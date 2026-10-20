// Trampa de foco de los diálogos. Devuelve el elemento al que hay que mover el foco a mano,
// o null si el navegador puede seguir su orden natural de Tab.
export function siguienteFoco(enfocables, activo, atras) {
  if (enfocables.length === 0) return null
  const primero = enfocables[0]
  const ultimo = enfocables[enfocables.length - 1]
  if (!enfocables.includes(activo)) return atras ? ultimo : primero
  if (atras && activo === primero) return ultimo
  if (!atras && activo === ultimo) return primero
  return null
}
