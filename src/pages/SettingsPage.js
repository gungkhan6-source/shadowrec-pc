import React, { useState, useEffect } from 'react'

export default function SettingsPage({ onSettingsChange }) {
  const api = window.shadowRec
  const [tab, setTab] = useState('recording')

  // Kayıt ayarları
  const [savePath, setSavePath] = useState('')
  const [format, setFormat]     = useState('mp4')
  const [gpu, setGpu]           = useState(true)

  // Yayın ayarları
  const [ytKey, setYtKey]       = useState('')
  const [twKey, setTwKey]       = useState('')
  const [twServer, setTwServer] = useState('live.twitch.tv')
  const [defPlatform, setDefPlatform] = useState('youtube')
  const [defBitrate, setDefBitrate]   = useState('6000')
  const [defQuality, setDefQuality]   = useState('1080p 60fps')
  const [showYt, setShowYt]     = useState(false)
  const [showTw, setShowTw]     = useState(false)
  const [lowLatency, setLowLatency]   = useState(true)
  const [autoRecord, setAutoRecord]   = useState(false)

  // Ses ayarları
  const [micBoost, setMicBoost] = useState(100)
  const [echoCancel, setEchoCancel] = useState(false)

  const [saved, setSaved] = useState(false)

  const TABS = [
    { id:'recording', label:'KAYIT' },
    { id:'stream',    label:'YAYIN' },
    { id:'audio',     label:'SES' },
    { id:'about',     label:'HAKKINDA' },
  ]

  const TWITCH_SERVERS = [
    { id:'live.twitch.tv',         label:'Otomatik (Önerilen)' },
    { id:'live-fra.twitch.tv',     label:'Frankfurt, DE' },
    { id:'live-ams.twitch.tv',     label:'Amsterdam, NL' },
    { id:'live-lhr.twitch.tv',     label:'Londra, UK' },
  ]

  useEffect(() => {
    const load = async () => {
      if (!api) return
      setSavePath(await api.loadSetting('savePath','C:\\Videos\\ShadowRec') || '')
      setFormat(await api.loadSetting('format','mp4') || 'mp4')
      setGpu(await api.loadSetting('gpu', true))
      setYtKey(await api.loadSetting('ytKey','') || '')
      setTwKey(await api.loadSetting('twKey','') || '')
      setTwServer(await api.loadSetting('twServer','live.twitch.tv') || 'live.twitch.tv')
      setDefPlatform(await api.loadSetting('defPlatform','youtube') || 'youtube')
      setDefBitrate(await api.loadSetting('defBitrate','6000') || '6000')
      setDefQuality(await api.loadSetting('defQuality','1080p 60fps') || '1080p 60fps')
      setLowLatency(await api.loadSetting('lowLatency', true))
      setAutoRecord(await api.loadSetting('autoRecord', false))
      setMicBoost(await api.loadSetting('micBoost', 100))
      setEchoCancel(await api.loadSetting('echoCancel', false))
    }
    load()
  }, [])

  const handleSave = async () => {
    await api?.saveSetting('savePath', savePath)
    await api?.saveSetting('format', format)
    await api?.saveSetting('gpu', gpu)
    await api?.saveSetting('ytKey', ytKey)
    await api?.saveSetting('twKey', twKey)
    await api?.saveSetting('twServer', twServer)
    await api?.saveSetting('defPlatform', defPlatform)
    await api?.saveSetting('defBitrate', defBitrate)
    await api?.saveSetting('defQuality', defQuality)
    await api?.saveSetting('lowLatency', lowLatency)
    await api?.saveSetting('autoRecord', autoRecord)
    await api?.saveSetting('micBoost', micBoost)
    await api?.saveSetting('echoCancel', echoCancel)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onSettingsChange?.({ savePath, format, gpu })
  }

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden' }}>

      {/* Tab bar */}
      <div style={{
        display:'flex', gap:2, padding:'10px 16px 0',
        borderBottom:'1px solid rgba(0,200,255,0.08)',
        flexShrink:0,
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={tab===t.id ? 'rb-border' : ''}
            style={{
              padding:'6px 16px',
              background: tab===t.id ? 'rgba(0,200,255,0.08)' : 'transparent',
              border: tab===t.id ? undefined : '1px solid transparent',
              borderRadius:'6px 6px 0 0',
              color: tab===t.id ? 'var(--cyan)' : 'var(--text-dim)',
              fontFamily:'var(--font-display)', fontSize:9, letterSpacing:2,
              cursor:'pointer', transition:'all 0.15s',
            }}>{t.label}</button>
        ))}
      </div>

      {/* İçerik */}
      <div style={{ flex:1, overflowY:'auto', padding:20 }}>

        {/* KAYIT AYARLARI */}
        {tab === 'recording' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14, maxWidth:560 }}>
            <SGroup title="KAYIT KLASÖRÜ">
              <SRow label="Kayıt klasörü" desc="Videoların kaydedileceği yer">
                <div style={{ display:'flex', gap:6, flex:1 }}>
                  <div style={{
                    flex:1, background:'rgba(0,0,0,0.5)',
                    border:'1px solid rgba(0,200,255,0.2)',
                    borderRadius:7, padding:'6px 10px',
                    fontSize:11, color:'var(--text-dim)',
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                  }}>{savePath || 'Seçilmedi'}</div>
                  <CyBtn onClick={async () => { const f = await api?.selectFolder(); if(f) setSavePath(f) }}>📂 Seç</CyBtn>
                  <CyBtn onClick={() => savePath && api?.openFolder(savePath)}>↗</CyBtn>
                </div>
              </SRow>
            </SGroup>

            <SGroup title="FORMAT & KALİTE">
              <SRow label="Varsayılan format" desc="MP4 veya MKV">
                <div style={{ display:'flex', gap:6 }}>
                  {['mp4','mkv'].map(f => (
                    <button key={f} onClick={() => setFormat(f)}
                      className={format===f ? 'rb-bg' : ''}
                      style={{
                        padding:'6px 20px',
                        background: format===f ? undefined : 'rgba(255,255,255,0.04)',
                        border: format===f ? undefined : '1px solid rgba(255,255,255,0.08)',
                        borderRadius:7, cursor:'pointer',
                        color: format===f ? undefined : 'var(--text-dim)',
                        fontFamily:'var(--font-display)', fontSize:11,
                      }}>{f.toUpperCase()}</button>
                  ))}
                </div>
              </SRow>
              <SRow label="GPU Encode" desc="NVENC/AMF donanım encoder">
                <Toggle value={gpu} onChange={setGpu} />
              </SRow>
            </SGroup>
          </div>
        )}

        {/* YAYIN AYARLARI */}
        {tab === 'stream' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14, maxWidth:560 }}>

            <SGroup title="YOUTUBE CANLI YAYIN">
              <SRow label="Stream Key" desc="YouTube Studio → Canlı Yayın → Stream Key">
                <div style={{ display:'flex', gap:6, flex:1 }}>
                  <input
                    type={showYt ? 'text' : 'password'}
                    value={ytKey} onChange={e => setYtKey(e.target.value)}
                    placeholder="xxxx-xxxx-xxxx-xxxx"
                    style={{
                      flex:1, background:'rgba(0,0,0,0.5)',
                      border:'1px solid rgba(255,0,0,0.3)',
                      borderRadius:7, padding:'6px 10px',
                      color:'#ff6666', fontSize:11, outline:'none',
                    }} />
                  <CyBtn onClick={() => setShowYt(!showYt)}>{showYt ? '🙈' : '👁'}</CyBtn>
                </div>
              </SRow>
              <SRow label="RTMP Sunucu" desc="">
                <div style={{ fontSize:10, color:'var(--text-dim)', fontFamily:'monospace' }}>
                  rtmp://a.rtmp.youtube.com/live2/
                </div>
              </SRow>
            </SGroup>

            <SGroup title="TWITCH CANLI YAYIN">
              <SRow label="Stream Key" desc="Twitch.tv → Dashboard → Ayarlar → Stream Key">
                <div style={{ display:'flex', gap:6, flex:1 }}>
                  <input
                    type={showTw ? 'text' : 'password'}
                    value={twKey} onChange={e => setTwKey(e.target.value)}
                    placeholder="live_xxxxxxxxxx"
                    style={{
                      flex:1, background:'rgba(0,0,0,0.5)',
                      border:'1px solid rgba(145,70,255,0.4)',
                      borderRadius:7, padding:'6px 10px',
                      color:'#9b5cf6', fontSize:11, outline:'none',
                    }} />
                  <CyBtn onClick={() => setShowTw(!showTw)}>{showTw ? '🙈' : '👁'}</CyBtn>
                </div>
              </SRow>
              <SRow label="Twitch Sunucusu" desc="En yakın sunucuyu seç">
                <select value={twServer} onChange={e => setTwServer(e.target.value)}
                  style={{
                    background:'rgba(0,0,0,0.5)',
                    border:'1px solid rgba(145,70,255,0.3)',
                    borderRadius:7, padding:'6px 10px',
                    color:'#9b5cf6', fontSize:10, outline:'none',
                  }}>
                  {TWITCH_SERVERS.map(s => (
                    <option key={s.id} value={s.id} style={{ background:'#0d1525' }}>{s.label}</option>
                  ))}
                </select>
              </SRow>
            </SGroup>

            <SGroup title="YAYIN KALİTE AYARLARI">
              <SRow label="Varsayılan platform" desc="">
                <div style={{ display:'flex', gap:6 }}>
                  {['youtube','twitch'].map(p => (
                    <button key={p} onClick={() => setDefPlatform(p)}
                      className={defPlatform===p ? 'rb-bg' : ''}
                      style={{
                        padding:'5px 14px',
                        background: defPlatform===p ? undefined : 'rgba(255,255,255,0.04)',
                        border: defPlatform===p ? undefined : '1px solid rgba(255,255,255,0.08)',
                        borderRadius:7, cursor:'pointer',
                        color: defPlatform===p ? undefined : 'var(--text-dim)',
                        fontSize:10, textTransform:'capitalize',
                      }}>{p}</button>
                  ))}
                </div>
              </SRow>
              <SRow label="Varsayılan bitrate" desc="kbps">
                <select value={defBitrate} onChange={e => setDefBitrate(e.target.value)}
                  style={{
                    background:'rgba(0,0,0,0.5)',
                    border:'1px solid rgba(0,200,255,0.25)',
                    borderRadius:7, padding:'6px 10px',
                    color:'var(--cyan)', fontSize:10, outline:'none',
                  }}>
                  {['2500','4000','6000','8000','12000'].map(b => (
                    <option key={b} value={b} style={{ background:'#0d1525' }}>{b} kbps</option>
                  ))}
                </select>
              </SRow>
              <SRow label="Varsayılan kalite" desc="">
                <select value={defQuality} onChange={e => setDefQuality(e.target.value)}
                  style={{
                    background:'rgba(0,0,0,0.5)',
                    border:'1px solid rgba(0,200,255,0.25)',
                    borderRadius:7, padding:'6px 10px',
                    color:'var(--cyan)', fontSize:10, outline:'none',
                  }}>
                  {['720p 30fps','1080p 30fps','1080p 60fps','1440p 60fps'].map(q => (
                    <option key={q} value={q} style={{ background:'#0d1525' }}>{q}</option>
                  ))}
                </select>
              </SRow>
              <SRow label="Düşük gecikme modu" desc="Twitch ultra-low latency">
                <Toggle value={lowLatency} onChange={setLowLatency} />
              </SRow>
              <SRow label="Yayınla birlikte kaydet" desc="Yerel MP4 kaydı da yap">
                <Toggle value={autoRecord} onChange={setAutoRecord} />
              </SRow>
            </SGroup>

            {/* Yardım kutusu */}
            <div style={{
              padding:12, borderRadius:8,
              background:'rgba(0,200,255,0.04)',
              border:'1px solid rgba(0,200,255,0.1)',
              fontSize:10, color:'var(--text-dim)', lineHeight:1.6,
            }}>
              <div className="rb" style={{ fontFamily:'var(--font-display)', fontSize:8, letterSpacing:2, marginBottom:6 }}>
                STREAM KEY NASIL ALINIR?
              </div>
              <div>🔴 YouTube: studio.youtube.com → Sol menü "Canlı Yayın" → Stream anahtarı</div>
              <div style={{ marginTop:4 }}>🟣 Twitch: dashboard.twitch.tv → Ayarlar → Kanal → Birincil stream anahtarı</div>
            </div>
          </div>
        )}

        {/* SES AYARLARI */}
        {tab === 'audio' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14, maxWidth:560 }}>
            <SGroup title="MİKROFON">
              <SRow label="Mikrofon seviyesi" desc={`${micBoost}%`}>
                <input type="range" min="50" max="200" value={micBoost}
                  onChange={e => setMicBoost(Number(e.target.value))}
                  style={{ width:140, accentColor:'var(--cyan)' }} />
              </SRow>
              <SRow label="Eko giderme" desc="Hoparlör sesini filtrele">
                <Toggle value={echoCancel} onChange={setEchoCancel} />
              </SRow>
            </SGroup>
            <SGroup title="YAYIN SES BİTRATE">
              <SRow label="Ses kalitesi" desc="Yayın için ses bitrate">
                <div style={{ display:'flex', gap:4 }}>
                  {['96','128','192','320'].map(b => (
                    <button key={b}
                      className="rb-border"
                      style={{
                        padding:'5px 10px',
                        background:'rgba(0,0,0,0.4)',
                        borderRadius:6, cursor:'pointer',
                        color:'var(--cyan)', fontSize:10,
                      }}>{b}k</button>
                  ))}
                </div>
              </SRow>
            </SGroup>
          </div>
        )}

        {/* HAKKINDA */}
        {tab === 'about' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16, maxWidth:480 }}>
            <div style={{
              padding:20, borderRadius:10,
              background:'rgba(0,0,0,0.4)',
              border:'1px solid rgba(0,200,255,0.1)',
            }}>
              <div className="rb" style={{ fontFamily:'var(--font-display)', fontSize:18, letterSpacing:4, marginBottom:8 }}>
                SHADOWREC PC
              </div>
              <div style={{ fontSize:12, color:'var(--text-dim)', marginBottom:4 }}>v1.0.0</div>
              <div style={{ fontSize:11, color:'var(--text-dim)', lineHeight:1.8 }}>
                Electron + React + FFmpeg<br/>
                Ekran kaydı · Video converter · Canlı yayın<br/>
                YouTube · Twitch · Özel RTMP
              </div>
            </div>
            <SGroup title="SİSTEM">
              <SRow label="FFmpeg" desc="Video motoru">
                <span style={{ fontSize:10, color:'var(--green)' }}>✓ Hazır</span>
              </SRow>
              <SRow label="GPU Encode" desc="NVENC/AMF">
                <span style={{ fontSize:10, color:'var(--cyan)' }}>h264_nvenc</span>
              </SRow>
            </SGroup>
          </div>
        )}
      </div>

      {/* Kaydet */}
      {tab !== 'about' && (
        <div style={{ padding:'12px 20px', borderTop:'1px solid rgba(0,200,255,0.06)', flexShrink:0 }}>
          <button onClick={handleSave}
            className={saved ? '' : 'rb-border'}
            style={{
              width:'100%', padding:'11px',
              background: saved ? 'rgba(0,255,136,0.12)' : 'rgba(0,0,0,0.5)',
              border: saved ? '1px solid rgba(0,255,136,0.4)' : undefined,
              borderRadius:10,
              color: saved ? 'var(--green)' : undefined,
              fontFamily:'var(--font-display)',
              fontSize:11, fontWeight:700, letterSpacing:3,
              cursor:'pointer', transition:'all 0.3s',
            }}>
            {saved ? '✅ KAYDEDİLDİ' : '💾 AYARLARI KAYDET'}
          </button>
        </div>
      )}
    </div>
  )
}

function SGroup({ title, children }) {
  return (
    <div style={{
      background:'rgba(0,0,0,0.3)',
      border:'1px solid rgba(0,200,255,0.08)',
      borderRadius:10, overflow:'hidden',
    }}>
      <div className="rb" style={{
        padding:'7px 14px',
        background:'rgba(0,200,255,0.03)',
        borderBottom:'1px solid rgba(0,200,255,0.06)',
        fontSize:8, letterSpacing:2,
        fontFamily:'var(--font-display)',
      }}>{title}</div>
      <div style={{ padding:'4px 0' }}>{children}</div>
    </div>
  )
}

function SRow({ label, desc, children }) {
  return (
    <div style={{
      display:'flex', alignItems:'center',
      justifyContent:'space-between',
      padding:'9px 14px', gap:16,
    }}>
      <div>
        <div style={{ fontSize:12, color:'var(--text)' }}>{label}</div>
        {desc && <div style={{ fontSize:10, color:'var(--text-dim)', marginTop:1 }}>{desc}</div>}
      </div>
      {children}
    </div>
  )
}

function Toggle({ value, onChange }) {
  return (
    <div onClick={() => onChange(!value)} style={{
      width:40, height:22, borderRadius:11,
      background: value ? 'rgba(0,200,255,0.18)' : 'rgba(255,255,255,0.06)',
      border:`1px solid ${value ? 'rgba(0,200,255,0.5)' : 'rgba(255,255,255,0.1)'}`,
      cursor:'pointer', position:'relative', transition:'all 0.2s', flexShrink:0,
    }}>
      <div style={{
        position:'absolute', top:3, left: value ? 20 : 3,
        width:14, height:14, borderRadius:'50%',
        background: value ? 'var(--cyan)' : 'rgba(255,255,255,0.3)',
        transition:'left 0.2s',
        boxShadow: value ? '0 0 6px var(--cyan)' : 'none',
      }} />
    </div>
  )
}

function CyBtn({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="rb-border"
      style={{
        background:'rgba(0,0,0,0.4)',
        borderRadius:7, padding:'6px 12px',
        color:'var(--cyan)', fontSize:11,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        whiteSpace:'nowrap',
      }}>{children}</button>
  )
}
