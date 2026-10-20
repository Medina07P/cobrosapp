const test = require('node:test');
const assert = require('node:assert');
const { jwtSecret } = require('./config');

function conSecreto(valor, fn) {
  const previo = process.env.JWT_SECRET;
  try {
    if (valor === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = valor;
    fn();
  } finally {
    if (previo === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previo;
  }
}

test('jwtSecret lanza si JWT_SECRET no está definido', () => {
  conSecreto(undefined, () => assert.throws(() => jwtSecret(), /JWT_SECRET no está definido/));
});

test('jwtSecret lanza si JWT_SECRET está vacío', () => {
  conSecreto('', () => assert.throws(() => jwtSecret(), /JWT_SECRET no está definido/));
});

test('jwtSecret lanza si JWT_SECRET son solo espacios', () => {
  conSecreto('   ', () => assert.throws(() => jwtSecret(), /JWT_SECRET no está definido/));
});

test('jwtSecret devuelve el valor definido (leído al llamar)', () => {
  conSecreto('abc123', () => assert.strictEqual(jwtSecret(), 'abc123'));
  conSecreto('otro', () => assert.strictEqual(jwtSecret(), 'otro'));
});
