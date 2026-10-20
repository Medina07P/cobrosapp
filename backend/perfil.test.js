const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizarWhatsapp, colorValido, ratioContraste, textoSobre, colorLegibleSobreBlanco } = require('./perfil');

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

test('textoSobre elige tinta oscura o blanco según el contraste', () => {
  assert.equal(textoSobre('#FFD400'), '#1F2421');
  assert.equal(textoSobre('#1F6B4F'), '#FFFFFF');
  assert.equal(textoSobre('#4f46e5'), '#FFFFFF');
  assert.equal(textoSobre('#FFFFFF'), '#1F2421');
});

test('colorLegibleSobreBlanco conserva el color si contrasta >= 4.5 con blanco', () => {
  assert.equal(colorLegibleSobreBlanco('#FFD400'), '#1F2421');
  assert.equal(colorLegibleSobreBlanco('#1F6B4F'), '#1F6B4F');
  assert.ok(ratioContraste('#FFD400', '#FFFFFF') < 2);
  assert.ok(ratioContraste('#1F6B4F', '#FFFFFF') >= 4.5);
});

test('textoSobre y colorLegibleSobreBlanco toleran entradas inválidas sin lanzar', () => {
  for (const v of ['azul', undefined, null, '#abc', '']) {
    assert.equal(textoSobre(v), '#FFFFFF');
    assert.equal(colorLegibleSobreBlanco(v), '#1F2421');
  }
});

test('paridad con el frontend (colorTema.js) para los mismos colores', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const ruta = path.join(__dirname, '..', 'sgcrc-frontend-export', 'src', 'lib', 'colorTema.js');
  const src = fs.readFileSync(ruta, 'utf8');
  const fe = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
  for (const c of ['#FFD400', '#1F6B4F', '#4f46e5', '#FFFFFF', '#000000']) {
    assert.equal(textoSobre(c), fe.textoSobre(c), c);
    assert.equal(ratioContraste(c, '#FFFFFF'), fe.ratioContraste(c, '#FFFFFF'), c);
  }
});
