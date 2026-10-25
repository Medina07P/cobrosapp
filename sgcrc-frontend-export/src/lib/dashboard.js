// Lógica pura del Dashboard: fechas locales y próximos cobros según las reglas reales de cobro.
import { tocaCobrarEn } from './calendario.js'

const pad = (n) => String(n).padStart(2, '0')

export const aISOLocal = (fecha = new Date()) =>
  `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`

export const sumarDiasISO = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number)
  return aISOLocal(new Date(y, m - 1, d + n))
}

export const textoDias = (n) => (n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : `En ${n} días`)

// Una fila por suscripción activa: la primera fecha de cobro dentro de la ventana, ordenada por cercanía.
export const proximosCobros = (subs, clientes, desdeISO, { max = 5, ventana = 60 } = {}) => {
  const nombres = new Map(clientes.map((c) => [c.id, c.nombre]))
  const pendientes = subs.filter((s) => s.activa)
  const filas = []
  for (let dias = 0; dias <= ventana && pendientes.length > 0; dias++) {
    const fecha = sumarDiasISO(desdeISO, dias)
    for (let i = pendientes.length - 1; i >= 0; i--) {
      const s = pendientes[i]
      if (!tocaCobrarEn(s, fecha)) continue
      filas.push({
        id: s.id, fecha, dias,
        cliente: nombres.get(s.cliente_id) || 'Cliente eliminado',
        plan: s.tipo, monto: s.monto, frecuencia: s.frecuencia || 'mensual',
      })
      pendientes.splice(i, 1)
    }
  }
  return filas.sort((a, b) => a.dias - b.dias || a.id - b.id).slice(0, max)
}
