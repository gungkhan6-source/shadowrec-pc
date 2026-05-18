import React, { useState, useEffect } from 'react'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import RecorderPage from './pages/RecorderPage'
import ConverterPage from './pages/ConverterPage'
import SettingsPage from './pages/SettingsPage'
import LivePage from './pages/LivePage'

export default function App() {
  const [page, setPage] = useState('recorder')
  const [settings, setSettings] = useState({
    savePath: 'C:\\Videos\\ShadowRec',
    format: 'mp4',
    gpu: true,
  })

  // Ayarları başlangıçta yükle
  useEffect(() => {
    const load = async () => {
      const api = window.shadowRec
      if (!api) return
      const savePath = await api.loadSetting('savePath', 'C:\\Videos\\ShadowRec')
      const format   = await api.loadSetting('format', 'mp4')
      const gpu      = await api.loadSetting('gpu', true)
      setSettings({ savePath, format, gpu })
    }
    load()
  }, [])

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh' }}>
      <TitleBar />
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        <Sidebar current={page} onChange={setPage} />
        <main style={{ flex:1, overflow:'hidden', animation:'fade-in 0.3s ease' }}>
          {page === 'recorder'  && <RecorderPage settings={settings} />}
          {page === 'converter' && <ConverterPage />}
          {page === 'live'      && <LivePage />}
          {page === 'settings'  && (
            <SettingsPage
              onSettingsChange={(s) => setSettings(prev => ({ ...prev, ...s }))}
            />
          )}
        </main>
      </div>
    </div>
  )
}
