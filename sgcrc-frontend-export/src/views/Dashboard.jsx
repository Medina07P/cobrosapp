import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api.js'
import Badge from '../ui/Badge.jsx'
import ConfirmDialog from '../ui/ConfirmDialog.jsx'
import { toast } from '../ui/Toast.jsx'
import Button from '../ui/Button.jsx'
import PageHeader from '../ui/PageHeader.jsx'
import ErrorMsg from '../ui/ErrorMsg.jsx'
import Skeleton from '../ui/Skeleton.jsx'
import EmptyState from '../ui/EmptyState.jsx'
import { fmt, fmtFecha, esDelDia } from '../lib/formato.js'
import { mensajeError } from '../lib/errores.js'
import { aISOLocal, proximosCobros, textoDias } from '../lib/dashboard.js'
import { clientesEnRebote, separarPendientesPorRebote } from '../lib/rebotes.js'
import { useCarga } from '../lib/useCarga.js'

const suma = (items) => items.reduce((a, i) => a + (Number(i.monto) || 0), 0)

function Cifra({ rotulo, valor, sub, mal = false }) {
  return (
    <div className={`cifra${mal ? ' cifra-mal' : ''}`}>
      <dt className="cifra-rotulo">{rotulo}</dt>
      <dd className="cifra-valor">{valor}</dd>
      {sub && <dd className="cifra-sub">{sub}</dd>}
    </div>
  )
}

export default function Dashboard({ onNavegar }) {
  const { datos: data, cargando, error, cargar, reintentar } = useCarga(async () => {
    const [clientes, suscripciones, historial, resumen] = await Promise.all([
      api.getClientes(), api.getSuscripciones(), api.getHistorial(), api.getResumenCobros(),
    ])
    return { clientes, suscripciones, historial, resumen }
  }, { avisoConDatos: 'error' })
  const [loadingProceso, setLoadingProceso] = useState(false)
  const [reenvio, setReenvio] = useState(null)
  const [resumenAbierto, setResumenAbierto] = useState(false)
  const montado = useRef(true)
  useEffect(() => {
    montado.current = true
    return () => { montado.current = false }
  }, [])

  const handleForzarCobros = async (confirmarReenvio = false) => {
    setLoadingProceso(true)
    try {
      const res = await api.runCobros({ confirmarReenvio })
      setReenvio(null)
      setResumenAbierto(false)
      setLoadingProceso(false)
      toast.exito(res.message || 'Proceso completado exitosamente')
      await cargar()
      // El diálogo devuelve el foco al botón, que tras la recarga puede quedar deshabilitado: lo movemos al contenido.
      requestAnimationFrame(() => {
        if (!montado.current) return
        const destino = document.getElementById('dash-hoy') || document.getElementById('contenido')
        destino?.focus()
      })
    } catch (err) {
      const errorStatus = err.response?.status || err.status
      const errorData = err.response?.data || err.data
      if (!montado.current) return
      if (errorStatus === 409 && errorData?.requiereConfirmacion) {
        setResumenAbierto(false)
        setReenvio(errorData?.mensaje || 'Ya se procesaron cobros hoy.')
        cargar() // los datos mostrados estaban obsoletos
      } else {
        setReenvio(null)
        setResumenAbierto(false)
        toast.error(errorData?.error || mensajeError(err))
      }
    } finally {
      if (montado.current) setLoadingProceso(false)
    }
  }

  const stats = useMemo(() => {
    if (!data) return null
    const { clientes, suscripciones, historial, resumen } = data
    const activas = suscripciones.filter((s) => s.activa)
    const ahora = new Date()
    const hoyApp = resumen?.hoy || aISOLocal(ahora)
    const paraHoy = resumen?.paraHoy || []
    const vencidos = resumen?.vencidos || []
    const perdidos = resumen?.perdidos || []
    return {
      clientes: clientes.length,
      activas: activas.length,
      ingresos: suma(activas),
      enviados: historial.filter((h) => h.estado === 'Enviado' && esDelDia(h.fecha, hoyApp)).length,
      fallidos: historial.filter((h) => h.estado === 'Fallido' && esDelDia(h.fecha, hoyApp)).length,
      paraHoy,
      vencidos,
      perdidos,
      ventanaDias: resumen?.ventanaDias,
      pendientes: [...paraHoy, ...vencidos],
      proximos: proximosCobros(suscripciones, clientes, hoyApp),
      rebotes: clientesEnRebote(clientes, suscripciones),
    }
  }, [data])

  if (!data) return (
    <div className="pagina">
      <PageHeader titulo="Dashboard" />
      {error ? <ErrorMsg msg={error} onRetry={reintentar} cargando={cargando} /> : <Skeleton />}
    </div>
  )

  const { enviables: pendientesEnvio, rebotados: pendientesRebote } =
    separarPendientesPorRebote(stats.pendientes, stats.rebotes)
  const hayEnviables = pendientesEnvio.length > 0
  const puedeReenviar = !hayEnviables && stats.enviados > 0
  const sinAccion = !hayEnviables && !puedeReenviar
  const nSubsRebote = stats.rebotes.reduce((a, r) => a + r.suscripciones, 0)
  const totalRebote = suma(stats.rebotes)
  const mes = new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })

  return (
    <div className="pagina">
      <PageHeader
        titulo="Dashboard"
        descripcion={`Resumen de ${mes}`}
        acciones={
          <Button
            variante="secundario" icono="paper-plane-tilt"
            disabled={sinAccion} cargando={loadingProceso && puedeReenviar}
            aria-describedby={sinAccion ? 'dash-sin-pendientes' : undefined}
            onClick={() => (hayEnviables ? setResumenAbierto(true) : handleForzarCobros(false))}
          >
            {puedeReenviar ? 'Reenviar cobros de hoy' : 'Revisar y enviar cobros de hoy'}
          </Button>
        }
      />
      {sinAccion && <p id="dash-sin-pendientes" className="dash-aviso">No hay cobros pendientes de enviar hoy.</p>}

      {error && <ErrorMsg msg={error} onRetry={reintentar} cargando={cargando} />}

      <section aria-labelledby="dash-hoy">
        <h2 id="dash-hoy" className="panel-titulo" tabIndex={-1}>Hoy</h2>
        <dl className="hoy-franja">
          <Cifra rotulo="Pendientes hoy" valor={stats.paraHoy.length} sub={fmt(suma(stats.paraHoy))} />
          <Cifra rotulo="Vencidos" valor={stats.vencidos.length} mal={stats.vencidos.length > 0} />
          <Cifra rotulo="Enviados hoy" valor={stats.enviados} />
          <Cifra rotulo="Fallidos" valor={stats.fallidos} />
        </dl>
        {stats.perdidos.length > 0 && (
          <p className="dash-aviso">
            {stats.perdidos.length} {stats.perdidos.length === 1 ? 'cobro quedó fuera' : 'cobros quedaron fuera'} de la
            ventana de reintento ({stats.ventanaDias} días) y ya no se reenvían.
          </p>
        )}
      </section>

      {stats.rebotes.length > 0 && (
        <section aria-labelledby="dash-rebotes" className="panel">
          <div className="seccion-cab">
            <div>
              <h2 id="dash-rebotes" className="panel-titulo">Clientes que no reciben cobros</h2>
              <p className="pagina-desc">
                {`${stats.rebotes.length === 1 ? '1 cliente con' : `${stats.rebotes.length} clientes con`} ${nSubsRebote === 1 ? '1 suscripción activa no está enviando' : `${nSubsRebote} suscripciones activas no están enviando`} recordatorios porque el correo rebotó (${fmt(totalRebote)} en total). Se reanudan al corregir la dirección.`}
              </p>
            </div>
            <Button variante="secundario" icono="pencil-simple" onClick={() => onNavegar('clientes')}>
              Corregir correos
            </Button>
          </div>
          <ul className="libro">
            {stats.rebotes.map((r) => (
              <li key={r.id} className="libro-fila">
                <div className="libro-fecha"><span className="libro-cliente">{r.nombre}</span></div>
                <div>
                  <p className="libro-detalle">{r.correo}</p>
                  <p className="libro-detalle">
                    {r.suscripciones === 1 ? '1 suscripción activa' : `${r.suscripciones} suscripciones activas`}
                  </p>
                </div>
                <p className="libro-monto">{fmt(r.monto)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="dash-resumen">
        <h2 id="dash-resumen" className="panel-titulo">Tu negocio</h2>
        <dl className="negocio">
          <Cifra rotulo="Clientes" valor={stats.clientes} />
          <Cifra rotulo="Suscripciones activas" valor={stats.activas} />
          <Cifra rotulo="Ingresos mensuales activos" valor={fmt(stats.ingresos)} />
        </dl>
      </section>

      <section aria-labelledby="dash-proximos" className="panel">
        <h2 id="dash-proximos" className="panel-titulo">Próximos cobros</h2>
        <p className="pagina-desc">Las próximas 5 suscripciones activas según su calendario de cobro.</p>
        {stats.proximos.length > 0 ? (
          <ol className="libro">
            {stats.proximos.map((f) => (
              <li key={f.id} className="libro-fila">
                <div className="libro-fecha">
                  <span>{fmtFecha(f.fecha)}</span>
                  {f.dias === 0
                    ? <Badge tono="warn" icono="bell">Hoy</Badge>
                    : <span className="libro-detalle">{textoDias(f.dias)}</span>}
                </div>
                <div>
                  <p className="libro-cliente">{f.cliente}</p>
                  <p className="libro-detalle">{f.plan} · {f.frecuencia}</p>
                </div>
                <p className="libro-monto">{fmt(f.monto)}</p>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState nivel={3} icono="calendar-blank" titulo="Sin cobros próximos">
            No hay cobros en los próximos 60 días.
          </EmptyState>
        )}
      </section>

      <ConfirmDialog
        abierto={resumenAbierto}
        titulo="Enviar cobros de hoy"
        textoConfirmar={`Enviar ${pendientesEnvio.length} ${pendientesEnvio.length === 1 ? 'cobro' : 'cobros'}`}
        cargando={loadingProceso && !reenvio}
        onConfirmar={() => handleForzarCobros(false)}
        onCancelar={() => setResumenAbierto(false)}
      >
        <p>Se enviará un recordatorio por correo a:</p>
        <ul className="resumen-envio">
          {pendientesEnvio.map((i) => (
            <li key={`${i.suscripcion_id}-${i.fechaCobro}`}>
              <span className="libro-cliente">{i.cliente}</span>
              <span className="libro-detalle">
                {i.plan} · {fmt(i.monto)}
                {i.diasVencido > 0 && ` · vencido hace ${i.diasVencido} ${i.diasVencido === 1 ? 'día' : 'días'}`}
              </span>
            </li>
          ))}
        </ul>
        <p className="resumen-total">Total: {fmt(suma(pendientesEnvio))}</p>
        {pendientesRebote.length > 0 && (
          <p className="dash-aviso">
            {pendientesRebote.length === 1 ? '1 cobro no se enviará' : `${pendientesRebote.length} cobros no se enviarán`}
            {' '}porque el correo del cliente rebotó.
          </p>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        abierto={reenvio !== null}
        titulo="Reenviar cobros de hoy"
        textoConfirmar="Reenviar"
        cargando={loadingProceso}
        onConfirmar={() => handleForzarCobros(true)}
        onCancelar={() => setReenvio(null)}
      >
        <p>{reenvio}</p>
        <p>¿Deseas forzar el reenvío para todos los pendientes de hoy?</p>
      </ConfirmDialog>
    </div>
  )
}
