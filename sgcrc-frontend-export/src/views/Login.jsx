import { useState } from 'react'

const DEFAULT_USER = import.meta.env.VITE_ADMIN_USER || 'admin'
const DEFAULT_PASS = import.meta.env.VITE_ADMIN_PASS || 'admin123'

export default function Login({ onLogin }) {
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_API_KEY || '')
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (user !== DEFAULT_USER || password !== DEFAULT_PASS) {
      setError('Credenciales inválidas')
      return
    }
    onLogin({ user, apiKey })
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 space-y-4">
        <h1 className="text-2xl font-bold text-slate-800">SGCRC Admin</h1>
        <p className="text-sm text-slate-500">Inicia sesión para gestionar cobros</p>
        {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}
        <input className="w-full border rounded-lg px-3 py-2" placeholder="Usuario" value={user} onChange={(e) => setUser(e.target.value)} required />
        <input className="w-full border rounded-lg px-3 py-2" type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <input className="w-full border rounded-lg px-3 py-2" placeholder="API Key (opcional)" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2 font-semibold">Entrar</button>
      </form>
    </div>
  )
}
