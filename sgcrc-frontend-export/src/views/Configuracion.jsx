import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import PageHeader from '../ui/PageHeader.jsx'
import { mensajeError } from '../lib/errores.js'
import Field from '../ui/Field.jsx'
import Button from '../ui/Button.jsx'
import Icon from '../ui/Icon.jsx'
import ErrorMsg from '../ui/ErrorMsg.jsx'
import Skeleton from '../ui/Skeleton.jsx'
import { toast } from '../ui/Toast.jsx'
import { validarPerfil } from '../lib/validaciones.js'
import { enfocarPrimerInvalido } from '../lib/formularios.js'
import { aplicarColorTema, COLOR_POR_DEFECTO, parseHex } from '../lib/colorTema.js'
import { estadoContrasteCorreo } from '../lib/contrasteCorreo.js'
import { useCarga } from '../lib/useCarga.js'

// Hexadecimal de 6 dígitos válido para mostrar y calcular; si el guardado es inválido, el color por defecto.
function colorValido(hex) {
  const c = parseHex(hex)
  if (!c) return COLOR_POR_DEFECTO
  const h = (n) => n.toString(16).padStart(2, '0')
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`.toUpperCase()
}

const fmtRatio = (n) => n.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export default function Configuracion({ onGuardado }) {
  const { datos: perfil, setDatos: setPerfil, cargando, hayDatos, error: errorCarga, reintentar } = useCarga(async () => {
    const data = await api.getPerfil()
    return {
      nombre: data?.nombre ?? '',
      color_tema: data?.color_tema ?? COLOR_POR_DEFECTO,
      whatsapp: data?.whatsapp ?? '',
    }
  })
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)
  const formRef = useRef(null)
  const previaRef = useRef(null)

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
      onGuardado?.(payload)
    } catch (err) {
      toast.error(err.response?.data?.error || mensajeError(err))
    } finally {
      setGuardando(false)
    }
  }

  let contenido
  if (!hayDatos && errorCarga) {
    contenido = <ErrorMsg msg={errorCarga} onRetry={reintentar} cargando={cargando} />
  } else if (!hayDatos) {
    contenido = <Skeleton />
  } else {
    const color = colorValido(perfil.color_tema)
    const { ratio, suficiente, colorMonto } = estadoContrasteCorreo(color)
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
              {suficiente ? (
                <p className="contraste contraste-ok">
                  <Icon name="check-circle" size={14} />
                  <span>Contraste suficiente en tus correos ({texto}:1)</span>
                </p>
              ) : (
                <p className="contraste contraste-warn">
                  <Icon name="warning" size={14} />
                  <span>Contraste bajo en tus correos ({texto}:1): el texto del botón se leerá mal. Prueba un tono más oscuro o más claro.</span>
                </p>
              )}
              {colorMonto !== color && (
                <p className="field-ayuda">El monto se mostrará en tono oscuro para que se lea sobre el fondo blanco del correo.</p>
              )}
              <p className="sr-only" aria-live="polite">{`Contraste del texto del botón en tus correos: ${suficiente ? 'suficiente' : 'bajo'}`}</p>
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
            <div className="vista-previa-correo" aria-hidden="true">
              <span className="vista-previa-boton">Reportar pago por WhatsApp</span>
              <span className="vista-previa-monto tabular" style={{ color: colorMonto }}>$ 50.000</span>
            </div>
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
