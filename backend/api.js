const http = require("http");
const db = require("./db");
const auth = require("./auth");
const jwt = require('jsonwebtoken');
const { colorValido, normalizarWhatsapp } = require("./perfil");
const { procesarCobrosDelDia, estaProcesandoCobros, procesarSeleccionados, previsualizarCobros, resumenCobros } = require("./scheduler");

const { jwtSecret } = require("./config");

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

// Igual que parseBody, pero exige un objeto (rechaza null, arreglos y primitivos con 400)
async function parseBodyObjeto(req) {
  const body = await parseBody(req);
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("VALIDATION_ERROR: Cuerpo de la petición inválido.");
  }
  return body;
}

function obtenerUsuario(req) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return null;
  const token = authHeader.split(" ")[1];
  // Fuera del try: si falta JWT_SECRET el error se propaga (500 + log), no se convierte en 401
  const secreto = jwtSecret();
  try {
    return jwt.verify(token, secreto, { algorithms: ['HS256'] });
  } catch (err) {
    return null;
  }
}

// ── Router Principal ───────────────────────────────────────────────────

// VALIDATION_ERROR -> 400 con el mensaje limpio; cualquier otro error -> 500 genérico (sin detalles internos)
function errorDeDatos(res, err) {
  if (err && typeof err.message === "string" && err.message.startsWith("JSON inválido")) {
    return json(res, 400, { error: "JSON inválido" });
  }
  if (err && typeof err.message === "string" && err.message.startsWith("VALIDATION_ERROR: ")) {
    return json(res, 400, { error: err.message.replace("VALIDATION_ERROR: ", "") });
  }
  console.error("🔥 Error en API:", err);
  return json(res, 500, { error: "Error interno del servidor" });
}

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
    // ── 1. RUTAS PÚBLICAS ──
    if (pathname === "/auth/register" && method === "POST") {
      try { req.body = await parseBodyObjeto(req); } catch (e) { return errorDeDatos(res, e); }
      return auth.registrar(req, res);
    }
    if (pathname === "/auth/login" && method === "POST") {
      try { req.body = await parseBodyObjeto(req); } catch (e) { return errorDeDatos(res, e); }
      return auth.login(req, res);
    }
    if (pathname === "/health") return json(res, 200, { status: "ok" });

    // ── 2. VERIFICACIÓN DE USUARIO (JWT) ──
    const usuario = obtenerUsuario(req);
    if (!usuario) return json(res, 401, { error: "No autorizado. Inicie sesión." });

    // ── 3. CLIENTES ──
    if (pathname.startsWith("/clientes")) {
      const id = pathname.split("/")[2];
      if (method === "GET" && !id) return json(res, 200, db.clientes.all(usuario.id));
      
      if (method === "POST" && !id) {
        try { return json(res, 201, db.clientes.create(await parseBodyObjeto(req), usuario.id)); }
        catch (e) { return errorDeDatos(res, e); }
      }
      
      if (method === "PUT" && id) {
        let actualizado;
        try { actualizado = db.clientes.update(Number(id), await parseBodyObjeto(req), usuario.id); }
        catch (e) { return errorDeDatos(res, e); }
        if (!actualizado) return json(res, 404, { error: "Cliente no encontrado" });
        return json(res, 200, actualizado);
      }
      
      if (method === "DELETE" && id) {
        try {
          if (!db.clientes.delete(Number(id), usuario.id).ok) return json(res, 404, { error: "Cliente no encontrado" });
          return json(res, 200, { message: "Cliente eliminado con éxito", id });
        } catch (e) { return errorDeDatos(res, e); }
      }
    }

    // ── 4. CATÁLOGO DE PLANES ──
    if (pathname.startsWith("/planes")) {
      const id = pathname.split("/")[2];
      if (method === "GET" && !id) return json(res, 200, db.planes.all(usuario.id));
      
      if (method === "POST" && !id) {
        try { return json(res, 201, db.planes.create(await parseBodyObjeto(req), usuario.id)); }
        catch (e) { return errorDeDatos(res, e); }
      }

      if (method === "PUT" && id) {
        let actualizado;
        try { actualizado = db.planes.update(Number(id), await parseBodyObjeto(req), usuario.id); }
        catch (e) { return errorDeDatos(res, e); }
        if (!actualizado) return json(res, 404, { error: "Plan no encontrado" });
        return json(res, 200, actualizado);
      }

      if (method === "DELETE" && id) {
        try {
          if (!db.planes.delete(Number(id), usuario.id).ok) return json(res, 404, { error: "Plan no encontrado" });
          return json(res, 200, { message: "Plan eliminado correctamente" });
        } catch (e) { return errorDeDatos(res, e); }
      }
    }

    // ── 5. SUSCRIPCIONES (CON DESCRIPCIÓN) ──
    if (pathname.startsWith("/suscripciones")) {
      const id = pathname.split("/")[2];
      if (method === "GET" && !id) return json(res, 200, db.suscripciones.all(usuario.id));
      
      if (method === "POST" && !id) {
        try {
          const nuevaSub = db.suscripciones.create(await parseBodyObjeto(req), usuario.id);
          return json(res, 201, nuevaSub);
        } catch (dbErr) {
          return errorDeDatos(res, dbErr);
        }
      }

      if (method === "PUT" && id) {
        try {
          const actualizada = db.suscripciones.update(Number(id), await parseBodyObjeto(req), usuario.id);
          if (!actualizada) return json(res, 404, { error: "Suscripción no encontrada" });
          return json(res, 200, actualizada);
        } catch (dbErr) {
          return errorDeDatos(res, dbErr);
        }
      }

      if (method === "DELETE" && id) {
        try {
          if (!db.suscripciones.delete(Number(id), usuario.id).ok) return json(res, 404, { error: "Suscripción no encontrada" });
          return json(res, 200, { message: "Suscripción eliminada con éxito", id });
        } catch (e) { return errorDeDatos(res, e); }
      }
    }

    // ── 8. CONFIGURACIÓN DE USUARIO (PERFIL Y TEMA) ──
    
    // Nueva ruta para obtener el perfil actual
    if (pathname === "/usuario/perfil" && method === "GET") {
      try {
        const datos = db.usuarios.findById(usuario.id);
        if (!datos) return json(res, 404, { error: "Usuario no encontrado" });
        // Lista blanca: nunca se expone config_smtp ni password
        const { id, email, nombre, color_tema, whatsapp } = datos;
        return json(res, 200, { id, email, nombre, color_tema, whatsapp });
      } catch (e) {
        return json(res, 500, { error: "Error al obtener perfil" });
      }
    }

    // Ruta para actualizar nombre y tema (Cambiada a POST o PATCH según prefieras)
    if (pathname === "/usuario/config-tema" && (method === "PATCH" || method === "POST")) {
      let body;
      try { body = await parseBodyObjeto(req); } catch (e) { return errorDeDatos(res, e); }
      const cambios = {};
      try {
        // Un color heredado inválido que coincide con el guardado se ignora (el frontend reenvía el perfil completo)
        if (body.color_tema) {
          if (colorValido(body.color_tema)) {
            cambios.color_tema = body.color_tema;
          } else {
            const actual = db.usuarios.findById(usuario.id);
            if (!actual || body.color_tema !== actual.color_tema) {
              return json(res, 400, { error: "El color debe tener el formato #RRGGBB." });
            }
          }
        }
        if (body.nombre) {
          const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
          if (!nombre || nombre.length > 120) {
            return json(res, 400, { error: "El nombre debe ser un texto de 1 a 120 caracteres." });
          }
          cambios.nombre = nombre;
        }
        const whatsapp = body.whatsapp === undefined ? undefined : normalizarWhatsapp(body.whatsapp);
        if (body.whatsapp !== undefined && whatsapp === undefined) {
          return json(res, 400, { error: "El WhatsApp debe tener entre 8 y 15 dígitos, con código de país (ej. 573001234567)." });
        }
        if (whatsapp !== undefined) cambios.whatsapp = whatsapp;

        db.usuarios.actualizarPerfil(usuario.id, cambios);
        return json(res, 200, { success: true, message: "Configuración actualizada" });
      } catch (e) {
        return errorDeDatos(res, e);
      }
    }

    // ── 6. HISTORIAL ──
    if (pathname === "/historial" && method === "GET") {
      return json(res, 200, db.historial.all(usuario.id));
    }

    // ── 7. PROCESOS DE COBRO ──
    if (pathname === "/run-individual" && method === "POST") {
      const body = (await parseBody(req).catch(() => ({}))) || {};
      if (!body.ids || !Array.isArray(body.ids)) {
        return json(res, 400, { error: "Se requiere un arreglo de IDs" });
      }
      if (body.ids.length > 500) return json(res, 400, { error: "Demasiados IDs" });
      const resultado = await procesarSeleccionados(usuario.id, body.ids);
      if (!resultado.success) return json(res, 409, { error: resultado.message });
      return json(res, 200, { message: "Proceso individual completado", enviados: resultado.enviados });
    }

    if (pathname === "/cobros/resumen" && method === "GET") {
      return json(res, 200, resumenCobros(usuario.id));
    }

    if (pathname === "/run" && method === "POST") {
      if (estaProcesandoCobros()) return json(res, 409, { error: "El proceso ya está en ejecución" });

      const body = (await parseBody(req).catch(() => ({}))) || {};

      // Solo se pide confirmación cuando no hay nada nuevo que enviar y sí hay cobros de hoy ya enviados
      const plan = previsualizarCobros(usuario.id, false);
      if (plan.enviar.length === 0 && plan.yaEnviadosHoy.length > 0 && body.confirmarReenvio !== true) {
        return json(res, 409, { 
          requiereConfirmacion: true, 
          mensaje: `Se detectaron ${plan.yaEnviadosHoy.length} cobros ya enviados hoy.`,
          yaEnviadosIds: plan.yaEnviadosHoy.map((s) => s.id) 
        });
      }

      const resultado = await procesarCobrosDelDia(usuario.id, body.confirmarReenvio === true);
      if (!resultado.success) return json(res, 409, { error: resultado.message });

      let message = `Proceso completado: ${resultado.enviados} enviados`;
      if (resultado.vencidosEnviados > 0) message += ` (${resultado.vencidosEnviados} vencidos)`;
      if (resultado.omitidos > 0) message += `. ${resultado.omitidos} ya enviados hoy se omitieron`;
      return json(res, 200, {
        message,
        enviados: resultado.enviados,
        vencidosEnviados: resultado.vencidosEnviados,
        omitidos: resultado.omitidos
      });
    }

    json(res, 404, { error: "Ruta no encontrada" });

  } catch (err) {
    console.error("🔥 Error crítico en API:", err); 
    json(res, 500, { error: "Error interno del servidor" });
  }
}

function iniciarAPI(puerto) {
  const server = http.createServer(handler);
  server.listen(puerto, () => console.log(`🚀 API de SGCRC lista localhost:${puerto}`));
  return server;
}

module.exports = { iniciarAPI };