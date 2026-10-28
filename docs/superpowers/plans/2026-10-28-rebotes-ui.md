# Aviso de rebotes de correo — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el panel muestre qué clientes con suscripciones activas dejaron de recibir cobros por correo rebotado, y corregir el mensaje de `POST /run` que los cuenta como enviados.

**Architecture:** Un helper puro en el frontend (`src/lib/rebotes.js`) deriva el conjunto afectado de los datos que Dashboard y Clientes ya cargan; dos puntos de UI lo consumen (sección en el Dashboard y badge en la tabla de Clientes). En el backend se separan los dos motivos de omisión que hoy comparten contador, y el texto de respuesta se mueve a una función pura en `cobros.js`.

**Tech Stack:** React 18 + Vite (frontend), Node.js `http` + SQLite (backend), `node:test` en ambos.

**Spec:** `docs/superpowers/specs/2026-10-28-rebotes-ui-design.md`

## Global Constraints

- UI, comentarios, mensajes y commits en español. Commits con prefijo convencional (`feat(frontend): ...`, `fix: ...`).
- Sin dependencias nuevas. Sin Tailwind. Sin endpoint nuevo. Sin migración ni cambio de esquema.
- Multi-tenant intacto: todo es lectura del lado del cliente sobre datos que ya vienen filtrados por `usuario_id`.
- Estilos: solo tokens y clases existentes (`--warn`, `--warn-bg`, `--ink-2`, `--line`, `panel`, `panel-titulo`, `pagina-desc`, `libro*`, `badge`, `celda-nota`). El único bloque CSS nuevo permitido es `.seccion-cab` en `src/styles/ui.css`.
- Nunca aplicar color de marca fuera de `aplicarColorTema()`; nada de colores hardcodeados.
- No ejecutar `POST /run` ni pulsar "Enviar"/"Reenviar" en el Dashboard durante la verificación: envía correos reales.
- No hacer `git push`: lo hace el usuario.
- Verificación obligatoria: `npm test` + `npm run build` en `sgcrc-frontend-export`; `npm run test:unit` en `backend`.
- La comparación de rebote es `correo_rebotado === correo` con la columna no vacía, idéntica a `backend/scheduler.js:76` y `:131`. No normalizar mayúsculas ni espacios.

## Review Focus

1. Un cliente cuyo correo ya se corrigió conserva el valor viejo en `correo_rebotado`; debe dejar de aparecer como bloqueado.
2. La comparación del frontend debe coincidir carácter a carácter con la del scheduler: si difieren, la UI dice "bloqueado" mientras el cron sí envía (o al revés).
3. Un cliente con el correo rebotado pero sin suscripciones activas no debe entrar: no hay nada que reanudar.
4. `monto` puede venir `null` desde SQLite; la suma no debe pintar `NaN`.
5. Con cero rebotes la sección no se renderiza, y el botón "Corregir correos" nunca navega con un handler indefinido.

---

### Task 1: Helper `clientesEnRebote`

**Files:**
- Create: `sgcrc-frontend-export/src/lib/rebotes.js`
- Test: `sgcrc-frontend-export/src/lib/rebotes.test.js`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `esReboteActivo(cliente) -> boolean`
  - `clientesEnRebote(clientes, suscripciones) -> Array<{ id, nombre, correo, suscripciones, monto }>`, ordenado por `monto` descendente y luego `nombre` ascendente.

- [ ] **Step 1: Write the failing test**

`sgcrc-frontend-export/src/lib/rebotes.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { esReboteActivo, clientesEnRebote } from './rebotes.js'

const cliente = (id, nombre, correo, correo_rebotado = null) => ({ id, nombre, correo, correo_rebotado })
const sub = (id, cliente_id, monto, activa = 1) => ({ id, cliente_id, monto, activa })

test('esReboteActivo: solo cuando la columna coincide con el correo actual', () => {
  assert.equal(esReboteActivo(cliente(1, 'Ana', 'ana@x.com', 'ana@x.com')), true)
  assert.equal(esReboteActivo(cliente(1, 'Ana', 'nueva@x.com', 'ana@x.com')), false)
  assert.equal(esReboteActivo(cliente(1, 'Ana', 'ana@x.com', null)), false)
  assert.equal(esReboteActivo(cliente(1, 'Ana', 'ana@x.com', '')), false)
})

test('esReboteActivo compara igual que el scheduler: distingue mayúsculas', () => {
  assert.equal(esReboteActivo(cliente(1, 'Ana', 'Ana@X.com', 'ana@x.com')), false)
})

test('clientesEnRebote devuelve solo clientes con rebote y suscripción activa', () => {
  const clientes = [
    cliente(1, 'Ana', 'ana@x.com', 'ana@x.com'),
    cliente(2, 'Beto', 'beto@x.com', 'viejo@x.com'),
    cliente(3, 'Caro', 'caro@x.com', 'caro@x.com'),
  ]
  const subs = [sub(10, 1, 50000), sub(11, 3, 30000, 0)]
  assert.deepEqual(clientesEnRebote(clientes, subs), [
    { id: 1, nombre: 'Ana', correo: 'ana@x.com', suscripciones: 1, monto: 50000 },
  ])
})

test('clientesEnRebote suma varias suscripciones activas y ordena por monto', () => {
  const clientes = [
    cliente(1, 'Ana', 'ana@x.com', 'ana@x.com'),
    cliente(2, 'Beto', 'beto@x.com', 'beto@x.com'),
  ]
  const subs = [sub(10, 1, 20000), sub(11, 1, 15000), sub(12, 2, 90000), sub(13, 2, 5000, 0)]
  const r = clientesEnRebote(clientes, subs)
  assert.deepEqual(r.map((x) => [x.id, x.suscripciones, x.monto]), [[2, 1, 90000], [1, 2, 35000]])
})

test('clientesEnRebote no produce NaN con montos nulos', () => {
  const r = clientesEnRebote([cliente(1, 'Ana', 'ana@x.com', 'ana@x.com')], [sub(10, 1, null), sub(11, 1, 10000)])
  assert.equal(r[0].monto, 10000)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd sgcrc-frontend-export && npm test`
Expected: FAIL — `Cannot find module .../rebotes.js`.

- [ ] **Step 3: Implement `sgcrc-frontend-export/src/lib/rebotes.js`**

Encabezado en español explicando que replica la comparación de `scheduler.js`. Acumular por `cliente_id` solo las suscripciones con `activa` verdadera (`{ suscripciones, monto }`, con `Number(s.monto) || 0`), filtrar los clientes que tienen acumulado y rebote activo, y ordenar con `b.monto - a.monto || a.nombre.localeCompare(b.nombre, 'es') || a.id - b.id`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd sgcrc-frontend-export && npm test`
Expected: PASS, los 5 tests nuevos y los existentes.

- [ ] **Step 5: Commit**

```bash
git add sgcrc-frontend-export/src/lib/rebotes.js sgcrc-frontend-export/src/lib/rebotes.test.js
git commit -m "feat(frontend): helper de clientes con correo rebotado"
```

---

### Task 2: Sección "Clientes que no reciben cobros" en el Dashboard

**Files:**
- Modify: `sgcrc-frontend-export/src/views/Dashboard.jsx`
- Modify: `sgcrc-frontend-export/src/App.jsx:124`
- Modify: `sgcrc-frontend-export/src/styles/ui.css` (tras `.panel-titulo`, línea 143)

**Interfaces:**
- Consumes: `clientesEnRebote(clientes, suscripciones)` de Task 1.
- Produces: `<Dashboard onNavegar={(id) => void} />`; `onNavegar` recibe el id de vista `'clientes'`.

- [ ] **Step 1: Pasar la navegación desde `App.jsx`**

En `App.jsx:124`, cambiar `dashboard: <Dashboard />,` por `dashboard: <Dashboard onNavegar={setView} />,`.

- [ ] **Step 2: Calcular el conjunto en `Dashboard.jsx`**

- Importar `clientesEnRebote` desde `../lib/rebotes.js`.
- Cambiar la firma a `export default function Dashboard({ onNavegar })`.
- Dentro del `useMemo` de `stats`, añadir `rebotes: clientesEnRebote(clientes, suscripciones),` (usa las variables ya desestructuradas de `data`).

- [ ] **Step 3: Renderizar la sección**

Insertar justo después de la sección `<section aria-labelledby="dash-hoy">` y antes de `<section aria-labelledby="dash-resumen">`. Solo se renderiza si `stats.rebotes.length > 0`:

```jsx
{stats.rebotes.length > 0 && (
  <section aria-labelledby="dash-rebotes" className="panel">
    <div className="seccion-cab">
      <div>
        <h2 id="dash-rebotes" className="panel-titulo">Clientes que no reciben cobros</h2>
        <p className="pagina-desc">
          {`${nSubsRebote === 1 ? '1 suscripción activa no está enviando' : `${nSubsRebote} suscripciones activas no están enviando`} recordatorios porque el correo rebotó (${fmt(totalRebote)} en total). Se reanudan al corregir la dirección.`}
        </p>
      </div>
      <Button variante="secundario" icono="pencil-simple" onClick={() => onNavegar('clientes')}>
        Corregir correos
      </Button>
    </div>
    <ul className="libro">
      {stats.rebotes.map((r) => (
        <li key={r.id} className="libro-fila">
          <div className="libro-fecha"><span className="libro-cliente">{r.nombre}</span></div>
          <div>
            <p className="libro-detalle">{r.correo}</p>
            <p className="libro-detalle">
              {r.suscripciones === 1 ? '1 suscripción activa' : `${r.suscripciones} suscripciones activas`}
            </p>
          </div>
          <p className="libro-monto">{fmt(r.monto)}</p>
        </li>
      ))}
    </ul>
  </section>
)}
```

Antes del `return`, junto a `hayPendientes`/`puedeReenviar`, definir:

```jsx
const nSubsRebote = stats.rebotes.reduce((a, r) => a + r.suscripciones, 0)
const totalRebote = suma(stats.rebotes)
```

- [ ] **Step 4: Añadir el bloque CSS de la cabecera**

En `src/styles/ui.css`, justo después de `.panel-titulo` (línea 143):

```css
.seccion-cab { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 0.75rem; }
.seccion-cab .panel-titulo { margin-bottom: 0.25rem; }
```

- [ ] **Step 5: Verificar build y revisión visual**

Run: `cd sgcrc-frontend-export && npm run build`
Expected: build sin errores.

Con `npm run dev`, en escritorio y a 360 px de ancho:
- Con al menos un cliente rebotado: la sección aparece entre "Hoy" y "Tu negocio", el botón lleva a Clientes y el foco termina en el `h1` de esa vista.
- Sin clientes rebotados: la sección no existe.
- En móvil el nombre ocupa su propia línea y el monto queda a la derecha, como en "Próximos cobros".

- [ ] **Step 6: Commit**

```bash
git add sgcrc-frontend-export/src/views/Dashboard.jsx sgcrc-frontend-export/src/App.jsx sgcrc-frontend-export/src/styles/ui.css
git commit -m "feat(frontend): aviso de clientes que no reciben cobros en el Dashboard"
```

---

### Task 3: Marca de correo rebotado en la tabla de Clientes

**Files:**
- Modify: `sgcrc-frontend-export/src/views/Clientes.jsx:182`

**Interfaces:**
- Consumes: `esReboteActivo(cliente)` de Task 1; `Badge` de `../ui/Badge.jsx`.
- Produces: nada para otras tareas.

- [ ] **Step 1: Añadir imports y el componente de celda**

En `Clientes.jsx`, importar `Badge` desde `../ui/Badge.jsx` y `esReboteActivo` desde `../lib/rebotes.js`. Antes del `export default`, definir:

```jsx
function CeldaCorreo({ cliente }) {
  if (!esReboteActivo(cliente)) return cliente.correo
  return (
    <>
      {cliente.correo}
      <span className="celda-nota">
        <Badge tono="warn" icono="warning-circle">Correo rebotado</Badge>
      </span>
      <span className="celda-nota">No recibe cobros hasta que corrijas la dirección.</span>
    </>
  )
}
```

- [ ] **Step 2: Usarlo en la celda**

Sustituir `<td role="cell" data-label="Correo">{c.correo}</td>` por:

```jsx
<td role="cell" data-label="Correo"><CeldaCorreo cliente={c} /></td>
```

- [ ] **Step 3: Verificar build y revisión visual**

Run: `cd sgcrc-frontend-export && npm run build`
Expected: build sin errores.

Con `npm run dev`, en escritorio y a 360 px: la fila rebotada muestra el correo, debajo el badge "Correo rebotado" con icono y debajo la nota; el resto de filas no cambia. Al editar el correo y guardar, el badge desaparece de esa fila.

- [ ] **Step 4: Commit**

```bash
git add sgcrc-frontend-export/src/views/Clientes.jsx
git commit -m "feat(frontend): marca de correo rebotado en la tabla de clientes"
```

---

### Task 4: Separar los omitidos por rebote del mensaje de `POST /run`

**Files:**
- Modify: `backend/scheduler.js:109,133`
- Modify: `backend/cobros.js` (nueva función + export en línea 126)
- Modify: `backend/api.js:5-8,279-287`
- Modify: `backend/cobros.test.js`
- Modify: `backend/tests_cobros_integration.js:71`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `mensajeProceso({ enviados, vencidosEnviados, omitidos, omitidosRebote }) -> string` en `backend/cobros.js`.
  - `procesarCobrosDelDia()` devuelve además `omitidosRebote: number`.

- [ ] **Step 1: Write the failing test**

Añadir a `backend/cobros.test.js` (e importar `mensajeProceso` en el `require` de la línea 3-5):

```js
test('mensajeProceso: solo enviados', () => {
  assert.equal(mensajeProceso({ enviados: 3 }), 'Proceso completado: 3 enviados');
});

test('mensajeProceso: vencidos y ya enviados', () => {
  assert.equal(
    mensajeProceso({ enviados: 2, vencidosEnviados: 1, omitidos: 4 }),
    'Proceso completado: 2 enviados (1 vencidos). 4 ya enviados hoy se omitieron'
  );
});

test('mensajeProceso: los omitidos por rebote no se presentan como enviados', () => {
  const m = mensajeProceso({ enviados: 0, omitidosRebote: 2 });
  assert.equal(m, 'Proceso completado: 0 enviados. 2 con correo rebotado no se enviaron');
  assert.ok(!m.includes('ya enviados'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm run test:unit`
Expected: FAIL — `mensajeProceso is not a function`.

- [ ] **Step 3: Implementar `mensajeProceso` en `backend/cobros.js`**

Añadir antes del `module.exports`, con un comentario en español que explique que distingue los dos motivos de omisión, y exportarla:

```js
function mensajeProceso({ enviados = 0, vencidosEnviados = 0, omitidos = 0, omitidosRebote = 0 } = {}) {
  let message = `Proceso completado: ${enviados} enviados`;
  if (vencidosEnviados > 0) message += ` (${vencidosEnviados} vencidos)`;
  if (omitidos > 0) message += `. ${omitidos} ya enviados hoy se omitieron`;
  if (omitidosRebote > 0) message += `. ${omitidosRebote} con correo rebotado no se enviaron`;
  return message;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm run test:unit`
Expected: PASS.

- [ ] **Step 5: Separar el contador en el scheduler**

- `scheduler.js:109`: añadir `omitidosRebote: 0` al objeto `resumen`.
- `scheduler.js:133`: cambiar `resumen.omitidos++;` por `resumen.omitidosRebote++;`.

`resumen.omitidos` queda solo con los ya enviados hoy (`:122`), que es lo que ya asume `tests_cobros_integration.js:71`.

- [ ] **Step 6: Usar la función en la API**

- En `api.js`, añadir `const { mensajeProceso } = require("./cobros");` junto a los requires de la cabecera (después de la línea 6).
- Sustituir las líneas 279-281 (`let message = ...` y los dos `if`) por `const message = mensajeProceso(resultado);`.
- Añadir `omitidosRebote: resultado.omitidosRebote` al objeto de respuesta de las líneas 282-287.

- [ ] **Step 7: Cubrir el contador nuevo en la integración**

En `tests_cobros_integration.js`, tras `assert.strictEqual(r2.omitidos, 1);` (línea 71), añadir:

```js
assert.strictEqual(r2.omitidosRebote, 0);
```

- [ ] **Step 8: Run integration test**

Run: `cd backend && npm run test:integration`
Expected: PASS. Escribe usuarios temporales en `backend/data/sgcrc.db` (base local, no producción) y usa el mailer simulado: no envía correos reales.

- [ ] **Step 9: Commit**

```bash
git add backend/scheduler.js backend/cobros.js backend/api.js backend/cobros.test.js backend/tests_cobros_integration.js
git commit -m "fix: distinguir los cobros omitidos por rebote de los ya enviados"
```

---

## Verificación final

- [ ] `cd sgcrc-frontend-export && npm test`
- [ ] `cd sgcrc-frontend-export && npm run build`
- [ ] `cd backend && npm run test:unit`
- [ ] `cd backend && npm run test:integration`
- [ ] Revisión visual a 360 px y escritorio, con y sin rebotes.
- [ ] `npx impeccable detect` sobre los archivos de UI cambiados (una sola pasada al terminar).
