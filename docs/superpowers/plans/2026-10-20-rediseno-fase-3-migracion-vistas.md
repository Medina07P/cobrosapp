# Rediseño visual, Fase 3: Migración de vistas y shell. Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar Clientes, Planes, Suscripciones, Login y Configuración, y el shell (sidebar y cabecera) al sistema visual "libro de caja cálido" con los componentes de `src/ui/`, y cerrar los pendientes diferidos de la Fase 2.

**Architecture:** Primero se completa la base (lógica pura con pruebas en `src/lib/`, ajustes de componentes y clases CSS compartidas de página, tarjeta, formulario y tabla); después el shell, y luego cada vista como tarea independiente que solo compone componentes ya existentes. Los formularios validan en el cliente con funciones puras (`lib/validaciones.js`, espejo de las reglas del backend), muestran el error en línea con `Field` y mueven el foco al primer campo inválido (esa es la estrategia de accesibilidad de errores: el lector de pantalla lo anuncia por `aria-describedby` al recibir el foco). Los avisos usan `toast`, las confirmaciones `ConfirmDialog`.

**Tech Stack:** React 18, Vite 7, CSS propio con tokens (`src/styles/`), Tailwind CDN solo en vistas aún no migradas (Dashboard, Historial y Calendario conservan sus estilos), `node:test`.

Spec: `docs/superpowers/specs/2026-10-19-rediseno-visual-frontend-design.md` · Contexto: `PRODUCT.md`, Fase 2 en `docs/superpowers/plans/2026-10-20-rediseno-fase-2-componentes-base.md`.

## Global Constraints

- Rama `develop`. Un commit por tarea, con el trailer final exacto `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Sin push.
- Todo dentro de `sgcrc-frontend-export/` salvo este plan. Tailwind sigue por CDN: no crear `tailwind.config.js` ni PostCSS. `fetch`, no `axios`.
- Las vistas y componentes migrados NO usan clases de Tailwind ni colores hardcodeados: usan las clases de `src/styles/*.css` y `var(--...)`. Texto sobre fondo de marca: `var(--color-primario-contraste)`. Nunca `setProperty('--color-primario', ...)` directo: solo `aplicarColorTema`.
- Sin emojis ni símbolos decorativos: solo `<Icon>`. Iconos disponibles: `squares-four users tag arrows-clockwise clock-counter-clockwise calendar-blank gear warning-circle warning check-circle check x x-circle arrow-clockwise caret-left caret-right caret-down paper-plane-tilt envelope-simple coins bell sign-out magnifying-glass plus pencil-simple trash eye eye-slash list`; si falta uno, agregarlo a `scripts/gen-icons.mjs` y correr `npm run icons`.
- Texto mínimo 12 px; contraste 4.5:1; objetivos táctiles de 44 px (36 px solo en botones `sm` de filas de tabla de escritorio); foco visible lo da `base.css` (no anularlo).
- Textos de interfaz en español con tildes. Terminología: Clientes, Planes, Suscripciones, Historial, Cobros.
- Cada campo de formulario es un `<Field>` (label visible asociado) salvo casillas (`.check`) y el selector de color. Los formularios usan `<form noValidate onSubmit>`; tras un error de validación el foco va al primer campo inválido con `enfocarPrimerInvalido`.
- Reglas del backend que el cliente espeja: nombre ≤120 caracteres y obligatorio; correo obligatorio, ≤254 y con `@`; monto numérico no negativo (`/^\d+(\.\d+)?$/`); frecuencia ∈ semanal|quincenal|mensual|anual; día de cobro entero 1-31; fecha `AAAA-MM-DD`; WhatsApp vacío o 8-15 dígitos.
- El cliente NO envía `usuario_id` (el backend lo toma del JWT y lo ignora del cuerpo).
- Verificación de cada tarea (desde `sgcrc-frontend-export/`): `npm test` y `npm run build` sin errores.

## Estructura de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/lib/validaciones.js` + `.test.js` | Crear | `validarCliente`, `validarPlan`, `validarSuscripcion`, `validarPerfil` puros |
| `src/lib/formularios.js` + `.test.js` | Crear | `primerInvalido`, `enfocarPrimerInvalido` |
| `src/lib/formato.js` + `.test.js` | Modificar/Crear | Añade `fmtFecha` y pruebas de `fmt` |
| `src/lib/toastStore.js` + test | Modificar | `pausar()` y `reanudar()`, prueba de duración por defecto |
| `src/ui/Field.jsx`, `EmptyState.jsx`, `Badge.jsx`, `Toast.jsx`, `Dialog.jsx` | Modificar | Diferidos de la Fase 2 |
| `src/ui/PageHeader.jsx` | Crear | Encabezado de página (`h1`, descripción, acciones) |
| `src/styles/ui.css` | Modificar | Clases `.pagina*`, `.panel*`, `.form-grid`, `.form-acciones`, `.check`, `.tabla*`, `.herramientas` |
| `src/styles/shell.css` | Crear | Clases del shell (sidebar clara, barra móvil, salto al contenido) |
| `src/App.jsx`, `src/main.jsx` | Modificar | Shell nuevo |
| `src/views/Clientes.jsx`, `Planes.jsx`, `Suscripciones.jsx`, `Login.jsx`, `Configuracion.jsx` | Reescribir | Vistas migradas |
| `src/views/Dashboard.jsx`, `Historial.jsx`, `Calendario.jsx` | Modificar | Solo el encabezado pasa a `PageHeader` |
| `sgcrc-frontend-export/CLAUDE.md` | Modificar | Documentación |

---

### Task 1: Lógica pura con pruebas (validaciones, formularios, fecha, pausa de toasts)

**Files:**
- Create: `src/lib/validaciones.js`, `src/lib/validaciones.test.js`, `src/lib/formularios.js`, `src/lib/formularios.test.js`, `src/lib/formato.test.js`
- Modify: `src/lib/formato.js`, `src/lib/toastStore.js`, `src/lib/toastStore.test.js`

**Interfaces:**
- Produces:
  - `validarCliente({ nombre, correo }): { nombre?: string, correo?: string }`
  - `validarPlan({ nombre_plan, monto, frecuencia, dia_cobro }): { nombre_plan?, monto?, frecuencia?, dia_cobro? }`
  - `validarSuscripcion({ cliente_id, plan_id, fecha_alta }): { cliente_id?, plan_id?, fecha_alta? }`
  - `validarPerfil({ nombre, whatsapp }): { nombre?, whatsapp? }`
  - Todas devuelven un objeto vacío si no hay errores; los mensajes son frases en español para mostrar tal cual.
  - `primerInvalido(contenedor): Element | null` y `enfocarPrimerInvalido(contenedor): boolean` (`contenedor` puede ser `null`/`undefined`).
  - `fmtFecha(iso: string): string` → `'05/10/2026'`; `''` si no tiene forma `AAAA-MM-DD` (admite sufijo con hora).
  - `crearTostadas(...)` gana `pausar(): void` (cancela los temporizadores activos) y `reanudar(): void` (reprograma los que no tengan temporizador, con la duración completa).

- [ ] **Step 1: Escribir las pruebas que fallan**

`src/lib/validaciones.test.js`:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validarCliente, validarPlan, validarSuscripcion, validarPerfil } from './validaciones.js'

test('cliente válido no produce errores', () => {
  assert.deepEqual(validarCliente({ nombre: 'Ana', correo: 'ana@correo.co' }), {})
})

test('cliente: nombre vacío o solo espacios, nombre largo, correo sin @ o vacío', () => {
  assert.equal(validarCliente({ nombre: '  ', correo: 'a@b.c' }).nombre, 'Escribe el nombre.')
  assert.match(validarCliente({ nombre: 'x'.repeat(121), correo: 'a@b.c' }).nombre, /120/)
  assert.equal(validarCliente({ nombre: 'Ana', correo: '' }).correo, 'Escribe el correo.')
  assert.equal(validarCliente({ nombre: 'Ana', correo: 'ana.correo' }).correo, 'El correo no es válido.')
  assert.match(validarCliente({ nombre: 'Ana', correo: 'a@' + 'x'.repeat(260) }).correo, /254/)
})

test('plan válido (monto 0 permitido, string numérica)', () => {
  assert.deepEqual(validarPlan({ nombre_plan: 'Oro', monto: '50000', frecuencia: 'mensual', dia_cobro: '15' }), {})
  assert.deepEqual(validarPlan({ nombre_plan: 'Gratis', monto: 0, frecuencia: 'anual', dia_cobro: 1 }), {})
})

test('plan: nombre, monto, frecuencia y día inválidos', () => {
  const e = validarPlan({ nombre_plan: '', monto: '-5', frecuencia: 'diaria', dia_cobro: '32' })
  assert.equal(e.nombre_plan, 'Escribe el nombre del plan.')
  assert.equal(e.monto, 'El precio debe ser un número sin signos ni letras.')
  assert.equal(e.frecuencia, 'Elige una frecuencia válida.')
  assert.equal(e.dia_cobro, 'El día de cobro debe ser un entero entre 1 y 31.')
  assert.equal(validarPlan({ nombre_plan: 'A', monto: '', frecuencia: 'mensual', dia_cobro: 1 }).monto, 'Escribe el precio.')
  assert.equal(validarPlan({ nombre_plan: 'A', monto: 10, frecuencia: 'mensual', dia_cobro: '1.5' }).dia_cobro, 'El día de cobro debe ser un entero entre 1 y 31.')
})

test('suscripción: cliente, plan y fecha', () => {
  assert.deepEqual(validarSuscripcion({ cliente_id: '3', plan_id: '2', fecha_alta: '2026-10-05' }), {})
  const e = validarSuscripcion({ cliente_id: '', plan_id: '', fecha_alta: '05/10/2026' })
  assert.equal(e.cliente_id, 'Elige un cliente.')
  assert.equal(e.plan_id, 'Elige un plan.')
  assert.equal(e.fecha_alta, 'La fecha de inicio no es válida.')
  assert.deepEqual(validarSuscripcion({ cliente_id: 1, plan_id: 1, fecha_alta: '' }), {})
})

test('perfil: nombre obligatorio y WhatsApp vacío o 8-15 dígitos', () => {
  assert.deepEqual(validarPerfil({ nombre: 'Mi negocio', whatsapp: '' }), {})
  assert.deepEqual(validarPerfil({ nombre: 'Mi negocio', whatsapp: '573001234567' }), {})
  assert.equal(validarPerfil({ nombre: ' ', whatsapp: '' }).nombre, 'Escribe el nombre de tu negocio.')
  assert.equal(validarPerfil({ nombre: 'X', whatsapp: '+57 300' }).whatsapp, 'Escribe solo dígitos, con código de país (8 a 15).')
  assert.equal(validarPerfil({ nombre: 'X', whatsapp: '1234567' }).whatsapp, 'Escribe solo dígitos, con código de país (8 a 15).')
})
```

`src/lib/formularios.test.js`:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { primerInvalido, enfocarPrimerInvalido } from './formularios.js'

const contenedor = (el) => ({ querySelector: (sel) => (sel === '[aria-invalid="true"]' ? el : null) })

test('primerInvalido devuelve el elemento o null y tolera contenedor nulo', () => {
  const el = { focus() {} }
  assert.equal(primerInvalido(contenedor(el)), el)
  assert.equal(primerInvalido(contenedor(null)), null)
  assert.equal(primerInvalido(null), null)
  assert.equal(primerInvalido(undefined), null)
})

test('enfocarPrimerInvalido enfoca y devuelve true; sin inválidos devuelve false', () => {
  let enfocado = 0
  const el = { focus() { enfocado += 1 } }
  assert.equal(enfocarPrimerInvalido(contenedor(el)), true)
  assert.equal(enfocado, 1)
  assert.equal(enfocarPrimerInvalido(contenedor(null)), false)
})
```

`src/lib/formato.test.js`:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fmt, fmtFecha } from './formato.js'

test('fmt da pesos colombianos sin decimales', () => {
  const s = fmt(1234567).replace(/\s/g, ' ')
  assert.match(s, /^\$\s?1\.234\.567$/)
})

test('fmtFecha pasa AAAA-MM-DD a DD/MM/AAAA sin desfase de zona horaria', () => {
  assert.equal(fmtFecha('2026-10-05'), '05/10/2026')
  assert.equal(fmtFecha('2026-01-31T10:00:00'), '31/01/2026')
})

test('fmtFecha devuelve cadena vacía si no hay fecha válida', () => {
  assert.equal(fmtFecha(''), '')
  assert.equal(fmtFecha(null), '')
  assert.equal(fmtFecha('mañana'), '')
})
```

Añadir al final de `src/lib/toastStore.test.js` (usa el helper `falsos()` ya definido en el archivo):
```js
test('la duración por defecto es 5000 ms y la de error 10000 ms', () => {
  const f = falsos()
  const t = crearTostadas({ programar: f.programar, cancelar: f.cancelar })
  t.mostrar('a', 'info')
  t.mostrar('b', 'error')
  assert.deepEqual([...f.tareas.values()].map((x) => x.ms), [5000, 10000])
})

test('pausar cancela los temporizadores y reanudar los reprograma sin cerrar nada', () => {
  const f = falsos()
  const t = crearTostadas({ duracion: 1000, programar: f.programar, cancelar: f.cancelar })
  t.mostrar('a')
  t.mostrar('b', 'error')
  t.pausar()
  assert.equal(f.tareas.size, 0)
  assert.equal(t.getSnapshot().length, 2)
  t.reanudar()
  assert.deepEqual([...f.tareas.values()].map((x) => x.ms), [1000, 2000])
  t.reanudar()
  assert.equal(f.tareas.size, 2)
})
```

- [ ] **Step 2: Verificar que fallan**

Run: `npm test`
Expected: FAIL (`ERR_MODULE_NOT_FOUND` para `validaciones.js` y `formularios.js`; `fmtFecha`, `pausar`/`reanudar` no definidos).

- [ ] **Step 3: Implementar**

`src/lib/validaciones.js`:
```js
// Validación en el cliente, espejo de las reglas de backend/db.js. Devuelven {} si todo está bien.
const vacio = (v) => typeof v !== 'string' || v.trim() === ''

export function validarCliente({ nombre, correo }) {
  const e = {}
  if (vacio(nombre)) e.nombre = 'Escribe el nombre.'
  else if (nombre.trim().length > 120) e.nombre = 'El nombre no puede superar 120 caracteres.'
  if (vacio(correo)) e.correo = 'Escribe el correo.'
  else if (correo.trim().length > 254) e.correo = 'El correo no puede superar 254 caracteres.'
  else if (!correo.includes('@')) e.correo = 'El correo no es válido.'
  return e
}

const FRECUENCIAS = ['semanal', 'quincenal', 'mensual', 'anual']

export function validarPlan({ nombre_plan, monto, frecuencia, dia_cobro }) {
  const e = {}
  if (vacio(nombre_plan)) e.nombre_plan = 'Escribe el nombre del plan.'
  else if (nombre_plan.trim().length > 120) e.nombre_plan = 'El nombre del plan no puede superar 120 caracteres.'
  const m = typeof monto === 'number' ? String(monto) : String(monto ?? '').trim()
  if (m === '') e.monto = 'Escribe el precio.'
  else if (!/^\d+(\.\d+)?$/.test(m)) e.monto = 'El precio debe ser un número sin signos ni letras.'
  if (!FRECUENCIAS.includes(frecuencia)) e.frecuencia = 'Elige una frecuencia válida.'
  const d = String(dia_cobro ?? '').trim()
  if (!/^\d+$/.test(d) || Number(d) < 1 || Number(d) > 31) e.dia_cobro = 'El día de cobro debe ser un entero entre 1 y 31.'
  return e
}

export function validarSuscripcion({ cliente_id, plan_id, fecha_alta }) {
  const e = {}
  if (cliente_id === '' || cliente_id == null) e.cliente_id = 'Elige un cliente.'
  if (plan_id === '' || plan_id == null) e.plan_id = 'Elige un plan.'
  if (fecha_alta && !/^\d{4}-\d{2}-\d{2}$/.test(fecha_alta)) e.fecha_alta = 'La fecha de inicio no es válida.'
  return e
}

export function validarPerfil({ nombre, whatsapp }) {
  const e = {}
  if (vacio(nombre)) e.nombre = 'Escribe el nombre de tu negocio.'
  const w = (whatsapp ?? '').trim()
  if (w !== '' && !/^\d{8,15}$/.test(w)) e.whatsapp = 'Escribe solo dígitos, con código de país (8 a 15).'
  return e
}
```

`src/lib/formularios.js`:
```js
// Accesibilidad de errores: tras validar, el foco va al primer campo inválido y el lector de pantalla
// anuncia su error por aria-describedby.
export function primerInvalido(contenedor) {
  return contenedor?.querySelector('[aria-invalid="true"]') ?? null
}

export function enfocarPrimerInvalido(contenedor) {
  const el = primerInvalido(contenedor)
  if (!el) return false
  el.focus()
  return true
}
```

`src/lib/formato.js`: añadir al final
```js
// 'AAAA-MM-DD' (con o sin hora) -> 'DD/MM/AAAA', sin pasar por Date para evitar desfases de zona horaria
export const fmtFecha = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(typeof iso === 'string' ? iso : '')
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}
```

`src/lib/toastStore.js`: sustituir el cuerpo de `mostrar` y añadir pausa. El archivo final queda así:
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

  const programarCierre = (t) => {
    temporizadores.set(t.id, programar(() => cerrar(t.id), t.tipo === 'error' ? duracion * 2 : duracion))
  }

  const mostrar = (mensaje, tipo = 'info') => {
    if (items.length >= MAX_VISIBLES) cerrar(items[0].id)
    const id = siguiente++
    const t = { id, mensaje, tipo }
    items = [...items, t]
    programarCierre(t)
    avisar()
    return id
  }

  // Mientras el puntero o el foco están sobre los avisos, no se cierran solos (WCAG 2.2.1)
  const pausar = () => {
    temporizadores.forEach((tm) => cancelar(tm))
    temporizadores.clear()
  }

  const reanudar = () => {
    items.forEach((t) => { if (!temporizadores.has(t.id)) programarCierre(t) })
  }

  const subscribe = (fn) => {
    oyentes.add(fn)
    return () => { oyentes.delete(fn) }
  }

  return { mostrar, cerrar, pausar, reanudar, subscribe, getSnapshot: () => items }
}
```

- [ ] **Step 4: Verificar**

Run: `npm test`
Expected: PASS, todas las suites (colorTema, toastStore, focoDialog, validaciones, formularios, formato).

- [ ] **Step 5: Commit**

```bash
git add sgcrc-frontend-export/src/lib
git commit -m "feat(frontend): validaciones, foco al primer error, fmtFecha y pausa de toasts con pruebas"
```

---

### Task 2: Ajustes de componentes y clases CSS compartidas

**Files:**
- Modify: `src/ui/Field.jsx`, `src/ui/EmptyState.jsx`, `src/ui/Badge.jsx`, `src/ui/Toast.jsx`, `src/ui/Dialog.jsx`, `src/styles/ui.css`
- Create: `src/ui/PageHeader.jsx`

**Interfaces:**
- Consumes: `toast` store de Task 1 (`pausar`/`reanudar` en `crearTostadas`).
- Produces:
  - `Field`: el `aria-describedby` pasado por el llamador se fusiona con los ids de ayuda y error (ya no los pisa).
  - `EmptyState({ icono, titulo, nivel = 3, children, accion })`: `nivel` elige `h2`..`h6`.
  - `Badge`: un `tono` desconocido cae a `'warn'`.
  - `ToastRegion`: pausa los cierres con puntero o foco dentro de la región.
  - `Dialog`: si el elemento previo ya no está en el documento al cerrar, el foco va a `#contenido` (si existe).
  - `PageHeader({ titulo: string, descripcion?: string, acciones?: ReactNode })` (`export default`), renderiza el `h1` de la página.
  - Clases CSS: `.pagina`, `.pagina-cab`, `.pagina-titulo`, `.pagina-desc`, `.panel`, `.panel-titulo`, `.form-grid`, `.form-acciones`, `.check`, `.herramientas`, `.tabla-wrap`, `.tabla` (`th`, `td`, `.num`, `.acciones`), `.celda-nota`.

- [ ] **Step 1: `Field.jsx` fusiona `aria-describedby`**

Reemplazar la función por esta versión (se extrae `aria-describedby` de `resto`):
```jsx
export default function Field({ label, ayuda, error, requerido = false, as: Control = 'input', id, className = '', 'aria-describedby': describedbyExtra, ...resto }) {
  const autoId = useId()
  const idCampo = id || autoId
  const idAyuda = ayuda ? `${idCampo}-ayuda` : null
  const idError = error ? `${idCampo}-error` : null
  const descrito = [describedbyExtra, idAyuda, idError].filter(Boolean).join(' ') || undefined
```
El resto del JSX no cambia (`aria-describedby={descrito}` antes de `{...resto}`).

- [ ] **Step 2: `EmptyState` con `nivel`**

```jsx
export default function EmptyState({ icono = 'tag', titulo, nivel = 3, children, accion }) {
  const Titulo = `h${Math.min(6, Math.max(2, nivel))}`
  return (
    <div className="vacio">
      <Icon name={icono} size={36} />
      <Titulo className="vacio-titulo">{titulo}</Titulo>
      {children && <p className="vacio-texto">{children}</p>}
      {accion && <div className="vacio-accion">{accion}</div>}
    </div>
  )
}
```

- [ ] **Step 3: `Badge` con tono de respaldo**

```jsx
const TONOS = ['ok', 'warn', 'bad', 'info']

export default function Badge({ tono = 'warn', icono, children }) {
  const t = TONOS.includes(tono) ? tono : 'warn'
  return (
    <span className={`badge badge-${t}`}>
```
(el resto igual).

- [ ] **Step 4: Pausa de toasts en `Toast.jsx`**

Añadir a `toast` los métodos internos expuestos solo al módulo: dentro de `ToastRegion`, en el `div.toast-region`:
```jsx
    <div
      className="toast-region"
      aria-live="polite"
      aria-relevant="additions"
      onMouseEnter={tostadas.pausar}
      onMouseLeave={tostadas.reanudar}
      onFocus={tostadas.pausar}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) tostadas.reanudar() }}
    >
```

- [ ] **Step 5: Foco de respaldo en `Dialog.jsx`**

En la limpieza del efecto principal, reemplazar la línea `if (previo && typeof previo.focus === 'function') previo.focus()` por:
```jsx
      if (previo && document.contains(previo) && typeof previo.focus === 'function') previo.focus()
      else document.getElementById('contenido')?.focus()
```

- [ ] **Step 6: `PageHeader.jsx`**

```jsx
// Encabezado de página: el único h1 de cada vista.
export default function PageHeader({ titulo, descripcion, acciones }) {
  return (
    <div className="pagina-cab">
      <div>
        <h1 className="pagina-titulo">{titulo}</h1>
        {descripcion && <p className="pagina-desc">{descripcion}</p>}
      </div>
      {acciones && <div className="pagina-acciones">{acciones}</div>}
    </div>
  )
}
```

- [ ] **Step 7: Clases compartidas al final de `src/styles/ui.css`**

```css
/* ---------- Estructura de página ---------- */
.pagina { display: grid; gap: 1.25rem; }
.pagina-cab { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 0.75rem; }
.pagina-titulo { margin: 0; font-size: 1.75rem; line-height: 1.2; }
.pagina-desc { margin: 0.25rem 0 0; color: var(--ink-2); }

.panel { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 1.25rem; }
.panel-titulo { margin: 0 0 1rem; font-size: 1.125rem; }

.form-grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); align-items: start; }
.form-acciones { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1rem; }
.check {
  display: inline-flex; align-items: center; gap: 0.6rem; min-height: 2.75rem;
  font-weight: 600; cursor: pointer;
}
.check input { width: 1.25rem; height: 1.25rem; accent-color: var(--color-primario); }
.herramientas { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 0.75rem; }
.herramientas .field { flex: 1; min-width: 14rem; }

/* ---------- Tabla ---------- */
.tabla-wrap { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; overflow-x: auto; }
.tabla { width: 100%; border-collapse: collapse; }
.tabla th {
  padding: 0.75rem 1rem; text-align: left; white-space: nowrap;
  font-size: 0.8125rem; font-weight: 600; color: var(--ink-2);
  background: var(--surface-alt); border-bottom: 1px solid var(--line);
}
.tabla td { padding: 0.85rem 1rem; vertical-align: middle; border-bottom: 1px solid var(--line); }
.tabla tbody tr:last-child td { border-bottom: 0; }
.tabla th.num, .tabla td.num { text-align: right; font-variant-numeric: tabular-nums; }
.tabla th.acciones, .tabla td.acciones { text-align: right; white-space: nowrap; }
.tabla td.acciones > * + * { margin-left: 0.5rem; }
.celda-nota { display: block; font-size: 0.8125rem; color: var(--ink-2); }
```

- [ ] **Step 8: Verificar y commit**

Run: `npm test` y `npm run build` (sin errores).
```bash
git add sgcrc-frontend-export/src/ui sgcrc-frontend-export/src/styles/ui.css
git commit -m "feat(frontend): PageHeader, clases de página/tabla/formulario y ajustes diferidos de la Fase 2"
```

---

### Task 3: Shell (sidebar clara, cabecera móvil, salto al contenido) y encabezados de las vistas ya migradas

**Files:**
- Create: `src/styles/shell.css`
- Modify: `src/main.jsx` (importar `./styles/shell.css` tras `ui.css`), `src/App.jsx`, `src/views/Dashboard.jsx`, `src/views/Historial.jsx`, `src/views/Calendario.jsx`

**Interfaces:**
- Consumes: `PageHeader`, `Icon`, `Logo`, `Button`, estado `session`/`backendOk`/`view` existentes en `App.jsx`.
- Produces: `main#contenido` con `tabIndex={-1}` (destino del foco de respaldo del `Dialog` y del enlace "Saltar al contenido"); cada vista tiene un único `h1` (el shell no usa `h1`).

- [ ] **Step 1: `src/styles/shell.css`**

```css
/* Shell de la aplicación: sidebar clara en escritorio, barra superior y navegación en móvil. */
.saltar {
  position: absolute; left: 0.75rem; top: -4rem; z-index: 70;
  padding: 0.6rem 1rem; border-radius: 6px;
  background: var(--ink); color: var(--surface); font-weight: 600; text-decoration: none;
}
.saltar:focus { top: 0.75rem; }

.shell { min-height: 100vh; display: flex; }

.lateral {
  display: none; flex-direction: column; gap: 0.25rem;
  width: 16rem; flex-shrink: 0; height: 100vh; position: sticky; top: 0;
  padding: 1.25rem 1rem;
  background: var(--surface); border-right: 1px solid var(--line);
}
@media (min-width: 768px) { .lateral { display: flex; } }

.marca { display: flex; align-items: center; gap: 0.6rem; font-family: var(--font-display); font-size: 1.375rem; font-weight: 600; color: var(--ink); }
.marca svg { color: var(--color-primario); }
.lateral .marca { padding: 0.25rem 0.5rem 1rem; }

.empresa { margin: 0 0.5rem 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--line); font-size: 0.875rem; color: var(--ink-2); }
.empresa strong { display: block; font-size: 1rem; color: var(--ink); overflow-wrap: anywhere; }

.nav { display: flex; flex-direction: column; gap: 0.125rem; }
.nav-item {
  position: relative; display: flex; align-items: center; gap: 0.75rem;
  width: 100%; min-height: 2.75rem; padding: 0.5rem 0.75rem 0.5rem 1rem;
  border: 0; border-radius: 6px; background: transparent;
  font: inherit; font-weight: 500; text-align: left; color: var(--ink-2); cursor: pointer;
  transition: background-color 140ms ease, color 140ms ease;
}
.nav-item:hover { background: var(--surface-alt); color: var(--ink); }
.nav-item[aria-current="page"] { background: var(--surface-alt); color: var(--ink); font-weight: 600; }
.nav-item[aria-current="page"]::before {
  content: ""; position: absolute; left: 0; top: 0.4rem; bottom: 0.4rem;
  width: 3px; border-radius: 2px; background: var(--color-primario);
}
.nav-item[aria-current="page"] svg { color: var(--color-primario); }

.lateral-pie { margin-top: auto; display: grid; gap: 0.5rem; padding-top: 1rem; border-top: 1px solid var(--line); }
.estado-server { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0 0.5rem; font-size: 0.8125rem; color: var(--ink-2); }
.estado-server i { width: 0.5rem; height: 0.5rem; border-radius: 50%; background: var(--ink-2); }
.estado-server[data-ok="true"] i { background: var(--ok); }
.estado-server[data-ok="false"] i { background: var(--bad); }

.contenido { flex: 1; min-width: 0; padding: 1rem; }
.contenido:focus { outline: none; }
@media (min-width: 768px) { .contenido { padding: 2rem 2.5rem; } }

/* Móvil: barra superior y navegación en fila (la barra inferior llega en la Fase 5) */
.barra-movil { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.75rem; }
.barra-movil .marca { font-size: 1.25rem; }
.nav-movil { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.25rem; }
.nav-movil .nav-item { width: auto; padding-left: 0.75rem; border: 1px solid var(--line); background: var(--surface); }
.nav-movil .nav-item[aria-current="page"] { border-color: var(--ink); }
.nav-movil .nav-item[aria-current="page"]::before { display: none; }
@media (min-width: 768px) { .barra-movil, .nav-movil { display: none; } }
```

- [ ] **Step 2: Reescribir el `return` de `src/App.jsx`**

Dejar intactos los hooks, `handleLogout`, `VIEWS` y el bloque de `Login`. Importar `Button` (`./ui/Button.jsx`). Reemplazar `activeStyle` y todo el JSX final por:

```jsx
  const estadoTexto = backendOk === null ? 'Comprobando servidor…' : backendOk ? 'Servidor conectado' : 'Sin conexión con el servidor'
  const nombreEmpresa = session.user?.nombre || 'Mi negocio'

  const items = (clase) => NAV.map((n) => (
    <button
      key={n.id}
      type="button"
      className="nav-item"
      aria-current={view === n.id ? 'page' : undefined}
      onClick={() => setView(n.id)}
    >
      <Icon name={n.icon} size={20} />
      {n.label}
    </button>
  ))

  return (
    <div className="shell">
      <a className="saltar" href="#contenido">Saltar al contenido</a>

      <aside className="lateral">
        <div className="marca"><Logo size={30} /><span>SGCRC</span></div>
        <p className="empresa">Empresa<strong>{nombreEmpresa}</strong></p>
        <nav className="nav" aria-label="Principal">{items()}</nav>
        <div className="lateral-pie">
          <span className="estado-server" data-ok={backendOk === null ? undefined : String(backendOk)} role="status">
            <i aria-hidden="true" />{estadoTexto}
          </span>
          <Button variante="secundario" icono="sign-out" onClick={handleLogout}>Salir</Button>
        </div>
      </aside>

      <main id="contenido" className="contenido" tabIndex={-1}>
        <div className="barra-movil">
          <div className="marca"><Logo size={26} /><span>SGCRC</span></div>
          <Button variante="secundario" tam="sm" icono="sign-out" onClick={handleLogout}>Salir</Button>
        </div>
        <nav className="nav-movil" aria-label="Principal">{items()}</nav>
        {VIEWS[view]}
      </main>
    </div>
  )
```
(la función `items` no necesita el parámetro `clase`: quitarlo). Eliminar el import y uso de `style` de Logo si ya no hace falta (el color lo da `.marca svg`). Quitar los comentarios obsoletos ("IMPORTANTE: Importar tu nueva vista", "Añadido configuración"). `Logo` debe usar `currentColor` (ya lo hace).

- [ ] **Step 3: Encabezados de Dashboard, Historial y Calendario**

En cada una de las tres vistas, localizar el `<h2 ...>` del título de la página (y el párrafo descriptivo contiguo, si existe) y sustituirlo por `<PageHeader titulo="..." descripcion="..." acciones={...} />` conservando exactamente el texto del título, la descripción y las acciones que ya tenía (por ejemplo, el botón "Forzar Cobros de Hoy" del Dashboard pasa a `acciones`; en Historial el grupo de filtros y "Actualizar" NO se mueve: solo el título). Importar `PageHeader` desde `../ui/PageHeader.jsx`. No tocar nada más de esas vistas (su rediseño es de las Fases 5 y 6). Si una vista tiene más de un `h2` de título de página, solo cambia el primero.

- [ ] **Step 4: Verificar y commit**

Run: `npm test`, `npm run build` y `grep -rn "animate-in\|slate-900" src/App.jsx` (sin resultados).
```bash
git add sgcrc-frontend-export/src
git commit -m "feat(frontend): shell con sidebar clara, aria-current, salto al contenido y PageHeader en las vistas ya migradas"
```

---

### Task 4: Vista Clientes

**Files:**
- Modify (reescribir): `src/views/Clientes.jsx`

**Interfaces:**
- Consumes: `api.getClientes()`, `api.getSuscripciones()`, `api.createCliente(data)`, `api.updateCliente(id, data)`, `api.deleteCliente(id)`; `PageHeader`, `Field`, `Button`, `ConfirmDialog`, `EmptyState`, `ErrorMsg`, `Skeleton`, `toast`; `validarCliente`, `enfocarPrimerInvalido`.

**Contrato de comportamiento (el implementador compone el JSX con las clases de Task 2):**

- Estado: `clientes`, `subs`, `cargando` (true al inicio), `errorCarga`, `form {nombre, correo}`, `errores {}`, `editando` (cliente o null), `guardando`, `busqueda`, `aEliminar` (cliente o null), `eliminando`. `cargar()` trae clientes y suscripciones con `Promise.all`; el conteo de suscripciones activas por cliente se calcula con `useMemo` como hoy.
- Estructura: `<div className="pagina">` con `PageHeader titulo="Clientes" descripcion="Las personas o negocios a los que les cobras."`; luego un `<section className="panel">` con `h2.panel-titulo` ("Nuevo cliente" o `Editar a ${editando.nombre}`) y un `<form ref={formRef} noValidate onSubmit={guardar}>` que contiene un `div.form-grid` con dos `Field`: Nombre (`id="cliente-nombre"`, `requerido`, `autoComplete="off"`, `maxLength={120}`) y Correo (`id="cliente-correo"`, `type="email"`, `inputMode="email"`, `requerido`, `autoComplete="off"`), cada uno con su `error={errores.x}`; y un `div.form-acciones` con `Button type="submit" cargando={guardando} icono={editando ? 'check' : 'plus'}` ("Crear cliente" / "Guardar cambios") y, solo editando, `Button variante="secundario"` "Cancelar" que limpia el formulario.
- `guardar(e)`: `preventDefault`; `validarCliente(form)`; si hay errores, `setErrores` y tras el render enfocar el primer inválido (`requestAnimationFrame(() => enfocarPrimerInvalido(formRef.current))`); si no, `setGuardando(true)`, llamar a `api.createCliente({nombre: form.nombre.trim(), correo: form.correo.trim()})` o `api.updateCliente(editando.id, {...})` (SIN `usuario_id`), `toast.exito('Cliente creado.' | 'Cliente actualizado.')`, limpiar form/errores/editando, `await cargar()`; en `catch`, `toast.error(e.message)`; `finally` `setGuardando(false)`. Al escribir en un campo se borra su error.
- Lista: si `cargando` → `<Skeleton />`; si `errorCarga` → `<ErrorMsg msg onRetry={cargar} />`. Con datos: barra `div.herramientas` con un `Field label="Buscar" type="search" id="cliente-buscar" placeholder="Nombre o correo"` que filtra `nombre`/`correo` (sin distinguir mayúsculas); luego `div.tabla-wrap > table.tabla` con `<caption className="sr-only">Lista de clientes</caption>`, `th scope="col"` Nombre, Correo, "Suscripciones activas" (`.num`), "Acciones" (`.acciones`), y cada `td` con `data-label` igual al encabezado. Acciones por fila: `Button variante="secundario" tam="sm" icono="pencil-simple" aria-label={`Editar a ${c.nombre}`}` (texto visible "Editar"; carga el formulario, limpia errores, enfoca `#cliente-nombre` y hace `scrollIntoView({block:'nearest'})`) y `Button variante="peligro" tam="sm" icono="trash" aria-label={`Eliminar a ${c.nombre}`}` (texto "Eliminar"; abre el diálogo).
- Vacíos: sin clientes → `EmptyState icono="users" nivel={2} titulo="Aún no tienes clientes"` con texto "Agrega el primero con el formulario de arriba." y acción `Button icono="plus"` "Agregar cliente" que enfoca `#cliente-nombre`. Búsqueda sin resultados → `EmptyState icono="magnifying-glass" nivel={2} titulo="Sin resultados"` con `Ningún cliente coincide con «${busqueda}».`.
- Eliminar: `ConfirmDialog abierto={aEliminar !== null} titulo="Eliminar cliente" peligro textoConfirmar="Eliminar" cargando={eliminando}` con el mensaje `¿Eliminar a ${aEliminar.nombre}? Esta acción no se puede deshacer.` (proteger el acceso a `aEliminar` nulo). Al confirmar: `api.deleteCliente`, `toast.exito('Cliente eliminado.')`, si era el que se edita limpiar el formulario, `cargar()`; error (p. ej. el backend rechaza si tiene suscripciones) → `toast.error(e.message)`; en ambos casos se cierra el diálogo.
- Sin `window.confirm`, sin clases de Tailwind, sin `style` con colores.

- [ ] **Step 1:** Reescribir `Clientes.jsx` según el contrato.
- [ ] **Step 2:** Verificar: `npm run build`, `grep -n "confirm(\|alert(\|usuario_id\|className=\"[^\"]*\\b\\(bg-\\|text-\\|px-\\|py-\\|rounded\\)" src/views/Clientes.jsx` sin resultados.
- [ ] **Step 3:** Commit `feat(frontend): vista Clientes con formulario accesible, búsqueda y confirmación de borrado`.

---

### Task 5: Vista Planes

**Files:**
- Modify (reescribir): `src/views/Planes.jsx`

**Interfaces:**
- Consumes: `api.getPlanes()`, `api.createPlan(data)`, `api.updatePlan(id, data)`, `api.deletePlan(id)`; los mismos componentes que Task 4; `validarPlan`, `enfocarPrimerInvalido`, `fmt`.

**Contrato de comportamiento:**

- Mismo patrón que Task 4 (estado de carga/error/guardado/eliminación, `Skeleton`, `ErrorMsg`, `toast`, `ConfirmDialog`, foco al primer error, `noValidate`). Estado del formulario inicial `{ nombre_plan: '', monto: '', frecuencia: 'mensual', dia_cobro: 1 }` (sin `descripcion`).
- `PageHeader titulo="Planes" descripcion="Lo que cobras y cada cuánto: tus planes se asignan a los clientes como suscripciones."`. (El título pasa de "Catálogo de Planes" a "Planes", como dice la terminología del producto; el ítem del menú en `App.jsx` conserva su etiqueta actual salvo que el implementador lo cambie también a "Planes": hacerlo, para que coincidan.)
- Campos (`form-grid`): Nombre del plan (`id="plan-nombre"`, requerido, `maxLength 120`, `placeholder="Ej.: Plan Oro"`), Precio en COP (`id="plan-monto"`, `type="text" inputMode="decimal"`, requerido, `ayuda="Solo números, sin puntos ni signos."`), Frecuencia (`as="select"` con opciones Semanal/Quincenal/Mensual/Anual con valores `semanal|quincenal|mensual|anual`), Día de cobro (`type="number" min=1 max=31`, `ayuda="Día del mes en que se genera el cobro."`).
- `guardar`: valida con `validarPlan`; payload `{ nombre_plan: trim, monto: Number(form.monto), frecuencia, dia_cobro: Number(form.dia_cobro) }`; crear o `updatePlan(editando.id, payload)`; toasts "Plan creado." / "Plan actualizado."
- Tabla: caption "Lista de planes"; columnas Nombre del plan (con `span.celda-nota` mostrando la frecuencia en minúscula capitalizada), Precio (`fmt`, `.num`), Día de cobro (`Día ${n}`), Acciones (Editar / Eliminar con `aria-label` que incluye el nombre). Editar carga `{ nombre_plan, monto: String(monto), frecuencia, dia_cobro }` en el formulario (no reutilizar la fila completa) y enfoca `#plan-nombre`.
- Eliminar: `ConfirmDialog` "Eliminar plan" con el mensaje `¿Eliminar el plan ${nombre}? Solo se puede eliminar si ninguna suscripción lo usa.`; el error del backend se muestra con `toast.error`.
- Vacío: `EmptyState icono="tag" nivel={2} titulo="Aún no tienes planes"` con acción "Crear mi primer plan" que enfoca `#plan-nombre`.
- Sin Tailwind, sin colores hardcodeados.

- [ ] **Step 1:** Reescribir `Planes.jsx`. Actualizar la etiqueta del ítem `planes` en `NAV` de `App.jsx` a "Planes".
- [ ] **Step 2:** Verificar: `npm run build`; grep de `confirm(`, `alert(` y clases de Tailwind sin resultados en `Planes.jsx`.
- [ ] **Step 3:** Commit `feat(frontend): vista Planes con validación en línea y confirmación de borrado`.

---

### Task 6: Vista Suscripciones

**Files:**
- Modify (reescribir): `src/views/Suscripciones.jsx`

**Interfaces:**
- Consumes: `api.getSuscripciones()`, `api.getClientes()`, `api.getPlanes()`, `api.createSuscripcion(data)`, `api.updateSuscripcion(id, data)`, `api.deleteSuscripcion(id)`; componentes de Task 4; `EstadoBadge`; `validarSuscripcion`, `enfocarPrimerInvalido`, `fmt`, `fmtFecha`.

**Contrato de comportamiento:**

- Mismo patrón que Task 4. Formulario inicial `{ cliente_id: '', plan_id: '', activa: true, descripcion: '', fecha_alta: hoy }` con `hoy` = fecha local `AAAA-MM-DD` calculada al montar (no `toISOString`, que desfasa por zona horaria: usar `new Date()` con `getFullYear/getMonth/getDate`).
- `PageHeader titulo="Suscripciones" descripcion="Qué plan paga cada cliente y desde cuándo."`.
- Campos: Cliente (`as="select"`, opción vacía "Elige un cliente", `id="sub-cliente"`, requerido), Plan (`as="select"`, opción vacía "Elige un plan", opciones `${nombre_plan} · ${fmt(monto)}`), Fecha de inicio (`type="date"`, `ayuda="Define el día en que se repite el cobro."`), Nota (`id="sub-nota"`, opcional, `maxLength 500`, `placeholder="Ej.: ubicación, tipo de servicio"`), y casilla "Suscripción activa" con `label.check > input[type=checkbox] + texto`. Si no hay clientes o no hay planes, en lugar del formulario el panel muestra `EmptyState` (`nivel={2}`) que explica qué falta crear primero ("Primero crea un cliente en Clientes" / "Primero crea un plan en Planes") sin enlaces de navegación.
- `guardar`: valida con `validarSuscripcion`; payload `{ cliente_id: Number, plan_id: Number, activa: !!form.activa, descripcion: form.descripcion.trim(), fecha_alta: form.fecha_alta }`; toasts "Suscripción creada." / "Suscripción actualizada." Editar carga `{ cliente_id: String(s.cliente_id), plan_id: String(s.plan_id), activa: !!s.activa, descripcion: s.descripcion || '', fecha_alta: (s.fecha_alta || hoy).slice(0, 10) }`.
- Barra `herramientas` sobre la tabla: botones de filtro Todas / Activas / Inactivas (`Button tam="sm"`, `variante` primario el seleccionado y secundario los demás, `aria-pressed`) y un `Field` de búsqueda por nombre de cliente o nota.
- Tabla: caption "Lista de suscripciones"; columnas Cliente (nombre + `span.celda-nota` con la nota o "Sin nota"), Plan (`s.tipo` y debajo `span.celda-nota` con la frecuencia), Inicio (`fmtFecha(s.fecha_alta)`), Monto (`fmt(s.monto)`, `.num`), Estado (`EstadoBadge estado={s.activa ? 'Activa' : 'Inactiva'}`), Acciones (Editar / Eliminar con `aria-label` que incluye el nombre del cliente). El nombre del cliente se resuelve con `clientes.find(c => c.id === s.cliente_id)?.nombre || 'Cliente eliminado'`.
- Eliminar: `ConfirmDialog` "Eliminar suscripción" con `¿Eliminar la suscripción de ${nombreCliente}? Dejará de recibir recordatorios de cobro.`
- Vacíos: sin suscripciones → `EmptyState icono="arrows-clockwise" nivel={2} titulo="Aún no hay suscripciones"`; filtro/búsqueda sin resultados → `EmptyState` "Sin resultados".
- Sin Tailwind, sin colores hardcodeados.

- [ ] **Step 1:** Reescribir `Suscripciones.jsx`.
- [ ] **Step 2:** Verificar: `npm run build`; grep de `confirm(`, `alert(`, `toISOString` y clases de Tailwind sin resultados en el archivo.
- [ ] **Step 3:** Commit `feat(frontend): vista Suscripciones con filtros, fecha local y confirmación de borrado`.

---

### Task 7: Login y registro

**Files:**
- Modify (reescribir): `src/views/Login.jsx`
- Modify: `src/styles/shell.css` (clases `.acceso*` al final)

**Interfaces:**
- Consumes: `Field`, `Button`, `ErrorMsg`, `Logo`, `toast`, `enfocarPrimerInvalido`; la prop `onLogin(data)`; `import.meta.env.VITE_API_URL || '/api'`.

**Contrato de comportamiento:**

- Estructura: `<main className="acceso">` (fondo `--surface-page`, centrado, `min-height: 100vh`, padding 1rem) con `<div className="acceso-tarjeta panel">` (ancho máx. 26rem): marca (`Logo` + "SGCRC" con `.marca`), `h1.acceso-titulo` ("Entra a tu cuenta" / "Crea tu cuenta"), párrafo `.pagina-desc` ("Recordatorios de cobro por correo, sin perseguir pagos." al entrar; "Registra tu negocio para empezar a cobrar." al registrarse), un `ErrorMsg` (sin `onRetry`) con el error del servidor si existe, el formulario y, al final, un `Button variante="secundario"` que alterna entre entrar y registrarse ("¿No tienes cuenta? Regístrate" / "¿Ya tienes cuenta? Inicia sesión"). Clases nuevas `.acceso`, `.acceso-tarjeta`, `.acceso-titulo` en `shell.css` usando solo tokens (sin sombra salvo un borde de 1 px).
- Formulario `noValidate onSubmit`: campos `Field` — Nombre del negocio (solo al registrarse; `autoComplete="organization"`), Correo (`type="email" inputMode="email" autoComplete="username"`), Contraseña (`type={ver ? 'text' : 'password'}`, `autoComplete={isRegister ? 'new-password' : 'current-password'}`), y debajo una casilla `label.check` "Mostrar contraseña" que controla `ver`. Validación cliente mínima: nombre obligatorio al registrarse, correo con `@`, contraseña no vacía (sin política de contraseña: el backend no la tiene y es una decisión abierta). Errores en línea con `Field` y foco al primer inválido.
- El botón principal es `Button type="submit" cargando={loading}` con texto "Entrar" / "Crear cuenta" (a ancho completo con `style={{ width: '100%' }}` o una clase `.acceso-tarjeta .btn { width: 100% }` en `shell.css`).
- Envío: igual que hoy (`fetch` a `${API_URL}/auth/login|register`, lectura del cuerpo como texto y `JSON.parse` solo si hay texto, mensaje claro si `Failed to fetch`: "No se pudo conectar con el servidor. ¿Está encendido el backend?"). Si el cuerpo no es JSON válido, no debe lanzar un error de parseo críptico: capturarlo y mostrar "Respuesta inesperada del servidor.".
- Registro correcto: `toast.exito('Cuenta creada. Ahora puedes iniciar sesión.')` (reemplaza `alert`), pasa a modo entrar y limpia la contraseña. Login correcto: llamar a `onLogin(data)` y NADA MÁS (se eliminan las líneas `localStorage.setItem('token'...)` y `('user'...)`: `App.jsx` guarda la sesión en `sgcrc_session`). Antes de borrarlas, comprobar con `grep -rn "getItem('token')\|getItem(\"token\")\|getItem('user')" src` que nada más las lee.
- Sin `animate-pulse`, sin borde lateral en el error, sin clases de Tailwind, fuente de la interfaz (IBM Plex) heredada del `body`.

- [ ] **Step 1:** Reescribir `Login.jsx` y añadir las clases a `shell.css`.
- [ ] **Step 2:** Verificar: `npm run build`; grep de `alert(`, `animate-`, `localStorage.setItem('token'` y clases de Tailwind sin resultados en `Login.jsx`.
- [ ] **Step 3:** Commit `feat(frontend): Login y registro accesibles con tokens del tema`.

---

### Task 8: Configuración

**Files:**
- Modify (reescribir): `src/views/Configuracion.jsx`
- Modify: `src/lib/colorTema.js` (solo si hace falta exportar `ratioContraste`/`textoSobre`; ya están exportados) y `src/styles/ui.css` (clases `.color-fila`, `.vista-previa`)

**Interfaces:**
- Consumes: `api.getPerfil()`, `api.updatePerfil(data)`; `PageHeader`, `Field`, `Button`, `Badge`, `ErrorMsg`, `Skeleton`, `toast`; `validarPerfil`, `enfocarPrimerInvalido`; `aplicarColorTema`, `COLOR_POR_DEFECTO`, `ratioContraste`, `textoSobre`, `parseHex` de `lib/colorTema.js`.

**Contrato de comportamiento:**

- Estado: `perfil {nombre, color_tema, whatsapp}` cargado con `api.getPerfil()` (con `Skeleton` mientras carga y `ErrorMsg` con reintento si falla; hoy un fallo rompe la vista), `errores`, `guardando`.
- `PageHeader titulo="Configuración" descripcion="El nombre, el color y el WhatsApp que ven tus clientes en los correos."`.
- Un solo `form noValidate onSubmit` dentro de un `section.panel` con: `Field` Nombre de tu negocio (`id="cfg-nombre"`, requerido, `autoComplete="organization"`); bloque de color con `label htmlFor="cfg-color"` "Color de tu marca", `input type="color" id="cfg-color"` (44 px de alto mínimo) y el valor hexadecimal en texto (`.tabular`); texto de ayuda "Se usa en los botones de tus correos y en esta aplicación."; y `Field` WhatsApp (`type="tel" inputMode="numeric" autoComplete="tel"`, `placeholder="573001234567"`, `ayuda="Con código de país, sin signos. Si lo dejas vacío, tus correos no llevan el botón de WhatsApp."`).
- Contraste del color elegido: calcular `ratio = ratioContraste(color, textoSobre(color))` y mostrar bajo el selector una línea con `Badge` — `tono="ok"` icono `check-circle` "Contraste suficiente (X:1)" si `ratio >= 4.5`, o `tono="warn"` icono `warning` "Contraste bajo (X:1): el texto de los botones se leerá mal. Prueba un tono más oscuro o más claro." (X con un decimal, coma decimal). Esta línea está en una región `aria-live="polite"`.
- Vista previa en vivo, SIN cambiar toda la aplicación hasta guardar: un `div.vista-previa` con `ref` al que, en un `useEffect` sobre `perfil.color_tema`, se le aplica `aplicarColorTema(ref.current, perfil.color_tema)`; dentro, un `Button` primario "Reportar pago por WhatsApp" y el rótulo "Así se ve el botón de tus correos". `.vista-previa` y `.color-fila` en `ui.css` solo con tokens.
- Guardar: `validarPerfil`; payload `{ nombre: trim, color_tema, whatsapp: trim }`; `api.updatePerfil(payload)`; al éxito `aplicarColorTema(document.documentElement, color_tema)` y `toast.exito('Configuración guardada.')`; en error `toast.error(e.response?.data?.error || e.message || 'No se pudo guardar.')`. Botón `Button type="submit" cargando={guardando} icono="check"` "Guardar cambios".
- Sin Tailwind, sin colores hardcodeados, sin el texto "Recarga para ver los cambios".

- [ ] **Step 1:** Reescribir `Configuracion.jsx` y añadir las clases a `ui.css`.
- [ ] **Step 2:** Verificar: `npm test`, `npm run build`; grep de `text-white`, `bg-brand`, `hover-brand` y clases de Tailwind sin resultados en el archivo.
- [ ] **Step 3:** Commit `feat(frontend): Configuración con contraste validado y vista previa en vivo acotada`.

---

### Task 9: Documentación del frontend

**Files:**
- Modify: `sgcrc-frontend-export/CLAUDE.md`

- [ ] **Step 1:** Actualizar la tabla de `src/` (filas de `lib/` con `validaciones.js`, `formularios.js`; fila de `styles/` con `shell.css`; `ui/PageHeader.jsx`), la sección "Componentes base" (patrón de formulario: `Field` + `validar*` + foco al primer error + `toast`/`ConfirmDialog`; clases `.pagina`, `.panel`, `.form-grid`, `.tabla`) y la sección "Theming" (la vista previa de Configuración usa `aplicarColorTema` sobre un elemento, no sobre `documentElement`). Marcar que Dashboard, Historial y Calendario conservan estilos antiguos hasta las Fases 5-6 y que el shell ya no usa Tailwind.
- [ ] **Step 2:** `npm test` y `npm run build`; commit `docs(frontend): documenta shell, formularios y componentes de la Fase 3`.
