import React, { useState, useRef } from 'react'
import { useLang } from '../i18n'

const FORMATS = ['MP4','MKV','WebM','GIF','MP3']
const SPEEDS  = ['0.5×','1×','1.5×','2×']

export default function ConverterPage() {
  const { t } = useLang()
  
  // PRESETS - label ve desc i18n'den
  const PRESETS = [
    { id:'source',     label:t('preset_source'),  emoji:'🔗', desc:t('preset_source_desc') },
    { id:'shorts',     label:t('preset_shorts'),  emoji:'📱', desc:t('preset_shorts_desc') },
    { id:'widescreen', label:t('preset_wide'),    emoji:'🎬', desc:t('preset_wide_desc') },
    { id:'4k',         label:t('preset_4k'),      emoji:'✨', desc:t('preset_4k_desc') },
    { id:'square',     label:t('preset_square'),  emoji:'⬜', desc:t('preset_square_desc') },
    { id:'720p',       label:t('preset_720p'),    emoji:'⚡', desc:t('preset_720p_desc') },
  ]
  
  const [inputFile, setInputFile] = useState(null)
  const [preset, setPreset]  = useState('widescreen')
  const [format, setFormat]  = useState('MP4')
  const [speed, setSpeed]    = useState('1×')
  const [mute, setMute]      = useState(false)
  const [status, setStatus]  = useState('idle') // idle|running|done|error
  const [progress, setProgress] = useState(0)
  const [log, setLog]        = useState('')
  const dropRef = useRef()
  const api = window.novaRec

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0]
    if (file) setInputFile({ name: file.name, path: file.path, size: file.size })
  }

  const handleConvert = async () => {
    if (!inputFile) return
    setStatus('running'); setProgress(0); setLog('')
    api?.onConvertProgress?.(data => {
      if (data && typeof data === 'object') {
        setProgress(data.progress || 0)
        setLog(data.log || '')
      }
    })
    const result = await api?.convertVideo?.({
      inputPath: inputFile.path,
      outputPath: inputFile.path.replace(/\.[^.]+$/, `_converted.${format.toLowerCase()}`),
      preset, format: format.toLowerCase(), speed: speed.replace('×',''),
      mute,
    })
    if (result?.success) { setStatus('done'); setProgress(100) }
    else { setStatus('error'); setLog(result?.error || 'Hata') }
  }

  return (
    <div style={{ height:'100%', display:'flex', gap:0, overflow:'hidden' }}>

      {/* Sol */}
      <div style={{
        width:320, padding:16,
        borderRight:'1px solid rgba(0,200,255,0.08)',
        display:'flex', flexDirection:'column', gap:12,
        overflowY:'auto',
      }}>
        <SectionLabel>{t('pick_video')}</SectionLabel>

        {/* Drop zone */}
        <div ref={dropRef}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => api?.selectFile?.().then(f => f && setInputFile(f))}
          style={{
            border:`2px dashed ${inputFile ? 'rgba(0,200,255,0.4)' : 'rgba(0,200,255,0.15)'}`,
            borderRadius:10, padding:20, textAlign:'center',
            background: inputFile ? 'rgba(0,200,255,0.05)' : 'transparent',
            cursor:'pointer', transition:'all 0.2s',
          }}>
          {inputFile ? (
            <>
              <div style={{ fontSize:24 }}>🎬</div>
              <div style={{ fontSize:11, color:'var(--cyan)', marginTop:4 }}>
                {inputFile.name.slice(0,32)}
              </div>
              <div style={{ fontSize:10, color:'var(--text-dim)', marginTop:2 }}>
                {(inputFile.size/1024/1024).toFixed(1)} MB
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize:28, opacity:0.4 }}>📂</div>
              <div style={{ fontSize:11, color:'var(--text-dim)', marginTop:6 }}>
                {t('drag_or_click')}
              </div>
              <div style={{ fontSize:10, color:'var(--text-dim)', opacity:0.5, marginTop:2 }}>
                {t('formats_hint')}
              </div>
            </>
          )}
        </div>

        <SectionLabel>{t('format')}</SectionLabel>
        <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
          {FORMATS.map(f => (
            <button key={f} onClick={() => setFormat(f)} style={{
              flex:'1 0 30%', padding:'7px 4px',
              background: format===f ? 'rgba(155,92,246,0.2)' : 'rgba(255,255,255,0.03)',
              border:`1px solid ${format===f ? 'rgba(155,92,246,0.6)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius:6, color: format===f ? 'var(--purple)' : 'var(--text-dim)',
              fontSize:11, fontWeight: format===f ? 700 : 400,
              cursor:'pointer', transition:'all 0.15s',
            }}>{f}</button>
          ))}
        </div>

        <SectionLabel>{t('speed')}</SectionLabel>
        <div style={{ display:'flex', gap:4 }}>
          {SPEEDS.map(s => (
            <button key={s} onClick={() => setSpeed(s)} style={{
              flex:1, padding:'7px 4px',
              background: speed===s ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.03)',
              border:`1px solid ${speed===s ? 'rgba(255,215,0,0.5)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius:6, color: speed===s ? 'var(--yellow)' : 'var(--text-dim)',
              fontSize:11, fontWeight: speed===s ? 700 : 400,
              cursor:'pointer', transition:'all 0.15s',
            }}>{s}</button>
          ))}
        </div>

        {/* Mute toggle */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'6px 0',
        }}>
          <span style={{ fontSize:12, color: mute ? 'var(--text)' : 'var(--text-dim)' }}>
            🔇 {t('mute_video')}
          </span>
          <div onClick={() => setMute(!mute)} style={{
            width:36, height:20, borderRadius:10,
            background: mute ? 'rgba(255,68,85,0.2)' : 'rgba(255,255,255,0.06)',
            border:`1px solid ${mute ? 'var(--red)' : 'rgba(255,255,255,0.1)'}`,
            cursor:'pointer', position:'relative', transition:'all 0.2s',
          }}>
            <div style={{
              position:'absolute', top:2, left: mute ? 18 : 2,
              width:14, height:14, borderRadius:'50%',
              background: mute ? 'var(--red)' : 'rgba(255,255,255,0.3)',
              transition:'left 0.2s',
            }} />
          </div>
        </div>
      </div>

      {/* Sağ */}
      <div style={{
        flex:1, padding:16,
        display:'flex', flexDirection:'column', gap:12,
        overflowY:'auto',
      }}>
        <SectionLabel>{t('output_size')}</SectionLabel>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {PRESETS.map(p => (
            <button key={p.id} onClick={() => setPreset(p.id)} style={{
              display:'flex', alignItems:'center', gap:10,
              padding:'10px 14px',
              background: preset===p.id ? 'rgba(0,200,255,0.1)' : 'rgba(255,255,255,0.02)',
              border:`1px solid ${preset===p.id ? 'rgba(0,200,255,0.4)' : 'rgba(255,255,255,0.05)'}`,
              borderRadius:8, cursor:'pointer', textAlign:'left',
              transition:'all 0.15s',
            }}>
              <span style={{ fontSize:18 }}>{p.emoji}</span>
              <div style={{ flex:1 }}>
                <div style={{
                  fontSize:12, fontWeight:600,
                  color: preset===p.id ? 'var(--text)' : 'var(--text-dim)',
                }}>{p.label}</div>
                <div style={{ fontSize:10, color:'var(--text-dim)', opacity:0.6 }}>{p.desc}</div>
              </div>
              {preset===p.id && (
                <span style={{ color:'var(--cyan)', fontSize:14 }}>✓</span>
              )}
            </button>
          ))}
        </div>

        <div style={{ marginTop:'auto' }}>
          {/* Progress */}
          {status === 'running' && (
            <div style={{ marginBottom:12 }}>
              <div style={{
                height:4, background:'rgba(255,255,255,0.06)',
                borderRadius:2, overflow:'hidden', marginBottom:6,
              }}>
                <div style={{
                  height:'100%', width:`${progress}%`,
                  background:'linear-gradient(90deg, var(--cyan), var(--purple))',
                  transition:'width 0.3s', borderRadius:2,
                }} />
              </div>
              <div style={{ fontSize:10, color:'var(--text-dim)' }}>
                {t('processing')} {progress}%
              </div>
            </div>
          )}

          {status === 'done' && (
            <div style={{
              padding:10, marginBottom:12, borderRadius:8,
              background:'rgba(0,255,136,0.08)',
              border:'1px solid rgba(0,255,136,0.3)',
              color:'var(--green)', fontSize:12,
            }}>{t('completed')}</div>
          )}

          {status === 'error' && (
            <div style={{
              padding:10, marginBottom:12, borderRadius:8,
              background:'rgba(255,68,85,0.08)',
              border:'1px solid rgba(255,68,85,0.3)',
              color:'var(--red)', fontSize:10,
            }}>{log.slice(-150)}</div>
          )}

          <button onClick={handleConvert}
            disabled={!inputFile || status === 'running'}
            style={{
              width:'100%', padding:'12px',
              background: !inputFile
                ? 'rgba(255,255,255,0.04)'
                : 'linear-gradient(135deg, rgba(0,200,255,0.2), rgba(155,92,246,0.2))',
              border:`1px solid ${!inputFile ? 'rgba(255,255,255,0.06)' : 'rgba(0,200,255,0.4)'}`,
              borderRadius:10,
              color: !inputFile ? 'var(--text-dim)' : 'var(--cyan)',
              fontFamily:'var(--font-display)',
              fontSize:12, fontWeight:700, letterSpacing:3,
              cursor: !inputFile ? 'not-allowed' : 'pointer',
              transition:'all 0.2s',
            }}>
            {status === 'running' ? '⏳ ' + t('processing') : '⚡ ' + t('convert_btn')}
          </button>
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize:9, letterSpacing:2, color:'var(--text-dim)',
      fontFamily:'var(--font-display)', fontWeight:700,
    }}>{children}</div>
  )
}
