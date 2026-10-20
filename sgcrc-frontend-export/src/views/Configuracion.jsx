import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import PageHeader from '../ui/PageHeader.jsx'
import Field from '../ui/Field.jsx'
import Button from '../ui/Button.jsx'
import Icon from '../ui/Icon.jsx'
import ErrorMsg from '../ui/ErrorMsg.jsx'
import Skeleton from '../ui/Skeleton.jsx'
import { toast } from '../ui/Toast.jsx'
import { validarPerfil } from '../lib/validaciones.js'
import { enfocarPrimerInvalido } from '../lib/formularios.js'
import { aplicarColorTema, COLOR_POR_DEFECTO, parseHex, ratioContraste } from '../lib/colorTema.js'

// Hexadecimal de 6 dígitos válido para mostrar y calcular; si el guardado es inválido, el color por defecto.
function colorValido(hex) {
  const c = parseHex(hex)
  if (!c) return COLOR_POR_DEFECTO
  const h = (n) => n.toString(16).padStart(2, '0')
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`.toUpperCase()
}

const fmtRatio = (n) => n.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export default function Configuracion() {
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)
  const formRef = useRef(null)
  const previaRef = useRef(null)

  const cargar = async () => {
    try {
      const data = await api.getPerfil()
      setPerfil({
        nombre: data?.nombre ?? '',
        color_tema: data?.color_tema ?? COLOR_POR_DEFECTO,
        whatsapp: data?.whatsapp ?? '',
      })
      setErrorCarga('')
    } catch (e) {
      setErrorCarga(e.message || 'No se pudo cargar la configuración.')
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

  // La vista previa se acota a su elemento: la app entera solo cambia al guardar.
  const colorTema = perfil?.color_tema
  useEffect(() => {
    if (previaRef.current && colorTema !== undefined) aplicarColorTema(previaRef.current, colorTema)
  }, [colorTema, cargando, errorCarga])

  const cambiar = (campo) => (e) => {
    const valor = e.target.value
    setPerfil((p) => ({ ...p, [campo]: valor }))
    setErrores((p) => (p[campo] ? { ...p, [campo]: undefined } : p))
  }

  const guardar = async (e) => {
    e.preventDefault()
    if (guardando) return
    const v = validarPerfil(perfil)
    if (Object.keys(v).length > 0) {
      setErrores(v)
      requestAnimationFrame(() => enfocarPrimerInvalido(formRef.current))
      return
    }
    setGuardando(true)
    try {
      const payload = { nombre: perfil.nombre.trim(), color_tema: colorValido(perfil.color_tema), whatsapp: perfil.whatsapp.trim() }
      await api.updatePerfil(payload)
      aplicarColorTema(document.documentElement, payload.color_tema)
      toast.exito('Configuración guardada.')
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  let contenido
  if (cargando) {
    contenido = <Skeleton />
  } else if (errorCarga || !perfil) {
    contenido = <ErrorMsg msg={errorCarga} onRetry={reintentar} />
  } else {
    const color = colorValido(perfil.color_tema)
    const ratio = ratioContraste(color, '#FFFFFF')
    const texto = fmtRatio(ratio)
    contenido = (
      <section className="panel">
        <form ref={formRef} noValidate onSubmit={guardar}>
          <div className="form-grid">
            <Field
              label="Nombre de tu negocio"
              id="cfg-nombre"
              requerido
              autoComplete="organization"
              maxLength={120}
              value={perfil.nombre}
              onChange={cambiar('nombre')}
              error={errores.nombre}
            />
            <div className="field" style={{ minWidth: 0 }}>
              <label className="field-label" htmlFor="cfg-color">Color de tu marca</label>
              <div className="color-fila">
                <input
                  type="color"
                  id="cfg-color"
                  className="color-input"
                  aria-describedby="cfg-color-ayuda"
                  value={color}
                  onChange={cambiar('color_tema')}
                />
                <span className="tabular">{color}</span>
              </div>
              <p id="cfg-color-ayuda" className="field-ayuda">Se usa en los botones de tus correos y en esta aplicación.</p>
              <div aria-live="polite">
                {ratio >= 4.5 ? (
                  <p className="contraste contraste-ok">
                    <Icon name="check-circle" size={14} />
                    <span>Contraste suficiente en tus correos ({texto}:1)</span>
                  </p>
                ) : (
                  <p className="contraste contraste-warn">
                    <Icon name="warning" size={14} />
                    <span>Contraste bajo en tus correos ({texto}:1): el botón lleva texto blanco y el monto usa este color sobre fondo blanco. Prueba un tono más oscuro.</span>
                  </p>
                )}
              </div>
            </div>
            <Field
              label="WhatsApp para reportar pagos"
              id="cfg-whatsapp"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="573001234567"
              ayuda="Con código de país, sin signos. Si lo dejas vacío, tus correos no llevan el botón de WhatsApp."
              value={perfil.whatsapp}
              onChange={cambiar('whatsapp')}
              error={errores.whatsapp}
            />
          </div>
          <div ref={previaRef} className="vista-previa">
            <p className="vista-previa-rotulo">Así se verá en tus correos</p>
            <span className="vista-previa-boton" aria-hidden="true">Reportar pago por WhatsApp</span>
            <span className="vista-previa-monto tabular" aria-hidden="true">$ 50.000</span>
          </div>
          <div className="form-acciones">
            <Button type="submit" cargando={guardando} icono="check">Guardar cambios</Button>
          </div>
        </form>
      </section>
    )
  }

  return (
    <div className="pagina">
      <PageHeader titulo="Configuración" descripcion="El nombre, el color y el WhatsApp que ven tus clientes en los correos." />
      {contenido}
    </div>
  )
}
