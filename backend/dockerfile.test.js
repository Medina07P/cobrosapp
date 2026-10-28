const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const leer = (f) => readFileSync(join(__dirname, f), 'utf8');

// El COPY de la imagen es una lista fija: olvidar un módulo local deja la API
// en bucle de reinicios (MODULE_NOT_FOUND) y el contenedor unhealthy.
test('el Dockerfile copia todos los módulos locales que requiere index.js', () => {
  const copy = leer('Dockerfile').split('\n').find((l) => l.startsWith('COPY ') && l.includes('index.js')) || '';
  const copiados = copy.split(/\s+/).slice(1).filter((t) => !t.startsWith('--') && t !== './');

  const pendientes = new Set(['index.js']);
  const vistos = new Set();
  while (pendientes.size) {
    const f = [...pendientes][0];
    pendientes.delete(f);
    vistos.add(f);
    for (const m of leer(f).matchAll(/require\(\s*['"]\.\/([\w.-]+?)(\.js)?['"]\s*\)/g)) {
      const dep = `${m[1]}.js`;
      if (!vistos.has(dep)) pendientes.add(dep);
    }
  }
  assert.deepEqual([...vistos].filter((f) => !copiados.includes(f)), []);
});
