// src/views/Historial.jsx
import { useState, useEffect } from 'react'
import { api } from '../api.js'
import { Badge, Spinner, ErrorMsg, Btn, fmt } from '../components.jsx'

export default function Historial() {
  const [historial, setHistorial] = useState([])
  const [clientes, setClientes]   = useState([])
  const [subs, setSubs]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [filtro, setFiltro]       = useState('todos')

  const cargar = async () => {
    setLoading(true); setError(null)
    try {
      const [h, c, s] = await Promise.all([api.getHistorial(), api.getClientes(), api.getSuscripciones()])
      setHistorial(h); setClientes(c); setSubs(s)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  if (loading) return <Spinner />

  const enriquecido = historial.map(h => {
    const sus = subs.find(s => s.id === h.suscripcion_id)
    const cli = clientes.find(c => c.id === sus?.cliente_id)
    return { ...h, sus, cli }
  })

  const filtrados = filtro === 'todos' ? enriquecido : enriquecido.filter(h => h.estado === filtro)

  const total   = enriquecido.filter(h => h.estado === 'Enviado').reduce((a, h) => a + h.monto, 0)
  const fallidos = enriquecido.filter(h => h.estado === 'Fallido').length

  return (
    <div>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.5rem',flexWrap:'wrap',gap:'1rem' }}>
        <h2 style={{ fontFamily:"'Playfair Display',serif",color:'#e8eaf0',margin:0,fontSize:'1.8rem' }}>Historial de Envíos</h2>
        <div style={{ display:'flex',gap:'0.5rem',alignItems:'center' }}>
          {['todos','Enviado','Fallido'].map(f => (
            <button key={f} onClick={() => setFiltro(f)} style={{
              background: filtro===f ? 'linear-gradient(135deg,#6c63ff,#a78bfa)' : '#1a1d27',
              border:'1px solid #2a2d3a',borderRadius:'6px',padding:'0.45rem 0.9rem',
              color:'#e8eaf0',cursor:'pointer',fontSize:'0.82rem'
            }}>{f}</button>
          ))}
          <Btn variant='secondary' style={{ padding:'0.45rem 0.9rem',fontSize:'0.82rem' }} onClick={cargar}>↻ Actualizar</Btn>
        </div>
      </div>

      {error && <ErrorMsg msg={error} onRetry={cargar} />}

      {/* Resumen rápido */}
      <div style={{ display:'flex',gap:'1rem',marginBottom:'1.2rem',flexWrap:'wrap' }}>
        <div style={{ background:'#0f1117',border:'1px solid #2a2d3a',borderRadius:'10px',padding:'0.8rem 1.2rem',flex:1,minWidth:'160px' }}>
          <div style={{ color:'#34d399',fontFamily:'monospace',fontWeight:800,fontSize:'1.2rem' }}>{fmt(total)}</div>
          <div style={{ color:'#555',fontSize:'0.78rem' }}>Total cobrado (historial)</div>
        </div>
        <div style={{ background:'#0f1117',border:'1px solid #2a2d3a',borderRadius:'10px',padding:'0.8rem 1.2rem',flex:1,minWidth:'160px' }}>
          <div style={{ color:'#f87171',fontFamily:'monospace',fontWeight:800,fontSize:'1.2rem' }}>{fallidos}</div>
          <div style={{ color:'#555',fontSize:'0.78rem' }}>Envíos fallidos</div>
        </div>
        <div style={{ background:'#0f1117',border:'1px solid #2a2d3a',borderRadius:'10px',padding:'0.8rem 1.2rem',flex:1,minWidth:'160px' }}>
          <div style={{ color:'#60a5fa',fontFamily:'monospace',fontWeight:800,fontSize:'1.2rem' }}>{enriquecido.length}</div>
          <div style={{ color:'#555',fontSize:'0.78rem' }}>Total registros</div>
        </div>
      </div>

      <div style={{ background:'#0f1117',border:'1px solid #2a2d3a',borderRadius:'12px',overflow:'auto' }}>
        <table style={{ width:'100%',borderCollapse:'collapse',fontSize:'0.88rem' }}>
          <thead>
            <tr style={{ background:'#0a0c12',borderBottom:'1px solid #2a2d3a' }}>
              {['Fecha','Cliente','Suscripción','Monto','Estado'].map(h =>
                <th key={h} style={{ textAlign:'left',padding:'0.9rem 1rem',color:'#555',fontWeight:600,fontSize:'0.78rem',textTransform:'uppercase' }}>{h}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0
              ? <tr><td colSpan={5} style={{ padding:'2rem',textAlign:'center',color:'#444' }}>Sin registros</td></tr>
              : filtrados.map(h => (
                  <tr key={h.id} style={{ borderBottom:'1px solid #1a1d27' }}>
                    <td style={{ padding:'0.85rem 1rem',color:'#8b8fa8',fontFamily:'monospace',whiteSpace:'nowrap',fontSize:'0.82rem' }}>
                      {new Date(h.fecha_envio).toLocaleString('es-CO', { dateStyle:'short', timeStyle:'short' })}
                    </td>
                    <td style={{ padding:'0.85rem 1rem',color:'#e8eaf0' }}>{h.cli?.nombre || '—'}</td>
                    <td style={{ padding:'0.85rem 1rem',color:'#8b8fa8' }}>{h.sus?.tipo || '—'}</td>
                    <td style={{ padding:'0.85rem 1rem',color:'#34d399',fontFamily:'monospace' }}>{fmt(h.monto)}</td>
                    <td style={{ padding:'0.85rem 1rem' }}><Badge status={h.estado} /></td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}
