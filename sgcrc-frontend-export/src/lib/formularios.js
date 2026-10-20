// Accesibilidad de errores: tras validar, el foco va al primer campo inválido y el lector de pantalla
// anuncia su error por aria-describedby.
export function primerInvalido(contenedor) {
  return contenedor?.querySelector('[aria-invalid="true"]') ?? null
}

export function enfocarPrimerInvalido(contenedor) {
  const el = primerInvalido(contenedor)
  if (!el) return false
  el.focus()
  return true
}
