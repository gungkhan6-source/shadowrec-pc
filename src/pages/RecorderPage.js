import React, { useState, useEffect, useRef } from 'react'
import { useLang } from '../i18n'

const QUALITIES = ['720p', '1080p', '1440p', '4K']
const FPS_OPT   = [30, 60]
const FORMATS   = ['mp4', 'mkv']

export default function RecorderPage({ settings }) {
  const { t } = useLang()
  const [isRecording, setIsRecording] = useState(false)
  const [seconds, setSeconds]         = useState(0)
  const [quality, setQuality]         = useState('1080p')
  const [fps, setFps]                 = useState(60)
  const [format, setFormat]           = useState('mp4')
  const [micOn, setMicOn]             = useState(false)
  const [micDevices, setMicDevices]   = useState([])
  const [selMic, setSelMic]           = useState(null)
  const [noiseLevel, setNoiseLevel]   = useState('off')
  const [sources, setSources]         = useState([])
  const [selSource, setSelSource]     = useState(null)
  const [lastOutput, setLastOutput]   = useState(null)
  const [log, setLog]                 = useState('')

  // ⭐ Game Capture (Phase 5)
  const [gameProcess, setGameProcess] = useState('test_app.exe')
  const [gameStatus, setGameStatus]   = useState('idle')  // 'idle' | 'running' | 'error'
  const [gameInfo, setGameInfo]       = useState('')
  
  // ⭐ Phase 7: Otomatik oyun tespiti
  const [detectedGames, setDetectedGames] = useState([])
  const [selectedGame, setSelectedGame]   = useState(null)
  const [showManual, setShowManual]       = useState(false)
  
  const timerRef = useRef(null)
  const api = window.novaRec

  // ⭐ Phase 7: Otomatik oyun tarama (her 3 saniyede)
  useEffect(() => {
    let mounted = true
    
    const scan = async () => {
      if (!api?.enumGames) return
      try {
        const result = await api.enumGames()
        if (!mounted) return
        if (result?.success && Array.isArray(result.games)) {
          setDetectedGames(result.games)
        }
      } catch (e) {
        console.error('enumGames error:', e)
      }
    }
    
    scan()  // İlk tarama
    const interval = setInterval(scan, 3000)  // 3 saniyede bir
    
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [api])

  // Kaynakları yükle
  useEffect(() => {
    api?.getSources?.().then(s => {
      setSources(s || [])
      if (s?.length) setSelSource(s[0])
    })
    // Mikrofon listesini yükle
    api?.getAudioDevices?.().then(devices => {
      setMicDevices(devices || [])
      if (devices?.length) setSelMic(devices[0].name)
    })
  }, [])

  // Log dinle
  useEffect(() => {
    api?.onRecordingLog?.((msg) => setLog(msg))
  }, [])

  // Sayaç
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } else {
      clearInterval(timerRef.current)
      setSeconds(0)
    }
    return () => clearInterval(timerRef.current)
  }, [isRecording])

  const fmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`

  const handleRecord = async () => {
    if (isRecording) {
      const result = await api?.stopRecording?.()
      setIsRecording(false)
      setGameStatus('idle')
      setGameInfo('')
      if (result?.outputPath) setLastOutput(result.outputPath)
    } else {
      const result = await api?.startRecording?.({
        quality, fps,
        format: format,
        savePath: settings?.savePath,
        micEnabled: micOn,
        micDevice: selMic,
        noiseLevel: noiseLevel === 'off' ? null : noiseLevel,
        gpu: settings?.gpu,
      })
      if (result?.success) {
        setIsRecording(true)
        setLastOutput(null)
      }
    }
  }

  // ⭐ Game Capture handler (DLL inject + shared memory pipeline)
  const handleGameCapture = async () => {
    if (isRecording) {
      // Aktif kayıt varsa durdur
      const result = await api?.stopRecording?.()
      setIsRecording(false)
      setGameStatus('idle')
      setGameInfo('')
      if (result?.outputPath) setLastOutput(result.outputPath)
      return
    }

    // ⭐ Phase 7: Seçilen oyundan veya manuel input'tan process adı al
    const processName = selectedGame?.exeName || gameProcess.trim()
    
    if (!processName) {
      setGameStatus('error')
      setGameInfo(t('pick_game_or_manual'))
      return
    }

    setGameStatus('running')
    setGameInfo(`Başlatılıyor: ${processName} (DLL inject)...`)

    // api.startGameRecording yoksa direkt ipcRenderer dene
    let result
    if (api?.startGameRecording) {
      result = await api.startGameRecording({
        processName,
        fps,
        quality,         // ⭐ YENİ: 720p/1080p/1440p/4K
        format,
        savePath: settings?.savePath,
      })
    } else if (window.require) {
      try {
        const { ipcRenderer } = window.require('electron')
        result = await ipcRenderer.invoke('start-game-recording', {
          processName,
          fps,
          quality,       // ⭐ YENİ
          format,
          savePath: settings?.savePath,
        })
      } catch (e) {
        result = { success: false, error: 'IPC köprüsü yok: ' + e.message }
      }
    } else {
      result = { success: false, error: 'api.startGameRecording yok ve window.require de yok' }
    }

    if (result?.success) {
      setIsRecording(true)
      setLastOutput(null)
      setGameInfo(`✅ ${t('capturing')}: ${result.width}x${result.height} @ ${result.fps}fps (${result.encoder})`)
    } else {
      setGameStatus('error')
      setGameInfo('❌ ' + (result?.error || 'Bilinmeyen hata'))
    }
  }

  const openLastFile = () => lastOutput && api?.openFile?.(lastOutput)
  const openFolder   = () => settings?.savePath && api?.openFolder?.(settings.savePath)

  return (
    <div style={{ height:'100%', display:'flex', overflow:'hidden' }}>

      {/* Sol: Kaynaklar + Ayarlar */}
      <div style={{
        width:260, padding:16,
        borderRight:'1px solid rgba(0,200,255,0.08)',
        display:'flex', flexDirection:'column', gap:10,
        overflowY:'auto', flexShrink:0,
      }}>
        <SLabel>{t('screen_source')}</SLabel>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {sources.length === 0 && (
            <div style={{ color:'var(--text-dim)', fontSize:11, padding:'6px 0' }}>
              {t('sources_loading')}
            </div>
          )}
          {sources.map(src => (
            <button key={src.id} onClick={() => setSelSource(src)} style={{
              background: selSource?.id === src.id
                ? 'rgba(0,200,255,0.1)' : 'rgba(255,255,255,0.03)',
              border:`1px solid ${selSource?.id === src.id
                ? 'rgba(0,200,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius:7, padding:'7px 10px',
              display:'flex', alignItems:'center', gap:8,
              cursor:'pointer', color:'var(--text)', textAlign:'left',
              transition:'all 0.15s',
            }}>
              {src.thumbnail && (
                <img src={src.thumbnail} alt=""
                  style={{ width:44, height:25, borderRadius:3, objectFit:'cover', flexShrink:0 }} />
              )}
              <span style={{ fontSize:10 }}>{src.name.slice(0,26)}</span>
            </button>
          ))}
        </div>

        <div style={{ height:1, background:'rgba(0,200,255,0.06)', margin:'4px 0' }} />
        <SLabel>{t('quality')}</SLabel>
        <SegCtrl options={QUALITIES} value={quality} onChange={setQuality} disabled={isRecording} />

        <SLabel>{t('fps')}</SLabel>
        <SegCtrl options={FPS_OPT} value={fps} onChange={setFps} disabled={isRecording} />

        <SLabel>{t('format')}</SLabel>
        <SegCtrl options={FORMATS} value={format} onChange={setFormat} disabled={isRecording} uppercase />

        <div style={{ height:1, background:'rgba(0,200,255,0.06)', margin:'4px 0' }} />
        <SLabel>{t('audio')}</SLabel>
        <Toggle label={t('microphone')} value={micOn} onChange={setMicOn} disabled={isRecording} />

        {/* Mic device selector */}
        {micOn && (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <SLabel>{t('audio_device')}</SLabel>
            {micDevices.length === 0 ? (
              <div style={{
                fontSize:10, color:'var(--text-dim)',
                padding:'8px', borderRadius:6,
                background:'rgba(255,255,255,0.03)',
                border:'1px solid rgba(255,255,255,0.06)',
              }}>
                {t("no_devices")}
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                {micDevices.map(d => {
                  const name = typeof d === 'string' ? d : d.name
                  const isBT = typeof d === 'object' ? d.bluetooth : false
                  const selected = selMic === name
                  return (
                    <button key={name}
                      onClick={() => !isRecording && setSelMic(name)}
                      style={{
                        display:'flex', alignItems:'center', gap:8,
                        padding:'7px 10px',
                        background: selected
                          ? isBT ? 'rgba(0,150,255,0.15)' : 'rgba(0,200,255,0.12)'
                          : 'rgba(255,255,255,0.03)',
                        border:`1px solid ${selected
                          ? isBT ? 'rgba(0,150,255,0.5)' : 'rgba(0,200,255,0.4)'
                          : 'rgba(255,255,255,0.06)'}`,
                        borderRadius:7, cursor: isRecording ? 'not-allowed' : 'pointer',
                        textAlign:'left', transition:'all 0.15s',
                      }}
                    >
                      <span style={{ fontSize:14 }}>{isBT ? '🎧' : '🎤'}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:10, color: selected ? 'var(--cyan)' : 'var(--text-dim)' }}>
                          {name}
                        </div>
                        {isBT && (
                          <div style={{ fontSize:8, color:'rgba(0,150,255,0.7)', marginTop:1 }}>
                            BLUETOOTH
                          </div>
                        )}
                      </div>
                      {selected && (
                        <span style={{ color: isBT ? '#0096ff' : 'var(--cyan)', fontSize:12 }}>✓</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Gürültü engelleme */}
            <SLabel>GÜRÜLTÜ ENGELLEME</SLabel>
            <div style={{ display:'flex', gap:4 }}>
              {[
                { id:'off',    label:'Kapalı', color:'var(--text-dim)' },
                { id:'light',  label:'Hafif',  color:'var(--green)' },
                { id:'medium', label:'Orta',   color:'var(--cyan)' },
                { id:'strong', label:'Güçlü',  color:'var(--purple)' },
              ].map(opt => (
                <button key={opt.id}
                  onClick={() => !isRecording && setNoiseLevel(opt.id)}
                  style={{
                    flex:1, padding:'5px 2px',
                    background: noiseLevel===opt.id ? `${opt.color}22` : 'rgba(255,255,255,0.03)',
                    border:`1px solid ${noiseLevel===opt.id ? opt.color : 'rgba(255,255,255,0.06)'}`,
                    borderRadius:6,
                    color: noiseLevel===opt.id ? opt.color : 'var(--text-dim)',
                    fontSize:9, fontWeight: noiseLevel===opt.id ? 700 : 400,
                    cursor: isRecording ? 'not-allowed' : 'pointer',
                    transition:'all 0.15s',
                  }}
                >{opt.label}</button>
              ))}
            </div>
          </div>
        )}

        {/* Format & Klasör bilgisi */}
        <div style={{ height:1, background:'rgba(0,200,255,0.06)', margin:'4px 0' }} />
        <SLabel>{t('record_info')}</SLabel>
        <div style={{
          background:'rgba(0,0,0,0.3)',
          border:'1px solid rgba(0,200,255,0.08)',
          borderRadius:7, padding:'8px 10px',
          fontSize:10, color:'var(--text-dim)',
          display:'flex', flexDirection:'column', gap:4,
        }}>
          <div>{t('format')}: <span style={{ color:'var(--cyan)' }}>{(settings?.format || 'mp4').toUpperCase()}</span></div>
          <div style={{ wordBreak:'break-all' }}>
            {t('folder_label')}: <span style={{ color:'var(--text-dim)', fontSize:9 }}>{settings?.savePath || t('not_set')}</span>
          </div>
        </div>
        <button onClick={openFolder} style={{
          background:'transparent',
          border:'1px solid rgba(0,200,255,0.15)',
          borderRadius:6, padding:'5px',
          color:'var(--text-dim)', fontSize:10,
          cursor:'pointer',
        }}>📂 {t('open_folder')}</button>
      </div>

      {/* Sağ: Önizleme + REC — PNG arka plan */}
      <div style={{
        flex:1, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
        gap:20, padding:24,
        position:'relative', overflow:'hidden',
      }}>
        {/* ⭐ Animated Inferno arka plan (bg.png yerine) */}
        <div className="inferno-bg" />
        <div className="inferno-sparks" />
        {/* Preview */}
        <div style={{
          width:'100%', maxWidth:640, aspectRatio:'16/9',
          background:'rgba(0,0,0,0.6)',
          border:`1px solid ${isRecording ? 'rgba(255,68,85,0.4)' : 'rgba(0,200,255,0.15)'}`,
          borderRadius:10,
          display:'flex', alignItems:'center', justifyContent:'center',
          position:'relative', overflow:'hidden', zIndex:1,
          transition:'border-color 0.3s',
          boxShadow: isRecording ? '0 0 20px rgba(255,68,85,0.15)' : 'none',
        }}>
          {selSource?.thumbnail ? (
            <img src={selSource.thumbnail} alt="preview"
              style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:9 }} />
          ) : (
            <span style={{ color:'var(--text-dim)', fontSize:12 }}>PREVIEW</span>
          )}

          {/* REC badge */}
          {isRecording && (
            <div style={{
              position:'absolute', top:10, left:10,
              display:'flex', alignItems:'center', gap:6,
              background:'rgba(0,0,0,0.75)',
              border:'1px solid var(--red)',
              borderRadius:6, padding:'4px 10px',
            }}>
              <div style={{
                width:8, height:8, borderRadius:'50%',
                background:'var(--red)',
                animation:'pulse-red 1s infinite',
              }} />
              <span style={{
                fontFamily:'var(--font-display)', fontSize:12, color:'var(--red)',
              }}>REC {fmt(seconds)}</span>
            </div>
          )}

          {/* Format badge */}
          <div style={{
            position:'absolute', bottom:10, right:10,
            background:'rgba(0,0,0,0.7)',
            border:'1px solid rgba(0,200,255,0.2)',
            borderRadius:5, padding:'2px 8px',
            fontSize:9, color:'var(--cyan)',
            fontFamily:'var(--font-display)',
          }}>
            {quality} · {fps}FPS · {format.toUpperCase()}
          </div>
        </div>

        {/* Ana REC butonu */}
        <button onClick={handleRecord} style={{
          width:110, height:110, borderRadius:'50%',
          zIndex:1,
          background: isRecording
            ? 'radial-gradient(circle, rgba(255,68,85,0.2), rgba(255,68,85,0.04))'
            : 'radial-gradient(circle, rgba(0,200,255,0.15), rgba(0,200,255,0.03))',
          border:`2px solid ${isRecording ? 'var(--red)' : 'var(--cyan)'}`,
          color: isRecording ? 'var(--red)' : 'var(--cyan)',
          fontFamily:'var(--font-display)',
          fontSize:12, fontWeight:700, letterSpacing:2,
          cursor:'pointer',
          display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center', gap:4,
          animation: isRecording ? 'pulse-red 2s infinite' : 'none',
          transition:'all 0.3s',
          boxShadow: isRecording
            ? '0 0 30px rgba(255,68,85,0.3)'
            : '0 0 20px rgba(0,200,255,0.1)',
        }}>
          <span style={{ fontSize:26 }}>{isRecording ? '⏹' : '⏺'}</span>
          <span>{isRecording ? t('stop_btn') : t('record_btn')}</span>
        </button>

        {/* Stats */}
        <div style={{ display:'flex', gap:12, zIndex:1 }}>
          {[
            { l:t('quality'),  v:quality },
            { l:t('fps'),      v:fps },
            { l:t('format'),   v:(settings?.format || 'MP4').toUpperCase() },
            { l:t('duration'), v:fmt(seconds) },
          ].map(s => (
            <div key={s.l} style={{
              background:'rgba(0,0,0,0.4)',
              border:'1px solid rgba(0,200,255,0.1)',
              borderRadius:8, padding:'6px 14px', textAlign:'center',
            }}>
              <div style={{ fontSize:8, color:'var(--text-dim)', letterSpacing:2, fontFamily:'var(--font-display)' }}>
                {s.l}
              </div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--cyan)', marginTop:2 }}>
                {s.v}
              </div>
            </div>
          ))}
        </div>

        {/* Son kayıt */}
        {lastOutput && (
          <div style={{
            display:'flex', alignItems:'center', gap:10,
            background:'rgba(0,255,136,0.06)',
            border:'1px solid rgba(0,255,136,0.2)',
            borderRadius:8, padding:'8px 14px',
            animation:'fade-in 0.3s ease',
          }}>
            <span style={{ fontSize:16 }}>✅</span>
            <div>
              <div style={{ fontSize:11, color:'var(--green)' }}>Kayıt tamamlandı</div>
              <div style={{ fontSize:9, color:'var(--text-dim)' }}>
                {lastOutput.split('\\').pop()}
              </div>
            </div>
            <button onClick={openLastFile} style={{
              background:'rgba(0,255,136,0.1)',
              border:'1px solid rgba(0,255,136,0.3)',
              borderRadius:6, padding:'4px 10px',
              color:'var(--green)', fontSize:10, cursor:'pointer',
            }}>▶ Aç</button>
          </div>
        )}

        {/* ⭐ Game Capture - Phase 5 + Phase 7 (Otomatik tespit) */}
        <div style={{
          background:'rgba(255,100,200,0.04)',
          border:'1px solid rgba(255,100,200,0.2)',
          borderRadius:10, padding:14, marginTop:8,
          position:'relative',
          zIndex: 10,
        }}>
          <div style={{
            display:'flex', alignItems:'center', gap:8, marginBottom:10,
          }}>
            <span style={{ fontSize:14 }}>🎮</span>
            <div style={{
              fontSize:9, letterSpacing:2, color:'rgba(255,100,200,0.9)',
              fontFamily:'var(--font-display)', fontWeight:700,
            }}>{t('game_capture_title')}</div>
            <div style={{
              fontSize:8, color:'var(--text-dim)', marginLeft:'auto',
            }}>{t('games_found', { n: detectedGames.length })}</div>
          </div>

          {/* Otomatik algılanan oyunlar listesi */}
          {detectedGames.length > 0 ? (
            <div style={{
              display:'flex', flexDirection:'column', gap:6, marginBottom:10,
              maxHeight:200, overflowY:'auto',
            }}>
              {detectedGames.map(game => {
                const isSelected = selectedGame?.pid === game.pid
                return (
                  <div
                    key={game.pid}
                    onClick={() => !isRecording && setSelectedGame(game)}
                    style={{
                      display:'flex', alignItems:'center', gap:10,
                      padding:'8px 10px',
                      background: isSelected
                        ? 'rgba(255,100,200,0.15)'
                        : 'rgba(0,0,0,0.25)',
                      border: `1px solid ${isSelected ? 'rgba(255,100,200,0.5)' : 'rgba(255,255,255,0.05)'}`,
                      borderRadius:6,
                      cursor: isRecording ? 'not-allowed' : 'pointer',
                      transition:'all 0.15s',
                      opacity: isRecording && !isSelected ? 0.4 : 1,
                    }}
                  >
                    <div style={{
                      fontSize:18,
                      filter: isSelected ? 'none' : 'grayscale(0.5)',
                    }}>🎯</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{
                        fontSize:12, fontWeight:600,
                        color: isSelected ? 'rgb(255,150,210)' : 'var(--text)',
                        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                      }}>
                        {game.windowTitle || game.exeName}
                      </div>
                      <div style={{
                        fontSize:9, color:'var(--text-dim)',
                        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                      }}>
                        {game.exeName} • {game.api} • {game.arch || (game.isWow64 ? 'x86' : 'x64')} • PID {game.pid}
                      </div>
                    </div>
                    {isSelected && (
                      <div style={{
                        fontSize:9, color:'rgb(255,100,200)',
                        background:'rgba(255,100,200,0.2)',
                        padding:'2px 6px', borderRadius:4,
                      }}>{t('selected_label')}</div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{
              padding:'12px 10px', marginBottom:10,
              background:'rgba(0,0,0,0.2)',
              border:'1px dashed rgba(255,255,255,0.1)',
              borderRadius:6,
              fontSize:11, color:'var(--text-dim)',
              textAlign:'center',
            }}>
              {t('no_games_running')}
            </div>
          )}

          {/* Manual mode toggle */}
          <div style={{
            display:'flex', alignItems:'center', gap:8, marginBottom:10,
          }}>
            <button
              onClick={() => setShowManual(!showManual)}
              style={{
                background:'transparent', border:'none',
                color:'var(--text-dim)', fontSize:10,
                cursor:'pointer', padding:0,
              }}
            >
              {showManual ? '▼' : '▶'} {t('manual_process_toggle')}
            </button>
          </div>

          {showManual && (
            <div style={{ display:'flex', gap:6, marginBottom:10 }}>
              <input
                type="text"
                value={gameProcess}
                onChange={e => {
                  setGameProcess(e.target.value)
                  setSelectedGame(null)
                }}
                placeholder="game.exe"
                disabled={isRecording}
                style={{
                  flex:1,
                  background:'rgba(0,0,0,0.3)',
                  border:'1px solid rgba(255,100,200,0.2)',
                  borderRadius:6, padding:'7px 10px',
                  color:'var(--text)', fontSize:11,
                  outline:'none',
                }}
              />
            </div>
          )}

          {/* Capture / Stop button */}
          <button
            onClick={handleGameCapture}
            disabled={!isRecording && !selectedGame && !gameProcess.trim()}
            style={{
              width:'100%',
              background: isRecording
                ? 'rgba(255,80,80,0.15)'
                : (!selectedGame && !gameProcess.trim())
                  ? 'rgba(255,255,255,0.05)'
                  : 'rgba(255,100,200,0.15)',
              border: `1px solid ${
                isRecording
                  ? 'rgba(255,80,80,0.4)'
                  : (!selectedGame && !gameProcess.trim())
                    ? 'rgba(255,255,255,0.1)'
                    : 'rgba(255,100,200,0.4)'
              }`,
              borderRadius:6, padding:'10px',
              color: isRecording
                ? '#ff8080'
                : (!selectedGame && !gameProcess.trim())
                  ? 'var(--text-dim)'
                  : 'rgb(255,100,200)',
              fontSize:12, fontWeight:600,
              cursor: (!isRecording && !selectedGame && !gameProcess.trim()) ? 'not-allowed' : 'pointer',
            }}
          >
            {isRecording
              ? '⏹ ' + t('stop_capture')
              : selectedGame
                ? `🎮 ${selectedGame.windowTitle || selectedGame.exeName} - ${t('capture_label')}`
                : gameProcess.trim()
                  ? `🎮 ${gameProcess.trim()} - ${t('capture_manual')}`
                  : '🎮 ' + t('pick_a_game')
            }
          </button>

          {gameInfo && (
            <div style={{
              marginTop:8, padding:'6px 10px',
              background: gameStatus === 'error'
                ? 'rgba(255,80,80,0.08)'
                : 'rgba(0,255,136,0.06)',
              border: `1px solid ${gameStatus === 'error' ? 'rgba(255,80,80,0.2)' : 'rgba(0,255,136,0.2)'}`,
              borderRadius:6,
              fontSize:10,
              color: gameStatus === 'error' ? '#ff8080' : 'var(--green)',
            }}>
              {gameInfo}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SLabel({ children }) {
  // rainbow label
  return (
    <div style={{
      fontSize:8, letterSpacing:2, color:'var(--text-dim)',
      fontFamily:'var(--font-display)', fontWeight:700,
    }}>{children}</div>
  )
}

function SegCtrl({ options, value, onChange, disabled, uppercase }) {
  return (
    <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
      {options.map(opt => (
        <button key={opt} onClick={() => !disabled && onChange(opt)} style={{
          flex:1, padding:'5px 4px',
          background: value===opt ? 'rgba(0,200,255,0.15)' : 'rgba(255,255,255,0.03)',
          border:`1px solid ${value===opt ? 'rgba(0,200,255,0.5)' : 'rgba(255,255,255,0.06)'}`,
          borderRadius:6,
          color: disabled ? 'var(--text-dim)' : value===opt ? 'var(--cyan)' : 'var(--text-dim)',
          fontSize:10, fontWeight: value===opt ? 700 : 400,
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition:'all 0.15s', opacity: disabled && value!==opt ? 0.5 : 1,
        }}>{uppercase ? String(opt).toUpperCase() : opt}</button>
      ))}
    </div>
  )
}

function Toggle({ label, value, onChange, disabled }) {
  return (
    <div style={{
      display:'flex', alignItems:'center',
      justifyContent:'space-between', padding:'5px 0',
    }}>
      <span style={{ fontSize:11, color: value ? 'var(--text)' : 'var(--text-dim)' }}>{label}</span>
      <div onClick={() => !disabled && onChange(!value)} style={{
        width:36, height:20, borderRadius:10,
        background: value ? 'rgba(0,200,255,0.2)' : 'rgba(255,255,255,0.06)',
        border:`1px solid ${value ? 'rgba(0,200,255,0.5)' : 'rgba(255,255,255,0.1)'}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        position:'relative', transition:'all 0.2s',
        opacity: disabled ? 0.5 : 1,
      }}>
        <div style={{
          position:'absolute', top:2,
          left: value ? 18 : 2,
          width:14, height:14, borderRadius:'50%',
          background: value ? 'var(--cyan)' : 'rgba(255,255,255,0.3)',
          transition:'left 0.2s',
          boxShadow: value ? '0 0 6px var(--cyan)' : 'none',
        }} />
      </div>
    </div>
  )
}
