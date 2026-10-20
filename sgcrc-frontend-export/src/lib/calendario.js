// Lógica pura del Calendario de cobros: fechas locales, rejilla del mes y proyección de cobros por día.

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

// Proyección de cobros del mes: { [día]: { total, items: [{...suscripción, cl}] } }.
// Si hay fecha_alta, su día manda y no se muestran cobros anteriores a ella; si no, dia_cobro.
export const agruparCobrosPorDia = (subs, clientes, anio, mes) => {
  const dias = diasDelMes(anio, mes)
  const mapa = {}

  const registrar = (dia, s) => {
    const inicio = parseFechaLocal(s.fecha_alta)
    if (inicio && new Date(anio, mes, dia) < inicio) return
    const d = Math.min(dia, dias)
    if (!Number.isFinite(d)) return
    if (!mapa[d]) mapa[d] = { total: 0, items: [] }
    const cl = clientes.find(c => c.id === s.cliente_id)
    mapa[d].total += s.monto
    mapa[d].items.push({ ...s, cl })
  }

  for (const s of subs) {
    const diaReal = s.fecha_alta ? parseInt(s.fecha_alta.split('-')[2], 10) : s.dia_cobro
    switch (s.frecuencia || 'mensual') {
      case 'semanal':
        for (let d = 1; d <= dias; d++) {
          if (new Date(anio, mes, d).getDay() === (diaReal % 7)) registrar(d, s)
        }
        break
      case 'quincenal':
        registrar(diaReal, s)
        if (diaReal + 15 <= dias) registrar(diaReal + 15, s)
        break
      case 'anual':
        if (mes === (s.mes_cobro || 0)) registrar(diaReal, s)
        break
      default:
        registrar(diaReal, s)
    }
  }
  return mapa
}
