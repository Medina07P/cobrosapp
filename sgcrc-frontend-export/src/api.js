// src/api.js — Capa de acceso al backend (Versión Proxy + JWT)

// IMPORTANTE: Usamos '/api' para que el proxy de Vite intercepte la petición.
// Esto evita errores de CORS y problemas de puertos en desarrollo.
const BASE = '/api';

let runtimeToken = '';

// Esta función recibe "Bearer <TOKEN>" desde App.jsx
export function setApiKey(token) {
  runtimeToken = token || '';
}

async function req(method, path, body) {
  const headers = { 
    'Content-Type': 'application/json' 
  };

  // Inyectamos el token JWT si existe
  if (runtimeToken) {
    headers['Authorization'] = runtimeToken;
  }

  try {
    const res = await fetch(BASE + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Si el token expiró o es inválido (401), limpiamos la sesión
    if (res.status === 401) {
      localStorage.removeItem('sgcrc_session');
      // Podrías añadir un window.location.reload() aquí para forzar el login
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Error ${res.status}`);
    }

    if (res.status === 204) return null;
    return res.json();
  } catch (error) {
    console.error("API Error:", error.message);
    throw error;
  }
}

export const api = {
  // Autenticación (Nuevas rutas)
  login: (credentials) => req('POST', '/auth/login', credentials),
  register: (userData) => req('POST', '/auth/register', userData),

  // Clientes
  getClientes: () => req('GET', '/clientes'),
  createCliente: (data) => req('POST', '/clientes', data),
  updateCliente: (id, data) => req('PUT', `/clientes/${id}`, data),
  deleteCliente: (id) => req('DELETE', `/clientes/${id}`),

  // Suscripciones
  getSuscripciones: () => req('GET', '/suscripciones'),
  createSuscripcion: (data) => req('POST', '/suscripciones', data),
  updateSuscripcion: (id, data) => req('PUT', `/suscripciones/${id}`, data),

  // Historial y utilidades
  getHistorial: () => req('GET', '/historial'),
  runCobros: () => req('POST', '/run'),
  health: () => req('GET', '/health'),
};