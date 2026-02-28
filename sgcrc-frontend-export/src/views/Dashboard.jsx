// src/views/Dashboard.jsx
import { useState, useEffect } from 'react'
import { api } from '../api.js'
import { fmt, Spinner, ErrorMsg, Btn } from '../components.jsx'

export default function Dashboard() {
  const [data, setData]     = useState(null)
  const [error, setError]   = useState(null)
  const [running, setRunning] = useState(false)

  const cargar = async () => {
    setError(null)
    try {
      const [clientes, suscripciones, historial] = await Promise.all([
        api.getClientes(), api.getSuscripciones(), api.getHistorial()
      ])
      setData({ clientes, suscripciones, historial })
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => { cargar() }, [])

  const forzarCobros = async () => {
    setRunning(true)
    try {
      await api.runCobros()
      alert('✅ Proceso de cobros iniciado. Revisa el historial en unos segundos.')
      await cargar()
    } catch (e) {
      alert('Error: ' + e.message)
    } finally {
      setRunning(false)
    }
  }

  if (!data && !error) return <Spinner />
  if (error) return <ErrorMsg msg={error} onRetry={cargar} />

  const { clientes, suscripciones, historial } = data
  const activas   = suscripciones.filter(s => s.activa)
  const ingresos  = activas.reduce((a, s) => a + s.monto, 0)
  const enviados  = historial.filter(h => h.estado === 'Enviado').length
  const fallidos  = historial.filter(h => h.estado === 'Fallido').length
  const today     = new Date().getDate()

  const proximos = activas
    .map(s => {
      const cl = clientes.find(c => c.id === s.cliente_id)
      const diasFalta = s.dia_cobro >= today ? s.dia_cobro - today : 31 - today + s.dia_cobro
      return { ...s, cl, diasFalta }
    })
    .sort((a, b) => a.diasFalta - b.diasFalta)
    .slice(0, 5)

  const cards = [
    { label:'Clientes',             value: clientes.length,    icon:'👥', color:'#6c63ff' },
    { label:'Suscripciones activas',value: activas.length,     icon:'🔄', color:'#a78bfa' },
    { label:'Ingresos mensuales',   value: fmt(ingresos),      icon:'💰', color:'#34d399' },
    { label:'Correos enviados',     value: enviados,           icon:'📧', color:'#60a5fa' },
    { label:'Envíos fallidos',      value: fallidos,           icon:'⚠️', color:'#f87171' },
  ]

  return (
    <div>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.5rem',flexWrap:'wrap',gap:'1rem' }}>
        <h2 style={{ fontFamily:"'Playfair Display',serif",color:'#e8eaf0',margin:0,fontSize:'1.8rem' }}>Panel Principal</h2>
        <Btn onClick={forzarCobros} disabled={running} style={{ opacity:running?0.6:1 }}>
          {running ? '⏳ Procesando...' : '▶ Forzar cobros ahora'}
        </Btn>
      </div>

      <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))',gap:'1rem',marginBottom:'2rem' }}>
        {cards.map(c => (
          <div key={c.label} style={{ background:'#0f1117',border:'1px solid #2a2d3a',borderRadius:'12px',padding:'1.2rem',borderLeft:`3px solid ${c.color}` }}>
            <div style={{ fontSize:'1.5rem',marginBottom:'0.4rem' }}>{c.icon}</div>
            <div style={{ color:c.color,fontSize:'1.5rem',fontWeight:800,fontFamily:'monospace' }}>{c.value}</div>
            <div style={{ color:'#8b8fa8',fontSize:'0.78rem',marginTop:'0.2rem' }}>{c.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background:'#0f1117',border:'1px solid #2a2d3a',borderRadius:'12px',padding:'1.4rem' }}>
        <h3 style={{ color:'#e8eaf0',margin:'0 0 1rem',fontSize:'1rem' }}>📅 Próximos Cobros</h3>
        {proximos.length === 0
          ? <p style={{ color:'#555' }}>Sin suscripciones activas.</p>
          : (
            <table style={{ width:'100%',borderCollapse:'collapse',fontSize:'0.88rem' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid #1e2130' }}>
                  {['Cliente','Tipo','Monto','Día','Faltan'].map(h =>
                    <th key={h} style={{ textAlign:'left',padding:'0.5rem',color:'#555',fontWeight:600,fontSize:'0.78rem' }}>{h}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {proximos.map(s => (
                  <tr key={s.id} style={{ borderBottom:'1px solid #1a1d27' }}>
                    <td style={{ padding:'0.65rem 0.5rem',color:'#e8eaf0' }}>{s.cl?.nombre}</td>
                    <td style={{ padding:'0.65rem 0.5rem',color:'#8b8fa8' }}>{s.tipo}</td>
                    <td style={{ padding:'0.65rem 0.5rem',color:'#34d399',fontFamily:'monospace' }}>{fmt(s.monto)}</td>
                    <td style={{ padding:'0.65rem 0.5rem',color:'#a78bfa',fontWeight:700 }}>Día {s.dia_cobro}</td>
                    <td style={{ padding:'0.65rem 0.5rem',color:s.diasFalta===0?'#fbbf24':'#666',fontSize:'0.8rem' }}>
                      {s.diasFalta === 0 ? '¡Hoy!' : `${s.diasFalta}d`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>
    </div>
  )
}
