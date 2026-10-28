// Mensajes que la API devuelve al panel. Viven aparte de cobros.js (reglas de fechas)
// y son puros: se prueban sin base de datos.
//
// Los dos motivos de omisión se informan por separado: "ya enviados hoy" (el cobro salió
// antes) y "correo rebotado" (nunca salió). Mezclarlos hacía que /run dijera que se
// enviaron justo los correos que se omitieron.
function mensajeProceso({ enviados = 0, vencidosEnviados = 0, omitidos = 0, omitidosRebote = 0 } = {}) {
  let message = `Proceso completado: ${enviados} ${enviados === 1 ? 'enviado' : 'enviados'}`;
  if (vencidosEnviados > 0) message += ` (${vencidosEnviados} ${vencidosEnviados === 1 ? 'vencido' : 'vencidos'})`;
  if (omitidos > 0) message += `. ${omitidos} ya ${omitidos === 1 ? 'enviado' : 'enviados'} hoy se ${omitidos === 1 ? 'omitió' : 'omitieron'}`;
  if (omitidosRebote > 0) message += `. ${omitidosRebote} con correo rebotado no se ${omitidosRebote === 1 ? 'envió' : 'enviaron'}`;
  return message;
}

module.exports = { mensajeProceso };
