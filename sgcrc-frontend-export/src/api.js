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
    // Si el token no tiene el prefijo "Bearer ", se lo ponemos
    headers['Authorization'] = runtimeToken.startsWith('Bearer ') 
      ? runtimeToken 
      : `Bearer ${runtimeToken}`;
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
      // Opcional: window.location.reload(); o redirección
    }

    // --- CORRECCIÓN CRÍTICA PARA EL ERROR 409 Y OTROS ---
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      
      const error = new Error(errData.error || `Error ${res.status}`);
      
      error.response = {
        status: res.status,
        data: errData
      };
      
      throw error;
    }

    if (res.status === 204) return null;
    return res.json();
  } catch (error) {
    if (!error.response) {
      console.error("Network/Runtime Error:", error.message);
    }
    throw error;
  }
}

export const api = {
  login: (credentials) => req('POST', '/auth/login', credentials),
  register: (userData) => req('POST', '/auth/register', userData),

  // --- CLIENTES ---
  getClientes: () => req('GET', '/clientes'),
  createCliente: (data) => req('POST', '/clientes', data),
  updateCliente: (id, data) => req('PUT', `/clientes/${id}`, data),
  deleteCliente: (id) => req('DELETE', `/clientes/${id}`),

  // --- CATÁLOGO DE PLANES ---
  getPlanes: () => req('GET', '/planes'),
  createPlan: (data) => req('POST', '/planes', data),
  updatePlan: (id, data) => req('PUT', `/planes/${id}`, data),
  deletePlan: (id) => req('DELETE', `/planes/${id}`),

  // --- SUSCRIPCIONES ---
  getSuscripciones: () => req('GET', '/suscripciones'),
  createSuscripcion: (data) => req('POST', '/suscripciones', data), 
  updateSuscripcion: (id, data) => req('PUT', `/suscripciones/${id}`, data),
  deleteSuscripcion: (id) => req('DELETE', `/suscripciones/${id}`),

  // --- CONFIGURACIÓN DE USUARIO (NUEVO) ---
  // Obtiene nombre y color_tema de Café Valdore
  getPerfil: () => req('GET', '/usuario/perfil'),
  
  // Actualiza nombre y color_tema (Usa PATCH como definimos en el server.js)
  updatePerfil: (data) => req('PATCH', '/usuario/config-tema', data),

  // --- PROCESOS Y OTROS ---
  getHistorial: () => req('GET', '/historial'),
  runCobros: (data) => req('POST', '/run', data),
  runIndividual: (ids) => req('POST', '/run-individual', { ids }), // Para reenvíos manuales
  health: () => req('GET', '/health'),
};