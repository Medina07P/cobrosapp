// api.js — Rutas REST para gestionar clientes, suscripciones e historial

const http     = require("http");
const url      = require("url");
const db       = require("./db");
const { procesarCobrosDelDia } = require("./scheduler");

// ── Helpers HTTP ───────────────────────────────────────────────────────

function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end",  () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error("JSON inválido")); }
    });
  });
}

function idFrom(pathname, base) {
  // Extrae el ID numérico de /base/:id
  const part = pathname.replace(base + "/", "");
  const n    = parseInt(part, 10);
  return isNaN(n) ? null : n;
}

// ── Router ─────────────────────────────────────────────────────────────

async function handler(req, res) {
  const { pathname } = url.parse(req.url);
  const method       = req.method;

  // CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Methods":"GET,POST,PUT,DELETE", "Access-Control-Allow-Headers":"Content-Type" });
    res.end();
    return;
  }

  try {
    // ── CLIENTES ──────────────────────────────────────────────────────

    if (pathname === "/clientes") {
      if (method === "GET")  return json(res, 200, db.clientes.all());
      if (method === "POST") {
        const body = await parseBody(req);
        if (!body.nombre || !body.correo) return json(res, 400, { error: "nombre y correo son requeridos" });
        return json(res, 201, db.clientes.create(body));
      }
    }

    if (pathname.startsWith("/clientes/")) {
      const id = idFrom(pathname, "/clientes");
      if (!id) return json(res, 400, { error: "ID inválido" });

      if (method === "PUT") {
        const body = await parseBody(req);
        const rec  = db.clientes.update(id, body);
        return json(res, rec ? 200 : 404, rec || { error: "No encontrado" });
      }
      if (method === "DELETE") { db.clientes.delete(id); return json(res, 200, { ok: true }); }
    }

    // ── SUSCRIPCIONES ─────────────────────────────────────────────────

    if (pathname === "/suscripciones") {
      if (method === "GET")  return json(res, 200, db.suscripciones.all());
      if (method === "POST") {
        const body = await parseBody(req);
        if (!body.cliente_id || !body.monto || !body.dia_cobro || !body.tipo)
          return json(res, 400, { error: "cliente_id, tipo, monto y dia_cobro son requeridos" });
        return json(res, 201, db.suscripciones.create(body));
      }
    }

    if (pathname.startsWith("/suscripciones/")) {
      const id = idFrom(pathname, "/suscripciones");
      if (!id) return json(res, 400, { error: "ID inválido" });

      if (method === "PUT") {
        const body = await parseBody(req);
        const rec  = db.suscripciones.update(id, body);
        return json(res, rec ? 200 : 404, rec || { error: "No encontrado" });
      }
    }

    // ── HISTORIAL ─────────────────────────────────────────────────────

    if (pathname === "/historial" && method === "GET")
      return json(res, 200, db.historial.all());

    // ── ACCIONES ──────────────────────────────────────────────────────

    // Forzar ejecución manual del scheduler (útil para pruebas)
    if (pathname === "/run" && method === "POST") {
      procesarCobrosDelDia();    // no bloqueamos, corre en segundo plano
      return json(res, 202, { message: "Proceso de cobros iniciado" });
    }

    // Health check
    if (pathname === "/health" && method === "GET")
      return json(res, 200, { status: "ok", timestamp: new Date().toISOString() });

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
    console.log(`   Rutas disponibles:`);
    console.log(`   GET/POST  /clientes`);
    console.log(`   PUT       /clientes/:id`);
    console.log(`   GET/POST  /suscripciones`);
    console.log(`   PUT       /suscripciones/:id`);
    console.log(`   GET       /historial`);
    console.log(`   POST      /run   ← forzar cobros ahora`);
    console.log(`   GET       /health`);
  });
}

module.exports = { iniciarAPI };
