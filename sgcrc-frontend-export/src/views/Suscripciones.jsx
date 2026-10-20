import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api.js'
import PageHeader from '../ui/PageHeader.jsx'
import Field from '../ui/Field.jsx'
import Button from '../ui/Button.jsx'
import ConfirmDialog from '../ui/ConfirmDialog.jsx'
import EmptyState from '../ui/EmptyState.jsx'
import ErrorMsg from '../ui/ErrorMsg.jsx'
import Skeleton from '../ui/Skeleton.jsx'
import { EstadoBadge } from '../ui/Badge.jsx'
import { toast } from '../ui/Toast.jsx'
import { validarSuscripcion } from '../lib/validaciones.js'
import { enfocarPrimerInvalido } from '../lib/formularios.js'
import { fmt, fmtFecha } from '../lib/formato.js'

const enfocarCliente = () => document.getElementById('sub-cliente')?.focus()

// Fecha local AAAA-MM-DD (la conversión a UTC desfasaría el día).
const fechaHoyLocal = () => {
  const d = new Date()
  const dos = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`
}

const capitalizar = (t) => {
  const s = String(t || '').toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const FILTROS = [
  { id: 'todas', texto: 'Todas' },
  { id: 'activas', texto: 'Activas' },
  { id: 'inactivas', texto: 'Inactivas' },
]

export default function Suscripciones() {
  const [hoy] = useState(fechaHoyLocal)
  const formVacio = useMemo(
    () => ({ cliente_id: '', plan_id: '', activa: true, descripcion: '', fecha_alta: hoy }),
    [hoy],
  )
  const [subs, setSubs] = useState([])
  const [clientes, setClientes] = useState([])
  const [planes, setPlanes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [form, setForm] = useState(formVacio)
  const [errores, setErrores] = useState({})
  const [editando, setEditando] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [filtro, setFiltro] = useState('todas')
  const [busqueda, setBusqueda] = useState('')
  const [aEliminar, setAEliminar] = useState(null)
  const [eliminando, setEliminando] = useState(false)
  const [nombreEliminar, setNombreEliminar] = useState('')
  const formRef = useRef(null)

  const cargar = async () => {
    setErrorCarga('')
    try {
      const [s, c, p] = await Promise.all([api.getSuscripciones(), api.getClientes(), api.getPlanes()])
      setSubs(s)
      setClientes(c)
      setPlanes(p)
    } catch (e) {
      setErrorCarga(e.message)
    } finally {
      setCargando(false)
    }
  }

  const reintentar = () => {
    setCargando(true)
    setErrorCarga('')
    cargar()
  }

  useEffect(() => { cargar() }, [])

  const nombreCliente = (s) => clientes.find((c) => c.id === s.cliente_id)?.nombre || 'Cliente eliminado'

  const pedirEliminar = (s) => {
    setNombreEliminar(nombreCliente(s))
    setAEliminar(s)
  }

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return subs.filter((s) => {
      if (filtro === 'activas' && !s.activa) return false
      if (filtro === 'inactivas' && s.activa) return false
      if (!q) return true
      const nombre = (clientes.find((c) => c.id === s.cliente_id)?.nombre || 'Cliente eliminado').toLowerCase()
      return nombre.includes(q) || (s.descripcion || '').toLowerCase().includes(q)
    })
  }, [subs, clientes, filtro, busqueda])

  const cambiar = (campo) => (e) => {
    const valor = e.target.value
    setForm((p) => ({ ...p, [campo]: valor }))
    setErrores((p) => (p[campo] ? { ...p, [campo]: undefined } : p))
  }

  const limpiarForm = () => {
    setForm(formVacio)
    setErrores({})
    setEditando(null)
  }

  const cancelar = () => {
    limpiarForm()
    requestAnimationFrame(enfocarCliente)
  }

  const editar = (s) => {
    setEditando(s)
    setForm({
      cliente_id: String(s.cliente_id),
      plan_id: String(s.plan_id),
      activa: !!s.activa,
      descripcion: s.descripcion || '',
      fecha_alta: (s.fecha_alta || hoy).slice(0, 10),
    })
    setErrores({})
    requestAnimationFrame(() => {
      const el = document.getElementById('sub-cliente')
      el?.focus()
      el?.scrollIntoView({ block: 'nearest' })
    })
  }

  const guardar = async (e) => {
    e.preventDefault()
    if (guardando) return
    const v = validarSuscripcion(form)
    if (Object.keys(v).length > 0) {
      setErrores(v)
      requestAnimationFrame(() => enfocarPrimerInvalido(formRef.current))
      return
    }
    setGuardando(true)
    try {
      const datos = {
        cliente_id: Number(form.cliente_id),
        plan_id: Number(form.plan_id),
        activa: !!form.activa,
        descripcion: form.descripcion.trim(),
        fecha_alta: form.fecha_alta,
      }
      if (editando) {
        await api.updateSuscripcion(editando.id, datos)
        toast.exito('Suscripción actualizada.')
      } else {
        await api.createSuscripcion(datos)
        toast.exito('Suscripción creada.')
      }
      limpiarForm()
      await cargar()
      requestAnimationFrame(enfocarCliente)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async () => {
    if (!aEliminar) return
    setEliminando(true)
    try {
      await api.deleteSuscripcion(aEliminar.id)
      toast.exito('Suscripción eliminada.')
      if (editando && editando.id === aEliminar.id) limpiarForm()
      await cargar()
      requestAnimationFrame(enfocarCliente)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setEliminando(false)
      setAEliminar(null)
    }
  }

  let formulario
  if (clientes.length === 0) {
    formulario = (
      <EmptyState icono="users" nivel={2} titulo="Aún no hay clientes">
        Primero crea un cliente en Clientes.
      </EmptyState>
    )
  } else if (planes.length === 0) {
    formulario = (
      <EmptyState icono="tag" nivel={2} titulo="Aún no hay planes">
        Primero crea un plan en Planes.
      </EmptyState>
    )
  } else {
    formulario = (
      <form ref={formRef} noValidate onSubmit={guardar}>
        <div className="form-grid">
          <Field
            label="Cliente"
            id="sub-cliente"
            as="select"
            requerido
            value={form.cliente_id}
            onChange={cambiar('cliente_id')}
            error={errores.cliente_id}
          >
            <option value="">Elige un cliente</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </Field>
          <Field
            label="Plan"
            id="sub-plan"
            as="select"
            requerido
            value={form.plan_id}
            onChange={cambiar('plan_id')}
            error={errores.plan_id}
          >
            <option value="">Elige un plan</option>
            {planes.map((p) => <option key={p.id} value={p.id}>{`${p.nombre_plan} · ${fmt(p.monto)}`}</option>)}
          </Field>
          <Field
            label="Fecha de inicio"
            id="sub-fecha"
            type="date"
            ayuda="Define el día en que se repite el cobro."
            value={form.fecha_alta}
            onChange={cambiar('fecha_alta')}
            error={errores.fecha_alta}
          />
          <Field
            label="Nota"
            id="sub-nota"
            autoComplete="off"
            maxLength={500}
            placeholder="Ej.: ubicación, tipo de servicio"
            value={form.descripcion}
            onChange={cambiar('descripcion')}
          />
        </div>
        <div className="form-acciones">
          <label className="check">
            <input
              type="checkbox"
              checked={form.activa}
              onChange={(e) => setForm((p) => ({ ...p, activa: e.target.checked }))}
            />
            Suscripción activa
          </label>
        </div>
        <div className="form-acciones">
          <Button type="submit" cargando={guardando} icono={editando ? 'check' : 'plus'}>
            {editando ? 'Guardar cambios' : 'Crear suscripción'}
          </Button>
          {editando && <Button variante="secundario" disabled={guardando} onClick={cancelar}>Cancelar</Button>}
        </div>
      </form>
    )
  }

  let lista
  if (subs.length === 0) {
    lista = (
      <EmptyState icono="arrows-clockwise" nivel={2} titulo="Aún no hay suscripciones">
        Cuando crees una, aparecerá aquí.
      </EmptyState>
    )
  } else {
    const q = busqueda.trim()
    lista = (
      <>
        <div className="herramientas">
          <div role="group" aria-label="Filtrar por estado" className="form-acciones">
            {FILTROS.map((f) => (
              <Button
                key={f.id}
                tam="sm"
                variante={filtro === f.id ? 'primario' : 'secundario'}
                aria-pressed={filtro === f.id}
                onClick={() => setFiltro(f.id)}
              >
                {f.texto}
              </Button>
            ))}
          </div>
          <Field
            label="Buscar"
            type="search"
            id="sub-buscar"
            placeholder="Cliente o nota"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        {filtradas.length === 0 ? (
          <EmptyState icono="magnifying-glass" nivel={2} titulo="Sin resultados">
            {q ? `Ninguna suscripción coincide con «${q}».` : 'No hay suscripciones con este filtro.'}
          </EmptyState>
        ) : (
          <div className="tabla-wrap" tabIndex={0} role="region" aria-label="Lista de suscripciones">
            <table className="tabla">
              <caption className="sr-only">Lista de suscripciones</caption>
              <thead>
                <tr>
                  <th scope="col">Cliente</th>
                  <th scope="col">Plan</th>
                  <th scope="col">Inicio</th>
                  <th scope="col" className="num">Monto</th>
                  <th scope="col">Estado</th>
                  <th scope="col" className="acciones">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((s) => {
                  const nombre = nombreCliente(s)
                  return (
                    <tr key={s.id}>
                      <td data-label="Cliente">
                        {nombre}
                        <span className="celda-nota">{s.descripcion || 'Sin nota'}</span>
                      </td>
                      <td data-label="Plan">
                        {s.tipo}
                        <span className="celda-nota">{capitalizar(s.frecuencia)}</span>
                      </td>
                      <td data-label="Inicio">{fmtFecha(s.fecha_alta)}</td>
                      <td data-label="Monto" className="num">{fmt(s.monto)}</td>
                      <td data-label="Estado"><EstadoBadge estado={s.activa ? 'Activa' : 'Inactiva'} /></td>
                      <td data-label="Acciones" className="acciones">
                        <Button variante="secundario" tam="sm" icono="pencil-simple" aria-label={`Editar la suscripción de ${nombre}`} disabled={guardando} onClick={() => editar(s)}>Editar</Button>
                        <Button variante="peligro" tam="sm" icono="trash" aria-label={`Eliminar la suscripción de ${nombre}`} onClick={() => pedirEliminar(s)}>Eliminar</Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </>
    )
  }

  let contenido
  if (cargando) {
    contenido = <Skeleton />
  } else if (errorCarga) {
    contenido = <ErrorMsg msg={errorCarga} onRetry={reintentar} />
  } else {
    contenido = (
      <>
        <section className="panel">
          <h2 className="panel-titulo">{editando ? `Editar la suscripción de ${nombreCliente(editando)}` : 'Nueva suscripción'}</h2>
          {formulario}
        </section>
        {lista}
      </>
    )
  }

  return (
    <div className="pagina">
      <PageHeader titulo="Suscripciones" descripcion="Qué plan paga cada cliente y desde cuándo." />
      {contenido}
      <ConfirmDialog
        abierto={aEliminar !== null}
        titulo="Eliminar suscripción"
        peligro
        textoConfirmar="Eliminar"
        cargando={eliminando}
        onConfirmar={eliminar}
        onCancelar={() => setAEliminar(null)}
      >
        {`¿Eliminar la suscripción de ${nombreEliminar}? Dejará de recibir recordatorios de cobro.`}
      </ConfirmDialog>
    </div>
  )
}
