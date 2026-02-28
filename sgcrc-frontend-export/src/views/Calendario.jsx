// src/views/Calendario.jsx
import { useState, useEffect, useMemo } from 'react'
import { api } from '../api.js'
import { Spinner, ErrorMsg, fmt } from '../components.jsx'

const MONTHS   = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS     = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

export default function Calendario() {
  const [subs, setSubs]       = useState([])
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [selected, setSelected] = useState(null)

  const today = new Date()
  const [view, setView] = useState({ month: today.getMonth(), year: today.getFullYear() })

  const cargar = async () => {
    setLoading(true); setError(null)
    try {
      const [s, c] = await Promise.all([api.getSuscripciones(), api.getClientes()])
      setSubs(s.filter(x => x.activa)); setClientes(c)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate()
  const firstDay    = new Date(view.year, view.month, 1).getDay()

  const cobrosPorDia = useMemo(() => {
    const map = {}
    subs.forEach(s => {
      const d = Math.min(s.dia_cobro, daysInMonth)
      if (!map[d]) map[d] = { total:0, items:[] }
      const cl = clientes.find(c => c.id === s.cliente_id)
      map[d].total += s.monto
      map[d].items.push({ ...s, cl })
    })
    return map
  }, [subs, clientes, daysInMonth])

  const prev = () => setView(v => v.month === 0  ? { month:11, year:v.year-1 } : { month:v.month-1, year:v.year })
  const next = () => setView(v => v.month === 11 ? { month:0,  year:v.year+1 } : { month:v.month+1, year:v.year })

  if (loading) return <Spinner />
  if (error)   return <ErrorMsg msg={error} onRetry={cargar} />

  const cells = [...Array(firstDay).fill(null), ...Array.from({length:daysInMonth},(_,i)=>i+1)]
  const selectedData = selected ? cobrosPorDia[selected] : null

  return (
    <div>
      <h2 style={{ fontFamily:"'Playfair Display',serif",color:'#e8eaf0',marginBottom:'1.5rem',fontSize:'1.8rem' }}>Calendario de Cobros</h2>

      <div style={{ display:'grid',gridTemplateColumns:'1fr auto',gap:'1.5rem',alignItems:'start' }}>
        <div style={{ background:'#0f1117',border:'1px solid #2a2d3a',borderRadius:'12px',padding:'1.5rem' }}>
          {/* Navegación */}
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.5rem' }}>
            <button onClick={prev} style={{ background:'#1a1d27',border:'1px solid #2a2d3a',borderRadius:'8px',padding:'0.5rem 1rem',color:'#e8eaf0',cursor:'pointer',fontSize:'1.1rem' }}>‹</button>
            <h3 style={{ margin:0,color:'#e8eaf0',fontFamily:"'Playfair Display',serif",fontSize:'1.2rem' }}>{MONTHS[view.month]} {view.year}</h3>
            <button onClick={next} style={{ background:'#1a1d27',border:'1px solid #2a2d3a',borderRadius:'8px',padding:'0.5rem 1rem',color:'#e8eaf0',cursor:'pointer',fontSize:'1.1rem' }}>›</button>
          </div>

          {/* Días semana */}
          <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'0.3rem',marginBottom:'0.3rem' }}>
            {DAYS.map(d => <div key={d} style={{ textAlign:'center',color:'#444',fontSize:'0.75rem',padding:'0.3rem',fontWeight:700 }}>{d}</div>)}
          </div>

          {/* Celdas */}
          <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'0.3rem' }}>
            {cells.map((day, i) => {
              if (!day) return <div key={`e${i}`} />
              const isToday   = day===today.getDate() && view.month===today.getMonth() && view.year===today.getFullYear()
              const cobros    = cobrosPorDia[day]
              const isSelected = selected === day
              return (
                <div
                  key={day}
                  onClick={() => setSelected(cobros ? (isSelected ? null : day) : null)}
                  style={{
                    background: isSelected ? '#2a1f50' : cobros ? '#1a1730' : '#0a0c12',
                    border: isSelected ? '2px solid #a78bfa' : isToday ? '2px solid #6c63ff' : cobros ? '1px solid #3d2d6a' : '1px solid #1a1d27',
                    borderRadius:'8px',padding:'0.45rem',minHeight:'60px',
                    cursor: cobros ? 'pointer' : 'default',
                    transition:'all 0.15s'
                  }}
                >
                  <div style={{ fontSize:'0.8rem',fontWeight:700,color:isToday?'#a78bfa':cobros?'#e8eaf0':'#444' }}>{day}</div>
                  {cobros && (
                    <>
                      <div style={{ color:'#34d399',fontSize:'0.62rem',fontWeight:700,marginTop:'0.2rem',lineHeight:1.2 }}>{fmt(cobros.total)}</div>
                      <div style={{ color:'#6c63ff',fontSize:'0.58rem' }}>{cobros.items.length}×</div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Panel lateral */}
        <div style={{ minWidth:'220px',background:'#0f1117',border:'1px solid #2a2d3a',borderRadius:'12px',padding:'1.2rem' }}>
          {selectedData ? (
            <>
              <h4 style={{ color:'#e8eaf0',margin:'0 0 0.3rem',fontSize:'1rem' }}>Día {selected}</h4>
              <div style={{ color:'#34d399',fontFamily:'monospace',fontWeight:800,fontSize:'1.1rem',marginBottom:'1rem' }}>{fmt(selectedData.total)}</div>
              {selectedData.items.map(s => (
                <div key={s.id} style={{ borderTop:'1px solid #1a1d27',paddingTop:'0.7rem',marginTop:'0.7rem' }}>
                  <div style={{ color:'#e8eaf0',fontSize:'0.85rem',fontWeight:600 }}>{s.cl?.nombre}</div>
                  <div style={{ color:'#8b8fa8',fontSize:'0.78rem' }}>{s.tipo}</div>
                  <div style={{ color:'#34d399',fontFamily:'monospace',fontSize:'0.82rem',marginTop:'0.2rem' }}>{fmt(s.monto)}</div>
                </div>
              ))}
            </>
          ) : (
            <div style={{ color:'#444',fontSize:'0.85rem',textAlign:'center',padding:'1rem 0' }}>
              Haz clic en un<br/>día con cobros<br/>para ver el detalle
            </div>
          )}

          <div style={{ marginTop:'1.5rem',borderTop:'1px solid #1a1d27',paddingTop:'1rem' }}>
            <div style={{ color:'#555',fontSize:'0.75rem',marginBottom:'0.5rem',fontWeight:700 }}>RESUMEN DEL MES</div>
            <div style={{ color:'#8b8fa8',fontSize:'0.8rem' }}>{Object.keys(cobrosPorDia).length} días con cobros</div>
            <div style={{ color:'#34d399',fontFamily:'monospace',fontSize:'0.85rem',fontWeight:700,marginTop:'0.3rem' }}>
              {fmt(Object.values(cobrosPorDia).reduce((a,v) => a+v.total, 0))}
            </div>
            <div style={{ color:'#555',fontSize:'0.73rem' }}>total proyectado</div>
          </div>
        </div>
      </div>
    </div>
  )
}
