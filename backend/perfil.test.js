const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizarWhatsapp, colorValido } = require('./perfil');

test('normalizarWhatsapp deja solo dígitos y acepta 8 a 15', () => {
  assert.equal(normalizarWhatsapp('+57 300 123-4567'), '573001234567');
  assert.equal(normalizarWhatsapp('(57) 300.123.4567'), '573001234567');
  assert.equal(normalizarWhatsapp('12345678'), '12345678');
});

test('normalizarWhatsapp: vacío o null borra el número; inválido devuelve undefined', () => {
  assert.equal(normalizarWhatsapp(''), null);
  assert.equal(normalizarWhatsapp(null), null);
  assert.equal(normalizarWhatsapp('1234567'), undefined);        // muy corto
  assert.equal(normalizarWhatsapp('1234567890123456'), undefined); // muy largo
  assert.equal(normalizarWhatsapp('abc'), undefined);
  assert.equal(normalizarWhatsapp('57300<script>'), undefined);
});

test('colorValido solo acepta #RRGGBB', () => {
  assert.equal(colorValido('#1F6B4F'), true);
  assert.equal(colorValido('#abcdef'), true);
  assert.equal(colorValido('#fff'), false);
  assert.equal(colorValido('red'), false);
  assert.equal(colorValido('#fff;}</style><script>x</script>'), false);
  assert.equal(colorValido(null), false);
});
