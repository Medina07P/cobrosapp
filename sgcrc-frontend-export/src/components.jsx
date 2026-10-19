// src/components.jsx — Componentes UI reutilizables (usan los tokens de src/styles/tokens.css)
import Icon from './ui/Icon.jsx'

export const fmt = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

export function Btn({ children, variant='primary', ...props }) {
  const estilos = {
    primary:   { background:'var(--color-primario)', color:'var(--color-primario-contraste)', border:'1px solid transparent' },
    secondary: { background:'var(--surface)', color:'var(--ink)', border:'1px solid var(--line)' },
    danger:    { background:'var(--bad-bg)', color:'var(--bad)', border:'1px solid var(--bad)' },
  }
  return (
    <button
      type="button"
      {...props}
      style={{ ...estilos[variant], borderRadius:'8px',padding:'0.6rem 1.2rem',cursor:'pointer',fontSize:'0.9rem',fontWeight:600,display:'inline-flex',alignItems:'center',gap:'0.4rem',...props.style }}
    >
      {children}
    </button>
  )
}

// El estado siempre lleva icono y texto, no solo color
const ESTADOS = {
  'Enviado':  { fg:'var(--ok)',   bg:'var(--ok-bg)',   icon:'check-circle' },
  'Activa':   { fg:'var(--ok)',   bg:'var(--ok-bg)',   icon:'check-circle' },
  'Fallido':  { fg:'var(--bad)',  bg:'var(--bad-bg)',  icon:'x-circle' },
  'Inactiva': { fg:'var(--bad)',  bg:'var(--bad-bg)',  icon:'x-circle' },
}
const ESTADO_PENDIENTE = { fg:'var(--warn)', bg:'var(--warn-bg)', icon:'clock-counter-clockwise' }

export function Badge({ status }) {
  const c = ESTADOS[status] || ESTADO_PENDIENTE
  return (
    <span style={{ background:c.bg,color:c.fg,borderRadius:'4px',padding:'0.2rem 0.6rem',fontSize:'0.8rem',fontWeight:600,display:'inline-flex',alignItems:'center',gap:'0.3rem' }}>
      <Icon name={c.icon} size={14} />
      {status}
    </span>
  )
}

export function Spinner() {
  return (
    <div role="status" style={{ display:'flex',alignItems:'center',justifyContent:'center',padding:'3rem',color:'var(--ink-2)',fontSize:'0.9rem',gap:'0.7rem' }}>
      <div style={{ width:'20px',height:'20px',border:'2px solid var(--line)',borderTop:'2px solid var(--color-primario)',borderRadius:'50%',animation:'spin 0.8s linear infinite' }} />
      Cargando...
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export function ErrorMsg({ msg, onRetry }) {
  return (
    <div role="alert" style={{ background:'var(--bad-bg)',border:'1px solid var(--bad)',borderRadius:'8px',padding:'1rem 1.2rem',color:'var(--bad)',display:'flex',justifyContent:'space-between',alignItems:'center',gap:'1rem',marginBottom:'1rem' }}>
      <span style={{ display:'inline-flex',alignItems:'center',gap:'0.5rem' }}>
        <Icon name="warning" size={18} />
        {msg}
      </span>
      {onRetry && <Btn variant='danger' style={{ padding:'0.3rem 0.8rem',fontSize:'0.8rem' }} onClick={onRetry}>Reintentar</Btn>}
    </div>
  )
}
