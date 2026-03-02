// src/api.js — Capa de acceso al backend

const BASE = '/api'
let runtimeApiKey = import.meta.env.VITE_API_KEY || ''

export function setApiKey(apiKey) {
  runtimeApiKey = apiKey || ''
}

async function req(method, path, body) {
  const headers = { 'Content-Type': 'application/json' }
  if (runtimeApiKey) headers['X-API-Key'] = runtimeApiKey

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Error ${res.status}`)
  }

  if (res.status === 204) return null
  return res.json()
}

export const api = {
  getClientes: () => req('GET', '/clientes'),
  createCliente: (data) => req('POST', '/clientes', data),
  updateCliente: (id, data) => req('PUT', `/clientes/${id}`, data),
  deleteCliente: (id) => req('DELETE', `/clientes/${id}`),

  getSuscripciones: () => req('GET', '/suscripciones'),
  createSuscripcion: (data) => req('POST', '/suscripciones', data),
  updateSuscripcion: (id, data) => req('PUT', `/suscripciones/${id}`, data),

  getHistorial: () => req('GET', '/historial'),
  runCobros: () => req('POST', '/run'),
  health: () => req('GET', '/health'),
}
