const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('shadowRec', {
  // Pencere
  minimize:  () => ipcRenderer.send('window-minimize'),
  maximize:  () => ipcRenderer.send('window-maximize'),
  close:     () => ipcRenderer.send('window-close'),

  // Kayıt
  getSources:       () => ipcRenderer.invoke('get-sources'),
  getAudioDevices:  () => ipcRenderer.invoke('get-audio-devices'),
  getSystemAudio: () => ipcRenderer.invoke('get-system-audio'),
  startRecording:   (opts) => ipcRenderer.invoke('start-recording', opts),
  startGameRecording: (opts) => ipcRenderer.invoke('start-game-recording', opts),
  stopRecording:    () => ipcRenderer.invoke('stop-recording'),
  isRecording:      () => ipcRenderer.invoke('is-recording'),
  onRecordingLog:   (cb) => ipcRenderer.on('recording-log', (_, d) => cb(d)),

  // Dosya/klasör
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectFile:   () => ipcRenderer.invoke('select-file'),
  openFile:     (p) => ipcRenderer.invoke('open-file', p),
  openFolder:   (p) => ipcRenderer.invoke('open-folder', p),

  // Converter
  convertVideo:       (opts) => ipcRenderer.invoke('convert-video', opts),
  onConvertProgress:  (cb) => ipcRenderer.on('convert-progress', (_, d) => cb(d)),

  // Settings kaydet/yükle
  saveSetting: (key, val) => ipcRenderer.invoke('save-setting', key, val),
  loadSetting: (key, def) => ipcRenderer.invoke('load-setting', key, def),
})
