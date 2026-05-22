// NovaRec Studio - electron-builder react-cra preset redirect
// Bu dosya electron-builder'ın beklediği konumda yer alıyor.
// Asıl Electron main process kodu electron/main.js'te.
// React build sürecinde bu dosya build/electron.js olarak kopyalanır.

require('../electron/main.js')
