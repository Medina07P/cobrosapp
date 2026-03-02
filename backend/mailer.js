const nodemailer = require("nodemailer");
require("dotenv").config();

// ── Función para crear un Transporter al vuelo ─────────────────────────

function crearTransporter(usuarioConfig = null) {
  // Si el usuario tiene config_smtp en la DB, la usamos. 
  // Si no, usamos las variables del .env (tus credenciales maestras).
  let config;

  if (usuarioConfig && usuarioConfig.config_smtp) {
    try {
      config = JSON.parse(usuarioConfig.config_smtp);
    } catch (e) {
      console.error("Error parseando config_smtp del usuario:", e);
    }
  }

  // Si no hay config de usuario, usamos la del sistema (.env)
  const host = config?.host || process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(config?.port || process.env.SMTP_PORT || 587);
  const user = config?.user || process.env.SMTP_USER;
  const pass = config?.pass || process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// ── Plantilla de correo (Mantenemos tu diseño) ─────────────────────────

function buildHtml({ cliente, suscripcion, nombreVendedor = "SGCRC" }) {
  const fecha = new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
  const monto = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(suscripcion.monto);

  const clienteNombre = escapeHtml(cliente.nombre);
  const tipo = escapeHtml(suscripcion.tipo);
  const descripcion = suscripcion.descripcion ? escapeHtml(suscripcion.descripcion) : "";

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <style>
    body { font-family: Arial, sans-serif; background:#f4f4f7; margin:0; padding:0; }
    .container { max-width:560px; margin:2rem auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.08); }
    .header { background:linear-gradient(135deg,#6c63ff,#a78bfa); padding:2rem; text-align:center; }
    .header h1 { color:#fff; margin:0; font-size:1.4rem; letter-spacing:0.02em; }
    .header p  { color:rgba(255,255,255,0.8); margin:0.4rem 0 0; font-size:0.9rem; }
    .body { padding:2rem; }
    .body p { color:#444; line-height:1.7; }
    .card { background:#f8f7ff; border:1px solid #e0dcff; border-radius:8px; padding:1.2rem 1.5rem; margin:1.2rem 0; }
    .card .row { display:flex; justify-content:space-between; padding:0.4rem 0; border-bottom:1px solid #ece9ff; font-size:0.9rem; }
    .card .row:last-child { border-bottom:none; }
    .card .label { color:#888; }
    .card .value { color:#333; font-weight:600; }
    .monto { color:#6c63ff; font-size:1.3rem; font-weight:800; }
    .footer { background:#f4f4f7; padding:1rem 2rem; text-align:center; font-size:0.78rem; color:#aaa; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Aviso de Cobro Mensual</h1>
      <p>Enviado por: ${escapeHtml(nombreVendedor)}</p>
    </div>
    <div class="body">
      <p>Estimado/a <strong>${clienteNombre}</strong>,</p>
      <p>Le informamos que se ha generado su cobro mensual correspondiente al siguiente concepto:</p>
      <div class="card">
        <div class="row"><span class="label">Servicio</span><span class="value">${tipo}</span></div>
        <div class="row"><span class="label">Fecha</span><span class="value">${fecha}</span></div>
        <div class="row"><span class="label">Monto</span><span class="value monto">${monto}</span></div>
        ${descripcion ? `<div class="row"><span class="label">Nota</span><span class="value">${descripcion}</span></div>` : ""}
      </div>
      <p>Por favor realice el pago correspondiente según los canales acordados.</p>
      <p>Si tiene alguna pregunta, no dude en contactarnos.</p>
    </div>
    <div class="footer">
      Este es un mensaje automático — Gestionado por SGCRC
    </div>
  </div>
</body>
</html>`;
}

// ── Función principal (Recibe usuarioConfig) ───────────────────────────

async function enviarCobro({ cliente, suscripcion, usuarioConfig }) {
  const monto = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(suscripcion.monto);
  
  // Creamos el transporte específico para este envío
  const transporter = crearTransporter(usuarioConfig);

  const fromEmail = (usuarioConfig && usuarioConfig.config_smtp) 
    ? JSON.parse(usuarioConfig.config_smtp).user 
    : (process.env.SMTP_FROM || process.env.SMTP_USER);

  await transporter.sendMail({
    from: `"${usuarioConfig.nombre}" <${fromEmail}>`,
    to: cliente.correo,
    subject: `Cobro mensual — ${suscripcion.tipo} — ${monto}`,
    html: buildHtml({ cliente, suscripcion, nombreVendedor: usuarioConfig.nombre }),
  });
}

async function verificarConexion() {
  try {
    const transporter = crearTransporter(); // Verifica la del .env por defecto
    await transporter.verify();
    console.log("✅ SMTP Maestro conectado correctamente");
    return true;
  } catch (err) {
    console.error("❌ Error SMTP Maestro:", err.message);
    return false;
  }
}

module.exports = { enviarCobro, verificarConexion, buildHtml };