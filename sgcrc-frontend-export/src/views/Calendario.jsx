import { useState, useEffect, useMemo } from 'react'
import { api } from '../api.js'
import { Spinner, ErrorMsg, fmt } from '../components.jsx'
import Icon from '../ui/Icon.jsx'

const MONTHS   = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS     = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

const panel = { background:'var(--surface)',border:'1px solid var(--line)',borderRadius:'8px' }
const botonNav = { background:'var(--surface)',border:'1px solid var(--line)',borderRadius:'8px',padding:'0.5rem 0.8rem',color:'var(--ink)',cursor:'pointer',display:'inline-flex',alignItems:'center' }

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

  // --- LÓGICA DE PROYECCIÓN CORREGIDA ---
  // --- LÓGICA DE PROYECCIÓN CORREGIDA ---
  // --- LÓGICA DE PROYECCIÓN CORREGIDA ---
  const cobrosPorDia = useMemo(() => {
    const map = {}

    const registrar = (dia, s) => {
      const fechaCelda = new Date(view.year, view.month, dia);
      const fechaInicio = s.fecha_alta ? new Date(s.fecha_alta) : null;

      // 1. FILTRO DE FECHA: No mostrar cobros antes de que empezara la suscripción
      if (fechaInicio && fechaCelda < fechaInicio) return;

      const d = Math.min(dia, daysInMonth)
      if (!map[d]) map[d] = { total: 0, items: [] }
      const cl = clientes.find(c => c.id === s.cliente_id)
      map[d].total += s.monto
      map[d].items.push({ ...s, cl })
    }

    subs.forEach(s => {
      const f = s.frecuencia || 'mensual';

      // 2. OBTENER EL DÍA REAL: Si existe fecha_alta, usamos ese día.
      // Si no, usamos el dia_cobro del plan.
      let diaReal = s.dia_cobro;
      if (s.fecha_alta) {
        // Extraemos el día del string "YYYY-MM-DD" (evita desfases de zona horaria)
        diaReal = parseInt(s.fecha_alta.split('-')[2]);
      }

      switch (f) {
        case 'semanal':
          for (let d = 1; d <= daysInMonth; d++) {
            if (new Date(view.year, view.month, d).getDay() === (diaReal % 7)) {
              registrar(d, s)
            }
          }
          break

        case 'quincenal':
          registrar(diaReal, s)
          const segundaQuincena = diaReal + 15
          if (segundaQuincena <= daysInMonth) registrar(segundaQuincena, s)
          break

        case 'anual':
          if (view.month === (s.mes_cobro || 0)) registrar(diaReal, s)
          break

        case 'mensual':
        default:
          registrar(diaReal, s)
          break
      }
    })
    return map
  }, [subs, clientes, daysInMonth, view.month, view.year])
  // ---------------------------------------

  const prev = () => setView(v => v.month === 0  ? { month:11, year:v.year-1 } : { month:v.month-1, year:v.year })
  const next = () => setView(v => v.month === 11 ? { month:0,  year:v.year+1 } : { month:v.month+1, year:v.year })

  if (loading) return <Spinner />
  if (error)   return <ErrorMsg msg={error} onRetry={cargar} />

  const cells = [...Array(firstDay).fill(null), ...Array.from({length:daysInMonth},(_,i)=>i+1)]
  const selectedData = selected ? cobrosPorDia[selected] : null

  return (
    <div>
      <h2 style={{ fontFamily:'var(--font-display)',color:'var(--ink)',marginBottom:'1.5rem',fontSize:'1.8rem' }}>Calendario de Cobros</h2>

      <div style={{ display:'grid',gridTemplateColumns:'1fr auto',gap:'1.5rem',alignItems:'start' }}>
        <div style={{ ...panel,padding:'1.5rem' }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.5rem' }}>
            <button type="button" onClick={prev} aria-label="Mes anterior" style={botonNav}><Icon name="caret-left" size={18} /></button>
            <h3 style={{ margin:0,color:'var(--ink)',fontFamily:'var(--font-display)' }}>{MONTHS[view.month]} {view.year}</h3>
            <button type="button" onClick={next} aria-label="Mes siguiente" style={botonNav}><Icon name="caret-right" size={18} /></button>
          </div>

          <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'0.3rem',marginBottom:'0.3rem' }}>
            {DAYS.map(d => <div key={d} style={{ textAlign:'center',color:'var(--ink-2)',fontSize:'0.8rem',fontWeight:700 }}>{d}</div>)}
          </div>

          <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'0.3rem' }}>
            {cells.map((day, i) => {
              if (!day) return <div key={`e${i}`} />
              const isToday   = day===today.getDate() && view.month===today.getMonth() && view.year===today.getFullYear()
              const cobros    = cobrosPorDia[day]
              const isSelected = selected === day
              const estiloCelda = {
                background: isSelected
                  ? 'color-mix(in srgb, var(--color-primario) 14%, var(--surface))'
                  : cobros ? 'color-mix(in srgb, var(--color-primario) 6%, var(--surface))' : 'var(--surface-alt)',
                border: isSelected ? '2px solid var(--color-primario)' : isToday ? '2px solid var(--ink)' : '1px solid var(--line)',
                borderRadius:'8px',padding:'0.45rem',minHeight:'60px',minWidth:0,overflow:'hidden',
                textAlign:'left',font:'inherit',color:'inherit',display:'block',width:'100%',
                cursor: cobros ? 'pointer' : 'default'
              }
              const numeroDia = (
                <div style={{ fontSize:'0.85rem',fontWeight:700,color: cobros || isToday ? 'var(--ink)' : 'var(--ink-2)' }}>{day}</div>
              )
              if (!cobros) return <div key={day} style={estiloCelda}>{numeroDia}</div>
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={`${day} de ${MONTHS[view.month]}, ${cobros.items.length} ${cobros.items.length === 1 ? 'cobro' : 'cobros'}, ${fmt(cobros.total)}`}
                  onClick={() => setSelected(isSelected ? null : day)}
                  style={estiloCelda}
                >
                  {numeroDia}
                  <div style={{ color:'var(--ok)',fontSize:'0.75rem',fontWeight:700,fontVariantNumeric:'tabular-nums',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{fmt(cobros.total)}</div>
                  <div style={{ color:'var(--ink-2)',fontSize:'0.75rem' }}>{cobros.items.length} {cobros.items.length === 1 ? 'cobro' : 'cobros'}</div>
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ ...panel,minWidth:'240px',padding:'1.2rem' }}>
          {selectedData ? (
            <>
              <h4 style={{ color:'var(--ink)',margin:'0 0 0.3rem' }}>Día {selected}</h4>
              <div style={{ color:'var(--ok)',fontVariantNumeric:'tabular-nums',fontWeight:800,fontSize:'1.1rem',marginBottom:'1rem' }}>{fmt(selectedData.total)}</div>
              {selectedData.items.map((s, idx) => (
                <div key={`${s.id}-${idx}`} style={{ borderTop:'1px solid var(--line)',paddingTop:'0.7rem',marginTop:'0.7rem' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'start', gap:'0.5rem' }}>
                    <div style={{ color:'var(--ink)',fontSize:'0.9rem',fontWeight:600 }}>{s.cl?.nombre}</div>
                    <span style={{ fontSize:'0.75rem', color:'var(--ink-2)', border:'1px solid var(--line)', padding:'0 6px', borderRadius:'4px', textTransform:'uppercase' }}>{s.frecuencia || 'mensual'}</span>
                  </div>
                  <div style={{ color:'var(--ink-2)',fontSize:'0.85rem' }}>{s.tipo}</div>
                  <div style={{ color:'var(--ink)',fontVariantNumeric:'tabular-nums',fontSize:'0.9rem' }}>{fmt(s.monto)}</div>
                  <div style={{ color:'var(--ink-2)',fontSize:'0.8rem' }}>Inició: {s.fecha_alta}</div>
                </div>
              ))}
            </>
          ) : (
            <div style={{ color:'var(--ink-2)',fontSize:'0.9rem',textAlign:'center' }}>Selecciona un día con cobros</div>
          )}
        </div>
      </div>
    </div>
  )
}
