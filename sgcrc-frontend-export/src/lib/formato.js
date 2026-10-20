export const fmt = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

// 'AAAA-MM-DD' (con o sin hora) -> 'DD/MM/AAAA', sin pasar por Date para evitar desfases de zona horaria
export const fmtFecha = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(typeof iso === 'string' ? iso : '')
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

// ¿La fecha ISO (UTC) cae en el mismo día calendario LOCAL que `ahora`?
export const esHoyLocal = (isoUtc, ahora = new Date()) => {
  if (!isoUtc) return false
  const d = new Date(isoUtc)
  if (Number.isNaN(d.getTime())) return false
  return d.getFullYear() === ahora.getFullYear()
    && d.getMonth() === ahora.getMonth()
    && d.getDate() === ahora.getDate()
}
