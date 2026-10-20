const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildHtml } = require('./mailer');

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
