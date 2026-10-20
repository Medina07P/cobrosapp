export const fmt = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

// 'AAAA-MM-DD' (con o sin hora) -> 'DD/MM/AAAA', sin pasar por Date para evitar desfases de zona horaria
export const fmtFecha = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(typeof iso === 'string' ? iso : '')
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}
