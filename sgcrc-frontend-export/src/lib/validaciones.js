// Validación en el cliente, espejo de las reglas de backend/db.js. Devuelven {} si todo está bien.
const vacio = (v) => typeof v !== 'string' || v.trim() === ''

export function validarCliente({ nombre, correo }) {
  const e = {}
  if (vacio(nombre)) e.nombre = 'Escribe el nombre.'
  else if (nombre.trim().length > 120) e.nombre = 'El nombre no puede superar 120 caracteres.'
  if (vacio(correo)) e.correo = 'Escribe el correo.'
  else if (correo.trim().length > 254) e.correo = 'El correo no puede superar 254 caracteres.'
  else if (!correo.includes('@')) e.correo = 'El correo no es válido.'
  return e
}

const FRECUENCIAS = ['semanal', 'quincenal', 'mensual', 'anual']

export function validarPlan({ nombre_plan, monto, frecuencia, dia_cobro }) {
  const e = {}
  if (vacio(nombre_plan)) e.nombre_plan = 'Escribe el nombre del plan.'
  else if (nombre_plan.trim().length > 120) e.nombre_plan = 'El nombre del plan no puede superar 120 caracteres.'
  const m = typeof monto === 'number' ? String(monto) : String(monto ?? '').trim()
  if (m === '') e.monto = 'Escribe el precio.'
  else if (!/^\d+(\.\d+)?$/.test(m)) e.monto = 'El precio debe ser un número sin signos ni letras.'
  if (!FRECUENCIAS.includes(frecuencia)) e.frecuencia = 'Elige una frecuencia válida.'
  const d = String(dia_cobro ?? '').trim()
  if (!/^\d+$/.test(d) || Number(d) < 1 || Number(d) > 31) e.dia_cobro = 'El día de cobro debe ser un entero entre 1 y 31.'
  return e
}

export function validarSuscripcion({ cliente_id, plan_id, fecha_alta }) {
  const e = {}
  if (cliente_id === '' || cliente_id == null) e.cliente_id = 'Elige un cliente.'
  if (plan_id === '' || plan_id == null) e.plan_id = 'Elige un plan.'
  if (fecha_alta && !/^\d{4}-\d{2}-\d{2}$/.test(fecha_alta)) e.fecha_alta = 'La fecha de inicio no es válida.'
  return e
}

export function validarPerfil({ nombre, whatsapp }) {
  const e = {}
  if (vacio(nombre)) e.nombre = 'Escribe el nombre de tu negocio.'
  const w = (whatsapp ?? '').trim()
  if (w !== '' && !/^\d{8,15}$/.test(w)) e.whatsapp = 'Escribe solo dígitos, con código de país (8 a 15).'
  return e
}
