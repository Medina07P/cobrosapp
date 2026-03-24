import { useEffect, useState } from 'react'
import { api } from '../api.js'

const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

const hoy = new Date().toISOString().split('T')[0];
const empty = { cliente_id: '', plan_id: '', activa: true, descripcion: '', fecha_alta: hoy }

export default function Suscripciones() {
  const [subs, setSubs] = useState([])
  const [clientes, setClientes] = useState([])
  const [planes, setPlanes] = useState([])
  const [error, setError] = useState('')
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)

  const cargar = async () => {
    setError('')
    try {
      const [s, c, p] = await Promise.all([
        api.getSuscripciones(), 
        api.getClientes(),
        api.getPlanes()
      ])
      setSubs(s)
      setClientes(c)
      setPlanes(p)
    } catch (e) { setError(e.message) }
  }

  useEffect(() => { cargar() }, [])

  const guardar = async () => {
    try {
      setError('');
      const payload = { 
        cliente_id: Number(form.cliente_id), 
        plan_id: Number(form.plan_id),
        activa: !!form.activa,
        descripcion: form.descripcion,
        fecha_alta: form.fecha_alta 
      };
      
      if (editing) {
        await api.updateSuscripcion(editing.id, payload);
      } else {
        await api.createSuscripcion(payload);
      }
      
      setForm(empty);
      setEditing(null);
      await cargar();
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Suscripciones</h2>
        {editing && (
          <button onClick={() => {setEditing(null); setForm(empty)}} className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest">
            ✕ Cancelar Edición
          </button>
        )}
      </div>

      {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg border border-red-100 text-sm">{error}</div>}

      {/* --- FORMULARIO DINÁMICO --- */}
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3 border border-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <select className="border rounded-lg px-3 py-2 text-sm focus:border-brand outline-none transition-all" value={form.cliente_id} onChange={(e) => setForm((p) => ({ ...p, cliente_id: e.target.value }))}>
              <option value="">Seleccionar Cliente</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            
            <select className="border rounded-lg px-3 py-2 text-sm focus:border-brand outline-none transition-all" value={form.plan_id} onChange={(e) => setForm((p) => ({ ...p, plan_id: e.target.value }))}>
              <option value="">Seleccionar Plan</option>
              {planes.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre_plan} ({fmt(p.monto)})</option>
              ))}
            </select>

            <input 
              type="date"
              className="border rounded-lg px-3 py-2 text-sm focus:border-brand outline-none transition-all"
              value={form.fecha_alta}
              onChange={(e) => setForm((p) => ({ ...p, fecha_alta: e.target.value }))}
            />

            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-500 flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="accent-brand w-4 h-4" checked={!!form.activa} onChange={(e) => setForm((p) => ({ ...p, activa: e.target.checked }))} /> 
                ACTIVA
              </label>
              <button 
                style={{ backgroundColor: 'var(--color-primario)' }}
                className="flex-1 text-white rounded-lg px-3 py-2 font-bold shadow-lg shadow-brand/20 hover:brightness-110 active:scale-95 transition-all text-sm" 
                onClick={guardar}
              >
                {editing ? 'Actualizar' : 'Vincular'}
              </button>
            </div>
        </div>

        <input 
          className="border rounded-lg px-3 py-2 w-full text-sm focus:border-brand outline-none transition-all" 
          placeholder="Nota o descripción (ej: Ubicación, tipo de molienda, etc.)"
          value={form.descripcion} 
          onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
        />
      </div>

      {/* --- TABLA --- */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="p-4">Cliente / Nota</th>
              <th className="p-4">Plan</th>
              <th className="p-4">Inicio</th>
              <th className="p-4">Monto</th>
              <th className="p-4">Estado</th>
              <th className="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {subs.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4">
                  <p className="font-bold text-slate-800">{clientes.find((c) => c.id === s.cliente_id)?.nombre || '-'}</p>
                  <p className="text-[10px] text-slate-400 font-medium italic italic">{s.descripcion || 'Sin notas'}</p>
                </td>
                <td className="p-4 uppercase text-[10px] font-bold text-slate-500">
                  {s.tipo} <span style={{ color: 'var(--color-primario)' }}>({s.frecuencia})</span>
                </td> 
                <td className="p-4 text-slate-600 font-medium">{s.fecha_alta}</td>
                <td className="p-4 font-bold text-emerald-600">{fmt(s.monto)}</td>
                <td className="p-4">
                  <span 
                    style={s.activa ? { backgroundColor: 'var(--color-primario-glow)', color: 'var(--color-primario)' } : {}}
                    className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${!s.activa ? 'bg-slate-100 text-slate-400' : ''}`}
                  >
                    {s.activa ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td className="p-4 text-right space-x-4">
                  <button 
                    style={{ color: 'var(--color-primario)' }}
                    className="font-bold text-xs uppercase hover:underline" 
                    onClick={() => { setEditing(s); setForm(s); }}
                  >
                    Editar
                  </button>
                  <button className="text-red-500 font-bold text-xs uppercase hover:underline" onClick={async () => {
                    if (confirm('¿Eliminar suscripción?')) { await api.deleteSuscripcion(s.id); cargar(); }
                  }}>
                    Borrar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}