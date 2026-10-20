# Rediseño visual, Fase 2: Componentes base. Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear los componentes base accesibles del frontend (`Button`, `Badge`, `Field`, `Dialog`, `ConfirmDialog`, `Toast`, `EmptyState`, `Skeleton`, `ErrorMsg`), retirar `components.jsx` y reemplazar los `alert/confirm` del Dashboard ("Forzar cobros").

**Architecture:** Estilos en CSS real (`src/styles/ui.css`) que consume solo los tokens de `tokens.css`; los componentes son funciones React finas que ponen clases. La lógica con comportamiento propio (almacén de notificaciones y trampa de foco) vive en módulos puros de `src/lib/` con pruebas `node:test`. Las notificaciones usan un almacén singleton (`toast.exito(...)`) leído con `useSyncExternalStore`, así se pueden lanzar desde cualquier lugar sin Provider. Las vistas Clientes, Planes, Suscripciones, Login y Configuración NO se migran aquí (Fase 3); solo Historial, Calendario y Dashboard, que ya usan `components.jsx` o `alert/confirm` del botón "Forzar cobros".

**Tech Stack:** React 18, Vite 7, CSS propio con tokens (`src/styles/`), Tailwind CDN solo en vistas aún no migradas, `node:test`.

Spec: `docs/superpowers/specs/2026-10-19-rediseno-visual-frontend-design.md` (sección "Componentes base").

## Global Constraints

- Rama de trabajo: `develop`. Un commit por tarea, con el trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Todo el trabajo es dentro de `sgcrc-frontend-export/`, salvo este plan y `CLAUDE.md` del frontend.
- Tailwind sigue por CDN. No crear `tailwind.config.js` ni PostCSS. Los componentes nuevos NO usan clases de Tailwind: usan las clases de `ui.css`.
- Usar `fetch`, no `axios`. Sin emojis ni símbolos decorativos: solo `<Icon>`.
- Los componentes usan variables CSS (`var(--...)`), nunca hex ni colores de Tailwind. Texto sobre fondo de marca: `var(--color-primario-contraste)`.
- Texto mínimo 12 px; contraste mínimo 4.5:1; objetivo táctil mínimo 44 px (botón por defecto) y 36 px (botón `sm`, solo en filas densas de escritorio).
- Foco visible: ya lo da `base.css` (`:focus-visible`), no anularlo.
- Sin sombras salvo `Dialog` y `Toast` (superficies flotantes). Radios 6-8 px, líneas de 1 px. Movimiento 120-180 ms; respetar `prefers-reduced-motion` (ya global en `base.css`).
- Textos de interfaz en español con tildes correctas.
- Iconos disponibles en `icons.generated.js`: `squares-four users tag arrows-clockwise clock-counter-clockwise calendar-blank gear warning-circle warning check-circle check x x-circle arrow-clockwise caret-left caret-right caret-down paper-plane-tilt envelope-simple coins bell sign-out magnifying-glass plus pencil-simple trash eye eye-slash list`. Si falta uno, agregarlo en `scripts/gen-icons.mjs` y correr `npm run icons`.
- Verificación de cada tarea: `npm test` y `npm run build` (desde `sgcrc-frontend-export/`) sin errores.

## Estructura de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/lib/formato.js` | Crear | `fmt` (moneda COP), movido desde `components.jsx` |
| `src/lib/toastStore.js` | Crear | Almacén puro de notificaciones (mostrar, cerrar, auto-cierre, límite) |
| `src/lib/toastStore.test.js` | Crear | Pruebas del almacén |
| `src/lib/focoDialog.js` | Crear | `siguienteFoco`: lógica pura de la trampa de foco |
| `src/lib/focoDialog.test.js` | Crear | Pruebas de la trampa de foco |
| `src/styles/ui.css` | Crear | Clases de todos los componentes base |
| `src/ui/Button.jsx` | Crear | Botón primario / secundario / peligro, con estado de carga |
| `src/ui/Badge.jsx` | Crear | `Badge` genérico y `EstadoBadge` (mapa de estados de cobro) |
| `src/ui/Skeleton.jsx` | Crear | Marcador de carga accesible |
| `src/ui/EmptyState.jsx` | Crear | Estado vacío con icono, texto y acción |
| `src/ui/ErrorMsg.jsx` | Crear | Aviso de error en línea con "Reintentar" |
| `src/ui/Field.jsx` | Crear | Campo con label, ayuda y error |
| `src/ui/Dialog.jsx` | Crear | Diálogo modal accesible |
| `src/ui/ConfirmDialog.jsx` | Crear | Diálogo de confirmación (reemplaza `confirm`) |
| `src/ui/Toast.jsx` | Crear | `toast` (API) y `ToastRegion` (render) |
| `package.json` | Modificar | Script `test` ejecuta todas las pruebas de `src/lib/` |
| `src/main.jsx` | Modificar | Importa `ui.css` y monta `ToastRegion` |
| `src/views/Historial.jsx`, `src/views/Calendario.jsx` | Modificar | Usan los componentes nuevos |
| `src/views/Dashboard.jsx` | Modificar | "Forzar cobros" con `ConfirmDialog` + `toast` |
| `src/components.jsx` | Eliminar | Sustituido por `src/ui/*` y `src/lib/formato.js` |
| `sgcrc-frontend-export/CLAUDE.md` | Modificar | Documenta los componentes base |

---

### Task 1: Lógica pura, con pruebas (almacén de toasts, trampa de foco, formato)

**Files:**
- Create: `src/lib/formato.js`, `src/lib/toastStore.js`, `src/lib/toastStore.test.js`, `src/lib/focoDialog.js`, `src/lib/focoDialog.test.js`
- Modify: `package.json` (script `test`)

**Interfaces:**
- Produces:
  - `fmt(n: number): string` (export nombrado de `formato.js`).
  - `crearTostadas({ duracion?: number, programar?: Function, cancelar?: Function }): { mostrar(mensaje: string, tipo?: 'ok'|'error'|'info'): number, cerrar(id: number): void, subscribe(fn): () => void, getSnapshot(): Array<{id, mensaje, tipo}> }`. `getSnapshot` devuelve la MISMA referencia mientras no haya cambios. Máximo 4 visibles (al exceder se cierra la más antigua). Duración por defecto 5000 ms; los de tipo `error` duran el doble.
  - `siguienteFoco(enfocables: any[], activo: any, atras: boolean): any | null`: devuelve el elemento al que hay que mover el foco manualmente o `null` si el navegador puede seguir su curso.

- [ ] **Step 1: Cambiar el script `test` para correr todas las pruebas**

En `package.json`, dejar:
```json
"test": "node --test \"src/lib/*.test.js\"",
```

- [ ] **Step 2: Escribir `src/lib/toastStore.test.js` (falla)**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { crearTostadas } from './toastStore.js'

// Programador falso: guarda los callbacks para dispararlos a mano
function falsos() {
  const tareas = new Map()
  let n = 0
  return {
    tareas,
    programar: (fn, ms) => { n += 1; tareas.set(n, { fn, ms }); return n },
    cancelar: (id) => { tareas.delete(id) },
  }
}

test('mostrar agrega la notificación con id y tipo, y notifica', () => {
  const f = falsos()
  const t = crearTostadas({ programar: f.programar, cancelar: f.cancelar })
  let avisos = 0
  t.subscribe(() => { avisos += 1 })
  const id = t.mostrar('Listo', 'ok')
  assert.deepEqual(t.getSnapshot(), [{ id, mensaje: 'Listo', tipo: 'ok' }])
  assert.equal(avisos, 1)
})

test('tipo por defecto es info y getSnapshot es estable sin cambios', () => {
  const f = falsos()
  const t = crearTostadas({ programar: f.programar, cancelar: f.cancelar })
  t.mostrar('Hola')
  assert.equal(t.getSnapshot()[0].tipo, 'info')
  assert.equal(t.getSnapshot(), t.getSnapshot())
})

test('cerrar quita la notificación, cancela su temporizador y notifica una sola vez', () => {
  const f = falsos()
  const t = crearTostadas({ programar: f.programar, cancelar: f.cancelar })
  const id = t.mostrar('A')
  let avisos = 0
  t.subscribe(() => { avisos += 1 })
  t.cerrar(id)
  assert.deepEqual(t.getSnapshot(), [])
  assert.equal(f.tareas.size, 0)
  assert.equal(avisos, 1)
  t.cerrar(id)
  assert.equal(avisos, 1)
})

test('se cierra sola al vencer el temporizador; los errores duran el doble', () => {
  const f = falsos()
  const t = crearTostadas({ duracion: 1000, programar: f.programar, cancelar: f.cancelar })
  t.mostrar('ok', 'ok')
  t.mostrar('mal', 'error')
  const duraciones = [...f.tareas.values()].map((x) => x.ms)
  assert.deepEqual(duraciones, [1000, 2000])
  ;[...f.tareas.values()][0].fn()
  assert.deepEqual(t.getSnapshot().map((x) => x.mensaje), ['mal'])
})

test('máximo 4 visibles: al exceder se cierra la más antigua', () => {
  const f = falsos()
  const t = crearTostadas({ programar: f.programar, cancelar: f.cancelar })
  for (const m of ['1', '2', '3', '4', '5']) t.mostrar(m)
  assert.deepEqual(t.getSnapshot().map((x) => x.mensaje), ['2', '3', '4', '5'])
  assert.equal(f.tareas.size, 4)
})

test('subscribe devuelve una función que da de baja al oyente', () => {
  const f = falsos()
  const t = crearTostadas({ programar: f.programar, cancelar: f.cancelar })
  let avisos = 0
  const baja = t.subscribe(() => { avisos += 1 })
  baja()
  t.mostrar('x')
  assert.equal(avisos, 0)
})
```

- [ ] **Step 3: Escribir `src/lib/focoDialog.test.js` (falla)**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { siguienteFoco } from './focoDialog.js'

const [a, b, c] = ['a', 'b', 'c']

test('sin elementos enfocables no hay a dónde mover el foco', () => {
  assert.equal(siguienteFoco([], null, false), null)
})

test('Tab en el último vuelve al primero', () => {
  assert.equal(siguienteFoco([a, b, c], c, false), a)
})

test('Shift+Tab en el primero salta al último', () => {
  assert.equal(siguienteFoco([a, b, c], a, true), c)
})

test('en posiciones intermedias deja actuar al navegador', () => {
  assert.equal(siguienteFoco([a, b, c], b, false), null)
  assert.equal(siguienteFoco([a, b, c], b, true), null)
})

test('si el foco está fuera de la lista (p. ej. en el contenedor) entra por el extremo correcto', () => {
  assert.equal(siguienteFoco([a, b, c], 'contenedor', false), a)
  assert.equal(siguienteFoco([a, b, c], 'contenedor', true), c)
})

test('con un solo elemento el foco se queda en él', () => {
  assert.equal(siguienteFoco([a], a, false), a)
  assert.equal(siguienteFoco([a], a, true), a)
})
```

- [ ] **Step 4: Ejecutar las pruebas y verificar que fallan**

Run (en `sgcrc-frontend-export/`): `npm test`
Expected: FAIL con `ERR_MODULE_NOT_FOUND` para `toastStore.js` y `focoDialog.js`.

- [ ] **Step 5: Implementar `src/lib/toastStore.js`**

```js
// Almacén de notificaciones (toasts). Puro y sin React: se lee con useSyncExternalStore.
const MAX_VISIBLES = 4

export function crearTostadas({ duracion = 5000, programar = setTimeout, cancelar = clearTimeout } = {}) {
  let items = []
  let siguiente = 1
  const oyentes = new Set()
  const temporizadores = new Map()

  const avisar = () => { oyentes.forEach((fn) => fn()) }

  const cerrar = (id) => {
    if (temporizadores.has(id)) {
      cancelar(temporizadores.get(id))
      temporizadores.delete(id)
    }
    const quedan = items.filter((t) => t.id !== id)
    if (quedan.length === items.length) return
    items = quedan
    avisar()
  }

  const mostrar = (mensaje, tipo = 'info') => {
    if (items.length >= MAX_VISIBLES) cerrar(items[0].id)
    const id = siguiente++
    items = [...items, { id, mensaje, tipo }]
    temporizadores.set(id, programar(() => cerrar(id), tipo === 'error' ? duracion * 2 : duracion))
    avisar()
    return id
  }

  const subscribe = (fn) => {
    oyentes.add(fn)
    return () => { oyentes.delete(fn) }
  }

  return { mostrar, cerrar, subscribe, getSnapshot: () => items }
}
```

- [ ] **Step 6: Implementar `src/lib/focoDialog.js`**

```js
// Trampa de foco de los diálogos. Devuelve el elemento al que hay que mover el foco a mano,
// o null si el navegador puede seguir su orden natural de Tab.
export function siguienteFoco(enfocables, activo, atras) {
  if (enfocables.length === 0) return null
  const primero = enfocables[0]
  const ultimo = enfocables[enfocables.length - 1]
  if (!enfocables.includes(activo)) return atras ? ultimo : primero
  if (atras && activo === primero) return ultimo
  if (!atras && activo === ultimo) return primero
  return null
}
```

- [ ] **Step 7: Crear `src/lib/formato.js`**

```js
export const fmt = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
```

- [ ] **Step 8: Ejecutar pruebas**

Run: `npm test`
Expected: PASS, todas las pruebas de `colorTema.test.js`, `toastStore.test.js` y `focoDialog.test.js`.

- [ ] **Step 9: Commit**

```bash
git add sgcrc-frontend-export/package.json sgcrc-frontend-export/src/lib
git commit -m "feat(frontend): almacén de toasts, trampa de foco y formato con pruebas"
```

---

### Task 2: Estilos y componentes sin estado (Button, Badge, Skeleton, EmptyState, ErrorMsg)

**Files:**
- Create: `src/styles/ui.css`, `src/ui/Button.jsx`, `src/ui/Badge.jsx`, `src/ui/Skeleton.jsx`, `src/ui/EmptyState.jsx`, `src/ui/ErrorMsg.jsx`
- Modify: `src/main.jsx` (importar `./styles/ui.css` después de `base.css`)

**Interfaces:**
- Consumes: `Icon` de `src/ui/Icon.jsx` (props `name`, `size`, `label`, `className`, `style`).
- Produces (todos `export default` salvo indicación):
  - `Button({ variante = 'primario'|'secundario'|'peligro', tam = 'md'|'sm', icono?: string, cargando?: boolean, type = 'button', className?, children, ...resto })`.
  - `Badge({ tono = 'warn'|'ok'|'bad'|'info', icono?: string, children })` y export nombrado `EstadoBadge({ estado: string })` (mapa: `Enviado` y `Activa` → ok/`check-circle`; `Fallido` e `Inactiva` → bad/`x-circle`; cualquier otro → warn/`clock-counter-clockwise`; el texto mostrado es `estado`).
  - `Skeleton({ filas = 3 })`.
  - `EmptyState({ icono = 'tag', titulo: string, children?, accion?: ReactNode })`.
  - `ErrorMsg({ msg: string, onRetry?: Function })`.
- Clases CSS que Tasks 3 y 4 reutilizan: `.btn`, `.field`, `.field-label`, `.field-control`, `.field-ayuda`, `.field-error`, `.dialog-velo`, `.dialog`, `.dialog-titulo`, `.dialog-cuerpo`, `.dialog-pie`, `.toast-region`, `.toast`, `.sr-only`. Se definen todas aquí para tener un solo archivo de estilos.

- [ ] **Step 1: Crear `src/styles/ui.css`**

```css
/* Componentes base de SGCRC. Solo consumen tokens de tokens.css. */

.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}

/* ---------- Button ---------- */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem;
  min-height: 2.75rem; padding: 0.5rem 1.1rem;
  border: 1px solid transparent; border-radius: 8px;
  font: inherit; font-size: 0.9375rem; font-weight: 600; line-height: 1.2;
  cursor: pointer;
  transition: filter 140ms ease, background-color 140ms ease, border-color 140ms ease;
}
.btn-sm { min-height: 2.25rem; padding: 0.3rem 0.8rem; font-size: 0.875rem; }
.btn-primario { background: var(--color-primario); color: var(--color-primario-contraste); }
.btn-primario:hover:not(:disabled) { filter: brightness(1.1); }
.btn-secundario { background: var(--surface); color: var(--ink); border-color: var(--line); }
.btn-secundario:hover:not(:disabled) { background: var(--surface-alt); }
.btn-peligro { background: var(--bad-bg); color: var(--bad); border-color: var(--bad); }
.btn-peligro:hover:not(:disabled) { filter: brightness(0.97); }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-girando { animation: btn-giro 0.9s linear infinite; }
@keyframes btn-giro { to { transform: rotate(360deg); } }

/* ---------- Badge ---------- */
.badge {
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.15rem 0.55rem; border-radius: 4px;
  font-size: 0.8125rem; font-weight: 600; line-height: 1.4; white-space: nowrap;
}
.badge-ok   { background: var(--ok-bg);   color: var(--ok); }
.badge-warn { background: var(--warn-bg); color: var(--warn); }
.badge-bad  { background: var(--bad-bg);  color: var(--bad); }
.badge-info { background: var(--info-bg); color: var(--info); }

/* ---------- Skeleton ---------- */
.skeleton { display: grid; gap: 0.75rem; padding: 1rem 0; }
.skeleton-fila { height: 1rem; border-radius: 4px; background: var(--line); }
.skeleton-fila:nth-child(odd) { width: 100%; }
.skeleton-fila:nth-child(even) { width: 72%; }

/* ---------- EmptyState ---------- */
.vacio {
  display: grid; justify-items: center; gap: 0.5rem; text-align: center;
  padding: 2.5rem 1rem; color: var(--ink-2);
}
.vacio-titulo { margin: 0; font-family: var(--font-display); font-size: 1.25rem; color: var(--ink); }
.vacio-texto { margin: 0; max-width: 36ch; }
.vacio-accion { margin-top: 0.5rem; }

/* ---------- ErrorMsg ---------- */
.aviso-error {
  display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;
  margin-bottom: 1rem; padding: 0.85rem 1rem;
  background: var(--bad-bg); color: var(--bad);
  border: 1px solid var(--bad); border-radius: 8px;
}
.aviso-error-texto { display: inline-flex; align-items: center; gap: 0.5rem; }

/* ---------- Field ---------- */
.field { display: grid; gap: 0.35rem; }
.field-label { font-size: 0.875rem; font-weight: 600; color: var(--ink); }
.field-requerido { color: var(--bad); }
.field-control {
  width: 100%; min-height: 2.75rem; padding: 0.5rem 0.75rem;
  background: var(--surface); color: var(--ink);
  border: 1px solid var(--line); border-radius: 8px;
  font: inherit; font-size: 1rem;
}
textarea.field-control { min-height: 5.5rem; resize: vertical; }
.field-control[aria-invalid="true"] { border-color: var(--bad); }
.field-control:disabled { background: var(--surface-alt); color: var(--ink-2); }
.field-ayuda { margin: 0; font-size: 0.8125rem; color: var(--ink-2); }
.field-error {
  display: inline-flex; align-items: center; gap: 0.35rem; margin: 0;
  font-size: 0.8125rem; font-weight: 600; color: var(--bad);
}

/* ---------- Dialog ---------- */
.dialog-velo {
  position: fixed; inset: 0; z-index: 50;
  display: flex; align-items: center; justify-content: center; padding: 1rem;
  background: rgba(31, 36, 33, 0.45);
}
.dialog {
  width: 100%; max-width: 30rem; max-height: 100%; overflow: auto;
  background: var(--surface); color: var(--ink);
  border: 1px solid var(--line); border-radius: 8px;
  box-shadow: 0 12px 32px rgba(31, 36, 33, 0.25);
  animation: dialog-entra 160ms ease-out;
}
@keyframes dialog-entra { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.dialog:focus { outline: none; }
.dialog-titulo { margin: 0; padding: 1.25rem 1.25rem 0; font-size: 1.25rem; }
.dialog-cuerpo { padding: 0.75rem 1.25rem 1.25rem; color: var(--ink); }
.dialog-pie {
  display: flex; justify-content: flex-end; gap: 0.75rem; flex-wrap: wrap;
  padding: 0.9rem 1.25rem; background: var(--surface-alt); border-top: 1px solid var(--line);
}

/* ---------- Toast ---------- */
.toast-region {
  position: fixed; z-index: 60; left: 1rem; right: 1rem; bottom: 1rem;
  display: grid; gap: 0.5rem; justify-items: center; pointer-events: none;
}
.toast {
  pointer-events: auto; width: 100%; max-width: 26rem;
  display: flex; align-items: flex-start; gap: 0.6rem;
  padding: 0.75rem 0.9rem; border: 1px solid var(--line); border-radius: 8px;
  background: var(--surface); color: var(--ink);
  box-shadow: 0 8px 24px rgba(31, 36, 33, 0.18);
  animation: dialog-entra 160ms ease-out;
}
.toast-ok    { border-color: var(--ok);   color: var(--ok); }
.toast-error { border-color: var(--bad);  color: var(--bad); }
.toast-info  { border-color: var(--info); color: var(--info); }
.toast-texto { flex: 1; color: var(--ink); }
.toast-cerrar {
  display: inline-flex; padding: 0.25rem; border: 0; border-radius: 4px;
  background: transparent; color: var(--ink-2); cursor: pointer;
}
.toast-cerrar:hover { background: var(--surface-alt); }
@media (min-width: 640px) {
  .toast-region { left: auto; right: 1.25rem; justify-items: end; }
}
```

- [ ] **Step 2: Crear `src/ui/Button.jsx`**

```jsx
import Icon from './Icon.jsx'

// variante: 'primario' | 'secundario' | 'peligro'. tam: 'md' | 'sm'.
// cargando: deshabilita el botón, anuncia aria-busy y gira el icono.
export default function Button({
  variante = 'primario', tam = 'md', icono, cargando = false,
  type = 'button', className = '', disabled, children, ...resto
}) {
  const clases = ['btn', `btn-${variante}`, tam === 'sm' ? 'btn-sm' : '', className].filter(Boolean).join(' ')
  return (
    <button type={type} className={clases} disabled={disabled || cargando} aria-busy={cargando || undefined} {...resto}>
      {cargando
        ? <Icon name="arrow-clockwise" size={18} className="btn-girando" />
        : icono && <Icon name={icono} size={18} />}
      {children}
    </button>
  )
}
```

- [ ] **Step 3: Crear `src/ui/Badge.jsx`**

```jsx
import Icon from './Icon.jsx'

// El estado siempre lleva icono y texto, nunca solo color.
export default function Badge({ tono = 'warn', icono, children }) {
  return (
    <span className={`badge badge-${tono}`}>
      {icono && <Icon name={icono} size={14} />}
      {children}
    </span>
  )
}

const ESTADOS = {
  Enviado:  { tono: 'ok',  icono: 'check-circle' },
  Activa:   { tono: 'ok',  icono: 'check-circle' },
  Fallido:  { tono: 'bad', icono: 'x-circle' },
  Inactiva: { tono: 'bad', icono: 'x-circle' },
}
const ESTADO_PENDIENTE = { tono: 'warn', icono: 'clock-counter-clockwise' }

export function EstadoBadge({ estado }) {
  const e = ESTADOS[estado] || ESTADO_PENDIENTE
  return <Badge tono={e.tono} icono={e.icono}>{estado}</Badge>
}
```

- [ ] **Step 4: Crear `src/ui/Skeleton.jsx`**

```jsx
// Marcador de carga estático (sin pulso infinito). El texto oculto lo anuncia a lectores de pantalla.
export default function Skeleton({ filas = 3 }) {
  return (
    <div className="skeleton" role="status" aria-busy="true">
      <span className="sr-only">Cargando…</span>
      {Array.from({ length: filas }, (_, i) => <div key={i} className="skeleton-fila" aria-hidden="true" />)}
    </div>
  )
}
```

- [ ] **Step 5: Crear `src/ui/EmptyState.jsx`**

```jsx
import Icon from './Icon.jsx'

export default function EmptyState({ icono = 'tag', titulo, children, accion }) {
  return (
    <div className="vacio">
      <Icon name={icono} size={36} />
      <h3 className="vacio-titulo">{titulo}</h3>
      {children && <p className="vacio-texto">{children}</p>}
      {accion && <div className="vacio-accion">{accion}</div>}
    </div>
  )
}
```

- [ ] **Step 6: Crear `src/ui/ErrorMsg.jsx`**

```jsx
import Icon from './Icon.jsx'
import Button from './Button.jsx'

export default function ErrorMsg({ msg, onRetry }) {
  return (
    <div role="alert" className="aviso-error">
      <span className="aviso-error-texto">
        <Icon name="warning" size={18} />
        {msg}
      </span>
      {onRetry && <Button variante="peligro" tam="sm" onClick={onRetry}>Reintentar</Button>}
    </div>
  )
}
```

- [ ] **Step 7: Importar los estilos en `src/main.jsx`**

Agregar tras `import './styles/base.css'`:
```jsx
import './styles/ui.css'
```

- [ ] **Step 8: Verificar**

Run: `npm test` y `npm run build`
Expected: pruebas en verde y build sin errores (los componentes aún no se usan; el build debe pasar igual).

- [ ] **Step 9: Commit**

```bash
git add sgcrc-frontend-export/src/styles/ui.css sgcrc-frontend-export/src/ui sgcrc-frontend-export/src/main.jsx
git commit -m "feat(frontend): componentes base Button, Badge, Skeleton, EmptyState y ErrorMsg"
```

---

### Task 3: Field

**Files:**
- Create: `src/ui/Field.jsx`

**Interfaces:**
- Consumes: clases `.field`, `.field-label`, `.field-requerido`, `.field-control`, `.field-ayuda`, `.field-error` (Task 2), `Icon`.
- Produces: `Field({ label: string, ayuda?: string, error?: string, requerido?: boolean, as = 'input'|'select'|'textarea', id?: string, className?, ...resto })` (`export default`). Los `children` (p. ej. `<option>`) y el resto de props (`value`, `onChange`, `type`, `autoComplete`, `inputMode`…) pasan al control. El `<label>` queda asociado por `htmlFor`/`id` (id generado con `useId` si no se pasa), y el control recibe `aria-describedby` (ayuda y error), `aria-invalid` y `aria-required`.

- [ ] **Step 1: Crear `src/ui/Field.jsx`**

```jsx
import { useId } from 'react'
import Icon from './Icon.jsx'

// Campo de formulario con label visible asociado, ayuda y error en línea.
// `as` elige el control: 'input' (por defecto), 'select' o 'textarea'; los children pasan al control.
export default function Field({ label, ayuda, error, requerido = false, as: Control = 'input', id, className = '', ...resto }) {
  const autoId = useId()
  const idCampo = id || autoId
  const idAyuda = ayuda ? `${idCampo}-ayuda` : null
  const idError = error ? `${idCampo}-error` : null
  const descrito = [idAyuda, idError].filter(Boolean).join(' ') || undefined

  return (
    <div className="field">
      <label className="field-label" htmlFor={idCampo}>
        {label}
        {requerido && <span className="field-requerido" aria-hidden="true"> *</span>}
      </label>
      <Control
        id={idCampo}
        className={`field-control ${className}`.trim()}
        aria-describedby={descrito}
        aria-invalid={error ? true : undefined}
        aria-required={requerido || undefined}
        {...resto}
      />
      {ayuda && <p id={idAyuda} className="field-ayuda">{ayuda}</p>}
      {error && (
        <p id={idError} className="field-error">
          <Icon name="warning-circle" size={14} />
          {error}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar**

Run: `npm run build`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add sgcrc-frontend-export/src/ui/Field.jsx
git commit -m "feat(frontend): componente Field con label asociado, ayuda y error"
```

---

### Task 4: Dialog, ConfirmDialog y Toast

**Files:**
- Create: `src/ui/Dialog.jsx`, `src/ui/ConfirmDialog.jsx`, `src/ui/Toast.jsx`
- Modify: `src/main.jsx` (montar `ToastRegion`)

**Interfaces:**
- Consumes: `siguienteFoco` (`src/lib/focoDialog.js`), `crearTostadas` (`src/lib/toastStore.js`), `Button`, `Icon`, clases de `ui.css`.
- Produces:
  - `Dialog({ abierto: boolean, titulo: string, onCerrar?: Function, cerrable = true, pie?: ReactNode, children })` (`export default`). `role="dialog"`, `aria-modal`, `aria-labelledby`, trampa de foco, Escape y clic en el velo llaman a `onCerrar` solo si `cerrable`; foco inicial en el primer `[data-autofocus]` o, si no hay, en el primer enfocable; al cerrar devuelve el foco al elemento previo; bloquea el scroll del `body` mientras está abierto. Con `abierto=false` no renderiza nada.
  - `ConfirmDialog({ abierto, titulo, children, textoConfirmar = 'Confirmar', textoCancelar = 'Cancelar', peligro = false, cargando = false, onConfirmar, onCancelar })` (`export default`). El foco inicial va al botón Cancelar (acción segura). Mientras `cargando`, no se puede cerrar.
  - `toast`: `{ exito(mensaje), error(mensaje), info(mensaje) }` (export nombrado de `Toast.jsx`) y `ToastRegion()` (export nombrado, se monta una vez). Cada `toast.*` devuelve el id.

- [ ] **Step 1: Crear `src/ui/Dialog.jsx`**

```jsx
import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { siguienteFoco } from '../lib/focoDialog.js'

const ENFOCABLES = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

export default function Dialog({ abierto, titulo, onCerrar, cerrable = true, pie, children }) {
  const raiz = useRef(null)
  const idTitulo = useId()
  // Refs para que el efecto dependa solo de `abierto` (no se reinicia el foco si cambia un callback)
  const cerrarRef = useRef(onCerrar)
  const cerrableRef = useRef(cerrable)
  cerrarRef.current = onCerrar
  cerrableRef.current = cerrable

  useEffect(() => {
    if (!abierto) return undefined
    const el = raiz.current
    const previo = document.activeElement
    const desbordeAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ;(el.querySelector('[data-autofocus]') || el.querySelector(ENFOCABLES) || el).focus()

    const alTeclear = (e) => {
      if (e.key === 'Escape' && cerrableRef.current) {
        e.stopPropagation()
        cerrarRef.current?.()
        return
      }
      if (e.key !== 'Tab') return
      const destino = siguienteFoco([...el.querySelectorAll(ENFOCABLES)], document.activeElement, e.shiftKey)
      if (destino) {
        e.preventDefault()
        destino.focus()
      }
    }
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.body.style.overflow = desbordeAnterior
      if (previo && typeof previo.focus === 'function') previo.focus()
    }
  }, [abierto])

  if (!abierto) return null
  return createPortal(
    <div
      className="dialog-velo"
      onMouseDown={(e) => { if (e.target === e.currentTarget && cerrable) onCerrar?.() }}
    >
      <div ref={raiz} className="dialog" role="dialog" aria-modal="true" aria-labelledby={idTitulo} tabIndex={-1}>
        <h2 id={idTitulo} className="dialog-titulo">{titulo}</h2>
        <div className="dialog-cuerpo">{children}</div>
        {pie && <div className="dialog-pie">{pie}</div>}
      </div>
    </div>,
    document.body,
  )
}
```

- [ ] **Step 2: Crear `src/ui/ConfirmDialog.jsx`**

```jsx
import Dialog from './Dialog.jsx'
import Button from './Button.jsx'

// Reemplaza window.confirm. El foco inicial cae en "Cancelar" (la acción segura).
export default function ConfirmDialog({
  abierto, titulo, children,
  textoConfirmar = 'Confirmar', textoCancelar = 'Cancelar',
  peligro = false, cargando = false, onConfirmar, onCancelar,
}) {
  return (
    <Dialog
      abierto={abierto}
      titulo={titulo}
      onCerrar={onCancelar}
      cerrable={!cargando}
      pie={(
        <>
          <Button variante="secundario" onClick={onCancelar} disabled={cargando} data-autofocus>{textoCancelar}</Button>
          <Button variante={peligro ? 'peligro' : 'primario'} onClick={onConfirmar} cargando={cargando}>{textoConfirmar}</Button>
        </>
      )}
    >
      {children}
    </Dialog>
  )
}
```

- [ ] **Step 3: Crear `src/ui/Toast.jsx`**

```jsx
import { createPortal } from 'react-dom'
import { useSyncExternalStore } from 'react'
import { crearTostadas } from '../lib/toastStore.js'
import Icon from './Icon.jsx'

const tostadas = crearTostadas()

// API imperativa: se puede llamar desde cualquier parte, sin Provider.
export const toast = {
  exito: (mensaje) => tostadas.mostrar(mensaje, 'ok'),
  error: (mensaje) => tostadas.mostrar(mensaje, 'error'),
  info: (mensaje) => tostadas.mostrar(mensaje, 'info'),
}

const ICONOS = { ok: 'check-circle', error: 'warning-circle', info: 'bell' }

// Montar UNA vez (main.jsx). La región vive siempre en el DOM para que los lectores de pantalla anuncien los avisos.
export function ToastRegion() {
  const items = useSyncExternalStore(tostadas.subscribe, tostadas.getSnapshot)
  return createPortal(
    <div className="toast-region" aria-live="polite" aria-relevant="additions">
      {items.map((t) => (
        <div key={t.id} className={`toast toast-${t.tipo}`} role={t.tipo === 'error' ? 'alert' : undefined}>
          <Icon name={ICONOS[t.tipo]} size={20} />
          <span className="toast-texto">{t.mensaje}</span>
          <button type="button" className="toast-cerrar" onClick={() => tostadas.cerrar(t.id)}>
            <Icon name="x" size={16} label="Cerrar notificación" />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  )
}
```

- [ ] **Step 4: Montar `ToastRegion` en `src/main.jsx`**

Agregar el import `import { ToastRegion } from './ui/Toast.jsx'` y dejar el render así:
```jsx
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <ToastRegion />
  </React.StrictMode>
)
```

- [ ] **Step 5: Verificar**

Run: `npm test` y `npm run build`
Expected: todo en verde.

- [ ] **Step 6: Commit**

```bash
git add sgcrc-frontend-export/src/ui sgcrc-frontend-export/src/main.jsx
git commit -m "feat(frontend): Dialog accesible, ConfirmDialog y Toast"
```

---

### Task 5: Adoptar los componentes (Historial, Calendario, Dashboard) y retirar `components.jsx`

**Files:**
- Modify: `src/views/Historial.jsx`, `src/views/Calendario.jsx`, `src/views/Dashboard.jsx`, `sgcrc-frontend-export/CLAUDE.md`
- Delete: `src/components.jsx`

**Interfaces:**
- Consumes: `Button`, `EstadoBadge` (de `Badge.jsx`), `Skeleton`, `ErrorMsg`, `ConfirmDialog`, `toast`, `fmt`.

- [ ] **Step 1: Historial**

Reemplazar la línea 3 `import { Badge, Spinner, ErrorMsg, Btn, fmt } from '../components.jsx'` por:
```jsx
import { EstadoBadge } from '../ui/Badge.jsx'
import Skeleton from '../ui/Skeleton.jsx'
import ErrorMsg from '../ui/ErrorMsg.jsx'
import Button from '../ui/Button.jsx'
import { fmt } from '../lib/formato.js'
```
Cambiar `if (loading) return <Spinner />` por `if (loading) return <Skeleton />`.
Cambiar `<Badge status={h.estado} />` por `<EstadoBadge estado={h.estado} />`.
Cambiar el bloque `<Btn variant='secondary' style=... onClick={cargar}> <Icon .../> Actualizar </Btn>` (líneas ~68-71) por:
```jsx
<Button variante="secundario" tam="sm" icono="arrow-clockwise" onClick={cargar}>Actualizar</Button>
```
Quitar el `import Icon` de Historial solo si deja de usarse (comprobar con búsqueda).

- [ ] **Step 2: Calendario**

Reemplazar la línea 3 `import { Spinner, ErrorMsg, fmt } from '../components.jsx'` por:
```jsx
import Skeleton from '../ui/Skeleton.jsx'
import ErrorMsg from '../ui/ErrorMsg.jsx'
import { fmt } from '../lib/formato.js'
```
Cambiar `if (loading) return <Spinner />` por `if (loading) return <Skeleton />`.

- [ ] **Step 3: Dashboard, "Forzar cobros" sin alert/confirm**

En `Dashboard.jsx`:
1. Imports nuevos: `import ConfirmDialog from '../ui/ConfirmDialog.jsx'`, `import { toast } from '../ui/Toast.jsx'` y `import Button from '../ui/Button.jsx'`.
2. Estado nuevo junto a `loadingProceso`: `const [reenvio, setReenvio] = useState(null)` (`null` o el mensaje del 409).
3. Reemplazar `handleForzarCobros` completo por:
```jsx
  const handleForzarCobros = async (confirmarReenvio = false) => {
    setLoadingProceso(true)
    try {
      const res = await api.runCobros({ confirmarReenvio })
      setReenvio(null)
      toast.exito(res.message || 'Proceso completado exitosamente')
      await cargar()
    } catch (err) {
      const errorStatus = err.response?.status || err.status
      const errorData = err.response?.data || err.data
      if (errorStatus === 409 && errorData?.requiereConfirmacion) {
        setReenvio(errorData?.mensaje || 'Ya se procesaron cobros hoy.')
      } else {
        setReenvio(null)
        toast.error(errorData?.error || err.message)
      }
    } finally {
      setLoadingProceso(false)
    }
  }
```
4. Reemplazar el `<button ...>Forzar Cobros de Hoy</button>` (líneas ~127-139) por:
```jsx
        <Button icono="paper-plane-tilt" cargando={loadingProceso && !reenvio} onClick={() => handleForzarCobros(false)}>
          {loadingProceso && !reenvio ? 'Procesando...' : 'Forzar Cobros de Hoy'}
        </Button>
```
5. Justo antes del `</div>` que cierra el `return` principal, agregar:
```jsx
      <ConfirmDialog
        abierto={reenvio !== null}
        titulo="Reenviar cobros de hoy"
        textoConfirmar="Reenviar"
        cargando={loadingProceso}
        onConfirmar={() => handleForzarCobros(true)}
        onCancelar={() => setReenvio(null)}
      >
        <p>{reenvio}</p>
        <p>¿Deseas forzar el reenvío para todos los pendientes de hoy?</p>
      </ConfirmDialog>
```
No se toca el resto del Dashboard (su rediseño es Fase 6).

- [ ] **Step 4: Borrar `components.jsx` y comprobar que no queda ninguna referencia**

Run: `git rm sgcrc-frontend-export/src/components.jsx` y luego `grep -rn "components.jsx" sgcrc-frontend-export/src`
Expected: sin resultados.

- [ ] **Step 5: Actualizar `sgcrc-frontend-export/CLAUDE.md`**

En la tabla de `src/`, reemplazar la fila de `components.jsx` por:
`| ui/ | Componentes base (Button, Badge/EstadoBadge, Field, Dialog, ConfirmDialog, Toast, EmptyState, Skeleton, ErrorMsg, Icon, Logo); estilos en styles/ui.css |`
y agregar la fila `| lib/formato.js, lib/toastStore.js, lib/focoDialog.js | fmt (COP), almacén de toasts y trampa de foco (con pruebas, npm test) |`.
Agregar una sección "Componentes base" con: usar `toast.exito/error/info` en vez de `alert`, `ConfirmDialog` en vez de `confirm`, `Field` (label obligatorio, asociado) en vez de `<input>` suelto, `Button` con `variante`/`tam`/`cargando`.

- [ ] **Step 6: Verificar**

Run: `npm test` y `npm run build`
Expected: todo en verde. Comprobar además `grep -rn "alert(\|confirm(" sgcrc-frontend-export/src/views/Dashboard.jsx` sin resultados (los de Clientes, Planes, Suscripciones y Login se migran en la Fase 3).

- [ ] **Step 7: Verificación en navegador (sin tocar producción)**

Arrancar `npm run dev` (frontend, puerto 5173) con el backend de desarrollo, iniciar sesión y comprobar: Historial y Calendario cargan con `Skeleton`; el botón de Actualizar funciona; en el Dashboard, "Forzar Cobros de Hoy" muestra el toast de éxito, y si ya se procesó hoy, el diálogo de reenvío (foco en Cancelar, Tab no sale del diálogo, Escape cierra, el foco vuelve al botón). Anotar el resultado en el reporte; no usar la base de producción.

- [ ] **Step 8: Commit**

```bash
git add -A sgcrc-frontend-export
git commit -m "refactor(frontend): vistas adoptan los componentes base y Dashboard sin alert/confirm"
```
