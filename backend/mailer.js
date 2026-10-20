const nodemailer = require("nodemailer");
require("dotenv").config();
const { colorValido, normalizarWhatsapp } = require("./perfil");

function crearTransporter(usuarioConfig = null) {
  let config;
  if (usuarioConfig && usuarioConfig.config_smtp) {
    try {
      config = JSON.parse(usuarioConfig.config_smtp);
    } catch (e) {
      console.error("Error parseando config_smtp del usuario:", e);
    }
  }

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

// Agregamos 'color' a los parámetros
function buildHtml({ cliente, suscripcion, nombreVendedor = "SGCRC", color: colorEntrada = "#4f46e5", whatsapp = null }) {
  const color = colorValido(colorEntrada) ? colorEntrada : "#4f46e5";
  const fecha = new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
  const monto = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(suscripcion.monto);
  
  const clienteNombre = escapeHtml(cliente.nombre);
  const tipo = escapeHtml(suscripcion.tipo);
  const descripcion = suscripcion.descripcion ? escapeHtml(suscripcion.descripcion) : "";
  const frecuencia = escapeHtml((suscripcion.frecuencia || "Mensual").toLowerCase());

  // WhatsApp del vendedor: sin número válido no se incluye el botón
  const numeroWa = normalizarWhatsapp(whatsapp);
  const bloqueWhatsapp = numeroWa
    ? `<p style="font-size: 14px; color: #6b7280;">Para reportar tu pago de forma rápida, puedes usar el siguiente botón:</p>
        <div class="btn-container">
          <a href="https://wa.me/${numeroWa}?text=${encodeURIComponent(`Hola, envío el comprobante de mi pago de ${suscripcion.tipo} por valor de ${monto}.`)}" class="btn">Reportar Pago por WhatsApp</a>
        </div>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #f9fafb; padding-bottom: 40px; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; margin-top: 40px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); border: 1px solid #f3f4f6; }
    
    /* GRADIENTE DINÁMICO */
        /* Opción recomendada para el header en buildHtml */
    .header { 
      background: ${color}; 
      background: linear-gradient(135deg, ${color} 0%, #111827 100%); 
      padding: 40px 20px; 
      text-align: center; 
      color: #ffffff; 
}
    
    .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em; }
    .header p { margin: 8px 0 0; opacity: 0.9; font-size: 14px; }
    .content { padding: 32px; color: #374151; line-height: 1.6; }
    .greeting { font-size: 18px; font-weight: 700; color: #111827; margin-bottom: 16px; }
    .receipt-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0; }
    .receipt-row { display: flex; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 12px; }
    .receipt-row:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .label { color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em; }
    .value { color: #1e293b; font-size: 14px; font-weight: 600; }
    .total-section { text-align: center; margin-top: 10px; }
    .total-label { font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold; }
    
    /* MONTO CON COLOR DINÁMICO */
    .total-amount { font-size: 32px; font-weight: 800; color: ${color}; margin: 4px 0; }
    
    .btn-container { text-align: center; margin-top: 32px; }
    
    /* BOTÓN CON COLOR DINÁMICO */
    .btn { background-color: ${color}; color: #ffffff !important; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px; display: inline-block; }
    
    .footer { text-align: center; padding: 24px; font-size: 12px; color: #9ca3af; }
    .divider { border-top: 1px solid #f3f4f6; margin: 24px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>Confirmación de Cobro</h1>
        <p>${escapeHtml(nombreVendedor)}</p>
      </div>
      <div class="content">
        <div class="greeting">Hola, ${clienteNombre}</div>
        <p>Esperamos que estés bien. Te informamos que se ha generado el cobro de tu suscripción <strong>${frecuencia}</strong>.</p>
        
        <div class="receipt-card">
          <div class="total-section">
            <div class="total-label">Monto a pagar</div>
            <div class="total-amount">${monto}</div>
          </div>
          <div class="divider"></div>
          <div class="receipt-row">
            <span class="label">Servicio: </span>
            <span class="value">${tipo}</span>
          </div>
          <div class="receipt-row">
            <span class="label">Fecha: </span>
            <span class="value">${fecha}</span>
          </div>
          ${descripcion ? `<div class="receipt-row"><span class="label">Referencia: </span><span class="value">${descripcion}</span></div>` : ""}
        </div>

        ${bloqueWhatsapp}
      </div>
      <div class="footer">
        Este es un mensaje automático generado por <strong>SGCRC</strong>.<br>
        &copy; ${new Date().getFullYear()} ${escapeHtml(nombreVendedor)}. Todos los derechos reservados.
      </div>
    </div>
  </div>
</body>
</html>`;
}

// Remitente como objeto (nodemailer lo codifica): el nombre nunca puede inyectar direcciones ni cabeceras
function construirRemitente(usuarioConfig, fromEmail) {
  const name = String(usuarioConfig?.nombre || "SGCRC").replace(/[\r\n"]/g, " ").trim().slice(0, 120) || "SGCRC";
  return { name, address: fromEmail };
}

async function enviarCobro({ cliente, suscripcion, usuarioConfig }) {
  const monto = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(suscripcion.monto);
  const transporter = crearTransporter(usuarioConfig);
  const frecuencia = (suscripcion.frecuencia || "Mensual");
  
  // LEEMOS EL COLOR DEL USUARIO (SI NO EXISTE, INDIGO POR DEFECTO)
  const colorMarca = usuarioConfig.color_tema || "#4f46e5";

  let fromEmail;
  try {
    fromEmail = usuarioConfig?.config_smtp ? JSON.parse(usuarioConfig.config_smtp).user : undefined;
  } catch (e) { /* config_smtp corrupto: se usa el remitente global */ }
  const global = process.env.SMTP_FROM || process.env.SMTP_USER || "";
  fromEmail = fromEmail || (global.match(/<([^<>]+)>/)?.[1] ?? global);

  await transporter.sendMail({
    from: construirRemitente(usuarioConfig, fromEmail),
    to: cliente.correo,
    subject: `Recibo de Cobro ${frecuencia} — ${monto}`,
    html: buildHtml({ 
        cliente, 
        suscripcion, 
        nombreVendedor: usuarioConfig.nombre,
        color: colorMarca, // Pasamos el color al constructor del HTML
        whatsapp: usuarioConfig.whatsapp,
    }),
  });
}

async function verificarConexion() {
  try {
    const transporter = crearTransporter();
    await transporter.verify();
    console.log("✅ SMTP Maestro conectado correctamente");
    return true;
  } catch (err) {
    console.error("❌ Error SMTP Maestro:", err.message);
    return false;
  }
}

module.exports = { enviarCobro, verificarConexion, buildHtml, construirRemitente };