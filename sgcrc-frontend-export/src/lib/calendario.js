// Lógica pura del Calendario de cobros: fechas locales, rejilla del mes y proyección de cobros por día.

import { diaEnZona } from './formato.js'

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

// 'AAAA-MM-DD' (con o sin hora) -> Date a medianoche LOCAL (no UTC). Entrada no válida -> null.
export const parseFechaLocal = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(typeof s === 'string' ? s : '')
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

export const diasDelMes = (anio, mes) => new Date(anio, mes + 1, 0).getDate()

// desfase: huecos antes del día 1 (domingo = 0).
export const rejillaMes = (anio, mes) => ({ dias: diasDelMes(anio, mes), desfase: new Date(anio, mes, 1).getDay() })

// '15 de octubre de 2026'
export const fechaLarga = (anio, mes, dia) => `${dia} de ${MESES[mes].toLowerCase()} de ${anio}`

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export const diaSemanaCorto = (anio, mes, dia) => DIAS_CORTOS[new Date(anio, mes, dia).getDay()]

// 'Lun 5 de octubre'
export const etiquetaAgenda = (anio, mes, dia) =>
  `${diaSemanaCorto(anio, mes, dia)} ${dia} de ${MESES[mes].toLowerCase()}`

// Reglas de cobro idénticas a backend/cobros.js (tocaCobrarEn). Una prueba de paridad las compara.
// iso: 'AAAA-MM-DD'. Usa UTC para el día de la semana y los días del mes, sin depender del huso.
const partes = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return {
    y, m, d,
    diaSemana: new Date(Date.UTC(y, m - 1, d)).getUTCDay(),
    diasMes: new Date(Date.UTC(y, m, 0)).getUTCDate(),
  }
}

export const tocaCobrarEn = (sus, iso) => {
  const alta = sus.fecha_alta ? String(sus.fecha_alta).slice(0, 10) : null
  if (alta) {
    if (alta > iso) return false // aún no empezó
    if (alta === iso) return true // el día de alta se cobra siempre
  }

  const { d: diaActual, m: mes, diaSemana, diasMes } = partes(iso)
  const diaBaseReal = alta ? Number(alta.split('-')[2]) : (sus.dia_cobro || 1)
  const diaBase = Math.min(diaBaseReal, diasMes)

  switch ((sus.frecuencia || 'mensual').toLowerCase()) {
    case 'quincenal': {
      const segunda = diaBase + 15
      const ajustada = segunda > diasMes ? segunda - diasMes : segunda
      return diaActual === diaBase || diaActual === ajustada
    }
    case 'semanal': {
      const objetivo = alta ? partes(alta).diaSemana : (sus.dia_cobro || 0) % 7
      return diaSemana === objetivo
    }
    case 'anual': {
      const mesObjetivo = alta ? Number(alta.split('-')[1]) : (sus.mes_cobro || 0) + 1
      return diaActual === diaBase && mes === mesObjetivo
    }
    default:
      return diaActual === diaBase
  }
}

// Proyección de cobros del mes: { [día]: { total, items: [{...suscripción, cl}] } }.
// Cada día del mes se decide con tocaCobrarEn (mismas reglas que el cron del backend).
export const agruparCobrosPorDia = (subs, clientes, anio, mes) => {
  const dias = diasDelMes(anio, mes)
  const prefijo = `${anio}-${String(mes + 1).padStart(2, '0')}-`
  const mapa = {}
  for (let dia = 1; dia <= dias; dia++) {
    const iso = prefijo + String(dia).padStart(2, '0')
    for (const s of subs) {
      if (!tocaCobrarEn(s, iso)) continue
      if (!mapa[dia]) mapa[dia] = { total: 0, items: [] }
      mapa[dia].total += s.monto
      mapa[dia].items.push({ ...s, cl: clientes.find(c => c.id === s.cliente_id) })
    }
  }
  return mapa
}

// Envíos reales por suscripción y día (Bogotá): 'Enviado' o 'Fallido'. Si un día tiene ambos, gana 'Enviado'.
export const indexarEnvios = (historial) => {
  const mapa = new Map()
  for (const h of Array.isArray(historial) ? historial : []) {
    if (h.estado !== 'Enviado' && h.estado !== 'Fallido') continue
    const dia = diaEnZona(h.fecha || h.fecha_envio)
    if (!dia) continue
    const clave = `${h.suscripcion_id}|${dia}`
    if (mapa.get(clave) !== 'Enviado') mapa.set(clave, h.estado)
  }
  return mapa
}

// Estado de un cobro proyectado: null si es futuro; si no, lo que dice el historial ese día.
// El historial guarda la fecha del envío (un reintento figura el día en que salió).
export const estadoEnvio = (envios, subId, iso, hoyISO) =>
  iso > hoyISO ? null : (envios.get(`${subId}|${iso}`) || 'Sin registro')
