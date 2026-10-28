// Clientes que dejaron de recibir cobros porque su correo rebotó.
// La comparación replica la del scheduler (backend/scheduler.js): la marca solo cuenta
// mientras `correo_rebotado` coincida exactamente con el correo actual, así que al
// corregir la dirección el bloqueo se levanta solo y la columna conserva el valor viejo.

export const esReboteActivo = (cliente) =>
  Boolean(cliente?.correo_rebotado) && cliente.correo_rebotado === cliente.correo

// Una fila por cliente con rebote activo y al menos una suscripción activa.
// Ordenadas por monto descendente: primero lo que más pesa en la facturación.
export const clientesEnRebote = (clientes, suscripciones) => {
  const activas = new Map()
  for (const s of suscripciones) {
    if (!s.activa) continue
    const acumulado = activas.get(s.cliente_id) || { suscripciones: 0, monto: 0 }
    acumulado.suscripciones += 1
    acumulado.monto += Number(s.monto) || 0
    activas.set(s.cliente_id, acumulado)
  }

  return clientes
    .filter((c) => activas.has(c.id) && esReboteActivo(c))
    .map((c) => ({
      id: c.id,
      nombre: c.nombre,
      correo: c.correo,
      suscripciones: activas.get(c.id).suscripciones,
      monto: activas.get(c.id).monto,
    }))
    .sort((a, b) => b.monto - a.monto || a.nombre.localeCompare(b.nombre, 'es') || a.id - b.id)
}
