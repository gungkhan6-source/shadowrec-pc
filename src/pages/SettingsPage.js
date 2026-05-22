import React, { useState, useEffect } from 'react'
import { useLang, LANGUAGES } from '../i18n'

export default function SettingsPage({ onSettingsChange }) {
  const api = window.novaRec || window.shadowRec
  const { lang, setLang, t } = useLang()
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
    { id:'recording', label: t('tab_recording') },
    { id:'stream',    label: t('tab_stream') },
    { id:'audio',     label: t('tab_audio') },
    { id:'language',  label: t('tab_language') },
    { id:'about',     label: t('tab_about') },
  ]

  const TWITCH_SERVERS = [
    { id:'live.twitch.tv',         label:'Auto (Recommended)' },
    { id:'live-fra.twitch.tv',     label:'Frankfurt, DE' },
    { id:'live-ams.twitch.tv',     label:'Amsterdam, NL' },
    { id:'live-lhr.twitch.tv',     label:'London, UK' },
  ]

  useEffect(() => {
    const load = async () => {
      if (!api) return
      setSavePath(await api.loadSetting('savePath','C:\\Videos\\NovaRec') || '')
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
        {TABS.map(tabItem => (
          <button key={tabItem.id} onClick={() => setTab(tabItem.id)}
            className={tab===tabItem.id ? 'rb-border' : ''}
            style={{
              padding:'6px 16px',
              background: tab===tabItem.id ? 'rgba(0,200,255,0.08)' : 'transparent',
              border: tab===tabItem.id ? undefined : '1px solid transparent',
              borderRadius:'6px 6px 0 0',
              color: tab===tabItem.id ? 'var(--cyan)' : 'var(--text-dim)',
              fontFamily:'var(--font-display)', fontSize:9, letterSpacing:2,
              cursor:'pointer', transition:'all 0.15s',
            }}>{tabItem.label}</button>
        ))}
      </div>

      {/* İçerik */}
      <div style={{ flex:1, overflowY:'auto', padding:20 }}>

        {/* RECORDING SETTINGS */}
        {tab === 'recording' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14, maxWidth:560 }}>
            <SGroup title={t('section_save_folder')}>
              <SRow label={t('record_folder')} desc={t('record_folder_desc')}>
                <div style={{ display:'flex', gap:6, flex:1 }}>
                  <div style={{
                    flex:1, background:'rgba(0,0,0,0.5)',
                    border:'1px solid rgba(0,200,255,0.2)',
                    borderRadius:7, padding:'6px 10px',
                    fontSize:11, color:'var(--text-dim)',
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                  }}>{savePath || t('not_set')}</div>
                  <CyBtn onClick={async () => { const f = await api?.selectFolder(); if(f) setSavePath(f) }}>📂 {t('select_folder')}</CyBtn>
                  <CyBtn onClick={() => savePath && api?.openFolder(savePath)}>↗</CyBtn>
                </div>
              </SRow>
            </SGroup>

            <SGroup title={t('section_format')}>
              <SRow label={t('default_format')} desc={t('default_format_desc')}>
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
              <SRow label={t('gpu_encode')} desc={t('gpu_encode_desc')}>
                <Toggle value={gpu} onChange={setGpu} />
              </SRow>
            </SGroup>
          </div>
        )}

        {/* STREAMING SETTINGS */}
        {tab === 'stream' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14, maxWidth:560 }}>

            <SGroup title={t('section_youtube')}>
              <SRow label={t('stream_key')} desc={t('stream_key_yt')}>
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

            <SGroup title={t('section_twitch')}>
              <SRow label={t('stream_key')} desc={t('stream_key_tw')}>
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
              <SRow label={t('twitch_server')} desc="">
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

            <SGroup title={t('section_defaults')}>
              <SRow label={t('default_platform')} desc="">
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
              <SRow label={t('default_bitrate')} desc="kbps">
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
              <SRow label={t('default_quality')} desc="">
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
              <SRow label={t('low_latency')} desc="Twitch ultra-low latency">
                <Toggle value={lowLatency} onChange={setLowLatency} />
              </SRow>
              <SRow label={t('auto_record')} desc="Local MP4">
                <Toggle value={autoRecord} onChange={setAutoRecord} />
              </SRow>
            </SGroup>

          </div>
        )}

        {/* AUDIO SETTINGS */}
        {tab === 'audio' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14, maxWidth:560 }}>
            <SGroup title={t('section_mic')}>
              <SRow label={t('mic_boost')} desc={`${micBoost}%`}>
                <input type="range" min="50" max="200" value={micBoost}
                  onChange={e => setMicBoost(Number(e.target.value))}
                  style={{ width:140, accentColor:'var(--cyan)' }} />
              </SRow>
              <SRow label={t('echo_cancel')} desc="">
                <Toggle value={echoCancel} onChange={setEchoCancel} />
              </SRow>
            </SGroup>
            <SGroup title={t('section_processing')}>
              <SRow label={t('audio')} desc="kbps">
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

        {/* LANGUAGE */}
        {tab === 'language' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14, maxWidth:600 }}>
            <SGroup title={t('language').toUpperCase()}>
              <SRow label={t('language')} desc={t('language_desc')}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, width:'100%' }}>
                  {LANGUAGES.map(L => {
                    const active = lang === L.id
                    return (
                      <button key={L.id} onClick={() => setLang(L.id)}
                        className={active ? 'rb-border' : ''}
                        style={{
                          display:'flex', alignItems:'center', gap:10,
                          padding:'10px 14px',
                          background: active ? 'rgba(0,200,255,0.08)' : 'rgba(255,255,255,0.03)',
                          border: active ? undefined : '1px solid rgba(255,255,255,0.06)',
                          borderRadius:8,
                          color: active ? 'var(--cyan)' : 'var(--text-dim)',
                          fontSize:12, fontWeight: active ? 700 : 400,
                          cursor:'pointer', transition:'all 0.15s',
                          textAlign:'left',
                        }}>
                        <span style={{ fontSize:20 }}>{L.flag}</span>
                        <span style={{ flex:1 }}>{L.label}</span>
                        {active && <span>✓</span>}
                      </button>
                    )
                  })}
                </div>
              </SRow>
            </SGroup>
          </div>
        )}

        {/* ABOUT / HAKKINDA */}
        {tab === 'about' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16, maxWidth:480 }}>
            <div style={{
              padding:20, borderRadius:10,
              background:'rgba(0,0,0,0.4)',
              border:'1px solid rgba(0,200,255,0.1)',
            }}>
              <div className="rb" style={{ fontFamily:'var(--font-display)', fontSize:18, letterSpacing:4, marginBottom:8 }}>
                NOVAREC STUDIO
              </div>
              <div style={{ fontSize:12, color:'var(--text-dim)', marginBottom:4 }}>v1.0.0</div>
              <div style={{ fontSize:11, color:'var(--text-dim)', lineHeight:1.8 }}>
                Electron + React + FFmpeg<br/>
                Screen Recording · Video Converter · Live Streaming<br/>
                YouTube · Twitch · Custom RTMP
              </div>
            </div>
            <SGroup title="SYSTEM">
              <SRow label="FFmpeg" desc="Video engine">
                <span style={{ fontSize:10, color:'var(--green)' }}>✓ Ready</span>
              </SRow>
              <SRow label="GPU Encode" desc="NVENC/AMF">
                <span style={{ fontSize:10, color:'var(--cyan)' }}>h264_nvenc</span>
              </SRow>
            </SGroup>
          </div>
        )}
      </div>

      {/* Save button */}
      {tab !== 'about' && tab !== 'language' && (
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
            {saved ? '✅ ' + t('saved') : '💾 ' + t('save_settings')}
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
