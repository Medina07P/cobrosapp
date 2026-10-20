import { useEffect, useMemo, useRef, useState } from 'react'
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
import { validarCliente } from '../lib/validaciones.js'
import { enfocarPrimerInvalido } from '../lib/formularios.js'

const FORM_VACIO = { nombre: '', correo: '' }

const enfocarNombre = () => document.getElementById('cliente-nombre')?.focus()

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [subs, setSubs] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [form, setForm] = useState(FORM_VACIO)
  const [errores, setErrores] = useState({})
  const [editando, setEditando] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [aEliminar, setAEliminar] = useState(null)
  const [eliminando, setEliminando] = useState(false)
  const [nombreEliminar, setNombreEliminar] = useState('')
  const formRef = useRef(null)

  const hayDatos = useRef(false)

  const cargar = async () => {
    setErrorCarga('')
    try {
      const [c, s] = await Promise.all([api.getClientes(), api.getSuscripciones()])
      setClientes(c)
      setSubs(s)
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

  const pedirEliminar = (c) => {
    setNombreEliminar(c.nombre)
    setAEliminar(c)
  }

  useEffect(() => { cargar() }, [])

  const porCliente = useMemo(() => {
    const map = {}
    subs.forEach((s) => { if (s.activa) map[s.cliente_id] = (map[s.cliente_id] || 0) + 1 })
    return map
  }, [subs])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return clientes
    return clientes.filter((c) =>
      (c.nombre || '').toLowerCase().includes(q) || (c.correo || '').toLowerCase().includes(q))
  }, [clientes, busqueda])

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

  const editar = (c) => {
    setEditando(c)
    setForm({ nombre: c.nombre, correo: c.correo })
    setErrores({})
    requestAnimationFrame(() => {
      const el = document.getElementById('cliente-nombre')
      el?.focus()
      el?.scrollIntoView({ block: 'nearest' })
    })
  }

  const guardar = async (e) => {
    e.preventDefault()
    if (guardando) return
    const v = validarCliente(form)
    if (Object.keys(v).length > 0) {
      setErrores(v)
      requestAnimationFrame(() => enfocarPrimerInvalido(formRef.current))
      return
    }
    setGuardando(true)
    try {
      const datos = { nombre: form.nombre.trim(), correo: form.correo.trim() }
      if (editando) {
        await api.updateCliente(editando.id, datos)
        toast.exito('Cliente actualizado.')
      } else {
        await api.createCliente(datos)
        toast.exito('Cliente creado.')
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
      await api.deleteCliente(aEliminar.id)
      toast.exito('Cliente eliminado.')
      if (editando && editando.id === aEliminar.id) limpiarForm()
      await cargar()
      requestAnimationFrame(() => {
        const el = document.getElementById('cliente-buscar') || document.getElementById('cliente-nombre')
        el?.focus()
      })
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
  } else if (clientes.length === 0) {
    lista = (
      <EmptyState
        icono="users"
        nivel={2}
        titulo="Aún no tienes clientes"
        accion={<Button icono="plus" onClick={enfocarNombre}>Agregar cliente</Button>}
      >
        Agrega el primero con el formulario de arriba.
      </EmptyState>
    )
  } else {
    lista = (
      <>
        <div className="herramientas">
          <Field
            label="Buscar"
            type="search"
            id="cliente-buscar"
            placeholder="Nombre o correo"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        {filtrados.length === 0 ? (
          <EmptyState icono="magnifying-glass" nivel={2} titulo="Sin resultados">
            {`Ningún cliente coincide con «${busqueda.trim()}».`}
          </EmptyState>
        ) : (
          <div className="tabla-wrap" tabIndex={0} role="region" aria-label="Lista de clientes">
            <table className="tabla">
              <caption className="sr-only">Lista de clientes</caption>
              <thead>
                <tr>
                  <th scope="col">Nombre</th>
                  <th scope="col">Correo</th>
                  <th scope="col" className="num">Suscripciones activas</th>
                  <th scope="col" className="acciones">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Nombre">{c.nombre}</td>
                    <td data-label="Correo">{c.correo}</td>
                    <td data-label="Suscripciones activas" className="num">{porCliente[c.id] || 0}</td>
                    <td data-label="Acciones" className="acciones">
                      <Button variante="secundario" tam="sm" icono="pencil-simple" aria-label={`Editar a ${c.nombre}`} disabled={guardando} onClick={() => editar(c)}>Editar</Button>
                      <Button variante="peligro" tam="sm" icono="trash" aria-label={`Eliminar a ${c.nombre}`} disabled={guardando} onClick={() => pedirEliminar(c)}>Eliminar</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="pagina">
      <PageHeader titulo="Clientes" descripcion="Las personas o negocios a los que les cobras." />

      <section className="panel">
        <h2 className="panel-titulo">{editando ? `Editar a ${editando.nombre}` : 'Nuevo cliente'}</h2>
        <form ref={formRef} noValidate onSubmit={guardar}>
          <div className="form-grid">
            <Field
              label="Nombre"
              id="cliente-nombre"
              requerido
              autoComplete="off"
              maxLength={120}
              value={form.nombre}
              onChange={cambiar('nombre')}
              error={errores.nombre}
            />
            <Field
              label="Correo"
              id="cliente-correo"
              type="email"
              inputMode="email"
              requerido
              autoComplete="off"
              value={form.correo}
              onChange={cambiar('correo')}
              error={errores.correo}
            />
          </div>
          <div className="form-acciones">
            <Button type="submit" cargando={guardando} icono={editando ? 'check' : 'plus'}>
              {editando ? 'Guardar cambios' : 'Crear cliente'}
            </Button>
            {editando && <Button variante="secundario" disabled={guardando} onClick={cancelar}>Cancelar</Button>}
          </div>
        </form>
      </section>

      {lista}

      <ConfirmDialog
        abierto={aEliminar !== null}
        titulo="Eliminar cliente"
        peligro
        textoConfirmar="Eliminar"
        cargando={eliminando}
        onConfirmar={eliminar}
        onCancelar={() => setAEliminar(null)}
      >
        {`¿Eliminar a ${nombreEliminar}? Esta acción no se puede deshacer.`}
      </ConfirmDialog>
    </div>
  )
}
