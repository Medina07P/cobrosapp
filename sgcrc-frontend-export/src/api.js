// src/api.js — Capa de acceso al backend (Versión Proxy + JWT)

const BASE = '/api';
let runtimeToken = '';

export function setApiKey(token) {
  runtimeToken = token || '';
}

async function req(method, path, body) {
  const headers = { 
    'Content-Type': 'application/json' 
  };

  if (runtimeToken) {
    headers['Authorization'] = runtimeToken;
  }

  try {
    const res = await fetch(BASE + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Manejo de sesión expirada
    if (res.status === 401) {
      localStorage.removeItem('sgcrc_session');
      // Opcional: window.location.href = '/login';
    }

    // --- CORRECCIÓN CRÍTICA PARA EL ERROR 409 ---
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      
      // Creamos un objeto de error enriquecido
      const error = new Error(errData.error || `Error ${res.status}`);
      
      // Adjuntamos la respuesta para que el Dashboard pueda ver el status (409)
      // y los datos (requiereConfirmacion, mensaje)
      error.response = {
        status: res.status,
        data: errData
      };
      
      throw error;
    }

    if (res.status === 204) return null;
    return res.json();
  } catch (error) {
    // Si no tiene el objeto response (error de red), lo logueamos
    if (!error.response) {
      console.error("Network/Runtime Error:", error.message);
    }
    throw error;
  }
}

export const api = {
  // Autenticación
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
  
  // CORRECCIÓN: Ahora acepta el objeto de datos (confirmarReenvio)
  runCobros: (data) => req('POST', '/run', data),
  
  health: () => req('GET', '/health'),
};