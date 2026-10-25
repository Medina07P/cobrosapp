import { useState, useMemo } from 'react'
import { api } from '../api.js'
import Skeleton from '../ui/Skeleton.jsx'
import ErrorMsg from '../ui/ErrorMsg.jsx'
import EmptyState from '../ui/EmptyState.jsx'
import Button from '../ui/Button.jsx'
import PageHeader from '../ui/PageHeader.jsx'
import { fmt, fmtFecha } from '../lib/formato.js'
import { MESES, rejillaMes, agruparCobrosPorDia, fechaLarga, etiquetaAgenda } from '../lib/calendario.js'
import { useCarga } from '../lib/useCarga.js'

const VACIO = []

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const plural = (n) => `${n} ${n === 1 ? 'cobro' : 'cobros'}`

export default function Calendario() {
  const { datos, hayDatos: cargado, cargando, error, reintentar } = useCarga(async () => {
    const [subs, clientes] = await Promise.all([api.getSuscripciones(), api.getClientes()])
    return { subs: subs.filter((x) => x.activa), clientes }
  })
  const subs = datos?.subs ?? VACIO
  const clientes = datos?.clientes ?? VACIO
  const [selected, setSelected] = useState(null)

  const hoy = new Date()
  const [view, setView] = useState({ month: hoy.getMonth(), year: hoy.getFullYear() })

  const { dias: daysInMonth, desfase } = rejillaMes(view.year, view.month)
  const cobrosPorDia = useMemo(
    () => agruparCobrosPorDia(subs, clientes, view.year, view.month),
    [subs, clientes, view.month, view.year]
  )
  const diasConCobros = useMemo(
    () => Object.keys(cobrosPorDia).map(Number).sort((a, b) => a - b),
    [cobrosPorDia]
  )

  const prev = () => { setSelected(null); setView(v => v.month === 0  ? { month: 11, year: v.year - 1 } : { month: v.month - 1, year: v.year }) }
  const next = () => { setSelected(null); setView(v => v.month === 11 ? { month: 0,  year: v.year + 1 } : { month: v.month + 1, year: v.year }) }
  const irAHoy = () => {
    const h = new Date()
    const m = h.getMonth(), y = h.getFullYear()
    setView({ month: m, year: y })
    // Solo se selecciona hoy si tiene cobros; si no, se navega al mes sin selección.
    setSelected(agruparCobrosPorDia(subs, clientes, y, m)[h.getDate()] ? h.getDate() : null)
  }

  const cabecera = <PageHeader titulo="Calendario de Cobros" />

  if (!cargado && error) return <div className="pagina">{cabecera}<ErrorMsg msg={error} onRetry={reintentar} cargando={cargando} /></div>
  if (!cargado) return <div className="pagina">{cabecera}<Skeleton /></div>
  if (subs.length === 0) {
    return (
      <div className="pagina">
        {cabecera}
        <EmptyState icono="calendar-blank" nivel={2} titulo="Aún no hay suscripciones activas">
          Cuando tengas suscripciones activas, sus cobros aparecerán en el calendario.
        </EmptyState>
      </div>
    )
  }

  const cells = [...Array(desfase).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const selectedData = selected ? cobrosPorDia[selected] : null
  const mesVacio = Object.keys(cobrosPorDia).length === 0

  return (
    <div className="pagina">
      {cabecera}

      <div className="cal-layout">
        <div className="panel cal-panel">
          <div className="cal-barra">
            <Button variante="secundario" icono="caret-left" className="cal-nav" onClick={prev} aria-label="Mes anterior" />
            <h2 className="cal-mes" aria-live="polite">{MESES[view.month]} {view.year}</h2>
            <Button variante="secundario" icono="caret-right" className="cal-nav" onClick={next} aria-label="Mes siguiente" />
            <Button variante="secundario" className="cal-hoy" onClick={irAHoy}>Hoy</Button>
          </div>

          <div className="cal-semana" aria-hidden="true">
            {DIAS.map(d => <div key={d} className="cal-dia-sem">{d}</div>)}
          </div>

          <div className="cal-rejilla">
            {cells.map((day, i) => {
              if (!day) return <div key={`e${i}`} aria-hidden="true" />
              const esHoy = day === hoy.getDate() && view.month === hoy.getMonth() && view.year === hoy.getFullYear()
              const cobros = cobrosPorDia[day]
              const sel = selected === day
              const clases = ['cal-celda', cobros ? 'cal-celda-cobros' : '', sel ? 'cal-celda-sel' : '', esHoy ? 'cal-celda-hoy' : ''].filter(Boolean).join(' ')
              if (!cobros) {
                return (
                  <div key={day} className={clases} aria-current={esHoy ? 'date' : undefined} aria-hidden={esHoy ? undefined : 'true'}>
                    <div className="cal-num">{day}</div>
                    {esHoy && <span className="sr-only">{day} de {MESES[view.month]}, hoy, sin cobros</span>}
                  </div>
                )
              }
              const n = cobros.items.length
              return (
                <button
                  key={day}
                  type="button"
                  className={clases}
                  aria-pressed={sel}
                  aria-current={esHoy ? 'date' : undefined}
                  aria-label={`${day} de ${MESES[view.month]}${esHoy ? ', hoy' : ''}, ${plural(n)}, ${fmt(cobros.total)}`}
                  onClick={() => setSelected(sel ? null : day)}
                >
                  <span className="cal-num">{day}</span>
                  <span className="cal-importe" title={fmt(cobros.total)}>{fmt(cobros.total)}</span>
                  <span className="cal-cuenta">{n}<span className="cal-cuenta-txt"> {n === 1 ? 'cobro' : 'cobros'}</span></span>
                </button>
              )
            })}
          </div>

          <section className="cal-agenda" aria-label="Agenda del mes">
            {diasConCobros.length === 0 ? (
              <p className="cal-detalle-vacio">Este mes no tiene cobros</p>
            ) : diasConCobros.map((dia) => {
              const datos = cobrosPorDia[dia]
              const esHoy = dia === hoy.getDate() && view.month === hoy.getMonth() && view.year === hoy.getFullYear()
              return (
                <article key={dia} className={`cal-agenda-dia${esHoy ? ' cal-agenda-hoy' : ''}`} aria-current={esHoy ? 'date' : undefined}>
                  <h3 className="cal-agenda-titulo">
                    {etiquetaAgenda(view.year, view.month, dia)}{esHoy && ' (hoy)'}
                    <span className="sr-only">, total </span>
                    <span className="cal-agenda-total">{fmt(datos.total)}</span>
                  </h3>
                  {datos.items.map((s, idx) => (
                    <div key={`${s.id}-${idx}`} className="cal-item">
                      <div className="cal-item-cab">
                        <div className="cal-item-nombre">{s.cl?.nombre || 'Cliente eliminado'}</div>
                        <span className="cal-chip">{s.frecuencia || 'mensual'}</span>
                      </div>
                      <div className="cal-item-tipo">{s.tipo}</div>
                      <div className="cal-item-monto">{fmt(s.monto)}</div>
                    </div>
                  ))}
                </article>
              )
            })}
          </section>
        </div>

        <div className="panel cal-detalle" role="region" aria-label="Detalle del día">
          <p className="sr-only" aria-live="polite">
            {selectedData ? `${fechaLarga(view.year, view.month, selected)}: ${selectedData.items.length} ${selectedData.items.length === 1 ? 'cobro' : 'cobros'}, ${fmt(selectedData.total)}` : ''}
          </p>
          {selectedData ? (
            <>
              <h3 className="cal-detalle-titulo">{fechaLarga(view.year, view.month, selected)}</h3>
              <div className="cal-detalle-total">{fmt(selectedData.total)}</div>
              {selectedData.items.map((s, idx) => (
                <div key={`${s.id}-${idx}`} className="cal-item">
                  <div className="cal-item-cab">
                    <div className="cal-item-nombre">{s.cl?.nombre || 'Cliente eliminado'}</div>
                    <span className="cal-chip">{s.frecuencia || 'mensual'}</span>
                  </div>
                  <div className="cal-item-tipo">{s.tipo}</div>
                  <div className="cal-item-monto">{fmt(s.monto)}</div>
                  <div className="cal-item-fecha">Inició: {fmtFecha(s.fecha_alta) || 'Sin fecha'}</div>
                </div>
              ))}
            </>
          ) : (
            <p className="cal-detalle-vacio">{mesVacio ? 'Este mes no tiene cobros' : 'Selecciona un día con cobros'}</p>
          )}
        </div>
      </div>
    </div>
  )
}
