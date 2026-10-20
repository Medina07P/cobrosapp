const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildHtml, construirRemitente } = require('./mailer');

const base = {
  cliente: { nombre: 'Ana' },
  suscripcion: { monto: 50000, tipo: 'Plan Oro', frecuencia: 'mensual' },
  nombreVendedor: 'Mi Negocio',
};

test('sin WhatsApp el correo no incluye botón ni números ajenos', () => {
  const html = buildHtml({ ...base });
  assert.ok(!html.includes('wa.me'));
  assert.ok(!html.includes('573014518350'));
  assert.ok(!html.includes('Reportar Pago por WhatsApp'));
});

test('con WhatsApp el enlace usa el número normalizado del usuario', () => {
  const html = buildHtml({ ...base, whatsapp: '+57 300 123 4567' });
  assert.ok(html.includes('https://wa.me/573001234567?text='));
  assert.ok(html.includes('Reportar Pago por WhatsApp'));
});

test('un WhatsApp inválido no genera enlace', () => {
  const html = buildHtml({ ...base, whatsapp: '"><script>x</script>' });
  assert.ok(!html.includes('wa.me'));
  assert.ok(!html.includes('<script>'));
});

test('un color inválido cae al color por defecto y no se inyecta en el HTML', () => {
  const html = buildHtml({ ...base, color: '#fff;}</style><script>x</script>' });
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('#4f46e5'));
});

test('la frecuencia y el nombre del cliente se escapan', () => {
  const html = buildHtml({
    cliente: { nombre: '<b>Ana</b>' },
    suscripcion: { monto: 1000, tipo: 'X', frecuencia: '<i>mensual</i>' },
  });
  assert.ok(!html.includes('<i>mensual</i>'));
  assert.ok(html.includes('&lt;i&gt;mensual&lt;/i&gt;'));
  assert.ok(!html.includes('<b>Ana</b>'));
});

test('construirRemitente neutraliza comillas y saltos de linea del nombre', () => {
  const r = construirRemitente({ nombre: 'x" <soporte@banco.com>, "y' + String.fromCharCode(13, 10) + 'Bcc: a@b.c' }, 'real@dominio.com');
  assert.strictEqual(r.address, 'real@dominio.com');
  assert.ok(!r.name.includes('"') && !r.name.includes(String.fromCharCode(13)) && !r.name.includes(String.fromCharCode(10)));
  assert.strictEqual(typeof r.name, 'string');
});

test('construirRemitente usa SGCRC si el nombre falta o queda vacio y trunca a 120', () => {
  assert.strictEqual(construirRemitente({ nombre: '' }, 'a@b.c').name, 'SGCRC');
  assert.strictEqual(construirRemitente(null, 'a@b.c').name, 'SGCRC');
  assert.strictEqual(construirRemitente({ nombre: '"' + String.fromCharCode(10) + '"' }, 'a@b.c').name, 'SGCRC');
  assert.strictEqual(construirRemitente({ nombre: 'n'.repeat(500) }, 'a@b.c').name.length, 120);
});

test('con color de marca claro el botón usa texto oscuro y el monto tinta legible', () => {
  const html = buildHtml({ ...base, color: '#FFD400' });
  assert.ok(html.includes('color: #1F2421 !important'));
  assert.ok(html.includes('.total-amount { font-size: 32px; font-weight: 800; color: #1F2421;'));
  assert.ok(html.includes('background-color: #FFD400;'));
});

test('con color de marca oscuro el botón usa texto blanco y el monto conserva el color', () => {
  const html = buildHtml({ ...base, color: '#1F6B4F' });
  assert.ok(html.includes('color: #FFFFFF !important'));
  assert.ok(html.includes('.total-amount { font-size: 32px; font-weight: 800; color: #1F6B4F;'));
});

test('con color inválido el índigo por defecto usa texto blanco', () => {
  const html = buildHtml({ ...base, color: 'rojo' });
  assert.ok(html.includes('background-color: #4f46e5;'));
  assert.ok(html.includes('color: #FFFFFF !important'));
});
