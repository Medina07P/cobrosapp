// src/App.jsx
import { useState, useEffect } from 'react'
import { api } from './api.js'
import Dashboard     from './views/Dashboard.jsx'
import Clientes      from './views/Clientes.jsx'
import Suscripciones from './views/Suscripciones.jsx'
import Historial     from './views/Historial.jsx'
import Calendario    from './views/Calendario.jsx'

const NAV = [
  { id:'dashboard',     icon:'⬡', label:'Dashboard'     },
  { id:'clientes',      icon:'👥', label:'Clientes'      },
  { id:'suscripciones', icon:'🔄', label:'Suscripciones' },
  { id:'historial',     icon:'📋', label:'Historial'     },
  { id:'calendario',    icon:'📅', label:'Calendario'    },
]

export default function App() {
  const [view, setView]         = useState('dashboard')
  const [collapsed, setCollapsed] = useState(false)
  const [backendOk, setBackendOk] = useState(null)

  // Verificar conexión al backend
  useEffect(() => {
    api.health()
      .then(() => setBackendOk(true))
      .catch(() => setBackendOk(false))
  }, [])

  const VIEWS = { dashboard: <Dashboard />, clientes: <Clientes />, suscripciones: <Suscripciones />, historial: <Historial />, calendario: <Calendario /> }

  return (
    <div style={{ display:'flex',minHeight:'100vh',background:'#080a10' }}>

      {/* Sidebar */}
      <div style={{ width: collapsed ? '60px' : '220px', background:'#0a0c12', borderRight:'1px solid #1a1d27', display:'flex', flexDirection:'column', transition:'width 0.2s', flexShrink:0, position:'sticky', top:0, height:'100vh', overflow:'hidden' }}>

        {/* Logo */}
        <div
          onClick={() => setCollapsed(v => !v)}
          style={{ padding:'1.2rem 1rem', borderBottom:'1px solid #1a1d27', display:'flex', alignItems:'center', gap:'0.7rem', cursor:'pointer' }}
        >
          <div style={{ width:'32px', height:'32px', background:'linear-gradient(135deg,#6c63ff,#a78bfa)', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem', flexShrink:0 }}>₩</div>
          {!collapsed && (
            <div>
              <div style={{ fontWeight:800, fontSize:'0.85rem', color:'#e8eaf0' }}>SGCRC</div>
              <div style={{ fontSize:'0.68rem', color:'#444' }}>Cobros Recurrentes</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:'0.8rem 0.5rem' }}>
          {NAV.map(n => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              title={collapsed ? n.label : ''}
              style={{
                display:'flex', alignItems:'center', gap:'0.7rem', width:'100%',
                padding:'0.7rem 0.8rem', background: view===n.id ? 'linear-gradient(90deg,#1e1830,#1a1d27)' : 'none',
                border:'none', borderLeft: view===n.id ? '2px solid #6c63ff' : '2px solid transparent',
                borderRadius:'8px', color: view===n.id ? '#a78bfa' : '#555',
                cursor:'pointer', fontSize:'0.88rem', fontWeight: view===n.id ? 700 : 500,
                marginBottom:'0.2rem', textAlign:'left'
              }}
            >
              <span style={{ fontSize:'1rem', flexShrink:0 }}>{n.icon}</span>
              {!collapsed && <span style={{ whiteSpace:'nowrap' }}>{n.label}</span>}
            </button>
          ))}
        </nav>

        {/* Estado backend */}
        {!collapsed && (
          <div style={{ padding:'1rem', borderTop:'1px solid #1a1d27', fontSize:'0.72rem' }}>
            <span style={{ color: backendOk === null ? '#555' : backendOk ? '#4ade80' : '#f87171' }}>
              {backendOk === null ? '● Conectando...' : backendOk ? '● Backend activo' : '● Backend offline'}
            </span>
            {backendOk === false && (
              <div style={{ color:'#555', marginTop:'0.3rem' }}>Inicia: <code style={{ color:'#8b8fa8' }}>node index.js</code></div>
            )}
          </div>
        )}
      </div>

      {/* Contenido */}
      <div style={{ flex:1, padding:'2rem', overflowY:'auto' }}>
        {backendOk === false && (
          <div style={{ background:'#2e0d0d', border:'1px solid #5c1a1a', borderRadius:'10px', padding:'1rem 1.2rem', color:'#f87171', marginBottom:'1.5rem', display:'flex', alignItems:'center', gap:'0.8rem' }}>
            <span style={{ fontSize:'1.2rem' }}>⚠️</span>
            <div>
              <strong>Backend no disponible.</strong> Asegúrate de que el servidor esté corriendo:<br/>
              <code style={{ background:'#1a0808', padding:'0.2rem 0.5rem', borderRadius:'4px', fontSize:'0.85rem' }}>cd sgcrc-export &amp;&amp; node index.js</code>
            </div>
          </div>
        )}
        {VIEWS[view]}
      </div>
    </div>
  )
}
