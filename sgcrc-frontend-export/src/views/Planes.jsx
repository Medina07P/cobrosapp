import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import PageHeader from '../ui/PageHeader.jsx'
import { mensajeError } from '../lib/errores.js'
import Field from '../ui/Field.jsx'
import Button from '../ui/Button.jsx'
import ConfirmDialog from '../ui/ConfirmDialog.jsx'
import EmptyState from '../ui/EmptyState.jsx'
import ErrorMsg from '../ui/ErrorMsg.jsx'
import Skeleton from '../ui/Skeleton.jsx'
import { toast } from '../ui/Toast.jsx'
import { validarPlan } from '../lib/validaciones.js'
import { enfocarPrimerInvalido } from '../lib/formularios.js'
import { fmt } from '../lib/formato.js'

const FORM_VACIO = { nombre_plan: '', monto: '', frecuencia: 'mensual', dia_cobro: 1 }

const enfocarNombre = () => document.getElementById('plan-nombre')?.focus()

const capitalizar = (t) => {
  const s = String(t || '').toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function Planes() {
  const [planes, setPlanes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [form, setForm] = useState(FORM_VACIO)
  const [errores, setErrores] = useState({})
  const [editando, setEditando] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [aEliminar, setAEliminar] = useState(null)
  const [eliminando, setEliminando] = useState(false)
  const [nombreEliminar, setNombreEliminar] = useState('')
  const formRef = useRef(null)

  const hayDatos = useRef(false)

  const cargar = async () => {
    setErrorCarga('')
    try {
      setPlanes(await api.getPlanes())
      hayDatos.current = true
    } catch (e) {
      // Tras una operación se conserva la lista y se avisa con un toast.
      if (hayDatos.current) toast.error(mensajeError(e))
      else setErrorCarga(mensajeError(e))
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

  const pedirEliminar = (p) => {
    setNombreEliminar(p.nombre_plan)
    setAEliminar(p)
  }

  const cambiar = (campo) => (e) => {
    const valor = e.target.value
    setForm((p) => ({ ...p, [campo]: valor }))
    setErrores((p) => (p[campo] ? { ...p, [campo]: undefined } : p))
  }

  const limpiarForm = () => {
    setForm(FORM_VACIO)
    setErrores({})
    setEditando(null)
  }

  const cancelar = () => {
    limpiarForm()
    requestAnimationFrame(enfocarNombre)
  }

  const editar = (p) => {
    setEditando(p)
    setForm({ nombre_plan: p.nombre_plan, monto: String(p.monto), frecuencia: p.frecuencia, dia_cobro: p.dia_cobro })
    setErrores({})
    requestAnimationFrame(() => {
      const el = document.getElementById('plan-nombre')
      el?.focus()
      el?.scrollIntoView({ block: 'nearest' })
    })
  }

  const guardar = async (e) => {
    e.preventDefault()
    if (guardando) return
    const v = validarPlan(form)
    if (Object.keys(v).length > 0) {
      setErrores(v)
      requestAnimationFrame(() => enfocarPrimerInvalido(formRef.current))
      return
    }
    setGuardando(true)
    try {
      const datos = {
        nombre_plan: form.nombre_plan.trim(),
        monto: Number(form.monto),
        frecuencia: form.frecuencia,
        dia_cobro: Number(form.dia_cobro),
      }
      if (editando) {
        await api.updatePlan(editando.id, datos)
        toast.exito('Plan actualizado.')
      } else {
        await api.createPlan(datos)
        toast.exito('Plan creado.')
      }
      limpiarForm()
      await cargar()
      requestAnimationFrame(enfocarNombre)
    } catch (err) {
      toast.error(mensajeError(err))
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async () => {
    if (!aEliminar || eliminando) return
    setEliminando(true)
    try {
      await api.deletePlan(aEliminar.id)
      toast.exito('Plan eliminado.')
      if (editando && editando.id === aEliminar.id) limpiarForm()
      await cargar()
      requestAnimationFrame(enfocarNombre)
    } catch (err) {
      toast.error(mensajeError(err))
    } finally {
      setEliminando(false)
      setAEliminar(null)
    }
  }

  let lista
  if (cargando) {
    lista = <Skeleton />
  } else if (errorCarga) {
    lista = <ErrorMsg msg={errorCarga} onRetry={reintentar} />
  } else if (planes.length === 0) {
    lista = (
      <EmptyState
        icono="tag"
        nivel={2}
        titulo="Aún no tienes planes"
        accion={<Button icono="plus" onClick={enfocarNombre}>Crear mi primer plan</Button>}
      >
        Crea el primero con el formulario de arriba.
      </EmptyState>
    )
  } else {
    lista = (
      <div className="tabla-wrap" tabIndex={0} role="region" aria-label="Lista de planes">
        <table className="tabla" role="table">
          <caption className="sr-only">Lista de planes</caption>
          <thead role="rowgroup">
            <tr role="row">
              <th role="columnheader" scope="col">Nombre del plan</th>
              <th role="columnheader" scope="col" className="num">Precio</th>
              <th role="columnheader" scope="col">Día de cobro</th>
              <th role="columnheader" scope="col" className="acciones">Acciones</th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {planes.map((p) => (
              <tr role="row" key={p.id}>
                <td role="cell" data-label="Nombre del plan">
                  {p.nombre_plan}
                  <span className="celda-nota">{capitalizar(p.frecuencia)}</span>
                </td>
                <td role="cell" data-label="Precio" className="num">{fmt(p.monto)}</td>
                <td role="cell" data-label="Día de cobro">{`Día ${p.dia_cobro}`}</td>
                <td role="cell" data-label="Acciones" className="acciones">
                  <Button variante="secundario" tam="sm" icono="pencil-simple" aria-label={`Editar ${p.nombre_plan}`} disabled={guardando} onClick={() => editar(p)}>Editar</Button>
                  <Button variante="peligro" tam="sm" icono="trash" aria-label={`Eliminar ${p.nombre_plan}`} disabled={guardando} onClick={() => pedirEliminar(p)}>Eliminar</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="pagina">
      <PageHeader titulo="Planes" descripcion="Lo que cobras y cada cuánto: tus planes se asignan a los clientes como suscripciones." />

      <section className="panel">
        <h2 className="panel-titulo">{editando ? `Editar ${editando.nombre_plan}` : 'Nuevo plan'}</h2>
        <form ref={formRef} noValidate onSubmit={guardar}>
          <div className="form-grid">
            <Field
              label="Nombre del plan"
              id="plan-nombre"
              requerido
              autoComplete="off"
              maxLength={120}
              placeholder="Ej.: Plan Oro"
              value={form.nombre_plan}
              onChange={cambiar('nombre_plan')}
              error={errores.nombre_plan}
            />
            <Field
              label="Precio en COP"
              id="plan-monto"
              type="text"
              inputMode="decimal"
              requerido
              autoComplete="off"
              ayuda="Solo números, sin puntos ni signos."
              value={form.monto}
              onChange={cambiar('monto')}
              error={errores.monto}
            />
            <Field
              label="Frecuencia"
              id="plan-frecuencia"
              as="select"
              value={form.frecuencia}
              onChange={cambiar('frecuencia')}
              error={errores.frecuencia}
            >
              <option value="semanal">Semanal</option>
              <option value="quincenal">Quincenal</option>
              <option value="mensual">Mensual</option>
              <option value="anual">Anual</option>
            </Field>
            <Field
              label="Día de cobro"
              id="plan-dia"
              type="number"
              min={1}
              max={31}
              ayuda="Solo se usa en suscripciones sin fecha de inicio; en las demás el cobro cae el día de su fecha de inicio."
              value={form.dia_cobro}
              onChange={cambiar('dia_cobro')}
              error={errores.dia_cobro}
            />
          </div>
          <div className="form-acciones">
            <Button type="submit" cargando={guardando} icono={editando ? 'check' : 'plus'}>
              {editando ? 'Guardar cambios' : 'Crear plan'}
            </Button>
            {editando && <Button variante="secundario" disabled={guardando} onClick={cancelar}>Cancelar</Button>}
          </div>
        </form>
      </section>

      {lista}

      <ConfirmDialog
        abierto={aEliminar !== null}
        titulo="Eliminar plan"
        peligro
        textoConfirmar="Eliminar"
        cargando={eliminando}
        onConfirmar={eliminar}
        onCancelar={() => setAEliminar(null)}
      >
        {`¿Eliminar el plan ${nombreEliminar}? Solo se puede eliminar si ninguna suscripción lo usa.`}
      </ConfirmDialog>
    </div>
  )
}
