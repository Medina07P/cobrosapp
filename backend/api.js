const http = require("http");
const db = require("./db");
const auth = require("./auth");
const jwt = require('jsonwebtoken');
const { procesarCobrosDelDia, estaProcesandoCobros, procesarSeleccionados, previsualizarCobros, resumenCobros } = require("./scheduler");

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

// VALIDATION_ERROR -> 400 con el mensaje limpio; cualquier otro error -> 500 genérico (sin detalles internos)
function errorDeDatos(res, err) {
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
      req.body = await parseBody(req);
      return auth.registrar(req, res);
    }
    if (pathname === "/auth/login" && method === "POST") {
      req.body = await parseBody(req);
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
        const body = await parseBody(req);
        try { return json(res, 201, db.clientes.create(body, usuario.id)); }
        catch (e) { return errorDeDatos(res, e); }
      }
      
      if (method === "PUT" && id) {
        const body = await parseBody(req);
        let actualizado;
        try { actualizado = db.clientes.update(Number(id), body, usuario.id); }
        catch (e) { return errorDeDatos(res, e); }
        if (!actualizado) return json(res, 404, { error: "Cliente no encontrado" });
        return json(res, 200, actualizado);
      }
      
      if (method === "DELETE" && id) {
        try {
          db.clientes.delete(Number(id), usuario.id);
          return json(res, 200, { message: "Cliente eliminado con éxito", id });
        } catch (e) { return json(res, 400, { error: e.message }); }
      }
    }

    // ── 4. CATÁLOGO DE PLANES ──
    if (pathname.startsWith("/planes")) {
      const id = pathname.split("/")[2];
      if (method === "GET" && !id) return json(res, 200, db.planes.all(usuario.id));
      
      if (method === "POST" && !id) {
        const body = await parseBody(req);
        try { return json(res, 201, db.planes.create(body, usuario.id)); }
        catch (e) { return errorDeDatos(res, e); }
      }

      if (method === "PUT" && id) {
        const body = await parseBody(req);
        let actualizado;
        try { actualizado = db.planes.update(Number(id), body, usuario.id); }
        catch (e) { return errorDeDatos(res, e); }
        if (!actualizado) return json(res, 404, { error: "Plan no encontrado" });
        return json(res, 200, actualizado);
      }

      if (method === "DELETE" && id) {
        try {
          db.planes.delete(Number(id), usuario.id);
          return json(res, 200, { message: "Plan eliminado correctamente" });
        } catch (e) { return json(res, 400, { error: e.message }); }
      }
    }

    // ── 5. SUSCRIPCIONES (CON DESCRIPCIÓN) ──
    if (pathname.startsWith("/suscripciones")) {
      const id = pathname.split("/")[2];
      if (method === "GET" && !id) return json(res, 200, db.suscripciones.all(usuario.id));
      
      if (method === "POST" && !id) {
        const body = await parseBody(req);
        try {
          const nuevaSub = db.suscripciones.create(body, usuario.id);
          return json(res, 201, nuevaSub);
        } catch (dbErr) {
          return errorDeDatos(res, dbErr);
        }
      }

      if (method === "PUT" && id) {
        const body = await parseBody(req);
        try {
          const actualizada = db.suscripciones.update(Number(id), body, usuario.id);
          if (!actualizada) return json(res, 404, { error: "Suscripción no encontrada" });
          return json(res, 200, actualizada);
        } catch (dbErr) {
          return errorDeDatos(res, dbErr);
        }
      }

      if (method === "DELETE" && id) {
        try {
          db.suscripciones.delete(Number(id), usuario.id);
          return json(res, 200, { message: "Suscripción eliminada con éxito", id });
        } catch (e) { return json(res, 500, { error: e.message }); }
      }
    }

    // ── 8. CONFIGURACIÓN DE USUARIO (PERFIL Y TEMA) ──
    
    // Nueva ruta para obtener el perfil actual
    if (pathname === "/usuario/perfil" && method === "GET") {
      try {
        const datos = db.usuarios.findById(usuario.id);
        // Quitamos el password por seguridad antes de enviar
        if (datos) delete datos.password;
        return json(res, 200, datos);
      } catch (e) {
        return json(res, 500, { error: "Error al obtener perfil" });
      }
    }

    // Ruta para actualizar nombre y tema (Cambiada a POST o PATCH según prefieras)
    if (pathname === "/usuario/config-tema" && (method === "PATCH" || method === "POST")) {
      const body = await parseBody(req);
      
      try {
        // Si viene color_tema, lo actualizamos
        if (body.color_tema) {
          db.usuarios.updateTema(usuario.id, body.color_tema);
        }
        // Si viene nombre, también lo actualizamos (Asegúrate de tener db.usuarios.updateNombre)
        if (body.nombre && db.usuarios.updateNombre) {
          db.usuarios.updateNombre(usuario.id, body.nombre);
        }
        
        return json(res, 200, { success: true, message: "Configuración actualizada" });
      } catch (e) {
        return json(res, 500, { error: "Error al actualizar configuración: " + e.message });
      }
    }

    // ── 6. HISTORIAL ──
    if (pathname === "/historial" && method === "GET") {
      return json(res, 200, db.historial.all(usuario.id));
    }

    // ── 7. PROCESOS DE COBRO ──
    if (pathname === "/run-individual" && method === "POST") {
      const body = await parseBody(req).catch(() => ({}));
      if (!body.ids || !Array.isArray(body.ids)) {
        return json(res, 400, { error: "Se requiere un arreglo de IDs" });
      }
      const resultado = await procesarSeleccionados(usuario.id, body.ids);
      return json(res, 200, { message: "Proceso individual completado", enviados: resultado.enviados });
    }

    if (pathname === "/cobros/resumen" && method === "GET") {
      return json(res, 200, resumenCobros(usuario.id));
    }

    if (pathname === "/run" && method === "POST") {
      if (estaProcesandoCobros()) return json(res, 409, { error: "El proceso ya está en ejecución" });

      const body = await parseBody(req).catch(() => ({}));

      // Solo se pide confirmación cuando no hay nada nuevo que enviar y sí hay cobros de hoy ya enviados
      const plan = previsualizarCobros(usuario.id, false);
      if (plan.enviar.length === 0 && plan.yaEnviadosHoy.length > 0 && body.confirmarReenvio !== true) {
        return json(res, 409, { 
          requiereConfirmacion: true, 
          mensaje: `Se detectaron ${plan.yaEnviadosHoy.length} cobros ya enviados hoy.`,
          yaEnviadosIds: plan.yaEnviadosHoy.map((s) => s.id) 
        });
      }

      const resultado = await procesarCobrosDelDia(usuario.id, body.confirmarReenvio || false);
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
  server.listen(puerto, () => console.log(`🚀 API de Café Valdore lista localhost:${puerto}`));
  return server;
}

module.exports = { iniciarAPI };