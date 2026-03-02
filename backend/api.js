// api.js — Rutas REST para gestionar clientes, suscripciones e historial

const http = require("http");
const url = require("url");
const db = require("./db");
const { procesarCobrosDelDia, estaProcesandoCobros } = require("./scheduler");

const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const API_KEY = process.env.API_KEY || "";

// ── Helpers HTTP ───────────────────────────────────────────────────────

function responseHeaders(extra = {}) {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": CORS_ORIGIN,
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,X-API-Key",
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

function isValidEmail(correo) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(correo || "").trim());
}

function validarCliente(body, parcial = false) {
  if (!parcial || body.nombre !== undefined) {
    if (typeof body.nombre !== "string" || !body.nombre.trim()) {
      return "nombre es requerido";
    }
  }

  if (!parcial || body.correo !== undefined) {
    if (!isValidEmail(body.correo)) {
      return "correo inválido";
    }
  }

  return null;
}

function validarSuscripcion(body, parcial = false) {
  if (!parcial || body.cliente_id !== undefined) {
    if (!Number.isInteger(Number(body.cliente_id)) || Number(body.cliente_id) <= 0) {
      return "cliente_id debe ser un entero positivo";
    }
  }

  if (!parcial || body.tipo !== undefined) {
    if (typeof body.tipo !== "string" || !body.tipo.trim()) return "tipo es requerido";
  }

  if (!parcial || body.monto !== undefined) {
    const monto = Number(body.monto);
    if (!Number.isFinite(monto) || monto <= 0) return "monto debe ser un número mayor a 0";
  }

  if (!parcial || body.dia_cobro !== undefined) {
    const dia = Number(body.dia_cobro);
    if (!Number.isInteger(dia) || dia < 1 || dia > 31) return "dia_cobro debe estar entre 1 y 31";
  }

  if (body.activa !== undefined && typeof body.activa !== "boolean") {
    return "activa debe ser boolean";
  }

  return null;
}

function autorizado(req) {
  if (!API_KEY) return true;
  return req.headers["x-api-key"] === API_KEY;
}

// ── Router ─────────────────────────────────────────────────────────────

async function handler(req, res) {
  const { pathname } = url.parse(req.url);
  const method = req.method;

  if (method === "OPTIONS") {
    res.writeHead(204, responseHeaders({ "Content-Length": "0" }));
    res.end();
    return;
  }

  if (pathname !== "/health" && !autorizado(req)) {
    return json(res, 401, { error: "No autorizado" });
  }

  try {
    if (pathname === "/clientes") {
      if (method === "GET") return json(res, 200, db.clientes.all());
      if (method === "POST") {
        const body = await parseBody(req);
        const err = validarCliente(body);
        if (err) return json(res, 400, { error: err });
        return json(res, 201, db.clientes.create(body));
      }
    }

    if (pathname.startsWith("/clientes/")) {
      const id = idFrom(pathname, "/clientes");
      if (!id) return json(res, 400, { error: "ID inválido" });

      if (method === "PUT") {
        const body = await parseBody(req);
        const err = validarCliente(body, true);
        if (err) return json(res, 400, { error: err });
        const rec = db.clientes.update(id, body);
        return json(res, rec ? 200 : 404, rec || { error: "No encontrado" });
      }
      if (method === "DELETE") {
        db.clientes.delete(id);
        return json(res, 200, { ok: true });
      }
    }

    if (pathname === "/suscripciones") {
      if (method === "GET") return json(res, 200, db.suscripciones.all());
      if (method === "POST") {
        const body = await parseBody(req);
        const err = validarSuscripcion(body);
        if (err) return json(res, 400, { error: err });
        return json(res, 201, db.suscripciones.create(body));
      }
    }

    if (pathname.startsWith("/suscripciones/")) {
      const id = idFrom(pathname, "/suscripciones");
      if (!id) return json(res, 400, { error: "ID inválido" });

      if (method === "PUT") {
        const body = await parseBody(req);
        const err = validarSuscripcion(body, true);
        if (err) return json(res, 400, { error: err });
        const rec = db.suscripciones.update(id, body);
        return json(res, rec ? 200 : 404, rec || { error: "No encontrado" });
      }
    }

    if (pathname === "/historial" && method === "GET") return json(res, 200, db.historial.all());

    if (pathname === "/run" && method === "POST") {
      if (estaProcesandoCobros()) {
        return json(res, 409, { error: "Ya hay un proceso de cobros en ejecución" });
      }

      procesarCobrosDelDia();
      return json(res, 202, { message: "Proceso de cobros iniciado" });
    }

    if (pathname === "/health" && method === "GET") {
      return json(res, 200, { status: "ok", timestamp: new Date().toISOString() });
    }

    json(res, 404, { error: "Ruta no encontrada" });
  } catch (err) {
    console.error("Error en API:", err.message);
    json(res, 500, { error: err.message });
  }
}

function iniciarAPI(puerto) {
  const server = http.createServer(handler);
  server.listen(puerto, () => {
    console.log(`🚀 API corriendo en http://localhost:${puerto}`);
    if (API_KEY) console.log("🔐 API protegida por X-API-Key");
  });
}

module.exports = { iniciarAPI };
