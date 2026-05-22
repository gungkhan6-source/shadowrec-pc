const { app, BrowserWindow, ipcMain, desktopCapturer, dialog, shell, Menu, clipboard } = require('electron')
const path = require('path')
const isDev = require('electron-is-dev')
const { spawn } = require('child_process')
const fs = require('fs')
const os = require('os')
// wasapi-capture: opsiyonel native ses modülü (geliştirme aşamasında)
// Eğer modül yüklenemezse uygulama yine de çalışmaya devam eder
let wasapi = null
try {
  wasapi = require('../wasapi-capture/index.js')
} catch (e) {
  console.log('ℹ️  wasapi-capture yüklenmedi (opsiyonel):', e.message)
}
// ⭐ Hook DLL'leri ve Injector'lar - 64-bit ve 32-bit oyunlar için ayrı
const GAME_HOOK_DLL_X64 = 'F:\\game-capture\\hook\\build\\Release\\shadowrec_hook.dll'
const GAME_HOOK_DLL_X86 = 'F:\\game-capture\\hook\\build_x86\\Release\\shadowrec_hook.dll'
const INJECTOR_X64       = 'F:\\game-capture\\hook\\build\\Release\\injector.exe'
const INJECTOR_X86       = 'F:\\game-capture\\hook\\build_x86\\Release\\injector.exe'

// Geriye dönük uyumluluk
const GAME_HOOK_DLL = GAME_HOOK_DLL_X64

// ⭐ NATIVE CAPTURE — DXGI tabanlı kendi capture modülümüz
// Eski ddagrab/gdigrab oyunda frame üretmiyor, bu native modül çözüyor
const USE_NATIVE_CAPTURE = true  // false yaparsan eski sisteme döner
let nativeCapture = null
try {
  nativeCapture = require('../native/screen_capture')
  console.log('✅ Native capture modülü yüklendi (DXGI)')
} catch (err) {
  console.error('⚠️ Native capture yüklenemedi:', err.message)
  console.error('   Eski sistem (ddagrab/gdigrab) kullanılacak')
}

let mainWindow
let recordingProcess = null
let recordingOutput = null

// ⭐ Oyun yayını sırasında crash önleme
// Oyun fullscreen'e geçince Electron / FFmpeg hata fırlatabilir
// Bu handler'lar uygulamayı açık tutar, sadece logla geçer
process.on('uncaughtException', (err) => {
  console.error('🛡️ Yakalanan hata (uygulama kapanmıyor):', err.message)
  console.error('   Stack:', err.stack)
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('recording-error', {
        message: 'Hata: ' + err.message + ' (uygulama açık kalıyor)'
      })
    }
  } catch (e) { /* sessiz geç */ }
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('🛡️ Promise hatası (uygulama kapanmıyor):', reason)
})

// ── FFmpeg yolu ──────────────────────────────────────────────────
function getFFmpegPath() {
  const local = path.join(__dirname, '..', 'bin', 'ffmpeg.exe')
  if (fs.existsSync(local)) return local
  const local2 = path.join(process.resourcesPath || '', 'bin', 'ffmpeg.exe')
  if (fs.existsSync(local2)) return local2
  return 'ffmpeg'
}

// ── NVENC var mı? (cache'li kontrol) ─────────────────────────────
let _nvencCache = null
function checkNvenc() {
  return new Promise((resolve) => {
    if (_nvencCache !== null) return resolve(_nvencCache)
    const proc = spawn(getFFmpegPath(), ['-hide_banner', '-encoders'])
    let out = ''
    proc.stdout.on('data', d => out += d.toString())
    proc.on('close', () => {
      _nvencCache = out.includes('h264_nvenc')
      console.log('NVENC desteği:', _nvencCache)
      resolve(_nvencCache)
    })
    proc.on('error', () => { _nvencCache = false; resolve(false) })
  })
}

// ── ddagrab var mı? (FFmpeg sürüm kontrolü) ──────────────────────
let _ddagrabCache = null
function checkDdagrab() {
  return new Promise((resolve) => {
    if (_ddagrabCache !== null) return resolve(_ddagrabCache)
    const proc = spawn(getFFmpegPath(), ['-hide_banner', '-filters'])
    let out = ''
    proc.stdout.on('data', d => out += d.toString())
    proc.on('close', () => {
      _ddagrabCache = out.includes('ddagrab')
      console.log('ddagrab desteği:', _ddagrabCache)
      resolve(_ddagrabCache)
    })
    proc.on('error', () => { _ddagrabCache = false; resolve(false) })
  })
}

// ── Çözünürlük tablosu ───────────────────────────────────────────
function getResolution(quality) {
  return {
    '720p':  { w:1280, h:720  },
    '1080p': { w:1920, h:1080 },
    '1440p': { w:2560, h:1440 },
    '4K':    { w:3840, h:2160 },
  }[quality] || { w:1280, h:720 }
}

// ── YouTube Live için bitrate (kbps) ─────────────────────────────
function getLiveBitrate(quality, fps) {
  const high = fps >= 50
  return {
    '720p':  high ? 5000 : 3500,
    '1080p': high ? 6000 : 4500,
    '1440p': high ? 9000 : 6000,
    '4K':    high ? 20000 : 13000,
  }[quality] || 2500
}

// ── Bluetooth mikrofon mu? ───────────────────────────────────────
function isBluetoothMic(name) {
  if (!name) return false
  const n = name.toLowerCase()
  return ['handsfree','bluetooth','wireless','headset','airpod','buds']
    .some(k => n.includes(k))
}

// ── Pencere ──────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 760,
    minWidth: 900, minHeight: 600,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: false,
    skipTaskbar: false,
    show: false,  // ⭐ Önce gizli, hazır olunca göster (boş ekran flicker önlenir)
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  // ⭐ HTML yüklendiğinde pencereyi göster
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    mainWindow.focus()
  })
  
  // ⭐ Yükleme başarısız olursa logla (production debug için kritik)
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('❌ Pencere yüklenemedi:', errorCode, errorDescription, 'URL:', validatedURL)
    mainWindow.show()  // hata olsa bile pencereyi göster ki kullanıcı görsün
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  })

  mainWindow.webContents.session.setDisplayMediaRequestHandler((request, callback) => {
    callback({ video: mainWindow, audio: 'loopback' })
  })

  mainWindow.loadURL(
    isDev ? 'http://localhost:3000'
          : `file://${path.join(__dirname, '../build/index.html')}`
  )

  mainWindow.setAlwaysOnTop(false, 'screen-saver')

  mainWindow.webContents.on('context-menu', (_, props) => {
    const { editFlags, isEditable, selectionText } = props
    const menu = Menu.buildFromTemplate([
      { label: 'Kes',       role: 'cut',       enabled: isEditable && editFlags.canCut },
      { label: 'Kopyala',   role: 'copy',      enabled: editFlags.canCopy || selectionText.length > 0 },
      { label: 'Yapıştır',  role: 'paste',     enabled: isEditable && editFlags.canPaste },
      { type: 'separator' },
      { label: 'Tümünü Seç', role: 'selectAll', enabled: isEditable },
    ])
    menu.popup()
  })

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control || input.meta) {
      if (input.key === 'c') mainWindow.webContents.copy()
      if (input.key === 'v') mainWindow.webContents.paste()
      if (input.key === 'x') mainWindow.webContents.cut()
      if (input.key === 'a') mainWindow.webContents.selectAll()
      if (input.key === 'z') mainWindow.webContents.undo()
    }
  })

  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' })
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

// ── IPC: Pencere kontrol ─────────────────────────────────────────
ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize())
ipcMain.on('window-close',    () => {
  if (recordingProcess) {
    try { recordingProcess.stdin.write('q') } catch(e){}
    setTimeout(() => mainWindow?.close(), 1000)
  } else mainWindow?.close()
})

// ── IPC: Ekran kaynakları ────────────────────────────────────────
ipcMain.handle('get-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 180 }
  })
  return sources.map(s => ({
    id: s.id,
    name: s.name,
    thumbnail: s.thumbnail.toDataURL()
  }))
})

// ── IPC: Klasör seç ──────────────────────────────────────────────
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Kayıt klasörü seç'
  })
  if (result.canceled) return null
  return result.filePaths[0]
})

// ── IPC: Dosya seç ───────────────────────────────────────────────
ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Video seç',
    filters: [
      { name: 'Video', extensions: ['mp4','mkv','avi','mov','webm','wmv'] },
      { name: 'Tüm dosyalar', extensions: ['*'] }
    ],
    properties: ['openFile']
  })
  if (result.canceled) return null
  const filePath = result.filePaths[0]
  const stat = fs.statSync(filePath)
  return { path: filePath, name: path.basename(filePath), size: stat.size }
})

// ── IPC: Mikrofon listesi ────────────────────────────────────────
ipcMain.handle('get-audio-devices', async () => {
  const ffmpeg = getFFmpegPath()
  return new Promise((resolve) => {
    const proc = spawn(ffmpeg, ['-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'])
    let output = ''
    proc.stderr.on('data', d => { output += d.toString() })
    proc.on('close', () => {
      const devices = []
      const lines = output.split('\n')
      for (const line of lines) {
        if (line.includes('(audio)') && !line.includes('Alternative name')) {
          const m = line.match(/"([^"@][^"]*)"/)
          if (m) {
            const name = m[1]
            devices.push({ name, bluetooth: isBluetoothMic(name) })
          }
        }
      }
      console.log('Ses cihazları:', devices)
      resolve(devices)
    })
    setTimeout(() => { try { proc.kill() } catch(e){} }, 5000)
  })
})

// Gürültü engelleme filtresi
function buildNoiseFilter(level, isBluetooth) {
  const btFix = isBluetooth ? 'aresample=48000,volume=2.0,' : ''
  switch(level) {
    case 'light':  return `${btFix}highpass=f=100,lowpass=f=8000`
    case 'medium': return `${btFix}highpass=f=150,lowpass=f=7500,anlmdn`
    case 'strong': return `${btFix}highpass=f=200,lowpass=f=7000,anlmdn=s=7,volume=1.5`
    default:       return isBluetooth ? 'aresample=48000,volume=2.0' : null
  }
}

// ═══════════════════════════════════════════════════════════════════════
// NATIVE CAPTURE — YAYINI VE KAYIT İÇİN
// DXGI tabanlı kendi capture sistemimiz
// FFmpeg'e stdin pipe ile rawvideo gönderir
// ═══════════════════════════════════════════════════════════════════════
let nativeFrameLoop = null  // Frame loop'un timer referansı (durdurmak için)
let nativeCapturerInitialized = false

let nativeCaptureStopping = false  // captureLoop'un dönmesini durdurur

function stopNativeCapture() {
  nativeCaptureStopping = true  // ⭐ Loop bir sonraki turda kendini durdurur
  if (nativeFrameLoop) {
    clearTimeout(nativeFrameLoop)
    if (typeof nativeFrameLoop === 'object' && nativeFrameLoop._onImmediate) {
      clearImmediate(nativeFrameLoop)
    }
    nativeFrameLoop = null
  }
  if (nativeCapturerInitialized && nativeCapture) {
    try {
      nativeCapture.shutdown()
    } catch (e) {}
    nativeCapturerInitialized = false
  }
}

async function startNativeCapture(options, event, isLiveMode, outputTarget) {
  const {
    quality = '720p',
    fps = 30,
    micDevice,
    micEnabled,
    noiseLevel = 'off',
    bitrate
  } = options

  const targetFps = Math.min(Math.max(parseInt(fps) || 30, 24), 60)
  const ffmpeg = getFFmpegPath()
  const hasMic = !!(micEnabled && micDevice)
  const isBluetooth = hasMic && isBluetoothMic(micDevice)
  const nvencAvailable = await checkNvenc()
  const { w: outW, h: outH } = getResolution(quality)

  // 1. Native capturer'ı başlat (DXGI device)
  let captureInfo
  try {
    captureInfo = nativeCapture.initialize()
    nativeCapturerInitialized = true
    console.log(`✅ Native capturer hazır: ${captureInfo.width}x${captureInfo.height}`)
  } catch (err) {
    console.error('❌ Native capture initialize hatası:', err.message)
    return { success: false, error: 'native_init_failed', message: err.message }
  }

  const srcW = captureInfo.width
  const srcH = captureInfo.height

  // 2. Bitrate hesabı (live için Streamlabs ayarları)
  let kbps = bitrate ? parseInt(bitrate) : (isLiveMode ? 4500 : 6000)
  if (isLiveMode) {
    const safeMax = quality === '720p' ? 4500 : quality === '1080p' ? 6000 : quality === '1440p' ? 10000 : 18000
    const safeMin = quality === '720p' ? 3500 : quality === '1080p' ? 4500 : quality === '1440p' ? 6000 : 13000
    if (kbps > safeMax) kbps = safeMax
    if (kbps < safeMin) kbps = safeMin
  }
  const gop = targetFps * 2

  console.log('═══════════════════════════════════════')
  console.log(`🚀 NATIVE CAPTURE ${isLiveMode ? 'LIVE' : 'KAYIT'}`)
  console.log(`   Kaynak: ${srcW}x${srcH} (DXGI)`)
  console.log(`   Çıkış : ${outW}x${outH} @ ${targetFps}fps`)
  console.log(`   Bitrate: ${kbps}k`)
  console.log(`   Mode  : ${isLiveMode ? 'RTMPS Live' : 'MP4 Dosya'}`)
  console.log(`   Mikrofon: ${hasMic ? micDevice : 'YOK'}`)
  console.log('═══════════════════════════════════════')

  // 3. FFmpeg argümanlarını hazırla
  const args = [
    '-y',
    '-hide_banner',
    '-loglevel', 'warning',
    '-stats',
    // Video girişi: stdin'den raw bgra
    '-f', 'rawvideo',
    '-pixel_format', 'bgra',
    '-video_size', `${srcW}x${srcH}`,
    '-framerate', String(targetFps),
    '-thread_queue_size', '4096',
    '-i', 'pipe:0'
  ]

  // Ses girişi (mikrofon varsa dshow, yoksa sessiz anullsrc)
  if (hasMic) {
    args.push(
      '-thread_queue_size', '4096',
      '-rtbufsize', '128M',
      '-f', 'dshow',
      '-sample_rate', isBluetooth ? '16000' : '48000',
      '-use_wallclock_as_timestamps', '1',
      '-i', `audio=${micDevice}`
    )
  } else {
    // Mikrofon yoksa sessiz ses akışı (MP4 audio track için gerekli)
    args.push(
      '-f', 'lavfi',
      '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000'
    )
  }

  // Stream mapping: her zaman video + ses (mic veya null)
  args.push('-map', '0:v', '-map', '1:a')

  // Ölçekleme filtresi (kaynak çözünürlük != hedef ise)
  const needScale = srcW !== outW || srcH !== outH
  if (needScale) {
    args.push('-vf', `scale=${outW}:${outH}:flags=lanczos,format=yuv420p`)
  } else {
    args.push('-vf', 'format=yuv420p')
  }

  // Video encoder
  if (nvencAvailable) {
    // Streamlabs klonu (NVENC)
    args.push(
      '-c:v', 'h264_nvenc',
      '-preset', 'p5',
      '-tune', 'hq',
      '-multipass', 'fullres',
      '-rc', 'cbr',
      '-rc-lookahead', '8',
      '-spatial_aq', '1',
      '-temporal_aq', '1',
      '-aq-strength', '8',
      '-b:v', `${kbps}k`,
      '-maxrate', `${kbps}k`,
      '-bufsize', `${kbps}k`,
      '-profile:v', 'high',
      '-level', '4.2',
      '-g', String(gop),
      '-keyint_min', String(gop),
      '-bf', '2',
      '-b_ref_mode', 'disabled'
    )
  } else {
    // libx264 fallback
    args.push(
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-tune', 'zerolatency',
      '-profile:v', 'high',
      '-level', '4.2',
      '-b:v', `${kbps}k`,
      '-maxrate', `${kbps}k`,
      '-bufsize', `${kbps}k`,
      '-g', String(gop),
      '-keyint_min', String(gop),
      '-sc_threshold', '0',
      '-bf', '2',
      '-x264-params', 'nal-hrd=cbr:force-cfr=1'
    )
  }

  // Ses encoder (input zaten yukarıda eklendi - mic veya anullsrc)
  if (hasMic) {
    const noiseFilter = buildNoiseFilter(noiseLevel, isBluetooth)
    if (noiseFilter) args.push('-af', noiseFilter)
    args.push('-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2')
  } else {
    args.push(
      '-shortest',
      '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2'
    )
  }

  // Çıkış
  if (isLiveMode) {
    args.push(
      '-fps_mode', 'cfr',
      '-async', '1',
      '-max_delay', '0',
      '-max_muxing_queue_size', '1024',
      '-flush_packets', '1',
      '-f', 'flv',
      '-flvflags', 'no_duration_filesize',
      outputTarget
    )
  } else {
    args.push(
      '-fps_mode', 'cfr',
      '-movflags', '+faststart',
      outputTarget
    )
  }

  console.log('CMD:', ffmpeg, args.slice(0, 20).join(' '), '... (truncated)')

  // 4. FFmpeg'i başlat
  recordingProcess = spawn(ffmpeg, args, { stdio: ['pipe', 'pipe', 'pipe'] })
  recordingOutput = outputTarget

  recordingProcess.stderr.on('data', (data) => {
    const msg = data.toString()
    process.stdout.write(msg)
    event.sender.send('recording-log', msg.slice(-200))
  })

  recordingProcess.on('close', (code) => {
    console.log(`\n📁 FFmpeg kapandı (kod: ${code})`)
    stopNativeCapture()
    recordingProcess = null
    event.sender.send('recording-stopped', { code, outputPath: outputTarget })
  })

  recordingProcess.on('error', (err) => {
    console.error('❌ FFmpeg hatası:', err.message)
    stopNativeCapture()
    event.sender.send('recording-error', { message: err.message })
  })

  // 5. Frame loop başlat (30 FPS hedef)
  const FRAME_TIME_MS = 1000 / targetFps
  const startTime = Date.now()
  let nextFrameTime = startTime + FRAME_TIME_MS
  let lastBuffer = null
  let frameCount = 0
  nativeCaptureStopping = false  // ⭐ Loop başladı, durmadı

  function captureLoop() {
    // ⭐ Durdurma flag'i veya FFmpeg kapanmış mı kontrol
    if (nativeCaptureStopping || !recordingProcess || !recordingProcess.stdin.writable) {
      return
    }

    try {
      const result = nativeCapture.captureToBuffer()
      let bufferToWrite = null
      if (result.success) {
        bufferToWrite = result.buffer
        lastBuffer = result.buffer
      } else if (lastBuffer) {
        bufferToWrite = lastBuffer
      }

      if (bufferToWrite) {
        // ⭐ Yazmadan önce SON KONTROL — stop tam o an çağrılmış olabilir
        if (nativeCaptureStopping || !recordingProcess.stdin.writable) {
          return
        }
        const ok = recordingProcess.stdin.write(bufferToWrite)
        frameCount++
        if (!ok) {
          // Backpressure: drain bekle
          recordingProcess.stdin.once('drain', () => {
            if (!nativeCaptureStopping) scheduleNext()
          })
          return
        }
      }
    } catch (err) {
      // EPIPE, write after end vb — normal, sessiz geç
      return
    }

    scheduleNext()
  }

  function scheduleNext() {
    if (nativeCaptureStopping) return  // ⭐ Durdurulduysa schedule etme
    nextFrameTime += FRAME_TIME_MS
    const now = Date.now()
    const wait = nextFrameTime - now
    if (wait > 1) {
      nativeFrameLoop = setTimeout(captureLoop, wait)
    } else {
      nativeFrameLoop = setImmediate(captureLoop)
    }
  }

  setImmediate(captureLoop)

  return {
    success: true,
    outputPath: outputTarget,
    encoder: nvencAvailable ? 'nvenc' : 'x264',
    capture: 'native-dxgi'
  }
}

// ── IPC: Kayıt başlat ────────────────────────────────────────────
let gameCaptureLoop = null
let gameCaptureStopping = false

function stopGameCapture() {
  gameCaptureStopping = true
  if (gameCaptureLoop) {
    clearInterval(gameCaptureLoop)
    gameCaptureLoop = null
  }
  if (nativeCapture) {
    try { nativeCapture.gameCaptureStop() } catch(e){}
  }
}
ipcMain.handle('start-game-recording', async (event, options) => {
  const {
    processName,
    fps = 60,
    quality = '1080p',     // ⭐ YENİ: 720p / 1080p / 1440p / 4K / native
    savePath,
    format = 'mp4',
    bitrate
  } = options

  if (!nativeCapture) {
    return { success: false, error: 'Native capture modulu yuklenmedi' }  
  }

  // ⭐ Phase 8: Mimari tespit (32-bit / 64-bit)
  let isWow64 = false
  if (nativeCapture.getProcessArchitecture) {
    const archInfo = nativeCapture.getProcessArchitecture(processName)
    if (!archInfo.found) {
      return { success: false, error: archInfo.error || 'Process bulunamadi: ' + processName }
    }
    isWow64 = !!archInfo.isWow64
  }

  // Doğru DLL ve injector'ı seç
  const HOOK_DLL = isWow64 ? GAME_HOOK_DLL_X86 : GAME_HOOK_DLL_X64
  const INJECTOR = isWow64 ? INJECTOR_X86 : INJECTOR_X64
  const archLabel = isWow64 ? 'x86 (32-bit)' : 'x64 (64-bit)'

  if (!fs.existsSync(HOOK_DLL)) {
    return { success: false, error: `Hook DLL bulunamadi (${archLabel}): ` + HOOK_DLL }
  }

  console.log('═══════════════════════════════════════')
  console.log('🎮 GAME CAPTURE BAŞLATILIYOR')
  console.log(`   Process: ${processName}`)
  console.log(`   Mimari:  ${archLabel}`)
  console.log(`   DLL:     ${HOOK_DLL}`)
  console.log(`   Yöntem:  ${isWow64 ? '32-bit injector.exe spawn' : 'native gameCaptureStart inject'}`)
  console.log('═══════════════════════════════════════')

  // 32-bit ise: harici injector.exe spawn et (cross-arch çünkü Electron 64-bit)
  // 64-bit ise: native modülün kendi inject mantığı kullan
  let injectedPid = 0
  if (isWow64) {
    // 32-bit injector.exe spawn — cross-architecture inject çözümü
    if (!fs.existsSync(INJECTOR)) {
      return { success: false, error: '32-bit injector.exe bulunamadi: ' + INJECTOR }
    }
    
    const injResult = await new Promise((resolve) => {
      const proc = spawn(INJECTOR, [processName, HOOK_DLL], {
        windowsHide: true,
      })
      let stdout = ''
      let stderr = ''
      proc.stdout.on('data', d => { stdout += d.toString() })
      proc.stderr.on('data', d => { stderr += d.toString() })
      proc.on('close', (code) => {
        // injector.exe stdout'unda "PID=XXXXX" pattern var
        const pidMatch = stdout.match(/PID=(\d+)/)
        const pid = pidMatch ? parseInt(pidMatch[1]) : 0
        
        // ⭐ Başarı kriteri:
        // - exit code 0 VE "Injection tamamlandi" yazısı YA DA
        // - PID bulundu (process erişildi) — exit code/encoding nedeniyle çıktı bozulmuş olabilir
        //   Eğer T3 zaten inject edilmişse re-inject zararsız (LoadLibrary aynı DLL'i ikinci kez yüklemez).
        const explicitSuccess = code === 0 && /Injection tamamlandi/i.test(stdout)
        const pidFound = pid > 0 && /Process bulundu/i.test(stdout)
        
        resolve({
          success: explicitSuccess || pidFound,
          explicitSuccess,
          pidFound,
          pid,
          stdout,
          stderr,
          code,
        })
      })
      proc.on('error', (err) => {
        resolve({ success: false, error: err.message, stdout, stderr })
      })
    })
    
    if (!injResult.success) {
      return {
        success: false,
        error: '32-bit injector basarisiz oldu (code=' + injResult.code + '). ' +
               'Stdout: ' + injResult.stdout.slice(-200)
      }
    }
    
    injectedPid = injResult.pid
    if (injResult.explicitSuccess) {
      console.log(`✅ 32-bit inject başarili (injector.exe), PID=${injectedPid}`)
    } else {
      console.log(`⚠️  32-bit inject (code=${injResult.code}) - PID bulundu (${injectedPid}), devam ediliyor (re-inject zararsız)`)
    }
    
    // Native modülün SHM'ine bağlan ama inject YAPMASIN (zaten yapıldı)
    const attachResult = nativeCapture.gameCaptureStart(processName, HOOK_DLL, true)
    if (!attachResult.success) {
      return { success: false, error: 'SHM attach basarisiz: ' + (attachResult.error || '?') }
    }
  } else {
    // 64-bit: native modül kendi inject etsin
    const startResult = nativeCapture.gameCaptureStart(processName, HOOK_DLL, false)
    if (!startResult.success) {
      return startResult
    }
    injectedPid = startResult.pid
    console.log(`✅ 64-bit inject başarili (native), PID=${injectedPid}`)
  }
  
  // 2. İlk frame'i bekle (DLL hook kurulsun, boyutu öğren)
  await new Promise(r => setTimeout(r, 1500))

  let firstFrame = null
  for (let i = 0; i < 30; i++) {

    firstFrame = nativeCapture.gameCaptureRead(200)
    if (firstFrame.success) break
    await new Promise(r => setTimeout(r, 100))
  
  }
  
  if (!firstFrame || !firstFrame.success) {
     nativeCapture.gameCaptureStop()
     return { success: false, error: 'Oyundan frame gelmedi (hook çalismadi mi?)' }
  }

  const srcW = firstFrame.width
  const srcH = firstFrame.height
  // ⭐ Hook'tan gelen format: 0=BGRA, 1=RGBA
  const srcPixFmt = firstFrame.pixelFormat === 1 ? 'rgba' : 'bgra'
  console.log(`✅ İlk frame: ${srcW}x${srcH} (pixelFormat=${srcPixFmt})`)


  // 3. Output dosyasi
  const folder = savePath || path.join(os.homedir(), 'Videos', 'NovaRec')
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const ext = format === 'mkv' ? 'mkv' : 'mp4'
  const filename = path.join(folder, `NovaRec_Game_${ts}.${ext}`)
  
  // 4. FFmpeg başlat (bgra/rgba → H264 → MP4/MKV)
  const ffmpegPath = getFFmpegPath()
  const targetFps = Math.min(Math.max(parseInt(fps) || 60, 24), 60)
  const nvenc = await checkNvenc()
  
  // ⭐ Hedef çözünürlük (UI'dan gelen quality)
  // 'native' → oyunun kendi çözünürlüğü (scale yok)
  // Diğerleri → fixed scale
  const RES_MAP = {
    '720p':  { w: 1280, h: 720  },
    '1080p': { w: 1920, h: 1080 },
    '1440p': { w: 2560, h: 1440 },
    '4K':    { w: 3840, h: 2160 },
    'native': null,  // scale yok
  }
  const targetRes = RES_MAP[quality] || RES_MAP['1080p']
  const willScale = targetRes && (targetRes.w !== srcW || targetRes.h !== srcH)
  const outW = targetRes ? targetRes.w : srcW
  const outH = targetRes ? targetRes.h : srcH
  
  // ⭐ Kalite preset'i (bitrate) - quality + fps'e bağlı
  // 4K@60 daha fazla bitrate gerektirir, 720p@30 daha az
  let kbps = bitrate
  if (!kbps) {
    const QUALITY_BITRATE = {
      '720p':  targetFps >= 60 ? 4500  : 3000,
      '1080p': targetFps >= 60 ? 8000  : 5500,
      '1440p': targetFps >= 60 ? 16000 : 10000,
      '4K':    targetFps >= 60 ? 35000 : 22000,
      'native': targetFps >= 60 ? 8000  : 5500,  // 1080p varsayım
    }
    kbps = QUALITY_BITRATE[quality] || 8000
  }
  
  const gop = targetFps * 2
  
  // ⭐ Video filter chain — fps cap + scale + format
  // fps=N filter: girişten N FPS'ye düşürür (fazla frame'leri atar, eksik olanları korur)
  // Bu wallclock_as_timestamps ile birleşince gerçek-zamanlı hız sağlar
  const vfFilters = []
  vfFilters.push(`fps=${targetFps}`)  // ⭐ ÖNCE fps cap (oyun 125 FPS verirse 60'a düşür)
  if (willScale) {
    vfFilters.push(`scale=${outW}:${outH}:flags=lanczos`)
  }
  vfFilters.push('format=yuv420p')
  
  const args = [ 

    '-y', '-hide_banner', '-loglevel', 'warning', '-stats',
    '-use_wallclock_as_timestamps', '1',  // ⭐ Gerçek zamanlı timestamp (hız bozulmasını engeller)
    '-f', 'rawvideo',
    '-pixel_format', srcPixFmt,  // ⭐ Dinamik: bgra veya rgba
    '-video_size', `${srcW}x${srcH}`,
    '-framerate', String(targetFps),  // input hint (claim)
    '-thread_queue_size', '4096',
    '-i', 'pipe:0',
    '-f', 'lavfi',
    '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-map', '0:v', '-map', '1:a',
    '-vf', vfFilters.join(','),
  ]

  if (nvenc) {
    args.push(  
      '-c:v', 'h264_nvenc',
      '-preset', 'p5', '-tune', 'hq', '-rc', 'cbr',
      '-b:v', `${kbps}k`, '-maxrate', `${kbps}k`, '-bufsize', `${kbps}k`,
      '-profile:v', 'high', '-g', String(gop), '-bf', '2'
    )
  } else {
    args.push(

      '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'zerolatency',
      '-b:v', `${kbps}k`, '-maxrate', `${kbps}k`, '-bufsize', `${kbps}k`,
      '-g', String(gop)
    )
  }

  args.push(
    '-shortest',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
    '-fps_mode', 'cfr',
    '-movflags', '+faststart',
    filename
  )
  
  console.log(`🎬 FFmpeg: ${srcW}x${srcH}${willScale ? ` → ${outW}x${outH} (${quality})` : ` (native)`} @ ${targetFps}fps, ${kbps}k, encoder=${nvenc ? 'nvenc' : 'x264'}`)
  
  recordingProcess = spawn(ffmpegPath, args, { stdio: ['pipe', 'pipe', 'pipe'] })
  recordingOutput = filename
  	
  recordingProcess.stderr.on('data', (data) => {
    const msg = data.toString()
    process.stdout.write(msg)
    event.sender.send('recording-log', msg.slice(-200))
  })

  recordingProcess.on('close', (code) => {
    console.log(`📁 FFmpeg kapandı (kod: ${code})`)
    stopGameCapture()
    recordingProcess = null
    event.sender.send('recording-stopped', { code, outputPath: filename })
  })

  recordingProcess.on('error', (err) => {
    console.error('FFmpeg hatası:', err.message)
    stopGameCapture()
    event.sender.send('recording-error', { message: err.message })
  })
  
  // 5. Frame loop — Native'den oku, FFmpeg'e pipe
  gameCaptureStopping = false
  let lastBuffer = null
  let frameCount = 0

  gameCaptureLoop = setInterval(() => {
    if (gameCaptureStopping || !recordingProcess || !recordingProcess.stdin.writable) {
      return
    }
    try {
      const result = nativeCapture.gameCaptureRead(0)  // bloklamadan
      let bufferToWrite = null
     
      if (result.success) {
        bufferToWrite = result.buffer
        lastBuffer = result.buffer
      } else if (lastBuffer) {
        bufferToWrite = lastBuffer  // önceki frame'i tekrar gönder (FPS sabit kalsın)
      }

      if (bufferToWrite && !gameCaptureStopping) {
        recordingProcess.stdin.write(bufferToWrite)
        frameCount++
      }
    } catch(e) {
      // EPIPE vs sessiz geç
    }
  }, Math.floor(1000 / targetFps))
  
  return {
    success: true,
    outputPath: filename,
    width: srcW,
    height: srcH,
    fps: targetFps,
    encoder: nvenc ? 'nvenc' : 'x264',
    capture: 'game-dll-inject'
  }
})	
 
ipcMain.handle('start-recording', async (event, options) => {
  const {
    quality = '720p',
    fps = 30,
    rtmpUrl,
    isLive,
    micDevice,
    micEnabled,
    savePath,
    noiseLevel = 'off',
    format = 'mp4',
    bitrate             
  } = options

  // ═══════════════════════════════════════════════════════════════
  // ⭐ NATIVE CAPTURE YOLU (USE_NATIVE_CAPTURE=true ise)
  // DXGI tabanlı kendi capture sistemimiz - oyun yayını için
  // ═══════════════════════════════════════════════════════════════
  if (USE_NATIVE_CAPTURE && nativeCapture) {
    if (isLive && rtmpUrl) {
      // RTMPS dönüşümü (Streamlabs gibi)
      let liveUrl = rtmpUrl
      if (liveUrl.startsWith('rtmp://a.rtmp.youtube.com/')) {
        liveUrl = liveUrl.replace('rtmp://a.rtmp.youtube.com/', 'rtmps://a.rtmps.youtube.com:443/')
        console.log('🔒 RTMP → RTMPS (Native Capture)')
      } else if (liveUrl.startsWith('rtmp://b.rtmp.youtube.com/')) {
        liveUrl = liveUrl.replace('rtmp://b.rtmp.youtube.com/', 'rtmps://b.rtmps.youtube.com:443/')
      }
      return await startNativeCapture(options, event, true, liveUrl)
    } else if (!isLive) {
      // Dosya kaydı
      const folder = savePath || path.join(os.homedir(), 'Videos', 'NovaRec')
      if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true })
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const ext = format === 'mkv' ? 'mkv' : 'mp4'
      const filename = path.join(folder, `NovaRec_${ts}.${ext}`)
      return await startNativeCapture(options, event, false, filename)
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ESKİ YOL — ddagrab/gdigrab (USE_NATIVE_CAPTURE=false veya native yüklü değilse)
  // ═══════════════════════════════════════════════════════════════

  const { w, h } = getResolution(quality)
  const ffmpeg = getFFmpegPath()
  const hasMic = !!(micEnabled && micDevice)
  const isBluetooth = hasMic && isBluetoothMic(micDevice)
  const nvencAvailable = await checkNvenc()
  const ddagrabOk = await checkDdagrab()

  // ═══════════════════════════════════════════════════════════════
  // YOUTUBE LIVE / RTMP YAYIN — 720p@30 SLAYT FIX v3
  // ddagrab + libx264 (NVENC live'da kapalı, dosya kaydında açık)
  // ═══════════════════════════════════════════════════════════════
  if (isLive && rtmpUrl) {
    console.log('🔍 DEBUG options:', JSON.stringify(options))

    // ⭐ Otomatik RTMP → RTMPS dönüşümü (Streamlabs gibi, slayt fix)
    // RTMPS port 443 üzerinden gider, ISP throttle'ından etkilenmez
    let liveUrl = rtmpUrl
    if (liveUrl.startsWith('rtmp://a.rtmp.youtube.com/')) {
      liveUrl = liveUrl.replace('rtmp://a.rtmp.youtube.com/', 'rtmps://a.rtmps.youtube.com:443/')
      console.log('🔒 RTMP → RTMPS dönüştürüldü (kararlı yayın)')
    } else if (liveUrl.startsWith('rtmp://b.rtmp.youtube.com/')) {
      liveUrl = liveUrl.replace('rtmp://b.rtmp.youtube.com/', 'rtmps://b.rtmps.youtube.com:443/')
      console.log('🔒 RTMP → RTMPS dönüştürüldü (yedek sunucu)')
    }
    console.log('📡 Final URL:', liveUrl.replace(/\/[^/]+$/, '/***'))

    const targetFps = Math.min(Math.max(parseInt(fps) || 30, 24), 60)
    const liveQuality = quality || '720p'
    const { w: lw, h: lh } = getResolution(liveQuality)

    // Frontend bitrate gönderdiyse onu kullan, yoksa tabloya düş
    let kbps = bitrate ? parseInt(bitrate) : getLiveBitrate(liveQuality, targetFps)

    // VOD kalitesi için minimum bitrate (Streamlabs referans alındı)
    // 720p@30: 3500k, 1080p@30: 4500k, 1080p@60: 6000k, 1440p@60: 9000k
    const minLiveBitrate =
        liveQuality === '720p'  ? (targetFps >= 50 ? 4500 : 3500)
      : liveQuality === '1080p' ? (targetFps >= 50 ? 6000 : 4500)
      : liveQuality === '1440p' ? (targetFps >= 50 ? 9000 : 6000)
      :                            (targetFps >= 50 ? 20000 : 13000)
    if (kbps < minLiveBitrate) {
      console.log(`⚠️ Bitrate ${kbps}k düşük, VOD için ${minLiveBitrate}k'ya yükseltildi`)
      kbps = minLiveBitrate
    }

    // Güvenli üst sınır (upload bantını boğmasın)
    const safeMax =
        liveQuality === '720p'  ? (targetFps >= 50 ? 6000 : 4500)
      : liveQuality === '1080p' ? (targetFps >= 50 ? 9000 : 6000)
      : liveQuality === '1440p' ? (targetFps >= 50 ? 14000 : 10000)
      :                            (targetFps >= 50 ? 25000 : 18000)
    if (kbps > safeMax) {
      console.log(`⚠️ Bitrate ${kbps}k yüksek, ${safeMax}k'ya düşürüldü`)
      kbps = safeMax
    }
    console.log('🔍 kbps kaynağı:', bitrate ? `frontend → ${kbps}k` : `tablo → ${kbps}k`)

    const maxKbps = kbps
    const bufKbps = kbps                  // 1sn buffer
    const gop     = targetFps * 2         // 2sn keyframe (Streamlabs ve YouTube standardı)

    // Encoder seçimi: NVENC tercih (Streamlabs gibi), yoksa libx264
    const useNvenc = nvencAvailable
    // ⭐ OYUN FIX: ddagrab her durumda tercih (gdigrab fullscreen oyunda frame üretmiyor)
    // ddagrab + NVENC kombinasyonu artık hwdownload + yuv420p ile çalışıyor
    const useDdagrab = ddagrabOk

    console.log('═══════════════════════════════════════')
    console.log(`🔴 LIVE ${liveQuality}@${targetFps}fps - STREAMLABS KLONU`)
    console.log('   Çözünürlük :', `${lw}x${lh}`)
    console.log('   FPS        :', targetFps)
    console.log('   Bitrate    :', `${kbps}k (max ${maxKbps}k, buf ${bufKbps}k)`)
    console.log('   GOP        :', gop, '(2sn keyframe)')
    console.log('   Encoder    :', useNvenc ? 'NVENC (Streamlabs ayarları)' : 'libx264 (fallback)')
    console.log('   Capture    :', useDdagrab ? 'ddagrab (DirectX, oyun uyumlu)' : 'gdigrab (fallback)')
    console.log('   Mikrofon   :', hasMic ? micDevice : 'YOK')
    console.log('   Bluetooth  :', isBluetooth ? 'EVET' : 'HAYIR')
    console.log('═══════════════════════════════════════')

    // ── Ekran girişi ─────────────────────────────────────────
    const liveArgs = [
      '-y',
      '-hide_banner',
      '-loglevel', 'warning',
      '-stats',
      '-thread_queue_size', '4096',
      '-rtbufsize', '256M',
      '-probesize', '32M',
      '-analyzeduration', '0',
      '-fflags', 'nobuffer+flush_packets+genpts'
    ]

    // ddagrab varsa kullan (oyun yayını için zorunlu, yukarıda tanımlandı)
    if (useDdagrab) {
      liveArgs.push(
        '-f', 'lavfi',
        '-i', `ddagrab=output_idx=0:framerate=${targetFps}:draw_mouse=1:video_size=${lw}x${lh}:output_fmt=8bit`
      )
    } else {
      liveArgs.push(
        '-f', 'gdigrab',
        '-framerate', String(targetFps),
        '-draw_mouse', '1',
        '-use_wallclock_as_timestamps', '1',
        '-i', 'desktop'
      )
    }

    // ── Mikrofon girişi ──────────────────────────────────────
    if (hasMic) {
      liveArgs.push(
        '-thread_queue_size', '4096',
        '-rtbufsize', '128M',
        '-f', 'dshow',
        '-sample_rate', isBluetooth ? '16000' : '48000',
        '-use_wallclock_as_timestamps', '1',
        '-i', `audio=${micDevice}`
      )
    }

    // ── Map ──────────────────────────────────────────────────
    liveArgs.push('-map', '0:v')
    if (hasMic) liveArgs.push('-map', '1:a')

    // ── Video filtre zinciri ─────────────────────────────────
    const vfChain = useDdagrab
      ? `hwdownload,format=bgra,scale=${lw}:${lh}:flags=lanczos,format=yuv420p,fps=${targetFps}`
      : `scale=${lw}:${lh}:flags=lanczos,format=yuv420p,fps=${targetFps}`

    // ── Video encoder ────────────────────────────────────────
    if (useNvenc) {
      // STREAMLABS BIREBIR KLONU:
      // rate_control: CBR | preset: p5 | tuning: hq | multipass: fullres
      // profile: high | b-frames: 2 | lookahead: 8 | aq: true | keyint: gop
      liveArgs.push(
        '-c:v', 'h264_nvenc',
        '-preset', 'p5',                 // ⭐ Streamlabs: p5 (hızlı kalite)
        '-tune', 'hq',                   // ⭐ Streamlabs: hq (high quality)
        '-multipass', 'fullres',         // ⭐ Streamlabs: fullres (2-pass encode!)
        '-rc', 'cbr',                    // ⭐ Streamlabs: CBR
        '-rc-lookahead', '8',            // ⭐ Streamlabs: 8 frame lookahead
        '-spatial_aq', '1',              // ⭐ Streamlabs: AQ açık
        '-temporal_aq', '1',             // ⭐ Streamlabs: temporal AQ
        '-aq-strength', '8',             // AQ gücü (0-15, 8 dengeli)
        '-b:v', `${kbps}k`,
        '-maxrate', `${maxKbps}k`,
        '-bufsize', `${bufKbps}k`,
        '-pix_fmt', 'yuv420p',
        '-profile:v', 'high',            // ⭐ Streamlabs: high
        '-level', '4.2',                 // 1080p60 destek
        '-g', String(gop),
        '-keyint_min', String(gop),
        '-bf', '2',                      // ⭐ Streamlabs: 2 B-frame
        '-b_ref_mode', 'disabled',       // ⭐ Streamlabs: b-ref-mode 0
        '-vf', vfChain
      )
    } else {
      // libx264 fallback (NVENC yoksa)
      liveArgs.push(
        '-c:v', 'libx264',
        '-preset', 'faster',
        '-tune', 'zerolatency',
        '-profile:v', 'high',
        '-level', '4.2',
        '-pix_fmt', 'yuv420p',
        '-b:v', `${kbps}k`,
        '-maxrate', `${maxKbps}k`,
        '-bufsize', `${bufKbps}k`,
        '-g', String(gop),
        '-keyint_min', String(gop),
        '-sc_threshold', '0',
        '-bf', '2',
        '-refs', '3',
        '-x264-params', 'nal-hrd=cbr:force-cfr=1',
        '-vf', vfChain
      )
    }

    // ── Ses encoder ──────────────────────────────────────────
    if (hasMic) {
      const noiseFilter = buildNoiseFilter(noiseLevel, isBluetooth)
      const afChain = isBluetooth
        ? (noiseFilter ? `${noiseFilter},aresample=48000` : 'aresample=48000')
        : noiseFilter
      if (afChain) liveArgs.push('-af', afChain)
      liveArgs.push(
        '-c:a', 'aac',
        '-b:a', '160k',                  // Streamlabs: 160k AAC
        '-ar', '48000',
        '-ac', '2'
      )
    } else {
      liveArgs.push(
        '-f', 'lavfi',
        '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
        '-shortest',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ar', '48000',
        '-ac', '2'
      )
    }

    // ── Senkron + RTMP çıkış ─────────────────────────────────
    liveArgs.push(
      '-fps_mode', 'cfr',
      '-async', '1',
      '-max_delay', '0',
      '-max_muxing_queue_size', '1024',
      '-flush_packets', '1',
      '-f', 'flv',
      '-flvflags', 'no_duration_filesize',
      liveUrl
    )

    console.log('CMD:', ffmpeg, liveArgs.join(' '))

    recordingProcess = spawn(ffmpeg, liveArgs, { stdio: ['pipe', 'pipe', 'pipe'] })

    // ── Otonom monitör ───────────────────────────────────────
    let droppedFrames = 0
    let dupFrames = 0
    let lastSpeedWarn = 0

    recordingProcess.stderr.on('data', (data) => {
      const msg = data.toString()
      process.stdout.write(msg)

      const dropMatch = msg.match(/drop=\s*(\d+)/)
      if (dropMatch) {
        const newDrop = parseInt(dropMatch[1])
        if (newDrop > droppedFrames + 30) {
          console.warn('⚠️  FRAME DROP:', newDrop)
          event.sender.send('recording-warning', {
            type: 'drop',
            message: `Frame drop: ${newDrop}`
          })
          droppedFrames = newDrop
        }
      }

      const dupMatch = msg.match(/dup=\s*(\d+)/)
      if (dupMatch) {
        const newDup = parseInt(dupMatch[1])
        if (newDup > dupFrames + 60) {
          console.warn('⚠️  DUP FRAME ARTIYOR:', newDup)
          event.sender.send('recording-warning', {
            type: 'dup',
            message: `Dup frame: ${newDup}`
          })
          dupFrames = newDup
        }
      }

      const speedMatch = msg.match(/speed=\s*([\d.]+)x/)
      if (speedMatch) {
        const sp = parseFloat(speedMatch[1])
        const now = Date.now()
        if (sp < 0.95 && now - lastSpeedWarn > 5000) {
          console.warn(`⚠️  SPEED DÜŞÜK: ${sp}x`)
          event.sender.send('recording-warning', {
            type: 'speed',
            message: `Encoder yavaş: ${sp}x`
          })
          lastSpeedWarn = now
        }
      }

      event.sender.send('recording-log', msg.slice(-200))
    })

    recordingProcess.on('close', (code) => {
      console.log('RTMP kapandı, kod:', code)
      console.log(`   Final: drop=${droppedFrames}, dup=${dupFrames}`)
      recordingProcess = null
      event.sender.send('recording-stopped', { code, droppedFrames, dupFrames })
    })

    recordingProcess.on('error', (err) => {
      console.error('RTMP hata:', err)
      event.sender.send('recording-error', { message: err.message })
    })

    return {
      success: true,
      outputPath: liveUrl,
      encoder: useNvenc ? 'nvenc' : 'x264',
      capture: useDdagrab ? 'ddagrab' : 'gdigrab'
    }
  }


  // ═══════════════════════════════════════════════════════════════
  // DOSYAYA KAYIT (NVENC burada açık kalıyor)
  // ═══════════════════════════════════════════════════════════════
  const folder = savePath || path.join(os.homedir(), 'Videos', 'NovaRec')
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true })

  const ext = format === 'mkv' ? 'mkv' : 'mp4'
  const timestamp = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19)
  const outFile = path.join(folder, `NovaRec_${timestamp}.${ext}`)
  recordingOutput = outFile

  const targetFps = Math.min(Math.max(parseInt(fps) || 30, 24), 60)

  const args = [
    '-y',
    '-thread_queue_size', '1024',
    '-f', 'gdigrab',
    '-framerate', String(targetFps),
    '-draw_mouse', '1',
    '-i', 'desktop'
  ]

  if (hasMic) {
    args.push(
      '-thread_queue_size', '1024',
      '-f', 'dshow',
      '-sample_rate', isBluetooth ? '16000' : '48000',
      '-i', `audio=${micDevice}`
    )
  }

  args.push('-map', '0:v')
  if (hasMic) args.push('-map', '1:a')

  const fileBitrate = quality === '4K' ? '20M' : quality === '1440p' ? '12M' : quality === '1080p' ? '8M' : '5M'
  if (nvencAvailable) {
    args.push('-c:v', 'h264_nvenc', '-preset', 'p4', '-b:v', fileBitrate)
  } else {
    args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '20')
  }
  args.push('-vf', `scale=${w}:${h}`, '-pix_fmt', 'yuv420p')

  if (hasMic) {
    const noiseFilter = buildNoiseFilter(noiseLevel, isBluetooth)
    const afChain = isBluetooth
      ? (noiseFilter ? `${noiseFilter},aresample=48000` : 'aresample=48000')
      : noiseFilter
    if (afChain) args.push('-af', afChain)
    args.push('-c:a', 'aac', '-b:a', '192k', '-ar', '48000')
  } else {
    args.push('-an')
  }

  args.push(outFile)
  console.log('FFmpeg DOSYA KAYDI:', ffmpeg, args.join(' '))

  recordingProcess = spawn(ffmpeg, args, { stdio: ['pipe', 'pipe', 'pipe'] })
  recordingProcess.stderr.on('data', (data) => {
    const msg = data.toString()
    event.sender.send('recording-log', msg.slice(-150))
  })
  recordingProcess.on('close', (code) => {
    console.log('FFmpeg kapandı, kod:', code)
    recordingProcess = null
  })

  return { success: true, outputPath: outFile, encoder: nvencAvailable ? 'nvenc' : 'x264' }
})

// ── IPC: Kayıt durdur ────────────────────────────────────────────
ipcMain.handle('stop-recording', async () => {
  if (!recordingProcess) {
    stopNativeCapture()
    stopGameCapture()
    return { success: false, error: 'Kayıt yok' }
  }
  return new Promise((resolve) => {
    const proc = recordingProcess
    const outPath = recordingOutput

    // ⭐ ADIM 1: Frame loop'larını durdur (hem DXGI hem Game Capture)
    stopNativeCapture()
    stopGameCapture()

    // ⭐ ADIM 2: FFmpeg'in close event'ini dinle (MP4 footer yazılınca tetiklenir)
    let resolved = false
    const onClose = (code) => {
      if (resolved) return
      resolved = true
      console.log(`📁 Kayıt tamamlandı, kod: ${code}, dosya: ${outPath}`)
      resolve({ success: true, outputPath: outPath, code })
    }
    proc.once('close', onClose)

    // ⭐ ADIM 3: stdin'i nazikçe kapat (FFmpeg buffer'ı flushlasın ve MP4 footer yazsın)
    try {
      proc.stdin.end()
    } catch (e) {
      console.error('stdin.end hatası:', e.message)
    }

    // ⭐ ADIM 4: 10 saniye sonra hâlâ kapanmadıysa zorla kapat (MP4 büyükse finalize uzun sürebilir)
    setTimeout(() => {
      if (!resolved && proc.exitCode === null) {
        console.warn('⚠️ FFmpeg 10s\'de kapanmadı, SIGTERM gönderiliyor')
        try { proc.kill('SIGTERM') } catch(e){}
      }
    }, 10000)
  })
})

ipcMain.handle('is-recording', () => recordingProcess !== null)

// ⭐ Phase 7: Otomatik oyun tespiti
ipcMain.handle('enum-games', () => {
  if (!nativeCapture || !nativeCapture.enumGames) {
    return { success: false, error: 'enumGames fonksiyonu yok', games: [] }
  }
  try {
    const games = nativeCapture.enumGames()
    return { success: true, games }
  } catch (err) {
    return { success: false, error: err.message, games: [] }
  }
})

ipcMain.handle('open-file', async (_, filePath) => {
  await shell.openPath(filePath)
})

ipcMain.handle('open-folder', async (_, folderPath) => {
  await shell.openPath(folderPath)
})

// ── IPC: Video convert ───────────────────────────────────────────
ipcMain.handle('convert-video', async (event, options) => {
  const { inputPath, outputPath, preset, format, speed, mute, brightness, contrast } = options
  const ffmpeg = getFFmpegPath()

  const vfFilters = []
  if (preset === 'shorts')          vfFilters.push('scale=1080:1920,setsar=1')
  else if (preset === 'widescreen') vfFilters.push('scale=1920:1080,setsar=1')
  else if (preset === '4k')         vfFilters.push('scale=3840:2160,setsar=1')
  else if (preset === '720p')       vfFilters.push('scale=1280:720,setsar=1')
  else if (preset === 'square')     vfFilters.push('scale=1080:1080,setsar=1')

  if (speed && speed !== '1') vfFilters.push(`setpts=${1/parseFloat(speed)}*PTS`)
  if (brightness && Math.abs(brightness) > 0.01) vfFilters.push(`eq=brightness=${brightness}`)
  if (contrast && Math.abs(contrast - 1) > 0.01)  vfFilters.push(`eq=contrast=${contrast}`)

  const args = ['-y', '-i', inputPath]
  if (vfFilters.length) args.push('-vf', vfFilters.join(','))

  if (format === 'gif') {
    args.push('-loop', '0', '-r', '15')
  } else if (format === 'mp3') {
    args.push('-vn', '-c:a', 'mp3', '-b:a', '320k')
  } else if (preset === 'source' && !vfFilters.length) {
    args.push('-c:v', 'copy', '-c:a', 'copy')
  } else {
    args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '18')
    if (mute) args.push('-an')
    else args.push('-c:a', 'aac', '-b:a', '192k')
  }

  args.push(outputPath)

  return new Promise((resolve) => {
    const proc = spawn(ffmpeg, args)
    let stderr = ''
    let duration = 0

    proc.stderr.on('data', d => {
      const chunk = d.toString()
      stderr += chunk

      const durMatch = chunk.match(/Duration:\s+(\d+):(\d+):(\d+)\.(\d+)/)
      if (durMatch) {
        duration = parseInt(durMatch[1])*3600 + parseInt(durMatch[2])*60 +
                   parseInt(durMatch[3]) + parseInt(durMatch[4])/100
      }

      const timeMatch = chunk.match(/time=(\d+):(\d+):(\d+)\.(\d+)/)
      if (timeMatch && duration > 0) {
        const cur = parseInt(timeMatch[1])*3600 + parseInt(timeMatch[2])*60 +
                    parseInt(timeMatch[3]) + parseInt(timeMatch[4])/100
        const pct = Math.min(Math.floor((cur / duration) * 100), 99)
        event.sender.send('convert-progress', { progress: pct, log: chunk.slice(-100) })
      }
    })

    proc.on('close', code => {
      event.sender.send('convert-progress', { progress: 100, log: 'Tamamlandı' })
      resolve({ success: code === 0, error: code !== 0 ? stderr.slice(-300) : '' })
    })
  })
})

// ── IPC: Settings ────────────────────────────────────────────────
const settingsPath = path.join(app.getPath('userData'), 'settings.json')

function loadSettings() {
  try { return JSON.parse(fs.readFileSync(settingsPath, 'utf8')) }
  catch { return {} }
}
function saveSettings(data) {
  fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2))
}

ipcMain.handle('save-setting', (_, key, val) => {
  const s = loadSettings(); s[key] = val; saveSettings(s)
})
ipcMain.handle('load-setting', (_, key, def) => {
  const s = loadSettings(); return s[key] ?? def
})
