const http = require("http");
const db = require("./db");
const auth = require("./auth");
const jwt = require('jsonwebtoken');
const { procesarCobrosDelDia, estaProcesandoCobros } = require("./scheduler");

const SECRET_KEY = process.env.JWT_SECRET || 'clave_maestra_super_secreta_123';

// ── Helpers HTTP ───────────────────────────────────────────────────────

function responseHeaders(extra = {}) {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*", // Permite peticiones desde el frontend (Vite)
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-API-Key",
    ...extra,
  };
}

function json(res, status, data) {
  res.writeHead(status, responseHeaders());
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("JSON inválido"));
      }
    });
  });
}

function idFrom(pathname, base) {
  const part = pathname.replace(base + "/", "");
  const n = parseInt(part, 10);
  return Number.isNaN(n) ? null : n;
}

// Validaciones básicas
function validarCliente(body) {
  if (!body.nombre || !body.nombre.trim()) return "Nombre es requerido";
  if (!body.correo || !body.correo.includes("@")) return "Correo inválido";
  return null;
}

function validarSuscripcion(body) {
  if (!body.cliente_id) return "ID de cliente requerido";
  if (!body.monto || body.monto <= 0) return "Monto inválido";
  if (!body.dia_cobro || body.dia_cobro < 1 || body.dia_cobro > 31) return "Día de cobro inválido";
  return null;
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
  // Manejo robusto de la URL
  const host = req.headers.host || 'localhost:3000';
  const requestUrl = new URL(req.url, `http://${host}`);
  const pathname = requestUrl.pathname;
  const method = req.method;

  // 1. Responder a CORS Preflight
  if (method === "OPTIONS") {
    res.writeHead(204, responseHeaders({ "Content-Length": "0" }));
    res.end();
    return;
  }

  try {
    // 2. Rutas Públicas
    if (pathname === "/auth/register" && method === "POST") {
      req.body = await parseBody(req);
      return auth.registrar(req, res);
    }
    if (pathname === "/auth/login" && method === "POST") {
      req.body = await parseBody(req);
      return auth.login(req, res);
    }
    if (pathname === "/health") return json(res, 200, { status: "ok" });

    // 3. Verificación de Token para rutas privadas
    const usuario = obtenerUsuario(req);
    if (!usuario) {
      return json(res, 401, { error: "No autorizado. Inicie sesión." });
    }

    // 4. Rutas Privadas (Clientes, Suscripciones, Historial)
    if (pathname === "/clientes") {
      if (method === "GET") return json(res, 200, db.clientes.all(usuario.id));
      if (method === "POST") {
        const body = await parseBody(req);
        const err = validarCliente(body);
        if (err) return json(res, 400, { error: err });
        return json(res, 201, db.clientes.create(body, usuario.id));
      }
    }

    if (pathname.startsWith("/clientes/")) {
      const id = idFrom(pathname, "/clientes");
      if (method === "PUT") {
        const body = await parseBody(req);
        return json(res, 200, db.clientes.update(id, body));
      }
      if (method === "DELETE") {
        db.clientes.delete(id);
        return json(res, 200, { ok: true });
      }
    }

    if (pathname === "/suscripciones") {
      if (method === "GET") return json(res, 200, db.suscripciones.all(usuario.id));
      if (method === "POST") {
        const body = await parseBody(req);
        const err = validarSuscripcion(body);
        if (err) return json(res, 400, { error: err });
        return json(res, 201, db.suscripciones.create(body, usuario.id));
      }
    }

    if (pathname === "/historial" && method === "GET") {
      return json(res, 200, db.historial.all(usuario.id));
    }

    if (pathname === "/run" && method === "POST") {
      if (estaProcesandoCobros()) return json(res, 409, { error: "En ejecución" });
      procesarCobrosDelDia(usuario.id);
      return json(res, 202, { message: "Proceso iniciado" });
    }

    // Ruta no encontrada
    json(res, 404, { error: "Ruta no encontrada" });

  } catch (err) {
    console.error("Error en API:", err.message);
    json(res, 500, { error: "Error interno del servidor" });
  }
}

function iniciarAPI(puerto) {
  const server = http.createServer(handler);
  server.listen(puerto, () => {
    console.log(`🚀 API corriendo en http://localhost:${puerto}`);
  });
  return server;
}

module.exports = { iniciarAPI };