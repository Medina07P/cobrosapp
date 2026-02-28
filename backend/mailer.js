// mailer.js — Servicio de correo con Nodemailer

const nodemailer = require("nodemailer");
require("dotenv").config();

// ── Transporter ────────────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || "smtp.gmail.com",
  port:   Number(process.env.SMTP_PORT) || 587,
  secure: false,                // true para puerto 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// ── Plantilla de correo ────────────────────────────────────────────────

function buildHtml({ cliente, suscripcion }) {
  const fecha  = new Date().toLocaleDateString("es-CO", { day:"numeric", month:"long", year:"numeric" });
  const monto  = new Intl.NumberFormat("es-CO", { style:"currency", currency:"COP", maximumFractionDigits:0 }).format(suscripcion.monto);

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
      <p>Gestión de Cobros Recurrentes</p>
    </div>
    <div class="body">
      <p>Estimado/a <strong>${cliente.nombre}</strong>,</p>
      <p>Le informamos que se ha generado su cobro mensual correspondiente al siguiente concepto:</p>
      <div class="card">
        <div class="row"><span class="label">Servicio</span><span class="value">${suscripcion.tipo}</span></div>
        <div class="row"><span class="label">Fecha</span><span class="value">${fecha}</span></div>
        <div class="row"><span class="label">Monto</span><span class="value monto">${monto}</span></div>
        ${suscripcion.descripcion ? `<div class="row"><span class="label">Nota</span><span class="value">${suscripcion.descripcion}</span></div>` : ""}
      </div>
      <p>Por favor realice el pago correspondiente según los canales acordados.</p>
      <p>Si tiene alguna pregunta, no dude en contactarnos.</p>
    </div>
    <div class="footer">
      Este es un mensaje automático — SGCRC · Sistema de Gestión de Cobros Recurrentes
    </div>
  </div>
</body>
</html>`;
}

// ── Función principal ──────────────────────────────────────────────────

async function enviarCobro({ cliente, suscripcion }) {
  const monto = new Intl.NumberFormat("es-CO", { style:"currency", currency:"COP", maximumFractionDigits:0 }).format(suscripcion.monto);

  await transporter.sendMail({
    from:    process.env.SMTP_FROM || process.env.SMTP_USER,
    to:      cliente.correo,
    subject: `Cobro mensual — ${suscripcion.tipo} — ${monto}`,
    html:    buildHtml({ cliente, suscripcion })
  });
}

// Verifica que las credenciales SMTP funcionen (útil al iniciar)
async function verificarConexion() {
  try {
    await transporter.verify();
    console.log("✅ SMTP conectado correctamente");
    return true;
  } catch (err) {
    console.error("❌ Error SMTP:", err.message);
    return false;
  }
}

module.exports = { enviarCobro, verificarConexion };
