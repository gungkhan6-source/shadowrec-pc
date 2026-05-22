import React, { useState, useEffect } from 'react'
import { useLang } from '../i18n'

const QUALITIES = ['720p 30fps','1080p 30fps','1080p 60fps','1440p 60fps']
const BITRATES  = ['2500','4000','6000','8000','12000']

export default function LivePage() {
  const { t } = useLang()
  
  // PLATFORMS - "Custom RTMP" label çevirilebilir
  const PLATFORMS = [
    { id:'youtube', label:'YouTube',         color:'#ff0000', icon:'▶', rtmp:'rtmp://a.rtmp.youtube.com/live2/' },
    { id:'twitch',  label:'Twitch',          color:'#9146ff', icon:'◈', rtmp:'rtmp://live.twitch.tv/app/' },
    { id:'custom',  label:t('custom_rtmp'),  color:'#00c8ff', icon:'⚡', rtmp:'' },
  ]
  
  const [platform, setPlatform]   = useState('youtube')
  const [streamKey, setStreamKey] = useState('')
  const [customRtmp, setCustomRtmp] = useState('')
  const [quality, setQuality]     = useState('1080p 60fps')
  const [bitrate, setBitrate]     = useState('6000')
  const [micOn, setMicOn]         = useState(true)
  const [micDevices, setMicDevices] = useState([])
  const [selMic, setSelMic] = useState(null)
  const [isLive, setIsLive]       = useState(false)
  const [seconds, setSeconds]     = useState(0)
  const [viewers, setViewers]     = useState(0)
  const [log, setLog]             = useState('')
  const [showKey, setShowKey]     = useState(false)
  const api = window.novaRec

  useEffect(() => {
    api?.getAudioDevices?.().then(devices => {
      setMicDevices(devices || [])
      if (devices?.length) {
        const first = devices[0]
        setSelMic(typeof first === 'object' ? first.name : first)
      }
     })
  }, [])

  useEffect(() => {
    let t
    if (isLive) {
      t = setInterval(() => {
        setSeconds(s => s + 1)
        setViewers(v => Math.max(0, v + Math.floor(Math.random()*3 - 1)))
      }, 1000)
    } else {
      setSeconds(0); setViewers(0)
    }
    return () => clearInterval(t)
  }, [isLive])

  useEffect(() => {
    api?.onRecordingLog?.((msg) => setLog(msg))
  }, [])

  const fmt = s => `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`

  const selPlat = PLATFORMS.find(p => p.id === platform)
  const rtmpUrl = platform === 'custom' ? customRtmp : selPlat.rtmp
  const fullUrl = rtmpUrl + streamKey

  const handleGoLive = async () => {
    if (!streamKey && platform !== 'custom') return alert(t('stream_key_required'))
    if (platform === 'custom' && !customRtmp) return alert(t('rtmp_required'))
    const [q, fps] = quality.split(' ')
    const result = await api?.startRecording?.({
      quality: q, fps: parseInt(fps), format:'mp4',
      savePath: null,
      micEnabled: micOn,
      micDevice: selMic,
      rtmpUrl: fullUrl,
      isLive: true,
      bitrate: parseInt(bitrate),
    })
    if (result?.success) setIsLive(true)
  }

  const handleStop = async () => {
    await api?.stopRecording?.()
    setIsLive(false)
  }

  return (
    <div style={{ height:'100%', display:'flex', overflow:'hidden' }}>

      {/* Sol: Platform + Ayarlar */}
      <div style={{
        width:320, padding:16,
        borderRight:'1px solid rgba(0,200,255,0.08)',
        display:'flex', flexDirection:'column', gap:10,
        overflowY:'auto', flexShrink:0,
      }}>
        <SLabel>{t('platform')}</SLabel>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {PLATFORMS.map(p => (
            <button key={p.id} onClick={() => !isLive && setPlatform(p.id)}
              className={platform===p.id ? 'rb-border' : ''}
              style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'10px 12px',
                background: platform===p.id ? `${p.color}15` : 'rgba(255,255,255,0.03)',
                border: platform===p.id ? undefined : '1px solid rgba(255,255,255,0.06)',
                borderRadius:8, cursor: isLive ? 'not-allowed' : 'pointer',
                textAlign:'left', transition:'all 0.15s',
              }}>
              <span style={{ fontSize:20, color:p.color }}>{p.icon}</span>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color: platform===p.id ? p.color : 'var(--text-dim)' }}>{p.label}</div>
                {platform===p.id && p.id !== 'custom' && (
                  <div style={{ fontSize:9, color:'var(--text-dim)', opacity:0.6 }}>{p.rtmp}...</div>
                )}
              </div>
              {platform===p.id && <span style={{ marginLeft:'auto', color:p.color }}>✓</span>}
            </button>
          ))}
        </div>

        {/* Custom RTMP */}
        {platform === 'custom' && (
          <>
            <SLabel>{t('rtmp_address')}</SLabel>
            <input value={customRtmp} onChange={e => setCustomRtmp(e.target.value)}
              placeholder="rtmp://..."
              disabled={isLive}
              style={{
                background:'rgba(0,0,0,0.5)', border:'1px solid rgba(0,200,255,0.25)',
                borderRadius:7, padding:'7px 10px', color:'var(--cyan)',
                fontSize:11, outline:'none', width:'100%',
              }} />
          </>
        )}

        {/* Stream Key */}
        {platform !== 'custom' && (
          <>
            <SLabel>{t('stream_key')}</SLabel>
            <div style={{ position:'relative' }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={streamKey}
                onChange={e => setStreamKey(e.target.value)}
                placeholder={`${selPlat.label} stream key...`}
                disabled={isLive}
                style={{
                  background:'rgba(0,0,0,0.5)', border:'1px solid rgba(0,200,255,0.25)',
                  borderRadius:7, padding:'7px 36px 7px 10px',
                  color:'var(--cyan)', fontSize:11, outline:'none', width:'100%',
                }} />
              <button onClick={() => setShowKey(!showKey)}
                style={{
                  position:'absolute', right:8, top:'50%', transform:'translateY(-50%)',
                  background:'none', border:'none', color:'var(--text-dim)',
                  cursor:'pointer', fontSize:12,
                }}>{showKey ? '🙈' : '👁'}</button>
            </div>
            <div style={{ fontSize:9, color:'var(--text-dim)', opacity:0.6 }}>
              {platform==='youtube' ? t('stream_key_yt') : t('stream_key_tw')}
            </div>
          </>
        )}

        <div style={{ height:1, background:'rgba(0,200,255,0.06)' }} />
        <SLabel>{t('quality')}</SLabel>
        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
          {QUALITIES.map(q => (
            <button key={q} onClick={() => !isLive && setQuality(q)}
              className={quality===q ? 'rb-border' : ''}
              style={{
                padding:'6px 10px',
                background: quality===q ? 'rgba(0,200,255,0.08)' : 'rgba(255,255,255,0.03)',
                border: quality===q ? undefined : '1px solid rgba(255,255,255,0.06)',
                borderRadius:6, color: quality===q ? 'var(--cyan)' : 'var(--text-dim)',
                fontSize:11, cursor: isLive ? 'not-allowed' : 'pointer',
                textAlign:'left', transition:'all 0.15s',
              }}>{q}</button>
          ))}
        </div>

        <SLabel>{t('video_bitrate')}</SLabel>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {BITRATES.map(b => (
            <button key={b} onClick={() => !isLive && setBitrate(b)}
              className={bitrate===b ? 'rb-bg' : ''}
              style={{
                padding:'5px 8px', flex:1,
                background: bitrate===b ? undefined : 'rgba(255,255,255,0.03)',
                border: bitrate===b ? undefined : '1px solid rgba(255,255,255,0.06)',
                borderRadius:6, color: bitrate===b ? undefined : 'var(--text-dim)',
                fontSize:10, cursor: isLive ? 'not-allowed' : 'pointer',
              }}>{b}</button>
          ))}
        </div>

        <div style={{ height:1, background:'rgba(0,200,255,0.06)' }} />
        <Toggle label={t('microphone')} value={micOn} onChange={setMicOn} disabled={isLive} />
        {micOn && micDevices.length > 0 && (
  <>
    <SLabel>{t('audio_device')}</SLabel>
    <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
      {micDevices.map(d => {
        const name = typeof d === 'object' ? d.name : d
        const selected = selMic === name
        return (
          <button key={name} onClick={() => !isLive && setSelMic(name)}
            className={selected ? 'rb-border' : ''}
            style={{
              display:'flex', alignItems:'center', gap:8,
              padding:'7px 10px',
              background: selected ? 'rgba(0,200,255,0.08)' : 'rgba(255,255,255,0.03)',
              border: selected ? undefined : '1px solid rgba(255,255,255,0.06)',
              borderRadius:7, cursor: isLive ? 'not-allowed' : 'pointer',
              textAlign:'left',
            }}>
            <span style={{ fontSize:12 }}>
              {name.toLowerCase().includes('rz') || name.toLowerCase().includes('razer') ? '🎮' : '🎤'}
            </span>
            <span style={{ fontSize:10, color: selected ? 'var(--cyan)' : 'var(--text-dim)' }}>
              {name}
            </span>
            {selected && <span style={{ marginLeft:'auto', color:'var(--cyan)', fontSize:11 }}>✓</span>}
          </button>
        )
      })}
    </div>
  </>
)}
      </div>
      
      {/* Sağ: Yayın kontrolü */}
      <div style={{
        flex:1, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
        gap:20, padding:24, position:'relative', overflow:'hidden',
      }}>
        {/* Arka plan PNG */}
        <div style={{
          position:'absolute', inset:0,
          backgroundImage:`url(${process.env.PUBLIC_URL}/bg.png)`,
          backgroundSize:'100% 100%', zIndex:0,
        }} />

        {/* Platform logosu büyük */}
        <div style={{ zIndex:1, textAlign:'center' }}>
          <div style={{ fontSize:60, marginBottom:8 }}>{selPlat.icon}</div>
          <div style={{ fontFamily:'var(--font-display)', fontSize:18, color:selPlat.color, letterSpacing:3 }}>
            {selPlat.label.toUpperCase()}
          </div>
          {isLive && (
            <div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'center', marginTop:8 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:'#ff4455', animation:'pulse-red 1s infinite' }} />
              <span style={{ fontFamily:'var(--font-display)', fontSize:14, color:'#ff4455' }}>{t('on_air')}</span>
            </div>
          )}
        </div>

        {/* Stats */}
        {isLive && (
          <div style={{ display:'flex', gap:16, zIndex:1 }}>
            {[
              { l:t('duration'), v:fmt(seconds),       c:'#00c8ff' },
              { l:t('quality'),  v:quality,             c:'#9b5cf6' },
              { l:t('bitrate'),  v:bitrate+'k',         c:'#ff8c00' },
            ].map(s => (
              <div key={s.l} style={{
                background:'rgba(0,0,0,0.6)',
                border:'1px solid rgba(255,255,255,0.1)',
                borderRadius:8, padding:'8px 16px', textAlign:'center',
              }}>
                <div style={{ fontSize:8, color:'var(--text-dim)', letterSpacing:2, fontFamily:'var(--font-display)' }}>{s.l}</div>
                <div style={{ fontSize:14, fontWeight:600, color:s.c, marginTop:2 }}>{s.v}</div>
              </div>
            ))}
          </div>
        )}

        {/* Go Live button */}
        <button onClick={isLive ? handleStop : handleGoLive}
          className={isLive ? '' : 'rb-border'}
          style={{
            zIndex:1, width:160, height:56,
            background: isLive ? 'rgba(255,68,85,0.15)' : 'rgba(0,0,0,0.5)',
            border: isLive ? '2px solid #ff4455' : undefined,
            borderRadius:12,
            color: isLive ? '#ff4455' : 'var(--cyan)',
            fontFamily:'var(--font-display)',
            fontSize:14, fontWeight:700, letterSpacing:3,
            cursor:'pointer', transition:'all 0.3s',
            animation: isLive ? 'pulse-red 2s infinite' : undefined,
          }}>
          {isLive ? '⏹ ' + t('stop_live') : '📡 ' + t('go_live')}
        </button>

        {/* Log */}
        {log && (
          <div style={{
            zIndex:1, maxWidth:500, width:'100%',
            background:'rgba(0,0,0,0.7)',
            border:'1px solid rgba(255,255,255,0.08)',
            borderRadius:8, padding:'8px 12px',
            fontSize:9, color:'var(--text-dim)',
            fontFamily:'monospace', maxHeight:60, overflow:'hidden',
          }}>{log}</div>
        )}
      </div>
    </div>
  )
}

function SLabel({ children }) {
  return (
    <div style={{ fontSize:8, letterSpacing:2, color:'var(--text-dim)', fontFamily:'var(--font-display)', fontWeight:700 }}>
      {children}
    </div>
  )
}

function Toggle({ label, value, onChange, disabled }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 0' }}>
      <span className="rb" style={{ fontSize:11 }}>{label}</span>
      <div onClick={() => !disabled && onChange(!value)} style={{
        width:38, height:21, borderRadius:11,
        background: value ? 'rgba(0,200,255,0.2)' : 'rgba(255,255,255,0.06)',
        border:`1px solid ${value ? 'rgba(0,200,255,0.5)' : 'rgba(255,255,255,0.1)'}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        position:'relative', transition:'all 0.2s',
      }}>
        <div style={{
          position:'absolute', top:3, left: value ? 19 : 3,
          width:13, height:13, borderRadius:'50%',
          background: value ? 'var(--cyan)' : 'rgba(255,255,255,0.3)',
          transition:'left 0.2s',
        }} />
      </div>
    </div>
  )
}
