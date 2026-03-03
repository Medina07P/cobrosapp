import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'

// Formateador de moneda colombiana
const fmt = (n) => new Intl.NumberFormat('es-CO', { 
  style: 'currency', 
  currency: 'COP', 
  maximumFractionDigits: 0 
}).format(n)

// Función para calcular días restantes hasta el próximo cobro
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
  const [loadingProceso, setLoadingProceso] = useState(false)

  // Función para cargar datos iniciales
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

  // --- FUNCIÓN DE COBROS CON MANEJO DE CONFLICTOS (409) ---
  const handleForzarCobros = async (confirmarReenvio = false) => {
  setLoadingProceso(true);
  try {
    // Intentamos ejecutar el proceso
    const res = await api.runCobros({ confirmarReenvio });
    alert(res.message || "✅ Proceso completado");
    await cargar(); 

  } catch (err) {
    // IMPORTANTE: Con fetch, los datos del error vienen en err.response
    const errorStatus = err.response?.status;
    const errorData = err.response?.data;

    // Si es 409 y el servidor dice que requiere confirmación
    if (errorStatus === 409 && errorData?.requiereConfirmacion) {
      const mensajeServidor = errorData.mensaje || "Ya se enviaron cobros hoy.";
      
      const seguro = window.confirm(
        `⚠️ ATENCIÓN: ${mensajeServidor}\n\n` +
        `• ¿Deseas reintentar el envío para TODOS los clientes de hoy?\n` +
        `• Presiona ACEPTAR para forzar todo.\n` +
        `• Presiona CANCELAR para no enviar nada.`
      );
      
      if (seguro) {
        // REINTENTO: Llamamos a la misma función pero con el flag en TRUE
        return handleForzarCobros(true);
      }
    } else {
      // Si es otro tipo de error (500, 404, etc.)
      alert("Error: " + (errorData?.error || err.message));
    }
  } finally {
    setLoadingProceso(false);
  }
};

  useEffect(() => {
    cargar()
  }, [])

  // Cálculo de estadísticas optimizado
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
        // Validación de seguridad: si el cliente no existe, evita que la app truene
        cliente: clientes.find((c) => c.id === s.cliente_id) || { nombre: 'Cliente no encontrado' }
      })).sort((a, b) => a.dias - b.dias).slice(0, 5),
    }
  }, [data])

  if (!data && !error) return <div className="p-6 text-center text-slate-500 font-medium">Cargando sistema de gestión...</div>
  if (error) return (
    <div className="p-6 text-red-600 bg-red-50 rounded-xl m-4">
      <p className="font-bold">Error de conexión:</p>
      <p className="mb-4">{error}</p>
      <button onClick={cargar} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
        Reintentar conexión
      </button>
    </div>
  )

  return (
    <div className="space-y-6 p-4 animate-in fade-in duration-500">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Dashboard</h2>
          <p className="text-slate-500 text-sm">Control central de cobros recurrentes</p>
        </div>
        <button 
          disabled={loadingProceso}
          className={`${
            loadingProceso ? 'bg-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
          } text-white font-semibold rounded-xl px-6 py-3 transition-all shadow-lg flex items-center gap-2 active:scale-95`}
          onClick={() => handleForzarCobros(false)}
        >
          {loadingProceso ? (
            <>
              <span className="animate-spin">⏳</span>
              Procesando cobros...
            </>
          ) : (
            <>
              <span>🚀</span>
              Forzar proceso de cobros
            </>
          )}
        </button>
      </div>

      {/* Grid de Estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Clientes', value: stats.clientes, icon: '👥', color: 'text-blue-600' },
          { label: 'Suscripciones', value: stats.activas, icon: '🔄', color: 'text-purple-600' },
          { label: 'Ingresos/Mes', value: fmt(stats.ingresos), icon: '💰', color: 'text-emerald-600' },
          { label: 'Enviados Hoy', value: stats.enviados, icon: '📧', color: 'text-sky-600' },
          { label: 'Fallidos', value: stats.fallidos, icon: '⚠️', color: 'text-rose-600' },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:border-indigo-100 transition-colors group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl group-hover:scale-110 transition-transform">{item.icon}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-50 ${item.color}`}>Métrica</span>
            </div>
            <p className="text-sm text-slate-500 font-medium">{item.label}</p>
            <p className="text-xl font-bold text-slate-800">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Lista de Próximos Cobros */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center mb-6">
          <div className="p-2 bg-amber-50 rounded-lg mr-3 text-xl">📅</div>
          <h3 className="text-lg font-bold text-slate-800">Próximos cobros programados</h3>
        </div>
        
        <div className="space-y-3">
          {stats.proximos.length > 0 ? (
            stats.proximos.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200">
                <div className="flex items-center space-x-4">
                  <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center font-bold text-indigo-600 shadow-sm border border-slate-100 uppercase">
                    {s.cliente?.nombre?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{s.cliente?.nombre}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{s.frecuencia || 'Mensual'}</p>
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
            <div className="text-center py-8">
              <p className="text-slate-400">No hay cobros pendientes en la agenda</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}