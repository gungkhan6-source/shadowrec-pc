import React from 'react'

export default function TitleBar() {
  // ⭐ Geriye dönük uyumluluk: window.novaRec varsa onu, yoksa window.shadowRec'i kullan
  const api = window.novaRec || window.shadowRec
  return (
    <div style={{
      height:40, display:'flex', alignItems:'center',
      justifyContent:'space-between', padding:'0 16px',
      background:'rgba(0,0,0,0.7)',
      borderBottom:'1px solid',
      WebkitAppRegion:'drag', flexShrink:0, zIndex:200,
    }} className="rb-border">
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{
          width:22, height:22,
          background:'linear-gradient(135deg, #00c8ff, #9b5cf6, #ff44cc)',
          clipPath:'polygon(50% 0%,100% 50%,50% 100%,0% 50%)',
          boxShadow:'0 0 12px rgba(155,92,246,0.5)',
        }} />
        <span className="rb" style={{
          fontFamily:'var(--font-display)', fontSize:14,
          fontWeight:900, letterSpacing:3,
        }}>NOVAREC</span>
        <span style={{
          fontFamily:'var(--font-display)', fontSize:11,
          fontWeight:400, letterSpacing:4,
          color:'var(--text-dim)',
          marginLeft:-4,
        }}>STUDIO</span>
        <span style={{ fontSize:9, color:'var(--text-dim)', letterSpacing:2, marginLeft:6 }}>v1.0</span>
      </div>
      <div style={{ display:'flex', gap:8, WebkitAppRegion:'no-drag' }}>
        {[
          { action:'minimize', color:'#ffd700', symbol:'─' },
          { action:'maximize', color:'#00ff88', symbol:'□' },
          { action:'close',    color:'#ff4455', symbol:'✕' },
        ].map(btn => (
          <button key={btn.action} onClick={() => api?.[btn.action]?.()}
            style={{
              width:28, height:20, background:'transparent',
              border:`1px solid ${btn.color}44`, borderRadius:4,
              color:btn.color, fontSize:10,
              display:'flex', alignItems:'center', justifyContent:'center',
              transition:'background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = btn.color+'22'; e.currentTarget.style.borderColor = btn.color }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = btn.color+'44' }}
          >{btn.symbol}</button>
        ))}
      </div>
    </div>
  )
}
