import { useState, useEffect, useMemo, useRef } from 'react'
import { api } from '../api.js'
import { EstadoBadge } from '../ui/Badge.jsx'
import Skeleton from '../ui/Skeleton.jsx'
import ErrorMsg from '../ui/ErrorMsg.jsx'
import EmptyState from '../ui/EmptyState.jsx'
import Button from '../ui/Button.jsx'
import PageHeader from '../ui/PageHeader.jsx'
import { toast } from '../ui/Toast.jsx'
import { mensajeError } from '../lib/errores.js'
import { fmt } from '../lib/formato.js'
import { enriquecerHistorial, limitarFilas, fechaHistorial, textoRegistros, LIMITE_FILAS } from '../lib/historial.js'

const FILTROS = ['todos', 'Enviado', 'Fallido']

const SinDato = () => (
  <>
    <span aria-hidden="true">—</span>
    <span className="sr-only">Sin dato</span>
  </>
)

export default function Historial() {
  const [historial, setHistorial] = useState([])
  const [clientes, setClientes]   = useState([])
  const [subs, setSubs]           = useState([])
  const [cargando, setCargando]   = useState(true)
  const [error, setError]         = useState('')
  const [filtro, setFiltro]       = useState('todos')
  const [visibles, setVisibles]   = useState(LIMITE_FILAS)
  const [conDatos, setConDatos]   = useState(false)
  const hayDatos = useRef(false)
  const enCurso = useRef(false)
  const montado = useRef(true)
  const pieRef = useRef(null)

  const cargar = async () => {
    if (enCurso.current) return
    enCurso.current = true
    setCargando(true); setError('')
    try {
      const [h, c, s] = await Promise.all([api.getHistorial(), api.getClientes(), api.getSuscripciones()])
      if (!montado.current) return
      setHistorial(h); setClientes(c); setSubs(s)
      hayDatos.current = true
      setConDatos(true)
    } catch (e) {
      if (!montado.current) return
      // Con datos previos se conservan y se avisa con un toast; sin datos solo se muestra el error.
      if (hayDatos.current) toast.error(mensajeError(e))
      else setError(mensajeError(e))
    } finally {
      enCurso.current = false
      if (montado.current) setCargando(false)
    }
  }

  useEffect(() => {
    montado.current = true
    cargar()
    return () => { montado.current = false }
  }, [])

  const enriquecido = useMemo(() => enriquecerHistorial(historial, subs, clientes), [historial, subs, clientes])
  const filtrados = useMemo(
    () => (filtro === 'todos' ? enriquecido : enriquecido.filter(h => h.estado === filtro)),
    [enriquecido, filtro]
  )
  const total = useMemo(
    () => enriquecido.filter(h => h.estado === 'Enviado').reduce((a, h) => a + (Number(h.monto_final) || 0), 0),
    [enriquecido]
  )
  const fallidos = useMemo(() => enriquecido.filter(h => h.estado === 'Fallido').length, [enriquecido])
  const mostrados = limitarFilas(filtrados, visibles)

  const elegirFiltro = (f) => { setFiltro(f); setVisibles(LIMITE_FILAS) }
  const quitarFiltro = () => {
    elegirFiltro('todos')
    requestAnimationFrame(() => document.getElementById('hist-filtro-todos')?.focus())
  }
  const verMas = () => {
    setVisibles(v => v + LIMITE_FILAS)
    requestAnimationFrame(() => pieRef.current?.focus())
  }

  let cuerpo
  if (!conDatos && error) {
    cuerpo = <ErrorMsg msg={error} onRetry={cargar} />
  } else if (!conDatos) {
    cuerpo = <Skeleton />
  } else {
    cuerpo = (
      <>
        <div className="hist-barra">
          <div className="hist-filtros" role="group" aria-label="Filtrar por estado">
            {FILTROS.map(f => (
              <Button key={f} id={`hist-filtro-${f === 'todos' ? 'todos' : f.toLowerCase()}`} tam="sm" variante={filtro === f ? 'primario' : 'secundario'}
                aria-pressed={filtro === f} onClick={() => elegirFiltro(f)}>
                {f === 'todos' ? 'Todos' : f}
              </Button>
            ))}
          </div>
        </div>
        <p className="sr-only" aria-live="polite">{textoRegistros(filtrados.length)}</p>

        <div className="hist-resumen">
          <div className="hist-tarjeta">
            <div className="hist-cifra hist-cifra-ok">{fmt(total)}</div>
            <div className="hist-rotulo">Total cobrado (historial)</div>
          </div>
          <div className="hist-tarjeta">
            <div className="hist-cifra hist-cifra-mal">{fallidos}</div>
            <div className="hist-rotulo">Envíos fallidos</div>
          </div>
          <div className="hist-tarjeta">
            <div className="hist-cifra hist-cifra-info">{enriquecido.length}</div>
            <div className="hist-rotulo">Total registros</div>
          </div>
        </div>

        {enriquecido.length === 0 ? (
          <EmptyState icono="tag" nivel={2} titulo="Aún no hay envíos">
            Cuando se envíen recordatorios de cobro aparecerán aquí.
          </EmptyState>
        ) : filtrados.length === 0 ? (
          <EmptyState icono="magnifying-glass" nivel={2} titulo="Ningún envío con ese estado"
            accion={<Button variante="secundario" onClick={quitarFiltro}>Quitar filtro</Button>}>
            {`No hay envíos con estado «${filtro}».`}
          </EmptyState>
        ) : (
          <>
            <div className="tabla-wrap" tabIndex={0} role="region" aria-label="Historial de envíos">
              <table className="tabla" role="table">
                <caption className="sr-only">Historial de envíos</caption>
                <thead role="rowgroup">
                  <tr role="row">
                    <th role="columnheader" scope="col">Fecha</th>
                    <th role="columnheader" scope="col">Cliente</th>
                    <th role="columnheader" scope="col">Suscripción</th>
                    <th role="columnheader" scope="col" className="num">Monto</th>
                    <th role="columnheader" scope="col">Estado</th>
                  </tr>
                </thead>
                <tbody role="rowgroup">
                  {mostrados.map(h => {
                    const fecha = fechaHistorial(h.fecha_valida)
                    return (
                      <tr role="row" key={h.id}>
                        <td role="cell" data-label="Fecha" className="hist-fecha">{fecha || <SinDato />}</td>
                        <td role="cell" data-label="Cliente">{h.cli?.nombre || <SinDato />}</td>
                        <td role="cell" data-label="Suscripción">{h.sus?.tipo || <SinDato />}</td>
                        <td role="cell" data-label="Monto" className="num">{fmt(h.monto_final)}</td>
                        <td role="cell" data-label="Estado"><EstadoBadge estado={h.estado} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="hist-pie">
              <p ref={pieRef} tabIndex={-1}>Mostrando {mostrados.length} de {filtrados.length}</p>
              {mostrados.length < filtrados.length && (
                <Button variante="secundario" onClick={verMas}>Ver más</Button>
              )}
            </div>
          </>
        )}
      </>
    )
  }

  return (
    <div className="pagina">
      <PageHeader
        titulo="Historial de Envíos"
        acciones={<Button variante="secundario" tam="sm" icono="arrow-clockwise" cargando={cargando} onClick={cargar}>Actualizar</Button>}
      />
      {cuerpo}
    </div>
  )
}
