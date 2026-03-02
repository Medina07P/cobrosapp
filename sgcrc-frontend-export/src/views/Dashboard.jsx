import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'

const fmt = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

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
      const [clientes, suscripciones, historial] = await Promise.all([api.getClientes(), api.getSuscripciones(), api.getHistorial()])
      setData({ clientes, suscripciones, historial })
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => { cargar() }, [])

  const stats = useMemo(() => {
    if (!data) return null
    const activas = data.suscripciones.filter((s) => s.activa)
    return {
      clientes: data.clientes.length,
      activas: activas.length,
      ingresos: activas.reduce((a, s) => a + s.monto, 0),
      enviados: data.historial.filter((h) => h.estado === 'Enviado').length,
      fallidos: data.historial.filter((h) => h.estado === 'Fallido').length,
      proximos: activas.map((s) => ({ ...s, dias: calcularDiasFaltantes(s.dia_cobro), cliente: data.clientes.find((c) => c.id === s.cliente_id) })).sort((a, b) => a.dias - b.dias).slice(0, 5),
    }
  }, [data])

  if (!data && !error) return <div className="p-6">Cargando...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2" onClick={async () => { await api.runCobros(); await cargar() }}>Forzar cobros</button>
      </div>
      {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg">{error}</div>}

      {stats && <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {[
          ['Clientes', stats.clientes],
          ['Suscripciones activas', stats.activas],
          ['Ingresos mensuales', fmt(stats.ingresos)],
          ['Enviados', stats.enviados],
          ['Fallidos', stats.fallidos],
        ].map(([label, value]) => (
          <div key={label} className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="text-xl font-bold">{value}</p>
          </div>
        ))}
      </div>}

      <div className="bg-white rounded-xl shadow-sm p-4">
        <h3 className="font-semibold mb-2">Próximos cobros</h3>
        <div className="space-y-2">
          {stats?.proximos?.map((s) => (
            <div key={s.id} className="flex justify-between text-sm border-b pb-2">
              <span>{s.cliente?.nombre} · {s.tipo}</span>
              <span className="font-semibold">{fmt(s.monto)} · {s.dias === 0 ? 'Hoy' : `${s.dias} días`}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
