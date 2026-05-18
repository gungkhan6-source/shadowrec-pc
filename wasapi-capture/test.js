const wasapi = require('./index.js')

try {
  const info = wasapi.initialize()
  console.log('Başlatıldı:', info)
  
  wasapi.start()
  console.log('Kayıt başladı...')
  
  setTimeout(() => {
    const data = wasapi.getData()
    console.log('Veri boyutu:', data.length, 'byte')
    wasapi.stop()
    wasapi.cleanup()
    console.log('Tamam!')
  }, 5000)
} catch(e) {
  console.error('Hata:', e.message)
}