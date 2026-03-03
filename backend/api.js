const http = require("http");
const db = require("./db");
const auth = require("./auth");
const jwt = require('jsonwebtoken');
const { procesarCobrosDelDia, estaProcesandoCobros, procesarSeleccionados } = require("./scheduler");

const SECRET_KEY = process.env.JWT_SECRET || 'clave_maestra_super_secreta_123';

// ── Helpers HTTP ───────────────────────────────────────────────────────
function responseHeaders(extra = {}) {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*", 
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-API-Key",
    ...extra,
  };
}

function json(res, status, data) {
  res.writeHead(status, responseHeaders());
  res.end(JSON.stringify(data));
}

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body.trim() ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error("JSON inválido: " + err.message));
      }
    });
  });
}

function obtenerUsuario(req) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return null;
  const token = authHeader.split(" ")[1];
  try {
    return jwt.verify(token, SECRET_KEY);
  } catch (err) {
    return null;
  }
}

// ── Router Principal ───────────────────────────────────────────────────

async function handler(req, res) {
  const host = req.headers.host || 'localhost:3000';
  const requestUrl = new URL(req.url, `http://${host}`);
  const pathname = requestUrl.pathname;
  const method = req.method;

  if (method === "OPTIONS") {
    res.writeHead(204, responseHeaders({ "Content-Length": "0" }));
    res.end();
    return;
  }

  try {
    if (pathname === "/auth/register" && method === "POST") {
      req.body = await parseBody(req);
      return auth.registrar(req, res);
    }
    if (pathname === "/auth/login" && method === "POST") {
      req.body = await parseBody(req);
      return auth.login(req, res);
    }
    if (pathname === "/health") return json(res, 200, { status: "ok" });

    const usuario = obtenerUsuario(req);
    if (!usuario) return json(res, 401, { error: "No autorizado. Inicie sesión." });

    // ── Clientes ──
    if (pathname === "/clientes") {
      if (method === "GET") return json(res, 200, db.clientes.all(usuario.id));
      if (method === "POST") {
        const body = await parseBody(req);
        return json(res, 201, db.clientes.create(body, usuario.id));
      }
    }

    // ── Suscripciones (CON MANEJO DE ERRORES DE VALIDACIÓN) ──
    if (pathname === "/suscripciones") {
      if (method === "GET") return json(res, 200, db.suscripciones.all(usuario.id));
      if (method === "POST") {
        const body = await parseBody(req);
        try {
          // Intentamos crear la suscripción usando la lógica validada de db.js
          const nuevaSub = db.suscripciones.create(body, usuario.id);
          return json(res, 201, nuevaSub);
        } catch (dbErr) {
          // Si el error es de validación (monto, cliente id, etc), enviamos 400
          const esErrorValidacion = dbErr.message.includes("VALIDATION_ERROR");
          const status = esErrorValidacion ? 400 : 500;
          const mensaje = dbErr.message.replace("VALIDATION_ERROR: ", "");
          
          return json(res, status, { error: mensaje });
        }
      }
    }

    if (pathname === "/historial" && method === "GET") {
      return json(res, 200, db.historial.all(usuario.id));
    }

    // ── Procesar Selección Individual ──
    if (pathname === "/run-individual" && method === "POST") {
      const body = await parseBody(req).catch(() => ({}));
      if (!body.ids || !Array.isArray(body.ids)) {
        return json(res, 400, { error: "Se requiere un arreglo de IDs en la propiedad 'ids'" });
      }
      try {
        const resultado = await procesarSeleccionados(usuario.id, body.ids);
        return json(res, 200, { message: "Proceso individual completado", enviados: resultado.enviados });
      } catch (err) {
        return json(res, 500, { error: err.message });
      }
    }

    // ── Proceso de Cobros General ──
    if (pathname === "/run" && method === "POST") {
      if (estaProcesandoCobros()) return json(res, 409, { error: "El proceso ya está en ejecución" });

      const body = await parseBody(req).catch(() => ({}));
      const hoy = new Date().toISOString().split('T')[0];
      const enviosHoy = db.historial.all(usuario.id).filter(h => h.fecha.startsWith(hoy) && h.estado === 'Enviado');

      if (enviosHoy.length > 0 && body.confirmarReenvio !== true) {
        return json(res, 409, { 
          requiereConfirmacion: true, 
          mensaje: `Se detectaron ${enviosHoy.length} cobros ya enviados hoy.`,
          yaEnviadosIds: enviosHoy.map(h => h.suscripcion_id) 
        });
      }

      try {
        const resultado = await procesarCobrosDelDia(usuario.id, body.confirmarReenvio || false);
        return json(res, 200, { message: `Proceso completado exitosamente.`, enviados: resultado.enviados });
      } catch (subErr) {
        return json(res, 500, { error: "Error en el motor de envíos: " + subErr.message });
      }
    }

    json(res, 404, { error: "Ruta no encontrada" });

  } catch (err) {
    console.error("🔥 Error crítico en API:", err); 
    json(res, 500, { error: "Error interno del servidor: " + err.message });
  }
}

function iniciarAPI(puerto) {
  const server = http.createServer(handler);
  server.listen(puerto, () => console.log(`🚀 API de Café Valdore lista en puerto ${puerto}`));
  return server;
}

module.exports = { iniciarAPI };