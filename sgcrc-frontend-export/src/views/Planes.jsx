import { useEffect, useState } from 'react'
import { api } from '../api.js'

const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

const empty = { nombre_plan: '', monto: '', frecuencia: 'mensual', dia_cobro: 1 }

export default function Planes() {
  const [planes, setPlanes] = useState([])
  const [error, setError] = useState('')
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)

  const cargar = async () => {
    try {
      const data = await api.getPlanes()
      setPlanes(data)
    } catch (e) { setError(e.message) }
  }

  useEffect(() => { cargar() }, [])

  const guardar = async () => {
    try {
      setError('')
      const payload = { ...form, monto: Number(form.monto), dia_cobro: Number(form.dia_cobro) }
      
      if (editing) {
        await api.updatePlan(editing.id, payload)
      } else {
        await api.createPlan(payload)
      }
      
      setForm(empty); setEditing(null); cargar()
    } catch (e) { setError(e.message) }
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Catálogo de Planes</h2>
        {editing && (
          <button onClick={() => {setEditing(null); setForm(empty)}} className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest">
            ✕ Cancelar Edición
          </button>
        )}
      </div>

      {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg border border-red-100 text-sm">{error}</div>}

      {/* Formulario con Color Dinámico */}
      <div className="bg-white rounded-xl shadow-sm p-4 grid grid-cols-1 md:grid-cols-5 gap-3 border border-slate-100">
        <input className="border rounded-lg px-3 py-2 text-sm focus:border-brand outline-none transition-all" placeholder="Nombre (Ej: Plan Oro)" value={form.nombre_plan} onChange={e => setForm({...form, nombre_plan: e.target.value})} />
        <input className="border rounded-lg px-3 py-2 text-sm focus:border-brand outline-none transition-all" type="number" placeholder="Precio (COP)" value={form.monto} onChange={e => setForm({...form, monto: e.target.value})} />
        
        <div className="flex flex-col">
          <select className="border rounded-lg px-3 py-2 text-sm focus:border-brand outline-none transition-all" value={form.frecuencia} onChange={e => setForm({...form, frecuencia: e.target.value})}>
            <option value="semanal">Semanal</option>
            <option value="quincenal">Quincenal</option>
            <option value="mensual">Mensual</option>
            <option value="anual">Anual</option>
          </select>
        </div>

        <input className="border rounded-lg px-3 py-2 text-sm focus:border-brand outline-none transition-all" type="number" min="1" max="31" placeholder="Día de cobro" value={form.dia_cobro} onChange={e => setForm({...form, dia_cobro: e.target.value})} title="Día del mes en que se generará el cobro" />

        <button 
          style={{ backgroundColor: 'var(--color-primario)' }}
          className="text-white rounded-lg px-3 py-2 font-bold shadow-lg shadow-brand/20 hover:brightness-110 active:scale-95 transition-all text-sm" 
          onClick={guardar}
        >
          {editing ? 'Actualizar Plan' : 'Crear Plan'}
        </button>
      </div>

      {/* Tabla de Resultados */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="p-4">Nombre del Plan</th>
              <th className="p-4">Monto</th>
              <th className="p-4">Día de Cobro</th>
              <th className="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {planes.map(p => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4">
                   <p className="font-bold text-slate-700">{p.nombre_plan}</p>
                   <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-500 uppercase font-bold">{p.frecuencia}</span>
                </td>
                <td className="p-4 font-bold text-brand">{fmt(p.monto)}</td>
                <td className="p-4 text-slate-500 font-medium">Día {p.dia_cobro}</td>
                <td className="p-4 text-right space-x-4">
                  <button 
                    style={{ color: 'var(--color-primario)' }}
                    className="font-bold text-xs uppercase hover:underline" 
                    onClick={() => { setEditing(p); setForm(p); }}
                  >
                    Editar
                  </button>
                  <button className="text-red-500 font-bold text-xs uppercase hover:underline" onClick={async () => {
                    if(confirm('¿Eliminar plan? Solo funcionará si no hay clientes usándolo.')) {
                      try { await api.deletePlan(p.id); cargar(); } catch(e) { setError(e.message); }
                    }
                  }}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}