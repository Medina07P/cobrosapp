# Cobros vencidos. Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el cron diario también reintente los cobros cuyo día ya pasó sin un envío exitoso (hasta 7 días), y exponer un resumen de vencidos y perdidos por API.

**Architecture:** La lógica de fechas sale de `scheduler.js` a un módulo puro `backend/cobros.js` (sin base de datos), con pruebas `node --test`. `scheduler.js` lo usa para decidir qué enviar; `api.js` añade `GET /cobros/resumen` y ajusta `POST /run`. Sin cambios de esquema: todo se deduce del historial.

**Tech Stack:** Node.js (CommonJS), `better-sqlite3`, `node:test`, `node-cron`. Backend sin framework HTTP.

Spec: `docs/superpowers/specs/2026-10-19-cobros-vencidos-design.md`

## Global Constraints

- Rama de trabajo: `develop`. Un commit por tarea. Trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Todo el trabajo es dentro de `backend/`, salvo la documentación indicada en la Tarea 4.
- Multi-tenant: toda ruta nueva toma `usuario.id` del JWT verificado (`obtenerUsuario`) y lo pasa a la capa repositorio. Los clientes se resuelven dentro de los del usuario (`db.clientes.all(usuarioId)`), nunca por id global.
- Sin Express; el router de `api.js` es imperativo (`if` por `pathname + method`, después de la verificación JWT).
- Sin migraciones de esquema.
- Las fechas de cobro son strings `YYYY-MM-DD` en `America/Bogota` (variable `APP_TZ`), nunca `toISOString()` de la fecha actual.
- Ventana de reintento por defecto: 7 días (`COBROS_REINTENTO_DIAS`; `0` = solo cobros de hoy). Ventana de búsqueda hacia atrás: 30 días.
- Las pruebas que escriben en la base usan un usuario temporal con email con timestamp y lo borran al terminar. Nunca se ejecutan contra la base de producción. Los correos se simulan: no se envía ninguno real.
- No cambiar `package.json` de dependencias (no ejecutar `npm audit fix`).

## Estructura de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `backend/cobros.js` | Crear | Reglas puras de fechas de cobro y planificación |
| `backend/cobros.test.js` | Crear | Pruebas unitarias de `cobros.js` |
| `backend/scheduler.js` | Modificar | Usa `planificarCobros`; añade `previsualizarCobros` y `resumenCobros` |
| `backend/tests_cobros_integration.js` | Crear | Prueba de integración del scheduler con base real de desarrollo y correo simulado |
| `backend/api.js` | Modificar | `GET /cobros/resumen` y ajuste de `POST /run` |
| `backend/tests_api_smoke.js` | Modificar | Caso para `/cobros/resumen` |
| `backend/package.json` | Modificar | Scripts `test:unit` y `test:integration` |
| `backend/.env.example`, `backend/CLAUDE.md`, `CLAUDE.md` | Modificar | Documentar variables y la nueva arquitectura |

---

### Task 1: Módulo puro `cobros.js` con pruebas

**Files:**
- Create: `backend/cobros.js`, `backend/cobros.test.js`
- Modify: `backend/package.json` (scripts)

**Interfaces:**
- Produces (de `backend/cobros.js`, `module.exports`):
  - `aISO(instante: Date): string` (fecha `YYYY-MM-DD` en la zona de la aplicación)
  - `hoyISO(ahora?: Date): string`
  - `sumarDias(iso: string, n: number): string`
  - `tocaCobrarEn(sus, iso): boolean`, con `sus = { id, frecuencia, dia_cobro, fecha_alta, mes_cobro? }`
  - `ultimoCobroSinEnviar(sus, historial, hoy, diasAtras = 30): { fechaCobro: string, diasVencido: number } | null`
  - `planificarCobros(suscripciones, historial, hoy, { ventana = 7, confirmarReenvio = false }): { enviar: Array<{ sus, fechaCobro, diasVencido }>, yaEnviadosHoy: Array<sus>, perdidos: Array<{ sus, fechaCobro, diasVencido }> }`
  - `ventanaReintento(): number`

- [ ] **Step 1: Escribir las pruebas que fallan, `backend/cobros.test.js`**

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  aISO, hoyISO, sumarDias, tocaCobrarEn, ultimoCobroSinEnviar, planificarCobros, ventanaReintento,
} = require('./cobros');

const sus = (extra) => ({ id: 1, frecuencia: 'mensual', dia_cobro: 15, ...extra });
const enviado = (suscripcion_id, fecha) => ({ suscripcion_id, estado: 'Enviado', fecha });
const fallido = (suscripcion_id, fecha) => ({ suscripcion_id, estado: 'Fallido', fecha });

test('aISO usa la zona de Bogotá, no la del servidor ni UTC', () => {
  // 2026-10-20 02:00 UTC es 2026-10-19 21:00 en Bogotá
  assert.equal(aISO(new Date('2026-10-20T02:00:00Z')), '2026-10-19');
  assert.equal(hoyISO(new Date('2026-10-19T13:00:00Z')), '2026-10-19');
});

test('sumarDias cruza meses y años', () => {
  assert.equal(sumarDias('2026-03-01', -1), '2026-02-28');
  assert.equal(sumarDias('2026-01-01', -1), '2025-12-31');
  assert.equal(sumarDias('2026-10-19', 7), '2026-10-26');
});

test('mensual: usa el día de fecha_alta y se ajusta a meses cortos', () => {
  const s = sus({ fecha_alta: '2026-01-31' });
  assert.equal(tocaCobrarEn(s, '2026-03-31'), true);
  assert.equal(tocaCobrarEn(s, '2026-02-28'), true);  // febrero no tiene 31
  assert.equal(tocaCobrarEn(s, '2026-02-27'), false);
});

test('fecha_alta futura no cobra; el día de alta cobra siempre', () => {
  const s = sus({ fecha_alta: '2026-11-05', frecuencia: 'semanal' });
  assert.equal(tocaCobrarEn(s, '2026-11-04'), false);
  assert.equal(tocaCobrarEn(s, '2026-11-05'), true);
});

test('sin fecha_alta usa dia_cobro del plan', () => {
  const s = sus({ dia_cobro: 10 });
  assert.equal(tocaCobrarEn(s, '2026-10-10'), true);
  assert.equal(tocaCobrarEn(s, '2026-10-11'), false);
});

test('quincenal: día base y 15 días después, con ajuste de fin de mes', () => {
  const s = sus({ frecuencia: 'quincenal', fecha_alta: '2026-01-10' });
  assert.equal(tocaCobrarEn(s, '2026-04-10'), true);
  assert.equal(tocaCobrarEn(s, '2026-04-25'), true);
  assert.equal(tocaCobrarEn(s, '2026-04-11'), false);
  const feb = sus({ frecuencia: 'quincenal', fecha_alta: '2026-01-20' });
  assert.equal(tocaCobrarEn(feb, '2026-02-07'), true);  // 20+15=35 → 35-28
  assert.equal(tocaCobrarEn(feb, '2026-02-20'), true);
});

test('semanal: mismo día de la semana que fecha_alta', () => {
  const s = sus({ frecuencia: 'semanal', fecha_alta: '2026-10-05' }); // lunes
  assert.equal(tocaCobrarEn(s, '2026-10-12'), true);
  assert.equal(tocaCobrarEn(s, '2026-10-13'), false);
});

test('anual: mismo día y mes que fecha_alta', () => {
  const s = sus({ frecuencia: 'anual', fecha_alta: '2025-03-10' });
  assert.equal(tocaCobrarEn(s, '2026-03-10'), true);
  assert.equal(tocaCobrarEn(s, '2026-04-10'), false);
});

test('un cobro de hace 2 días sin envío está vencido por 2 días', () => {
  const s = sus({ fecha_alta: '2026-01-17' });
  assert.deepEqual(ultimoCobroSinEnviar(s, [], '2026-10-19'), { fechaCobro: '2026-10-17', diasVencido: 2 });
});

test('un envío exitoso posterior al día de cobro lo cubre', () => {
  const s = sus({ fecha_alta: '2026-01-17' });
  const h = [enviado(1, '2026-10-18T13:00:00Z')];
  assert.equal(ultimoCobroSinEnviar(s, h, '2026-10-19'), null);
});

test('un envío anterior al día de cobro no lo cubre', () => {
  const s = sus({ fecha_alta: '2026-01-17' });
  const h = [enviado(1, '2026-09-17T13:00:00Z')];
  assert.equal(ultimoCobroSinEnviar(s, h, '2026-10-19').fechaCobro, '2026-10-17');
});

test('un envío Fallido o de otra suscripción no cubre el cobro', () => {
  const s = sus({ fecha_alta: '2026-01-17' });
  const h = [fallido(1, '2026-10-17T13:00:00Z'), enviado(2, '2026-10-17T13:00:00Z')];
  assert.equal(ultimoCobroSinEnviar(s, h, '2026-10-19').diasVencido, 2);
});

test('planificar: hoy sin enviar y vencido reciente se envían; perdido solo se informa', () => {
  const hoy = '2026-10-19';
  const deHoy = sus({ id: 1, fecha_alta: '2026-01-19' });
  const vencido = sus({ id: 2, fecha_alta: '2026-01-15' });   // venció el 15, hace 4 días
  const perdido = sus({ id: 3, fecha_alta: '2026-01-05' });   // venció el 5, hace 14 días
  const plan = planificarCobros([deHoy, vencido, perdido], [], hoy);
  assert.deepEqual(plan.enviar.map((i) => [i.sus.id, i.diasVencido]), [[1, 0], [2, 4]]);
  assert.deepEqual(plan.perdidos.map((i) => [i.sus.id, i.diasVencido]), [[3, 14]]);
  assert.deepEqual(plan.yaEnviadosHoy, []);
});

test('planificar: lo ya enviado hoy se omite salvo confirmarReenvio', () => {
  const hoy = '2026-10-19';
  const s = sus({ id: 1, fecha_alta: '2026-01-19' });
  const h = [enviado(1, '2026-10-19T13:00:00Z')];
  const sin = planificarCobros([s], h, hoy);
  assert.equal(sin.enviar.length, 0);
  assert.equal(sin.yaEnviadosHoy.length, 1);
  const con = planificarCobros([s], h, hoy, { confirmarReenvio: true });
  assert.deepEqual(con.enviar.map((i) => i.sus.id), [1]);
});

test('planificar: tras un Fallido el cobro se reintenta; ventana 0 solo cobra hoy', () => {
  const s = sus({ id: 1, fecha_alta: '2026-01-18' });
  const h = [fallido(1, '2026-10-18T13:00:00Z')];
  assert.equal(planificarCobros([s], h, '2026-10-19').enviar[0].diasVencido, 1);
  assert.equal(planificarCobros([s], h, '2026-10-19', { ventana: 0 }).enviar.length, 0);
  assert.equal(planificarCobros([s], h, '2026-10-19', { ventana: 0 }).perdidos.length, 1);
});

test('ventanaReintento lee COBROS_REINTENTO_DIAS y cae a 7 si es inválida', () => {
  const previo = process.env.COBROS_REINTENTO_DIAS;
  try {
    delete process.env.COBROS_REINTENTO_DIAS;
    assert.equal(ventanaReintento(), 7);
    process.env.COBROS_REINTENTO_DIAS = '0';
    assert.equal(ventanaReintento(), 0);
    process.env.COBROS_REINTENTO_DIAS = '3';
    assert.equal(ventanaReintento(), 3);
    process.env.COBROS_REINTENTO_DIAS = 'abc';
    assert.equal(ventanaReintento(), 7);
    process.env.COBROS_REINTENTO_DIAS = '-2';
    assert.equal(ventanaReintento(), 7);
  } finally {
    if (previo === undefined) delete process.env.COBROS_REINTENTO_DIAS;
    else process.env.COBROS_REINTENTO_DIAS = previo;
  }
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run (desde `backend/`): `node --test cobros.test.js`
Expected: FAIL con `Cannot find module './cobros'`.

- [ ] **Step 3: Implementar `backend/cobros.js`**

```js
// cobros.js — Reglas de fechas de cobro (puras: sin base de datos ni reloj implícito).
// Todas las fechas son strings 'YYYY-MM-DD' en la zona horaria de la aplicación
// (America/Bogota por defecto), así el resultado no depende de la zona del servidor.

const ZONA = process.env.APP_TZ || 'America/Bogota';
const VENTANA_BUSQUEDA_DIAS = 30;
const VENTANA_REINTENTO_POR_DEFECTO = 7;

const formatoFecha = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
});

// Fecha 'YYYY-MM-DD' de un instante, en la zona de la aplicación
function aISO(instante) {
  return formatoFecha.format(instante);
}

function hoyISO(ahora = new Date()) {
  return aISO(ahora);
}

function partes(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return {
    y, m, d,
    diaSemana: new Date(Date.UTC(y, m - 1, d)).getUTCDay(),
    diasMes: new Date(Date.UTC(y, m, 0)).getUTCDate(),
  };
}

function sumarDias(iso, n) {
  const { y, m, d } = partes(iso);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// ¿Cae un cobro de esta suscripción en la fecha dada?
function tocaCobrarEn(sus, iso) {
  const alta = sus.fecha_alta ? String(sus.fecha_alta).slice(0, 10) : null;
  if (alta) {
    if (alta > iso) return false;   // aún no empezó
    if (alta === iso) return true;  // el día de alta se cobra sí o sí
  }

  const { d: diaActual, m: mes, diaSemana, diasMes } = partes(iso);
  const diaBaseReal = alta ? Number(alta.split('-')[2]) : (sus.dia_cobro || 1);
  const diaBase = Math.min(diaBaseReal, diasMes);

  switch ((sus.frecuencia || 'mensual').toLowerCase()) {
    case 'quincenal': {
      const segunda = diaBase + 15;
      const ajustada = segunda > diasMes ? segunda - diasMes : segunda;
      return diaActual === diaBase || diaActual === ajustada;
    }
    case 'semanal': {
      const objetivo = alta ? partes(alta).diaSemana : (sus.dia_cobro || 0) % 7;
      return diaSemana === objetivo;
    }
    case 'anual': {
      const mesObjetivo = alta ? Number(alta.split('-')[1]) : (sus.mes_cobro || 0) + 1;
      return diaActual === diaBase && mes === mesObjetivo;
    }
    default:
      return diaActual === diaBase;
  }
}

// Último día de cobro (hoy o hasta `diasAtras` atrás) sin ningún envío 'Enviado'
// en esa fecha o después. Devuelve { fechaCobro, diasVencido } o null.
function ultimoCobroSinEnviar(sus, historial, hoy, diasAtras = VENTANA_BUSQUEDA_DIAS) {
  const enviados = historial
    .filter((h) => h.suscripcion_id === sus.id && h.estado === 'Enviado' && h.fecha)
    .map((h) => aISO(new Date(h.fecha)));

  for (let atras = 0; atras <= diasAtras; atras++) {
    const iso = sumarDias(hoy, -atras);
    if (!tocaCobrarEn(sus, iso)) continue;
    const cubierto = enviados.some((f) => f >= iso);
    return cubierto ? null : { fechaCobro: iso, diasVencido: atras };
  }
  return null;
}

// Decide qué enviar hoy.
//  enviar:        cobros de hoy sin enviar + vencidos dentro de la ventana de reintento
//  yaEnviadosHoy: suscripciones que tocan hoy y ya tienen su envío
//  perdidos:      vencidos más allá de la ventana (solo se informan)
// ventana = 0 desactiva el reintento de vencidos.
function planificarCobros(suscripciones, historial, hoy, { ventana = VENTANA_REINTENTO_POR_DEFECTO, confirmarReenvio = false } = {}) {
  const enviar = [];
  const yaEnviadosHoy = [];
  const perdidos = [];

  for (const sus of suscripciones) {
    const pendiente = ultimoCobroSinEnviar(sus, historial, hoy);
    if (pendiente) {
      (pendiente.diasVencido <= ventana ? enviar : perdidos).push({ sus, ...pendiente });
    } else if (tocaCobrarEn(sus, hoy)) {
      if (confirmarReenvio) enviar.push({ sus, fechaCobro: hoy, diasVencido: 0 });
      else yaEnviadosHoy.push(sus);
    }
  }
  return { enviar, yaEnviadosHoy, perdidos };
}

// Días de reintento configurados (COBROS_REINTENTO_DIAS); 0 = solo cobros de hoy
function ventanaReintento() {
  const v = Number.parseInt(process.env.COBROS_REINTENTO_DIAS ?? '', 10);
  return Number.isNaN(v) || v < 0 ? VENTANA_REINTENTO_POR_DEFECTO : v;
}

module.exports = { aISO, hoyISO, sumarDias, tocaCobrarEn, ultimoCobroSinEnviar, planificarCobros, ventanaReintento };
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `node --test cobros.test.js`
Expected: `tests 16`, `pass 16`, `fail 0`.

- [ ] **Step 5: Agregar los scripts a `backend/package.json`**

En `"scripts"` (conservando `start`, `dev` y `test`), agregar:
```json
"test:unit": "node --test cobros.test.js",
"test:integration": "node tests_cobros_integration.js"
```
Run: `npm run test:unit`
Expected: 16 pass.

- [ ] **Step 6: Commit**

```bash
git add backend/cobros.js backend/cobros.test.js backend/package.json
git commit -m "feat(cobros): módulo puro de fechas de cobro con detección de vencidos

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: El scheduler usa el planificador (con prueba de integración)

**Files:**
- Modify: `backend/scheduler.js` (reemplazo completo del archivo)
- Create: `backend/tests_cobros_integration.js`

**Interfaces:**
- Consumes: `planificarCobros`, `hoyISO`, `ventanaReintento` de `./cobros`.
- Produces (de `scheduler.js`):
  - `previsualizarCobros(usuarioId: number, confirmarReenvio?: boolean)` devuelve lo mismo que `planificarCobros`.
  - `resumenCobros(usuarioId: number)` devuelve `{ hoy, ventanaDias, paraHoy, vencidos, perdidos }`, donde cada elemento es `{ suscripcion_id, cliente, plan, monto, fechaCobro, diasVencido }`.
  - `procesarCobrosDelDia(usuarioIdFijo?, confirmarReenvio?)` devuelve `{ success, enviados, vencidosEnviados, omitidos, perdidos }` (o `{ success: false, message }` si ya hay una ejecución).
  - Se mantienen exportados `iniciarScheduler`, `estaProcesandoCobros`, `procesarSeleccionados`.

- [ ] **Step 1: Escribir la prueba de integración que falla, `backend/tests_cobros_integration.js`**

```js
// Prueba de integración del scheduler: usa la base de desarrollo (backend/data/sgcrc.db)
// con un usuario temporal que se borra al terminar. El correo está simulado.
// NO ejecutar contra la base de producción.
require('dotenv').config();
const assert = require('assert');
const database = require('./database');
const db = require('./db');
const mailer = require('./mailer');
const cobros = require('./cobros');
const { procesarCobrosDelDia, resumenCobros } = require('./scheduler');

const hoy = cobros.hoyISO();
const hace = (n) => cobros.sumarDias(hoy, -n);
const nombres = (lista) => lista.map((i) => i.cliente).sort();

async function run() {
  const usuarioId = Number(
    database.prepare('INSERT INTO usuarios (email, password, nombre) VALUES (?, ?, ?)')
      .run(`cobros_${Date.now()}@test.local`, 'x', 'Prueba cobros').lastInsertRowid
  );

  const enviados = [];
  const enviarOriginal = mailer.enviarCobro;
  mailer.enviarCobro = async ({ cliente }) => { enviados.push(cliente.nombre); };

  try {
    const semanal = db.planes.create({ nombre_plan: 'Semanal prueba', monto: 50000, frecuencia: 'semanal', dia_cobro: 1 }, usuarioId);
    const anual = db.planes.create({ nombre_plan: 'Anual prueba', monto: 90000, frecuencia: 'anual', dia_cobro: 1 }, usuarioId);

    const suscribir = (nombre, plan, fechaAlta) => {
      const cliente = db.clientes.create({ nombre, correo: `${nombre}@test.local` }, usuarioId);
      return db.suscripciones.create({ cliente_id: cliente.id, plan_id: plan.id, fecha_alta: fechaAlta }, usuarioId);
    };
    const registrar = (sus, estado, diasAtras) => db.historial.create({
      suscripcion_id: sus.id, estado, detalles: 'prueba', monto: sus.monto,
      fecha: `${hace(diasAtras)}T15:00:00.000Z`,
    }, usuarioId);

    // Día de cobro anual: hace 10 días (se evita el 29 de febrero)
    const fechaPerdido = hace(10).endsWith('-02-29') ? hace(11) : hace(10);
    const [anio, mes, dia] = fechaPerdido.split('-');

    suscribir('vencido', semanal, hace(9));                    // cobro hace 2 días, sin envío
    registrar(suscribir('cubierto', semanal, hace(9)), 'Enviado', 1); // ya enviado después del cobro
    suscribir('perdido', anual, `${Number(anio) - 1}-${mes}-${dia}`);  // cobro hace 10 días
    suscribir('dehoy', semanal, hace(14));                     // cobro hoy
    registrar(suscribir('reintento', semanal, hace(8)), 'Fallido', 1); // cobro ayer, falló

    // 1. Resumen antes de enviar
    const antes = resumenCobros(usuarioId);
    assert.deepStrictEqual(nombres(antes.paraHoy), ['dehoy']);
    assert.deepStrictEqual(nombres(antes.vencidos), ['reintento', 'vencido']);
    assert.deepStrictEqual(nombres(antes.perdidos), ['perdido']);

    // 2. Primera ejecución: hoy + vencidos; el perdido no se envía
    const r1 = await procesarCobrosDelDia(usuarioId, false);
    assert.deepStrictEqual(enviados.slice().sort(), ['dehoy', 'reintento', 'vencido']);
    assert.strictEqual(r1.enviados, 3);
    assert.strictEqual(r1.vencidosEnviados, 2);
    assert.strictEqual(r1.perdidos, 1);
    const detalles = db.historial.all(usuarioId).filter((h) => h.estado === 'Enviado').map((h) => h.detalles);
    assert.ok(detalles.some((d) => d.includes(`vencido desde ${hace(2)}`)), 'el historial debe indicar el vencimiento');

    // 3. Segunda ejecución: no repite nada
    enviados.length = 0;
    const r2 = await procesarCobrosDelDia(usuarioId, false);
    assert.strictEqual(r2.enviados, 0);
    assert.strictEqual(r2.omitidos, 1);
    assert.deepStrictEqual(enviados, []);

    // 4. Con confirmarReenvio solo se reenvía lo que toca hoy
    const r3 = await procesarCobrosDelDia(usuarioId, true);
    assert.deepStrictEqual(enviados, ['dehoy']);
    assert.strictEqual(r3.enviados, 1);

    console.log('OK integración de cobros vencidos');
  } finally {
    mailer.enviarCobro = enviarOriginal;
    database.prepare('DELETE FROM usuarios WHERE id = ?').run(usuarioId); // borra todo en cascada
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run (desde `backend/`, con `backend/data/` creada): `npm run test:integration`
Expected: FAIL. `resumenCobros` no está exportado de `scheduler.js` (`TypeError: resumenCobros is not a function`).

- [ ] **Step 3: Reemplazar `backend/scheduler.js` completo**

```js
const cron = require("node-cron");
const db = require("./db");
const mailer = require("./mailer");
const database = require("./database"); 
const cobros = require("./cobros");
require("dotenv").config();

let procesandoCobros = false;

function estaProcesandoCobros() {
  return procesandoCobros;
}

// Clientes del usuario por id: evita resolver clientes de otro usuario
function clientesDe(usuarioId) {
  return new Map(db.clientes.all(usuarioId).map((c) => [c.id, c]));
}

/**
 * QUÉ SE ENVIARÍA AHORA PARA UN USUARIO
 * Cobros de hoy sin enviar + vencidos dentro de la ventana de reintento.
 * Ver cobros.planificarCobros para el detalle de cada lista.
 */
function previsualizarCobros(usuarioId, confirmarReenvio = false) {
  return cobros.planificarCobros(
    db.suscripciones.activas(usuarioId),
    db.historial.all(usuarioId),
    cobros.hoyISO(),
    { ventana: cobros.ventanaReintento(), confirmarReenvio }
  );
}

/**
 * RESUMEN PARA LA API: cobros de hoy, vencidos (se reintentan) y perdidos (solo informativos)
 */
function resumenCobros(usuarioId) {
  const plan = previsualizarCobros(usuarioId, false);
  const clientes = clientesDe(usuarioId);
  const detallar = ({ sus, fechaCobro, diasVencido }) => ({
    suscripcion_id: sus.id,
    cliente: clientes.get(sus.cliente_id)?.nombre || "Desconocido",
    plan: sus.tipo,
    monto: sus.monto,
    fechaCobro,
    diasVencido,
  });

  return {
    hoy: cobros.hoyISO(),
    ventanaDias: cobros.ventanaReintento(),
    paraHoy: plan.enviar.filter((i) => i.diasVencido === 0).map(detallar),
    vencidos: plan.enviar.filter((i) => i.diasVencido > 0).map(detallar),
    perdidos: plan.perdidos.map(detallar),
  };
}

// --- PROCESAR SELECCIÓN INDIVIDUAL (Se mantiene igual) ---
async function procesarSeleccionados(usuarioId, listaIds) {
  if (procesandoCobros) return { success: false, message: "Ejecución en curso" };
  
  procesandoCobros = true;
  let totalEnviados = 0;

  try {
    const usuario = database.prepare('SELECT * FROM usuarios WHERE id = ?').get(usuarioId);
    if (!usuario) throw new Error("Usuario no encontrado");

    for (const susId of listaIds) {
      const sus = db.suscripciones.find(susId); 
      const cliente = db.clientes.find(sus.cliente_id);

      if (!sus || !cliente) continue;

      try {
        await mailer.enviarCobro({ cliente, suscripcion: sus, usuarioConfig: usuario });
        
        db.historial.create({
          suscripcion_id: sus.id,
          fecha: new Date().toISOString(), 
          estado: "Enviado",
          detalles: `Reenvío manual: Plan ${sus.tipo} ($${sus.monto}).`,
          monto: sus.monto
        }, usuario.id);

        totalEnviados++;
      } catch (err) {
        console.error(`❌ Error individual → ${cliente.nombre}: ${err.message}`);
      }
    }
    return { success: true, enviados: totalEnviados };
  } finally {
    procesandoCobros = false;
  }
}

// --- FUNCIÓN PRINCIPAL: cobros de hoy + vencidos ---
async function procesarCobrosDelDia(usuarioIdFijo = null, confirmarReenvio = false) {
  if (procesandoCobros) return { success: false, message: "Ejecución en curso" };

  procesandoCobros = true;
  const resumen = { success: true, enviados: 0, vencidosEnviados: 0, omitidos: 0, perdidos: 0 };

  try {
    const usuarios = usuarioIdFijo 
      ? [database.prepare('SELECT * FROM usuarios WHERE id = ?').get(usuarioIdFijo)]
      : database.prepare('SELECT * FROM usuarios').all();

    for (const usuario of usuarios) {
      if (!usuario) continue;

      const plan = previsualizarCobros(usuario.id, confirmarReenvio);
      const clientes = clientesDe(usuario.id);
      resumen.omitidos += plan.yaEnviadosHoy.length;
      resumen.perdidos += plan.perdidos.length;

      for (const { sus, fechaCobro, diasVencido } of plan.enviar) {
        const cliente = clientes.get(sus.cliente_id);
        if (!cliente) continue;

        const sufijo = diasVencido > 0 ? ` (vencido desde ${fechaCobro})` : "";

        try {
          await mailer.enviarCobro({ cliente, suscripcion: sus, usuarioConfig: usuario });

          db.historial.create({
            suscripcion_id: sus.id,
            fecha: new Date().toISOString(), 
            estado: "Enviado",
            detalles: `Cobro ${sus.tipo} enviado${sufijo}.`,
            monto: sus.monto 
          }, usuario.id);

          resumen.enviados++;
          if (diasVencido > 0) resumen.vencidosEnviados++;
        } catch (err) {
          db.historial.create({
            suscripcion_id: sus.id,
            fecha: new Date().toISOString(),
            estado: "Fallido",
            detalles: `Error${sufijo}: ${err.message}`,
            monto: sus.monto 
          }, usuario.id);
        }
      }
    }
    return resumen;
  } finally {
    procesandoCobros = false;
  }
}

function iniciarScheduler() {
  const min = process.env.CRON_MIN || "00";
  const hora = process.env.CRON_HORA || "08";
  const expr = `${min} ${hora} * * *`;

  console.log(`[Scheduler] Programado para las ${hora}:${min} (reintento de vencidos: ${cobros.ventanaReintento()} días)`);

  cron.schedule(expr, async () => {
    try {
      await procesarCobrosDelDia(null, false);
    } catch (error) {
      console.error("ERROR en cron:", error.message);
    }
  }, { timezone: "America/Bogota" });
}

module.exports = { 
  iniciarScheduler, 
  procesarCobrosDelDia, 
  estaProcesandoCobros,
  procesarSeleccionados,
  previsualizarCobros,
  resumenCobros
};
```

- [ ] **Step 4: Ejecutar la integración y las pruebas unitarias**

Run: `npm run test:integration`
Expected: imprime `OK integración de cobros vencidos` y termina con código 0. Luego `npm run test:unit` da 16 pass.

- [ ] **Step 5: Verificar que el usuario temporal se borró**

Run: `node -e "const d=require('./database');console.log(d.prepare(\"SELECT COUNT(*) n FROM usuarios WHERE email LIKE 'cobros_%@test.local'\").get())"`
Expected: `{ n: 0 }`.

- [ ] **Step 6: Commit**

```bash
git add backend/scheduler.js backend/tests_cobros_integration.js
git commit -m "feat(cobros): el scheduler reintenta cobros vencidos hasta 7 días

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: API: `GET /cobros/resumen` y ajuste de `POST /run`

**Files:**
- Modify: `backend/api.js:5` (import), `backend/api.js:194-221` (bloque "7. PROCESOS DE COBRO")
- Modify: `backend/tests_api_smoke.js` (nuevo caso antes de `console.log('OK backend smoke test')`)

**Interfaces:**
- Consumes: `previsualizarCobros`, `resumenCobros`, `procesarCobrosDelDia`, `estaProcesandoCobros` de `./scheduler`.
- Produces: `GET /cobros/resumen` → 200 `{ hoy, ventanaDias, paraHoy, vencidos, perdidos }`; `POST /run` → 200 `{ message, enviados, vencidosEnviados, omitidos }` o 409 `{ requiereConfirmacion, mensaje, yaEnviadosIds }`.

- [ ] **Step 1: Escribir el caso de smoke que falla**

En `backend/tests_api_smoke.js`, justo antes de `console.log('OK backend smoke test');`, agregar:

```js
    // 8. /cobros/resumen exige JWT y devuelve las tres listas
    const resumenSinToken = await json(port, 'GET', '/cobros/resumen');
    assert.strictEqual(resumenSinToken.status, 401, '/cobros/resumen sin JWT debe devolver 401');
    const resumen = await json(port, 'GET', '/cobros/resumen', undefined, token);
    assert.strictEqual(resumen.status, 200, 'GET /cobros/resumen con JWT debe devolver 200');
    const datosResumen = JSON.parse(resumen.body);
    assert.ok(Array.isArray(datosResumen.paraHoy), 'resumen.paraHoy debe ser un arreglo');
    assert.ok(Array.isArray(datosResumen.vencidos), 'resumen.vencidos debe ser un arreglo');
    assert.ok(Array.isArray(datosResumen.perdidos), 'resumen.perdidos debe ser un arreglo');
    assert.strictEqual(datosResumen.vencidos.length, 0, 'un usuario nuevo no tiene vencidos');
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run (desde `backend/`): `npm test`
Expected: FAIL en `GET /cobros/resumen con JWT debe devolver 200` (hoy responde 404).

- [ ] **Step 3: Actualizar el import en `backend/api.js` línea 5**

Reemplazar
```js
const { procesarCobrosDelDia, estaProcesandoCobros, procesarSeleccionados } = require("./scheduler");
```
por
```js
const { procesarCobrosDelDia, estaProcesandoCobros, procesarSeleccionados, previsualizarCobros, resumenCobros } = require("./scheduler");
```

- [ ] **Step 4: Reemplazar el handler de `/run` y añadir `/cobros/resumen`**

En el bloque `// ── 7. PROCESOS DE COBRO ──`, reemplazar el handler `if (pathname === "/run" && method === "POST") { ... }` completo por:

```js
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
```
Dejar intacto el handler de `/run-individual` que está justo antes.

- [ ] **Step 5: Ejecutar el smoke test**

Run: `npm test`
Expected: imprime `OK backend smoke test` (exit 0). Luego `npm run test:unit` (16 pass) y `npm run test:integration` (`OK integración de cobros vencidos`).

- [ ] **Step 6: Commit**

```bash
git add backend/api.js backend/tests_api_smoke.js
git commit -m "feat(api): GET /cobros/resumen e inclusión de vencidos en POST /run

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Documentación y variables de entorno

**Files:**
- Modify: `backend/.env.example`, `backend/CLAUDE.md`, `CLAUDE.md` (raíz)

- [ ] **Step 1: Variables en `backend/.env.example`**

Agregar al final del archivo:
```env
# Reintento de cobros vencidos: días hacia atrás que se reintentan (0 = solo cobros de hoy).
# Primer despliegue: usar 0 y mantenerlo al menos 7 días (con 0 solo se cobra lo de hoy y los cobros
# previos al despliegue salen de la ventana solos). Si se activa antes, revisar `perdidos` con
# diasVencido <= 7 en GET /cobros/resumen de cada usuario: esos saldrán al activar.
COBROS_REINTENTO_DIAS=7
# Zona horaria para calcular el día de cobro
APP_TZ=America/Bogota
```

- [ ] **Step 2: Actualizar `backend/CLAUDE.md`**

En la tabla de módulos, agregar la fila:
`| \`cobros.js\` | Reglas puras de fechas de cobro: \`tocaCobrarEn\`, detección de vencidos y \`planificarCobros\` (tests: \`npm run test:unit\`) |`

Reemplazar la sección "## Notas del scheduler" por:
```markdown
## Notas del scheduler

- Hora por defecto: 08:00 America/Bogota. Configurable con `CRON_HORA` y `CRON_MIN` en `.env`.
- La decisión de qué enviar vive en `cobros.js` (`planificarCobros`), no en `scheduler.js`. `tocaCobrarEn(sus, fecha)` prioriza `fecha_alta` sobre `dia_cobro` del plan.
- **Cobros vencidos:** el cron envía los cobros de hoy y reintenta los vencidos (día de cobro pasado sin envío `Enviado` en esa fecha o después) durante `COBROS_REINTENTO_DIAS` días (7 por defecto; 0 = solo hoy). Más allá de la ventana el cobro es "perdido": no se envía, solo aparece en `GET /cobros/resumen`.
- Idempotencia en `/run` (endpoint manual): responde 409 solo cuando no hay nada nuevo que enviar y sí hay cobros de hoy ya enviados; entonces requiere `{ confirmarReenvio: true }`.
- El mutex `procesandoCobros` es en memoria: no protege contra múltiples procesos Node.js.
- Pruebas: `npm run test:unit` (lógica de fechas), `npm run test:integration` (scheduler con usuario temporal en la base de desarrollo y correo simulado), `npm test` (smoke de la API). Ninguna debe ejecutarse contra producción.
```

- [ ] **Step 3: Actualizar `CLAUDE.md` de la raíz**

En la sección "### Scheduler de cobros", reemplazar su texto por:
```markdown
`backend/scheduler.js` ejecuta `procesarCobrosDelDia()` diariamente a la hora configurada. Las reglas de fechas están en `backend/cobros.js`: `tocaCobrarEn()` decide por frecuencia (`mensual`, `quincenal`, `semanal`, `anual`) usando `fecha_alta` como fecha base cuando está disponible, y `planificarCobros()` incluye los cobros vencidos (reintento hasta `COBROS_REINTENTO_DIAS`, 7 por defecto). Hay un mutex booleano `procesandoCobros` para evitar concurrencia.
```

- [ ] **Step 4: Verificar y commit**

Run: `grep -rn "tocaCobrarHoy" backend CLAUDE.md` 
Expected: sin resultados.
```bash
git add backend/.env.example backend/CLAUDE.md CLAUDE.md
git commit -m "docs: cobros vencidos, variables de entorno y pruebas del backend

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Criterio de cierre

- `npm run test:unit` (16 pass), `npm run test:integration` y `npm test` en verde desde `backend/`.
- `scheduler.js` ya no contiene `tocaCobrarHoy` ni usa `toISOString()` para el día de cobro.
- `GET /cobros/resumen` exige JWT y filtra por `usuario.id`.
- Ningún usuario temporal queda en la base tras las pruebas.

## Despliegue seguro (para quien despliega)

1. Subir con `COBROS_REINTENTO_DIAS=0` en el `.env` del servidor y reiniciar con `pm2 restart sgcrc-backend`. Mantenerlo al menos 7 días: con 0 solo se cobra lo de hoy (como antes) y los cobros previos al despliegue salen de la ventana solos.
2. Si se quiere activar antes, revisar en `GET /cobros/resumen` de cada usuario la lista `perdidos` con `diasVencido <= 7`: esos saldrán al activar.
3. Pasados los 7 días, quitar la variable (o ponerla en `7`) y reiniciar.
