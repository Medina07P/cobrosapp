import { fmtFecha } from './formato.js'

export const LIMITE_FILAS = 100

export const indexarPorId = (lista) =>
  new Map((Array.isArray(lista) ? lista : []).map((x) => [x.id, x]))

const marca = (h) => Date.parse(h.fecha_valida) || 0

// Une cada envío con su suscripción y cliente (índices por id) y ordena del más reciente al más antiguo.
// 'fecha' (backend actual) o 'fecha_envio' (registros viejos); sin monto propio se usa el de la suscripción.
export function enriquecerHistorial(historial, subs, clientes) {
  const porSub = indexarPorId(subs)
  const porCli = indexarPorId(clientes)
  return (Array.isArray(historial) ? historial : [])
    .map((h) => {
      const sus = porSub.get(h.suscripcion_id)
      const cli = sus ? porCli.get(sus.cliente_id) : undefined
      return { ...h, sus, cli, monto_final: h.monto || sus?.monto || 0, fecha_valida: h.fecha || h.fecha_envio }
    })
    .sort((a, b) => marca(b) - marca(a))
}

export const limitarFilas = (lista, n = LIMITE_FILAS) => lista.slice(0, n)

// ISO con hora -> fecha y hora locales; 'AAAA-MM-DD' sin hora -> DD/MM/AAAA (sin desfase de zona); inválida -> ''.
export function fechaHistorial(valor) {
  if (typeof valor !== 'string' || !valor) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return fmtFecha(valor)
  const t = Date.parse(valor)
  if (Number.isNaN(t)) return ''
  return new Date(t).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
}

export const textoRegistros = (n) => `${n} ${n === 1 ? 'registro' : 'registros'}`
