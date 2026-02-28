// src/components.jsx — Componentes UI reutilizables

export const fmt = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

export function Modal({ title, onClose, children }) {
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem' }}>
      <div style={{ background:'#0f1117',border:'1px solid #2a2d3a',borderRadius:'16px',width:'100%',maxWidth:'540px',maxHeight:'90vh',overflow:'auto',boxShadow:'0 24px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'1.5rem 1.5rem 0' }}>
          <h3 style={{ margin:0,color:'#e8eaf0',fontFamily:"'Playfair Display',serif",fontSize:'1.3rem' }}>{title}</h3>
          <button onClick={onClose} style={{ background:'none',border:'none',color:'#666',cursor:'pointer',fontSize:'1.5rem',lineHeight:1 }}>×</button>
        </div>
        <div style={{ padding:'1.5rem' }}>{children}</div>
      </div>
    </div>
  )
}

export function Input({ label, ...props }) {
  return (
    <div style={{ marginBottom:'1rem' }}>
      <label style={{ display:'block',marginBottom:'0.4rem',color:'#8b8fa8',fontSize:'0.78rem',letterSpacing:'0.06em',textTransform:'uppercase' }}>{label}</label>
      <input {...props} style={{ width:'100%',background:'#1a1d27',border:'1px solid #2a2d3a',borderRadius:'8px',padding:'0.65rem 0.9rem',color:'#e8eaf0',fontSize:'0.95rem',outline:'none',...props.style }} />
    </div>
  )
}

export function Select({ label, children, ...props }) {
  return (
    <div style={{ marginBottom:'1rem' }}>
      <label style={{ display:'block',marginBottom:'0.4rem',color:'#8b8fa8',fontSize:'0.78rem',letterSpacing:'0.06em',textTransform:'uppercase' }}>{label}</label>
      <select {...props} style={{ width:'100%',background:'#1a1d27',border:'1px solid #2a2d3a',borderRadius:'8px',padding:'0.65rem 0.9rem',color:'#e8eaf0',fontSize:'0.95rem',outline:'none' }}>
        {children}
      </select>
    </div>
  )
}

export function Btn({ children, variant='primary', ...props }) {
  const bg = variant==='primary' ? 'linear-gradient(135deg,#6c63ff,#a78bfa)' : variant==='danger' ? '#3d1515' : '#1e2130'
  const color = variant==='danger' ? '#f87171' : '#e8eaf0'
  const border = variant==='danger' ? '1px solid #5c1a1a' : '1px solid #2a2d3a'
  return (
    <button {...props} style={{ background:bg,border,color,borderRadius:'8px',padding:'0.6rem 1.2rem',cursor:'pointer',fontSize:'0.9rem',fontWeight:600,...props.style }}>
      {children}
    </button>
  )
}

export function Badge({ status }) {
  const map = {
    'Enviado':  { bg:'#0d2e1a', color:'#4ade80', border:'#1a4d2e' },
    'Fallido':  { bg:'#2e0d0d', color:'#f87171', border:'#4d1a1a' },
    'Activa':   { bg:'#0d2e1a', color:'#4ade80', border:'#1a4d2e' },
    'Inactiva': { bg:'#2e0d0d', color:'#f87171', border:'#4d1a1a' },
  }
  const c = map[status] || { bg:'#2e260d', color:'#fbbf24', border:'#4d3d1a' }
  return (
    <span style={{ background:c.bg,color:c.color,border:`1px solid ${c.border}`,borderRadius:'20px',padding:'0.2rem 0.7rem',fontSize:'0.75rem',fontWeight:700 }}>
      {status}
    </span>
  )
}

export function Spinner() {
  return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',padding:'3rem',color:'#555',fontSize:'0.9rem',gap:'0.7rem' }}>
      <div style={{ width:'20px',height:'20px',border:'2px solid #2a2d3a',borderTop:'2px solid #6c63ff',borderRadius:'50%',animation:'spin 0.8s linear infinite' }} />
      Cargando...
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export function ErrorMsg({ msg, onRetry }) {
  return (
    <div style={{ background:'#2e0d0d',border:'1px solid #5c1a1a',borderRadius:'10px',padding:'1rem 1.2rem',color:'#f87171',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem' }}>
      <span>⚠️ {msg}</span>
      {onRetry && <Btn variant='danger' style={{ padding:'0.3rem 0.8rem',fontSize:'0.8rem' }} onClick={onRetry}>Reintentar</Btn>}
    </div>
  )
}
