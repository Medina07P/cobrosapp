import { useEffect, useState } from 'react'
import { api } from '../api.js'

const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

const empty = { cliente_id: '', tipo: '', monto: '', dia_cobro: 1, descripcion: '', activa: true }

export default function Suscripciones() {
  const [subs, setSubs] = useState([])
  const [clientes, setClientes] = useState([])
  const [error, setError] = useState('')
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)

  const cargar = async () => {
    setError('')
    try {
      const [s, c] = await Promise.all([api.getSuscripciones(), api.getClientes()])
      setSubs(s)
      setClientes(c)
    } catch (e) { setError(e.message) }
  }

  useEffect(() => { cargar() }, [])

  const guardar = async () => {
    try {
      const payload = { ...form, cliente_id: Number(form.cliente_id), monto: Number(form.monto), dia_cobro: Number(form.dia_cobro) }
      if (editing) await api.updateSuscripcion(editing.id, payload)
      else await api.createSuscripcion(payload)
      setForm(empty)
      setEditing(null)
      await cargar()
    } catch (e) { setError(e.message) }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Suscripciones</h2>
      {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm p-4 grid md:grid-cols-3 gap-2">
        <select className="border rounded-lg px-3 py-2" value={form.cliente_id} onChange={(e) => setForm((p) => ({ ...p, cliente_id: e.target.value }))}>
          <option value="">Cliente</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <input className="border rounded-lg px-3 py-2" placeholder="Tipo" value={form.tipo} onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))} />
        <input className="border rounded-lg px-3 py-2" type="number" placeholder="Monto" value={form.monto} onChange={(e) => setForm((p) => ({ ...p, monto: e.target.value }))} />
        <input className="border rounded-lg px-3 py-2" type="number" min="1" max="31" placeholder="Día de cobro" value={form.dia_cobro} onChange={(e) => setForm((p) => ({ ...p, dia_cobro: e.target.value }))} />
        <input className="border rounded-lg px-3 py-2 md:col-span-2" placeholder="Descripción" value={form.descripcion} onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))} />
        <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={!!form.activa} onChange={(e) => setForm((p) => ({ ...p, activa: e.target.checked }))} /> Activa</label>
        <button className="bg-indigo-600 text-white rounded-lg px-3 py-2" onClick={guardar}>{editing ? 'Actualizar' : 'Crear'} suscripción</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500"><tr><th className="text-left p-3">Cliente</th><th className="text-left p-3">Tipo</th><th className="text-left p-3">Monto</th><th className="text-left p-3">Día</th><th className="text-left p-3">Estado</th><th className="text-right p-3">Acciones</th></tr></thead>
          <tbody>
            {subs.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="p-3">{clientes.find((c) => c.id === s.cliente_id)?.nombre || '-'}</td>
                <td className="p-3">{s.tipo}</td>
                <td className="p-3">{fmt(s.monto)}</td>
                <td className="p-3">{s.dia_cobro}</td>
                <td className="p-3"><span className={`px-2 py-1 rounded-full text-xs ${s.activa ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{s.activa ? 'Activa' : 'Inactiva'}</span></td>
                <td className="p-3 text-right"><button className="px-2 py-1 rounded bg-slate-100" onClick={() => { setEditing(s); setForm({ ...s }) }}>Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
