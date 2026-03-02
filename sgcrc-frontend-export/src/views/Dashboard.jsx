import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'

// Formateador de moneda colombiana
const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

// Función para calcular días restantes
function calcularDiasFaltantes(diaCobro) {
  const hoy = new Date()
  const year = hoy.getFullYear()
  const month = hoy.getMonth()
  const diasMesActual = new Date(year, month + 1, 0).getDate()
  const diaActual = hoy.getDate()
  const diaObjetivoMesActual = Math.min(diaCobro, diasMesActual)
  
  if (diaObjetivoMesActual >= diaActual) return diaObjetivoMesActual - diaActual
  
  const diasMesSiguiente = new Date(year, month + 2, 0).getDate()
  const diaObjetivoMesSiguiente = Math.min(diaCobro, diasMesSiguiente)
  return (diasMesActual - diaActual) + diaObjetivoMesSiguiente
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const cargar = async () => {
    setError('')
    try {
      const [clientes, suscripciones, historial] = await Promise.all([
        api.getClientes(), 
        api.getSuscripciones(), 
        api.getHistorial()
      ])
      setData({ clientes, suscripciones, historial })
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => { cargar() }, [])

  // Procesamiento de datos con useMemo para mejor rendimiento
  const stats = useMemo(() => {
    if (!data) return null
    const { clientes, suscripciones, historial } = data
    const activas = suscripciones.filter((s) => s.activa)
    
    return {
      clientes: clientes.length,
      activas: activas.length,
      ingresos: activas.reduce((a, s) => a + s.monto, 0),
      enviados: historial.filter((h) => h.estado === 'Enviado').length,
      fallidos: historial.filter((h) => h.estado === 'Fallido').length,
      proximos: activas.map((s) => ({ 
        ...s, 
        dias: calcularDiasFaltantes(s.dia_cobro), 
        cliente: clientes.find((c) => c.id === s.cliente_id) 
      })).sort((a, b) => a.dias - b.dias).slice(0, 5),
    }
  }, [data])

  if (!data && !error) return <div className="p-6 text-center">Cargando datos del sistema...</div>
  if (error) return <div className="p-6 text-red-600">Error: {error} <button onClick={cargar} className="underline">Reintentar</button></div>

  return (
    <div className="space-y-6 p-4">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800">Dashboard</h2>
          <p className="text-slate-500 text-sm">Resumen general de cobros recurrentes</p>
        </div>
        <button 
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl px-5 py-2.5 transition-all shadow-lg shadow-indigo-200"
          onClick={async () => { await api.runCobros(); await cargar() }}
        >
          🚀 Forzar proceso de cobros
        </button>
      </div>

      {/* Tarjetas de Estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Clientes', value: stats.clientes, icon: '👥', color: 'text-blue-600' },
          { label: 'Suscripciones', value: stats.activas, icon: '🔄', color: 'text-purple-600' },
          { label: 'Ingresos/Mes', value: fmt(stats.ingresos), icon: '💰', color: 'text-emerald-600' },
          { label: 'Enviados', value: stats.enviados, icon: '📧', color: 'text-sky-600' },
          { label: 'Fallidos', value: stats.fallidos, icon: '⚠️', color: 'text-rose-600' },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{item.icon}</span>
              <span className={`text-xs font-bold px-2 py-1 rounded-full bg-slate-50 ${item.color}`}>Métrica</span>
            </div>
            <p className="text-sm text-slate-500 font-medium">{item.label}</p>
            <p className="text-2xl font-bold text-slate-800">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Lista de Próximos Cobros */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center mb-6">
          <div className="p-2 bg-amber-50 rounded-lg mr-3">📅</div>
          <h3 className="text-lg font-bold text-slate-800">Próximos cobros programados</h3>
        </div>
        
        <div className="overflow-hidden">
          <div className="space-y-3">
            {stats.proximos.length > 0 ? (
              stats.proximos.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center font-bold text-indigo-600 shadow-sm">
                      {s.cliente?.nombre?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{s.cliente?.nombre || 'Cliente desconocido'}</p>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">{s.tipo}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-800">{fmt(s.monto)}</p>
                    <p className={`text-xs font-bold ${s.dias === 0 ? 'text-rose-500 animate-pulse' : 'text-indigo-500'}`}>
                      {s.dias === 0 ? '• COBRA HOY' : `en ${s.dias} días`}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-slate-400 py-4">No hay cobros pendientes</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}