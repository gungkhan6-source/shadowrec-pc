import React from 'react'

const NAV = [
  { id:'recorder',  icon:'⏺', label:'REC' },
  { id:'converter', icon:'⚡', label:'CNV' },
  { id:'live',      icon:'📡', label:'LIVE' },
  { id:'settings',  icon:'⚙',  label:'SET' },
]

export default function Sidebar({ current, onChange }) {
  return (
    <div style={{
      width:72, background:'rgba(0,0,0,0.5)',
      borderRight:'1px solid rgba(0,200,255,0.08)',
      display:'flex', flexDirection:'column',
      alignItems:'center', paddingTop:16, gap:4, flexShrink:0,
    }}>
      {NAV.map(item => {
        const active = current === item.id
        return (
          <button key={item.id} onClick={() => onChange(item.id)} title={item.label}
            className={active ? 'rb-bg' : ''}
            style={{
              width:52, height:52,
              background: active ? undefined : 'transparent',
              border: active ? undefined : '1px solid transparent',
              borderRadius:10,
              color: active ? undefined : 'var(--text-dim)',
              fontSize:20,
              display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'center',
              gap:2, cursor:'pointer', transition:'all 0.2s',
              position:'relative',
            }}
            onMouseEnter={e => { if (!active) { e.currentTarget.style.background='rgba(0,200,255,0.08)'; e.currentTarget.style.color='var(--text)' }}}
            onMouseLeave={e => { if (!active) { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text-dim)' }}}
          >
            <span>{item.icon}</span>
            <span style={{ fontSize:6, letterSpacing:1, fontFamily:'var(--font-display)' }}>{item.label}</span>
            {active && (
              <div className="rb-line" style={{
                position:'absolute', left:0, top:'50%',
                transform:'translateY(-50%)',
                width:3, height:24, borderRadius:'0 2px 2px 0',
              }} />
            )}
          </button>
        )
      })}
      <div style={{ marginTop:'auto', marginBottom:16 }}>
        <div className="rb-line" style={{ width:8, height:8, borderRadius:'50%', animation:'rb-line 3s linear infinite, blink 2s infinite' }} />
      </div>
    </div>
  )
}
