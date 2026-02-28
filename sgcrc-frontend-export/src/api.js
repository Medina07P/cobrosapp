// src/api.js — Todas las llamadas al backend en un solo lugar

const BASE = '/api'

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Error ${res.status}`)
  }
  return res.json()
}

export const api = {
  // Clientes
  getClientes:        ()       => req('GET',    '/clientes'),
  createCliente:      (data)   => req('POST',   '/clientes', data),
  updateCliente:      (id, d)  => req('PUT',    `/clientes/${id}`, d),
  deleteCliente:      (id)     => req('DELETE', `/clientes/${id}`),

  // Suscripciones
  getSuscripciones:   ()       => req('GET',    '/suscripciones'),
  createSuscripcion:  (data)   => req('POST',   '/suscripciones', data),
  updateSuscripcion:  (id, d)  => req('PUT',    `/suscripciones/${id}`, d),

  // Historial
  getHistorial:       ()       => req('GET',    '/historial'),

  // Forzar cobros (prueba)
  runCobros:          ()       => req('POST',   '/run'),

  // Health
  health:             ()       => req('GET',    '/health'),
}
