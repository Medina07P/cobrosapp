import { useState } from 'react'

export default function Login({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // CAMBIO CLAVE: Usamos la variable de entorno o el prefijo del proxy
  const API_URL = import.meta.env.VITE_API_URL || '/api'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const endpoint = isRegister ? '/auth/register' : '/auth/login'
    const payload = isRegister ? { email, password, nombre } : { email, password }

    try {
      // Ahora la petición va a '/api/auth/register' o '/api/auth/login'
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

    const text = await res.text(); // Leemos como texto primero
    const data = text ? JSON.parse(text) : {}; // Si hay texto, lo parseamos, si no, objeto vacío

      if (!res.ok) throw new Error(data.error || 'Error en la operación')

      if (isRegister) {
        alert('Cuenta creada. Ahora puedes iniciar sesión.')
        setIsRegister(false)
        setPassword('') // Limpiamos para seguridad
      } else {
        // Guardamos el token y datos del usuario
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        
        // Avisamos al componente principal (App.jsx) que ya estamos dentro
        onLogin(data) 
      }
    } catch (err) {
      // Si el error es "Failed to fetch", damos un mensaje más claro
      const msg = err.message === 'Failed to fetch' 
        ? 'No se pudo conectar con el servidor. ¿Está encendido el backend?' 
        : err.message
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-slate-900">SGCRC</h1>
          <p className="text-slate-500 mt-2">
            {isRegister ? 'Crea tu cuenta de cobros' : 'Bienvenido de nuevo'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 rounded text-sm animate-pulse">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Nombre Completo</label>
              <input 
                className="w-full border border-gray-300 rounded-lg px-4 py-2 mt-1 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="Ej. Juan Pérez"
                value={nombre} 
                onChange={(e) => setNombre(e.target.value)} 
                required 
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">Correo Electrónico</label>
            <input 
              type="email"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 mt-1 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="correo@ejemplo.com"
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Contraseña</label>
            <input 
              className="w-full border border-gray-300 rounded-lg px-4 py-2 mt-1 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              type="password" 
              placeholder="••••••••"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>

          <button 
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-3 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Procesando...
              </>
            ) : (isRegister ? 'Crear Cuenta' : 'Entrar al Sistema')}
          </button>
        </form>

        <div className="text-center pt-4 border-t border-gray-100">
          <button 
            type="button"
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
          >
            {isRegister ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate gratis'}
          </button>
        </div>
      </div>
    </div>
  )
}