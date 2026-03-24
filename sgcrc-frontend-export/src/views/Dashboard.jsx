import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'

// Formateador de moneda colombiana
const fmt = (n) => new Intl.NumberFormat('es-CO', { 
  style: 'currency', 
  currency: 'COP', 
  maximumFractionDigits: 0 
}).format(n)

// --- FUNCIÓN CALCULAR DÍAS (Igual que antes) ---
function calcularDiasFaltantes(fechaAlta, diaCobroPlan) {
  const hoy = new Date()
  const year = hoy.getFullYear()
  const month = hoy.getMonth()
  let diaReal = diaCobroPlan;
  if (fechaAlta) {
    const partes = fechaAlta.split('-');
    diaReal = parseInt(partes[2]);
  }
  const diasMesActual = new Date(year, month + 1, 0).getDate()
  const diaActual = hoy.getDate()
  const diaObjetivoMesActual = Math.min(diaReal, diasMesActual)
  const inicioSuscripcion = fechaAlta ? new Date(fechaAlta + "T00:00:00") : hoy;
  if (inicioSuscripcion > hoy) {
    const diffTime = Math.abs(inicioSuscripcion - hoy);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  if (diaObjetivoMesActual >= diaActual) {
    return diaObjetivoMesActual - diaActual
  }
  const diasMesSiguiente = new Date(year, month + 2, 0).getDate()
  const diaObjetivoMesSiguiente = Math.min(diaReal, diasMesSiguiente)
  return (diasMesActual - diaActual) + diaObjetivoMesSiguiente
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loadingProceso, setLoadingProceso] = useState(false)

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

  const handleForzarCobros = async (confirmarReenvio = false) => {
    setLoadingProceso(true);
    try {
      const res = await api.runCobros({ confirmarReenvio });
      alert(res.message || "✅ Proceso completado exitosamente");
      await cargar(); 
    } catch (err) {
      const errorStatus = err.response?.status || err.status;
      const errorData = err.response?.data || err.data;
      if (errorStatus === 409) {
        const msg = errorData?.mensaje || "Ya se procesaron cobros hoy.";
        if (window.confirm(`⚠️ ${msg}\n\n¿Deseas forzar el reenvío para todos los pendientes de hoy?`)) {
          return handleForzarCobros(true);
        }
      } else {
        alert("Error: " + (errorData?.error || err.message));
      }
    } finally {
      setLoadingProceso(false);
    }
  };

  useEffect(() => {
    cargar()
  }, [])

  const stats = useMemo(() => {
    if (!data) return null
    const { clientes, suscripciones, historial } = data
    const activas = suscripciones.filter((s) => s.activa)
    const hoyStr = new Date().toISOString().split('T')[0];

    return {
      clientes: clientes.length,
      activas: activas.length,
      ingresos: activas.reduce((a, s) => a + s.monto, 0),
      enviados: historial.filter((h) => h.estado === 'Enviado' && h.fecha?.includes(hoyStr)).length,
      fallidos: historial.filter((h) => h.estado === 'Fallido').length,
      proximos: activas.map((s) => ({ 
        ...s, 
        dias: calcularDiasFaltantes(s.fecha_alta, s.dia_cobro), 
        cliente: clientes.find((c) => c.id === s.cliente_id) || { nombre: 'Desconocido' }
      }))
      .filter(s => s.dias >= 0)
      .sort((a, b) => a.dias - b.dias)
      .slice(0, 5),
    }
  }, [data])

  if (!data && !error) return <div className="p-6 text-center text-slate-500 font-medium">Cargando estadísticas...</div>
  
  if (error) return (
    <div className="p-6 text-red-600 bg-red-50 rounded-xl m-4 border border-red-100">
      <p className="font-bold">Error de conexión:</p>
      <p className="mb-4">{error}</p>
      <button onClick={cargar} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-shadow">
        Reintentar
      </button>
    </div>
  )

  return (
    <div className="space-y-6 p-4 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Dashboard</h2>
          <p className="text-slate-500 text-sm">Resumen de {new Date().toLocaleDateString('es-CO', {month:'long', year:'numeric'})}</p>
        </div>
        {/* BOTÓN DINÁMICO */}
        <button 
          disabled={loadingProceso}
          style={!loadingProceso ? { backgroundColor: 'var(--color-primario)' } : {}}
          className={`${
            loadingProceso ? 'bg-slate-400' : 'hover:brightness-110 active:scale-95'
          } text-white font-semibold rounded-xl px-6 py-3 transition-all shadow-lg flex items-center gap-2`}
          onClick={() => handleForzarCobros(false)}
        >
          {loadingProceso ? <span className="animate-spin">⏳</span> : <span>🚀</span>}
          {loadingProceso ? 'Procesando...' : 'Forzar Cobros de Hoy'}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Clientes', value: stats.clientes, icon: '👥', color: 'text-blue-600' },
          { label: 'Suscripciones', value: stats.activas, icon: '🔄', color: 'text-purple-600' },
          { label: 'Ingresos/Mes', value: fmt(stats.ingresos), icon: '💰', color: 'text-emerald-600' },
          { label: 'Enviados Hoy', value: stats.enviados, icon: '📧', color: 'text-sky-600' },
          { label: 'Errores', value: stats.fallidos, icon: '⚠️', color: 'text-rose-600' },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{item.icon}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-50 ${item.color}`}>INFO</span>
            </div>
            <p className="text-sm text-slate-500 font-medium">{item.label}</p>
            <p className="text-xl font-bold text-slate-800">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Proximos Cobros List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center mb-6">
          <div className="p-2 bg-amber-50 rounded-lg mr-3 text-xl">📅</div>
          <h3 className="text-lg font-bold text-slate-800">Próximos cobros basados en fecha de inicio</h3>
        </div>
        
        <div className="space-y-3">
          {stats.proximos.length > 0 ? (
            stats.proximos.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200">
                <div className="flex items-center space-x-4">
                  {/* INICIAL DEL CLIENTE CON COLOR DINÁMICO */}
                  <div 
                    style={{ color: 'var(--color-primario)', borderColor: 'var(--color-primario-glow)' }}
                    className="h-10 w-10 rounded-full bg-white flex items-center justify-center font-bold shadow-sm border uppercase"
                  >
                    {s.cliente?.nombre?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{s.cliente?.nombre}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      Inició: {s.fecha_alta || 'Sin fecha'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-800">{fmt(s.monto)}</p>
                  {/* TEXTO DE DÍAS DINÁMICO */}
                  <p 
                    style={s.dias !== 0 ? { color: 'var(--color-primario)' } : {}}
                    className={`text-xs font-bold ${s.dias === 0 ? 'text-rose-500 animate-pulse' : ''}`}
                  >
                    {s.dias === 0 ? '• TOCA COBRAR HOY' : `en ${s.dias} días`}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <p className="text-slate-400 italic">No hay cobros proyectados para esta semana</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}