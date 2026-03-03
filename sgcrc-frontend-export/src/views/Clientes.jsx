import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [subs, setSubs] = useState([])
  const [error, setError] = useState('')
  const [form, setForm] = useState({ nombre: '', correo: '' })
  const [editing, setEditing] = useState(null)

  const cargar = async () => {
    setError('')
    try {
      const [c, s] = await Promise.all([api.getClientes(), api.getSuscripciones()])
      setClientes(c)
      setSubs(s)
    } catch (e) { setError(e.message) }
  }

  useEffect(() => { cargar() }, [])

  const porCliente = useMemo(() => {
    const map = {}
    subs.forEach((s) => { if (s.activa) map[s.cliente_id] = (map[s.cliente_id] || 0) + 1 })
    return map
  }, [subs])

  const guardar = async () => {
    try {
      if (editing) await api.updateCliente(editing.id, form)
      else await api.createCliente(form)
      setForm({ nombre: '', correo: '' })
      setEditing(null)
      await cargar()
    } catch (e) { setError(e.message) }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Clientes</h2>
      {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm p-4 grid md:grid-cols-3 gap-2">
        <input className="border rounded-lg px-3 py-2" placeholder="Nombre" value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} />
        <input className="border rounded-lg px-3 py-2" placeholder="Correo" value={form.correo} onChange={(e) => setForm((p) => ({ ...p, correo: e.target.value }))} />
        <button className="bg-indigo-600 text-white rounded-lg px-3 py-2" onClick={guardar}>{editing ? 'Actualizar' : 'Crear'} cliente</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="text-left p-3">Nombre</th><th className="text-left p-3">Correo</th><th className="text-left p-3">Subs activas</th><th className="text-right p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3 font-medium">{c.nombre}</td>
                <td className="p-3">{c.correo}</td>
                <td className="p-3">{porCliente[c.id] || 0}</td>
                <td className="p-3 text-right space-x-2">
                  <button className="px-2 py-1 rounded bg-slate-100" onClick={() => { setEditing(c); setForm({ nombre: c.nombre, correo: c.correo }) }}>Editar</button>
                  <button 
                    className="px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 transition-colors" 
                    onClick={async () => { 
                      if (window.confirm(`¿Estás seguro de eliminar a ${c.nombre}?`)) {
                        try {
                          setError(''); // Limpiamos errores previos
                          await api.deleteCliente(c.id); 
                          await cargar(); // Solo recarga si la eliminación fue exitosa
                        } catch (e) {
                          // Aquí capturamos el error 400 que configuramos en el backend
                          setError(e.message); 
                        }
                      }
                    }}
>
  Eliminar
</button>              </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
