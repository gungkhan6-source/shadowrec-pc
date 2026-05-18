const path = require('path')
const native = require('./build/Release/wasapi_capture.node')

class WasapiLoopback {
  constructor() {
    this.initialized = false
    this.info = null
  }

  // Başlat — sistem ses bilgisini döndür
  initialize() {
    try {
      this.info = native.initialize()
      this.initialized = true
      return this.info
    } catch(e) {
      throw new Error('WASAPI init failed: ' + e.message)
    }
  }

  // Kayıt başlat
  start() {
    if (!this.initialized) this.initialize()
    return native.start()
  }

  // Ses verisi al (Buffer)
  getData() {
    return native.getData()
  }

  // Durdur
  stop() {
    native.stop()
  }

  // Temizle
  cleanup() {
    native.cleanup()
    this.initialized = false
  }

  // Bilgi
  getInfo() {
    return this.info
  }
}

module.exports = new WasapiLoopback()
