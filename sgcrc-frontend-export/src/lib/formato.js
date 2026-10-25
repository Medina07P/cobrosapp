export const fmt = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

// 'AAAA-MM-DD' (con o sin hora) -> 'DD/MM/AAAA', sin pasar por Date para evitar desfases de zona horaria
export const fmtFecha = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(typeof iso === 'string' ? iso : '')
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

// Día calendario ('AAAA-MM-DD') de un instante ISO UTC en la zona de la app (Bogotá, igual que backend/cobros.js).
export const diaEnZona = (isoUtc, zona = 'America/Bogota') => {
  const t = isoUtc ? Date.parse(isoUtc) : NaN
  if (Number.isNaN(t)) return ''
  return new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t))
}

export const esDelDia = (isoUtc, diaISO, zona) => diaEnZona(isoUtc, zona) === diaISO
