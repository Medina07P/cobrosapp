import { useRef, useState } from 'react'
import Field from '../ui/Field.jsx'
import Button from '../ui/Button.jsx'
import ErrorMsg from '../ui/ErrorMsg.jsx'
import Logo from '../ui/Logo.jsx'
import { toast } from '../ui/Toast.jsx'
import { enfocarPrimerInvalido } from '../lib/formularios.js'

const API_URL = import.meta.env.VITE_API_URL || '/api'

function validar({ nombre, email, password }, esRegistro) {
  const errores = {}
  if (esRegistro && !nombre.trim()) errores.nombre = 'Escribe el nombre de tu negocio.'
  if (!email.trim()) errores.email = 'Escribe tu correo.'
  else if (!email.includes('@')) errores.email = 'El correo debe incluir "@".'
  if (!password) errores.password = 'Escribe tu contraseña.'
  return errores
}

export default function Login({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nombre, setNombre] = useState('')
  const [ver, setVer] = useState(false)
  const [errores, setErrores] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const formRef = useRef(null)

  const alternar = () => {
    setIsRegister((v) => !v)
    setErrores({})
    setError('')
    requestAnimationFrame(() => formRef.current?.querySelector('input')?.focus())
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return
    setError('')
    const errs = validar({ nombre, email, password }, isRegister)
    setErrores(errs)
    if (Object.keys(errs).length) {
      requestAnimationFrame(() => enfocarPrimerInvalido(formRef.current))
      return
    }
    setLoading(true)

    const endpoint = isRegister ? '/auth/register' : '/auth/login'
    const payload = isRegister ? { email, password, nombre } : { email, password }

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const text = await res.text()
      let data = {}
      if (text) {
        try { data = JSON.parse(text) } catch { throw new Error('Respuesta inesperada del servidor.') }
      }
      if (!res.ok) throw new Error(data.error || 'Error en la operación')

      if (isRegister) {
        toast.exito('Cuenta creada. Ahora puedes iniciar sesión.')
        setIsRegister(false)
        setPassword('')
      } else {
        onLogin(data)
      }
    } catch (err) {
      setError(err.message === 'Failed to fetch'
        ? 'No se pudo conectar con el servidor. ¿Está encendido el backend?'
        : err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="acceso">
      <div className="acceso-tarjeta panel">
        <div className="marca">
          <Logo decorativo />
          SGCRC
        </div>
        <h1 className="acceso-titulo">{isRegister ? 'Crea tu cuenta' : 'Entra a tu cuenta'}</h1>
        <p className="pagina-desc">
          {isRegister
            ? 'Registra tu negocio para empezar a cobrar.'
            : 'Recordatorios de cobro por correo, sin perseguir pagos.'}
        </p>

        {error && <ErrorMsg msg={error} />}

        <form ref={formRef} noValidate onSubmit={handleSubmit} className="acceso-form">
          {isRegister && (
            <Field
              label="Nombre del negocio" requerido autoComplete="organization"
              value={nombre} onChange={(e) => setNombre(e.target.value)} error={errores.nombre}
            />
          )}
          <Field
            label="Correo" requerido type="email" inputMode="email" autoComplete="username"
            value={email} onChange={(e) => setEmail(e.target.value)} error={errores.email}
          />
          <Field
            label="Contraseña" requerido type={ver ? 'text' : 'password'}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            value={password} onChange={(e) => setPassword(e.target.value)} error={errores.password}
          />
          <label className="check">
            <input type="checkbox" checked={ver} onChange={(e) => setVer(e.target.checked)} />
            Mostrar contraseña
          </label>
          <Button type="submit" cargando={loading}>{isRegister ? 'Crear cuenta' : 'Entrar'}</Button>
        </form>

        <Button variante="secundario" onClick={alternar}>
          {isRegister ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
        </Button>
      </div>
    </main>
  )
}
