# Rediseño Fase 7 (pulido y deuda técnica) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar la deuda diferida de las Fases 4-6: hook de carga único (con foco correcto al reintentar), errores de red distinguibles de errores de programación, color de marca por defecto único, estados de envío reales en el Calendario, días "de hoy" según Bogotá, y retirar Tailwind CDN sin romper el aspecto.

**Architecture:** La lógica nueva va en módulos puros de `src/lib/` con pruebas `node --test`; el hook `useCarga` es una capa fina de React sobre un reducer puro (`lib/carga.js`). Las 7 vistas con el patrón `cargar/reintentar/hayDatos` migran a ese hook. El backend solo cambia en el color por defecto (constante única en `backend/perfil.js`).

**Tech Stack:** React 18, Vite 7, `node --test` (frontend: `cd sgcrc-frontend-export && npm test`), backend Node `http` + better-sqlite3 (`cd backend && npm run test:unit`).

## Global Constraints

- Idioma: toda cadena visible, comentario y mensaje de commit en español con tildes correctas. Sin emojis.
- Sin Tailwind en código nuevo; colores solo con variables CSS (`--color-primario`, tokens de `tokens.css`).
- `fetch` en `src/api.js`; no usar `axios`.
- Las vistas siguen el patrón de `Clientes.jsx`: `toast.exito/error`, `ConfirmDialog`, `Field`, `mensajeError(e)` (nunca `err.message` directo).
- Cada vista tiene un único `h1` vía `PageHeader` (el `h1` lleva `tabIndex={-1}`).
- Toda tabla nueva lleva `data-label` en las celdas y `role` explícitos (Fase 5). Objetivos táctiles >= 44 px en móvil.
- Multi-tenant en backend: este plan no toca rutas ni consultas de datos.
- Commits en la rama `develop`, sin push ni merge. Cada commit termina con la línea `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Al probar en navegador NO pulsar "Enviar" en el Dashboard (envía correos reales).
- Para verificar visualmente: backend con secreto temporal en variable de entorno (`$env:JWT_SECRET='temporal-local'` en PowerShell, sin tocar `backend/.env`).

## File Structure

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/lib/carga.js` | Crear | Reducer puro del estado de carga |
| `src/lib/carga.test.js` | Crear | Pruebas del reducer |
| `src/lib/useCarga.js` | Crear | Hook React: carga, reintento con foco, aviso con datos previos |
| `src/ui/ErrorMsg.jsx` | Modificar | Prop `cargando` (el botón conserva el foco al reintentar) |
| `src/views/{Clientes,Planes,Suscripciones,Configuracion,Historial,Calendario,Dashboard}.jsx` | Modificar | Migrar al hook |
| `src/api.js`, `src/lib/errores.js`, `src/lib/errores.test.js` | Modificar | Marca de errores de red y de respuesta inválida |
| `backend/perfil.js`, `auth.js`, `database.js`, `mailer.js`, `mailer.test.js`, `perfil.test.js` | Modificar | `COLOR_POR_DEFECTO` único |
| `src/lib/paridadColores.test.js` | Modificar | Paridad de la constante de color |
| `src/lib/formato.js`, `formato.test.js` | Modificar | `diaEnZona`, `esDelDia` (día de Bogotá) |
| `src/lib/calendario.js`, `calendario.test.js` | Modificar | `indexarEnvios`, `estadoEnvio` |
| `index.html`, `src/styles/base.css` | Modificar | Retirar Tailwind CDN y reemplazarlo por un reset propio |
| `CLAUDE.md` (raíz y frontend), `DOCUMENTACION_TECNICA.md` | Modificar | Documentación |

---

### Task 1: Reducer puro de carga (`lib/carga.js`)

**Files:**
- Create: `sgcrc-frontend-export/src/lib/carga.js`
- Test: `sgcrc-frontend-export/src/lib/carga.test.js`

**Interfaces:**
- Produces: `estadoInicial = { datos: null, cargando: true, error: '' }` y `reducirCarga(estado, accion)` con acciones `{tipo:'inicio'}`, `{tipo:'exito', datos}`, `{tipo:'fallo', mensaje}`, `{tipo:'fin'}`, `{tipo:'poner', datos}` (`datos` puede ser función `prev => nuevo`).

- [ ] **Step 1: Escribir la prueba que falla**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { estadoInicial, reducirCarga } from './carga.js'

test('estado inicial: cargando, sin datos ni error', () => {
  assert.deepEqual(estadoInicial, { datos: null, cargando: true, error: '' })
})

test('inicio conserva el error y los datos (el aviso sigue visible mientras se reintenta)', () => {
  const e = reducirCarga({ datos: null, cargando: false, error: 'falló' }, { tipo: 'inicio' })
  assert.deepEqual(e, { datos: null, cargando: true, error: 'falló' })
})

test('éxito guarda los datos y limpia el error', () => {
  const e = reducirCarga({ datos: null, cargando: true, error: 'falló' }, { tipo: 'exito', datos: [1] })
  assert.deepEqual(e, { datos: [1], cargando: false, error: '' })
})

test('fallo guarda el mensaje y conserva los datos previos', () => {
  const e = reducirCarga({ datos: [1], cargando: true, error: '' }, { tipo: 'fallo', mensaje: 'sin red' })
  assert.deepEqual(e, { datos: [1], cargando: false, error: 'sin red' })
})

test('fin solo apaga cargando (el aviso se dio por otra vía)', () => {
  const e = reducirCarga({ datos: [1], cargando: true, error: '' }, { tipo: 'fin' })
  assert.deepEqual(e, { datos: [1], cargando: false, error: '' })
})

test('poner acepta un valor o una función sobre los datos previos', () => {
  assert.deepEqual(reducirCarga({ datos: { a: 1 }, cargando: false, error: '' }, { tipo: 'poner', datos: { a: 2 } }).datos, { a: 2 })
  assert.deepEqual(reducirCarga({ datos: { a: 1 }, cargando: false, error: '' }, { tipo: 'poner', datos: (p) => ({ ...p, b: 3 }) }).datos, { a: 1, b: 3 })
})

test('una acción desconocida devuelve el mismo estado', () => {
  const s = { datos: null, cargando: true, error: '' }
  assert.equal(reducirCarga(s, { tipo: 'nada' }), s)
})
```

- [ ] **Step 2: Ejecutar y ver el fallo**

Run: `cd sgcrc-frontend-export && node --test src/lib/carga.test.js`
Expected: FAIL (`Cannot find module './carga.js'`).

- [ ] **Step 3: Implementación mínima**

```js
// Estado de carga de una vista, sin React: lo consume lib/useCarga.js.
// datos === null significa "aún no hubo una carga correcta" (se muestra Skeleton o el error inicial).
export const estadoInicial = { datos: null, cargando: true, error: '' }

export function reducirCarga(estado, accion) {
  switch (accion.tipo) {
    case 'inicio': // el error previo se conserva: el aviso sigue en pantalla mientras se reintenta
      return { ...estado, cargando: true }
    case 'exito':
      return { datos: accion.datos, cargando: false, error: '' }
    case 'fallo':
      return { ...estado, cargando: false, error: accion.mensaje }
    case 'fin':
      return { ...estado, cargando: false }
    case 'poner': {
      const datos = typeof accion.datos === 'function' ? accion.datos(estado.datos) : accion.datos
      return { ...estado, datos }
    }
    default:
      return estado
  }
}
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `cd sgcrc-frontend-export && node --test src/lib/carga.test.js`
Expected: 7 pruebas PASS.

- [ ] **Step 5: Commit**

```bash
git add sgcrc-frontend-export/src/lib/carga.js sgcrc-frontend-export/src/lib/carga.test.js
git commit -m "feat(frontend): reducer puro del estado de carga de las vistas"
```

(Agregar el trailer `Co-Authored-By` indicado en Global Constraints.)

---

### Task 2: Hook `useCarga` y `ErrorMsg` con `cargando`

**Files:**
- Create: `sgcrc-frontend-export/src/lib/useCarga.js`
- Modify: `sgcrc-frontend-export/src/ui/ErrorMsg.jsx`

**Interfaces:**
- Consumes: `estadoInicial`, `reducirCarga` (Task 1); `mensajeError` de `lib/errores.js`; `toast` de `ui/Toast.jsx`.
- Produces: `useCarga(cargador, { avisoConDatos = 'toast' } = {})` donde `cargador` es `async () => datos`. Devuelve `{ datos, cargando, error, hayDatos, cargar, reintentar, setDatos }`:
  - `cargar(): Promise<boolean>` recarga (true si salió bien). Si se llama con otra carga en curso, se encola una sola recarga al terminar.
  - `reintentar()`: como `cargar` y, si sale bien, mueve el foco al `h1` de la vista (el botón "Reintentar" desaparece al tener datos).
  - `setDatos(valorOFuncion)`: edición local de los datos (lo usa Configuración).
  - Un fallo con datos previos: `avisoConDatos: 'toast'` muestra `toast.error` y conserva todo; `'error'` deja `error` en el estado (el Dashboard lo pinta con `ErrorMsg` sin perder los datos).
- `ErrorMsg({ msg, onRetry, cargando })`: con `cargando` el botón queda con `aria-disabled` (conserva el foco) y no repite la acción.

- [ ] **Step 1: Crear el hook**

```js
import { useCallback, useEffect, useReducer, useRef } from 'react'
import { estadoInicial, reducirCarga } from './carga.js'
import { mensajeError } from './errores.js'
import { toast } from '../ui/Toast.jsx'

// Patrón de carga de las vistas: Skeleton hasta la primera carga correcta, ErrorMsg si esa falla,
// y, con datos previos, un fallo de recarga avisa sin perder la lista.
export function useCarga(cargador, { avisoConDatos = 'toast' } = {}) {
  const [estado, dispatch] = useReducer(reducirCarga, estadoInicial)
  const montado = useRef(true)
  const enCurso = useRef(false)
  const pendiente = useRef(false)
  const hayDatos = useRef(false)
  const cargadorRef = useRef(cargador)
  cargadorRef.current = cargador

  const cargar = useCallback(async ({ enfocar = false } = {}) => {
    if (enCurso.current) { pendiente.current = true; return false }
    enCurso.current = true
    dispatch({ tipo: 'inicio' })
    let ok = false
    try {
      const datos = await cargadorRef.current()
      if (!montado.current) return false
      hayDatos.current = true
      dispatch({ tipo: 'exito', datos })
      ok = true
      // El botón "Reintentar" ya no existe: el foco pasa al título de la vista.
      if (enfocar) requestAnimationFrame(() => document.querySelector('#contenido h1')?.focus({ preventScroll: true }))
    } catch (e) {
      if (!montado.current) return false
      const mensaje = mensajeError(e)
      if (hayDatos.current && avisoConDatos === 'toast') {
        toast.error(mensaje)
        dispatch({ tipo: 'fin' })
      } else {
        dispatch({ tipo: 'fallo', mensaje })
      }
    } finally {
      enCurso.current = false
      if (pendiente.current && montado.current) {
        pendiente.current = false
        cargar()
      }
    }
    return ok
  }, [avisoConDatos])

  useEffect(() => {
    montado.current = true
    cargar()
    return () => { montado.current = false }
  }, [cargar])

  const reintentar = useCallback(() => cargar({ enfocar: true }), [cargar])
  const setDatos = useCallback((datos) => dispatch({ tipo: 'poner', datos }), [])

  return { ...estado, hayDatos: estado.datos !== null, cargar, reintentar, setDatos }
}
```

- [ ] **Step 2: Modificar `ErrorMsg.jsx`**

Reemplazar la firma y el botón:

```jsx
export default function ErrorMsg({ msg, onRetry, cargando = false }) {
```
```jsx
      {onRetry && <Button variante="peligro" cargando={cargando} onClick={onRetry}>Reintentar</Button>}
```

- [ ] **Step 3: Verificar que compila**

Run: `cd sgcrc-frontend-export && npm test && npm run build`
Expected: todas las pruebas PASS y build sin errores.

- [ ] **Step 4: Commit**

```bash
git add sgcrc-frontend-export/src/lib/useCarga.js sgcrc-frontend-export/src/ui/ErrorMsg.jsx
git commit -m "feat(frontend): hook useCarga y ErrorMsg que conserva el foco al reintentar"
```

---

### Task 3: Migrar Clientes, Planes y Suscripciones al hook

**Files:**
- Modify: `sgcrc-frontend-export/src/views/Clientes.jsx` (líneas ~20-23, 34-63, 156-159)
- Modify: `sgcrc-frontend-export/src/views/Planes.jsx` (líneas ~26-28, 38-60, 147-150)
- Modify: `sgcrc-frontend-export/src/views/Suscripciones.jsx` (líneas ~49-53, 65-92, 367-370)

**Interfaces:**
- Consumes: `useCarga` (Task 2), `ErrorMsg` con `cargando`.

Regla común por vista: eliminar `useState` de los datos cargados, de `cargando` y de `errorCarga`; eliminar `hayDatos`, `cargar`, `reintentar` y el `useEffect(() => { cargar() }, [])`; añadir el hook; leer los datos con `?? VACIO`. Las llamadas `await cargar()` tras guardar/eliminar se dejan tal cual. Quitar del `import` de React lo que quede sin uso (`useEffect` solo si ya no se usa en otro sitio del archivo; `useRef` se sigue usando para `formRef`).

- [ ] **Step 1: Clientes.jsx** — añadir `import { useCarga } from '../lib/useCarga.js'` y, sobre el componente, `const VACIO = []`. Dentro, reemplazar los estados `clientes`, `subs`, `cargando`, `errorCarga`, `hayDatos`, `cargar`, `reintentar` y el efecto por:

```js
  const { datos, cargando, hayDatos, error: errorCarga, cargar, reintentar } = useCarga(async () => {
    const [clientes, subs] = await Promise.all([api.getClientes(), api.getSuscripciones()])
    return { clientes, subs }
  })
  const clientes = datos?.clientes ?? VACIO
  const subs = datos?.subs ?? VACIO
```

Reemplazar el bloque de render de la lista (hoy `if (cargando) {…Skeleton…} else if (errorCarga) {…}`):

```js
  if (!hayDatos && errorCarga) {
    lista = <ErrorMsg msg={errorCarga} onRetry={reintentar} cargando={cargando} />
  } else if (!hayDatos) {
    lista = <Skeleton />
  } else if (…) {  // las ramas siguientes (vacío, tabla) quedan igual
```
(Conservar exactamente lo que hoy sigue a la rama de `errorCarga`; solo cambian las dos primeras condiciones.)

- [ ] **Step 2: Planes.jsx** — igual con:

```js
  const { datos: planes = VACIO, cargando, hayDatos, error: errorCarga, cargar, reintentar } = useCarga(() => api.getPlanes())
```
(con `const VACIO = []` fuera del componente; `datos` es `null` antes de la primera carga y el valor por defecto de la desestructuración no aplica a `null`, así que usar en su lugar `const planes = datos ?? VACIO` tras `const { datos, … } = useCarga(…)`). Mismos cambios de render que en Clientes.

- [ ] **Step 3: Suscripciones.jsx** —

```js
  const { datos, cargando, hayDatos, error: errorCarga, cargar, reintentar } = useCarga(async () => {
    const [subs, clientes, planes] = await Promise.all([api.getSuscripciones(), api.getClientes(), api.getPlanes()])
    return { subs, clientes, planes }
  })
  const subs = datos?.subs ?? VACIO
  const clientes = datos?.clientes ?? VACIO
  const planes = datos?.planes ?? VACIO
```
Render: `if (!hayDatos && errorCarga) contenido = <ErrorMsg … cargando={cargando} />; else if (!hayDatos) contenido = <Skeleton />; else …`. Los `useMemo` que dependen de `subs`/`clientes` siguen igual (`VACIO` es estable).

- [ ] **Step 4: Verificar**

Run: `cd sgcrc-frontend-export && npm test && npm run build`
Expected: PASS y build limpio. Buscar restos: `grep -n "setClientes\|setSubs\|setPlanes\|setCargando\|setErrorCarga\|hayDatos.current" src/views/Clientes.jsx src/views/Planes.jsx src/views/Suscripciones.jsx` debe no devolver nada.

- [ ] **Step 5: Commit**

```bash
git add sgcrc-frontend-export/src/views/Clientes.jsx sgcrc-frontend-export/src/views/Planes.jsx sgcrc-frontend-export/src/views/Suscripciones.jsx
git commit -m "refactor(frontend): Clientes, Planes y Suscripciones usan useCarga"
```

---

### Task 4: Migrar Configuración e Historial

**Files:**
- Modify: `sgcrc-frontend-export/src/views/Configuracion.jsx` (líneas ~27-58, 95-98)
- Modify: `sgcrc-frontend-export/src/views/Historial.jsx` (líneas ~24-62, 86-90)

**Interfaces:**
- Consumes: `useCarga` con `setDatos`.

- [ ] **Step 1: Configuracion.jsx** — quitar `perfil/cargando/errorCarga` de `useState`, `cargar`, `reintentar` y el efecto de carga; añadir:

```js
  const { datos: perfil, setDatos: setPerfil, cargando, hayDatos, error: errorCarga, reintentar } = useCarga(async () => {
    const data = await api.getPerfil()
    return {
      nombre: data?.nombre ?? '',
      color_tema: data?.color_tema ?? COLOR_POR_DEFECTO,
      whatsapp: data?.whatsapp ?? '',
    }
  })
```
`setPerfil((p) => ({ ...p, [campo]: valor }))` sigue funcionando (el reducer acepta función). El efecto de la vista previa conserva su lista de dependencias `[colorTema, cargando, errorCarga]`. Render:

```js
  if (!hayDatos && errorCarga) {
    contenido = <ErrorMsg msg={errorCarga} onRetry={reintentar} cargando={cargando} />
  } else if (!hayDatos) {
    contenido = <Skeleton />   // conservar el contenido que hoy tiene la rama `if (cargando)`
  } else {
```
(La rama actual `errorCarga || !perfil` desaparece: con `hayDatos` el perfil existe.)

- [ ] **Step 2: Historial.jsx** — eliminar `historial/clientes/subs/cargando/error/conDatos` de `useState`, los refs `hayDatos/enCurso/montado`, `cargar` y el efecto de montaje; añadir:

```js
  const { datos, cargando, hayDatos: conDatos, error, cargar } = useCarga(async () => {
    const [historial, clientes, subs] = await Promise.all([api.getHistorial(), api.getClientes(), api.getSuscripciones()])
    return { historial, clientes, subs }
  })
  const historial = datos?.historial ?? VACIO
  const clientes = datos?.clientes ?? VACIO
  const subs = datos?.subs ?? VACIO
```
(con `const VACIO = []` fuera del componente). `cuerpo = <ErrorMsg … onRetry={cargar} />` pasa a `onRetry={reintentar}` y `cargando={cargando}`: desestructurar también `reintentar`. El botón "Actualizar" sigue usando `cargando={cargando}` y `onClick={cargar}`. Quitar `useRef` del import solo si `pieRef` ya no lo necesita (sí lo necesita: se queda). Eliminar el `useEffect` del import si no se usa.

- [ ] **Step 3: Verificar**

Run: `cd sgcrc-frontend-export && npm test && npm run build`
Expected: PASS y build limpio.

- [ ] **Step 4: Commit**

```bash
git add sgcrc-frontend-export/src/views/Configuracion.jsx sgcrc-frontend-export/src/views/Historial.jsx
git commit -m "refactor(frontend): Configuración e Historial usan useCarga"
```

---

### Task 5: Migrar Calendario y Dashboard

**Files:**
- Modify: `sgcrc-frontend-export/src/views/Calendario.jsx` (líneas ~15-42, 66-67)
- Modify: `sgcrc-frontend-export/src/views/Dashboard.jsx` (líneas ~27-86, 112-116, 142)

**Interfaces:**
- Consumes: `useCarga`; el Dashboard usa `{ avisoConDatos: 'error' }`.

- [ ] **Step 1: Calendario.jsx** — quitar `subs/clientes/error/cargado` de `useState`, `enCurso` y `cargar`; añadir:

```js
  const { datos, hayDatos: cargado, cargando, error, reintentar } = useCarga(async () => {
    const [subs, clientes] = await Promise.all([api.getSuscripciones(), api.getClientes()])
    return { subs: subs.filter((x) => x.activa), clientes }
  })
  const subs = datos?.subs ?? VACIO
  const clientes = datos?.clientes ?? VACIO
```
Render: `if (!cargado && error) return <div className="pagina">{cabecera}<ErrorMsg msg={error} onRetry={reintentar} cargando={cargando} /></div>`. Las demás ramas (`!cargado`, `subs.length === 0`) quedan igual.

- [ ] **Step 2: Dashboard.jsx** — quitar `data/error` de `useState` y `cargar`; mantener `montado` (lo usa `handleForzarCobros`) con un efecto propio:

```js
  const { datos: data, cargando, error, cargar, reintentar } = useCarga(async () => {
    const [clientes, suscripciones, historial, resumen] = await Promise.all([
      api.getClientes(), api.getSuscripciones(), api.getHistorial(), api.getResumenCobros(),
    ])
    return { clientes, suscripciones, historial, resumen }
  }, { avisoConDatos: 'error' })
  const montado = useRef(true)
  useEffect(() => {
    montado.current = true
    return () => { montado.current = false }
  }, [])
```
`await cargar()` y `cargar()` dentro de `handleForzarCobros` siguen igual. Estado inicial fallido: `{error ? <ErrorMsg msg={error} onRetry={reintentar} cargando={cargando} /> : <Skeleton />}`. El aviso con datos (`{error && <ErrorMsg msg={error} onRetry={cargar} />}`) pasa a `onRetry={cargar} cargando={cargando}`. El `useMemo` de `stats` no cambia.

- [ ] **Step 3: Verificar en navegador (foco al reintentar)**

Run: `cd sgcrc-frontend-export && npm run build && npm test`. Luego con backend y `npm run dev`, en una vista (p. ej. Clientes) detener el backend, recargar (aparece el error), reiniciar el backend y pulsar "Reintentar" con teclado.
Expected: durante el reintento el botón sigue enfocado (`aria-disabled`); al cargar bien el foco queda en el `h1`. Comprobar con `document.activeElement.tagName === 'H1'`.

- [ ] **Step 4: Commit**

```bash
git add sgcrc-frontend-export/src/views/Calendario.jsx sgcrc-frontend-export/src/views/Dashboard.jsx
git commit -m "refactor(frontend): Calendario y Dashboard usan useCarga"
```

---

### Task 6: Marca de error de red en `api.js` y `mensajeError`

**Files:**
- Modify: `sgcrc-frontend-export/src/api.js` (función `req`)
- Modify: `sgcrc-frontend-export/src/lib/errores.js`
- Test: `sgcrc-frontend-export/src/lib/errores.test.js`

**Interfaces:**
- Produces: `api.js` marca `error.esRed = true` cuando `fetch` rechaza y `error.respuestaInvalida = true` cuando `res.json()` falla en una respuesta OK. `mensajeError` solo traduce a `MSG_RED`/`MSG_RESPUESTA_INVALIDA` con esas marcas; un `TypeError`/`SyntaxError` sin marca (bug de programación) devuelve `MSG_INESPERADO` y no muestra el texto técnico.

- [ ] **Step 1: Actualizar las pruebas (deben fallar)** — en `errores.test.js` reemplazar los dos tests de `TypeError` y `SyntaxError` por:

```js
const marcar = (e, marca) => Object.assign(e, { [marca]: true })

test('un error de red marcado por api.js se traduce al español', () => {
  assert.equal(mensajeError(marcar(new TypeError('Failed to fetch'), 'esRed')), MSG_RED)
  assert.equal(mensajeError(marcar(new TypeError('Load failed'), 'esRed')), MSG_RED)
  assert.equal(MSG_RED, 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.')
})

test('una respuesta no JSON marcada por api.js (p. ej. HTML del túnel) se traduce al español', () => {
  const esperado = 'El servidor respondió algo inesperado. Inténtalo de nuevo en un momento.'
  assert.equal(mensajeError(marcar(new SyntaxError("Unexpected token '<'"), 'respuestaInvalida')), esperado)
  assert.equal(MSG_RESPUESTA_INVALIDA, esperado)
})

test('un TypeError o SyntaxError sin marca es un bug de programación: no se muestra su texto técnico', () => {
  assert.equal(mensajeError(new TypeError("Cannot read properties of undefined (reading 'map')")), MSG_INESPERADO)
  assert.equal(mensajeError(new SyntaxError('Unexpected token')), MSG_INESPERADO)
})
```

Run: `cd sgcrc-frontend-export && node --test src/lib/errores.test.js`
Expected: FAIL (el código actual usa `instanceof`).

- [ ] **Step 2: Implementar** — en `errores.js`, reemplazar las dos primeras líneas de `mensajeError` y el comentario:

```js
// api.js marca los fallos de red (fetch rechaza) con `esRed` y las respuestas OK que no son JSON con
// `respuestaInvalida`. Un TypeError/SyntaxError sin marca es un error de programación y no se muestra.
// src/api.js construye "Error NNN" cuando no hay cuerpo JSON.
export function mensajeError(e) {
  if (e && e.esRed) return MSG_RED
  if (e && e.respuestaInvalida) return MSG_RESPUESTA_INVALIDA
  if (e instanceof TypeError || e instanceof SyntaxError) return MSG_INESPERADO
```
(el resto de la función queda igual.)

En `api.js`, separar el `fetch` y el `res.json()` del `try` general:

```js
  let res
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (error) {
    console.error('Network Error:', error.message)
    error.esRed = true
    throw error
  }

  // Manejo de sesión expirada
  if (res.status === 401) {
    localStorage.removeItem('sgcrc_session')
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    const error = new Error(errData.error || `Error ${res.status}`)
    error.response = { status: res.status, data: errData }
    throw error
  }

  if (res.status === 204) return null
  try {
    return await res.json()
  } catch (error) {
    error.respuestaInvalida = true
    throw error
  }
}
```
(sustituye el cuerpo actual de `req` desde `try {` hasta su `}` final, conservando la construcción de `headers`.)

- [ ] **Step 3: Verificar**

Run: `cd sgcrc-frontend-export && npm test && npm run build`
Expected: PASS. Con el backend detenido, la vista muestra el mensaje de red; con el backend arriba, funciona igual que antes.

- [ ] **Step 4: Commit**

```bash
git add sgcrc-frontend-export/src/api.js sgcrc-frontend-export/src/lib/errores.js sgcrc-frontend-export/src/lib/errores.test.js
git commit -m "fix(frontend): api.js marca errores de red y mensajeError no tapa errores de programación"
```

---

### Task 7: Color de marca por defecto único (#1F6B4F)

**Files:**
- Modify: `backend/perfil.js` (exportar `COLOR_POR_DEFECTO`)
- Modify: `backend/auth.js:34`, `backend/database.js:21,102`, `backend/mailer.js:38,39,156`
- Modify: `backend/mailer.test.js:33,75`, `backend/perfil.test.js`
- Modify: `sgcrc-frontend-export/src/lib/paridadColores.test.js`, `sgcrc-frontend-export/src/lib/colorTema.test.js:27`

**Interfaces:**
- Produces: `COLOR_POR_DEFECTO = '#1F6B4F'` exportado por `backend/perfil.js`. Solo afecta a usuarios NUEVOS y al respaldo cuando falta el color: los usuarios existentes conservan el que tienen guardado (en SQLite no se puede cambiar el DEFAULT de una columna existente; `auth.js` pasa el color explícito).
- Nota de producto: `#4f46e5` seguirá siendo un color válido que cualquier usuario puede elegir; las pruebas que lo usan como ejemplo de color válido se conservan.

- [ ] **Step 1: Pruebas que fallan** — en `backend/perfil.test.js` añadir al final:

```js
test('COLOR_POR_DEFECTO es el verde de marca y pasa la validación', () => {
  const { COLOR_POR_DEFECTO } = require('./perfil');
  assert.equal(COLOR_POR_DEFECTO, '#1F6B4F');
  assert.equal(colorValido(COLOR_POR_DEFECTO), COLOR_POR_DEFECTO);
});
```
(Ajustar `require`/`assert` al estilo del archivo: si ya importa `colorValido` arriba, usar ese nombre.) En `backend/mailer.test.js`: la prueba de la línea ~33 espera `#4f46e5` como color por defecto y la de la línea ~75 `background-color: #4f46e5;`: cambiar ambas a `#1F6B4F`. En `paridadColores.test.js` añadir, dentro de la prueba existente tras cargar `b`:

```js
  assert.equal(b.COLOR_POR_DEFECTO, COLOR_POR_DEFECTO)
```
y agregar `COLOR_POR_DEFECTO` al `import` de `./colorTema.js`.

Run: `cd backend && npm run test:unit` y `cd sgcrc-frontend-export && npm test`
Expected: FAIL en las pruebas tocadas.

- [ ] **Step 2: Implementar** — `perfil.js`: definir `const COLOR_POR_DEFECTO = '#1F6B4F';` y añadirlo a `module.exports`. `auth.js`: `const { COLOR_POR_DEFECTO } = require('./perfil');` y usarlo en el `INSERT` (línea 34). `database.js`: requerir `./perfil` y usar en la plantilla del DDL `` DEFAULT '${COLOR_POR_DEFECTO}' `` (línea 21) y en el `ALTER` (línea 102; `db.prepare` con el literal interpolado). `mailer.js`: ya importa de `./perfil`; añadir `COLOR_POR_DEFECTO` al destructuring y reemplazar los tres `"#4f46e5"` (valor por defecto del parámetro, respaldo de `colorValido` y `usuarioConfig.color_tema ||`).

- [ ] **Step 3: Verificar**

Run: `cd backend && npm run test:unit && npm run test:security` y `cd sgcrc-frontend-export && npm test`
Expected: todo PASS (la paridad ya no se salta: backend disponible).

- [ ] **Step 4: Documentación** — en `DOCUMENTACION_TECNICA.md:38` y `CLAUDE.md:125` (raíz) y `sgcrc-frontend-export/CLAUDE.md` (sección Theming, ejemplo `#4f46e5`) cambiar "default #4f46e5" por "default #1F6B4F (`COLOR_POR_DEFECTO` en `backend/perfil.js`)". Nota en el commit: usuarios existentes conservan su color.

- [ ] **Step 5: Commit**

```bash
git add backend/perfil.js backend/auth.js backend/database.js backend/mailer.js backend/mailer.test.js backend/perfil.test.js sgcrc-frontend-export/src/lib/paridadColores.test.js DOCUMENTACION_TECNICA.md CLAUDE.md sgcrc-frontend-export/CLAUDE.md
git commit -m "fix: color de marca por defecto único (#1F6B4F) en backend y frontend"
```

---

### Task 8: "Hoy" del Dashboard según Bogotá

**Files:**
- Modify: `sgcrc-frontend-export/src/lib/formato.js`, `sgcrc-frontend-export/src/lib/formato.test.js`
- Modify: `sgcrc-frontend-export/src/views/Dashboard.jsx` (líneas ~101-102 y el import)

**Interfaces:**
- Produces: `diaEnZona(isoUtc, zona = 'America/Bogota'): string` → `'AAAA-MM-DD'` o `''` si la fecha no es válida; `esDelDia(isoUtc, diaISO, zona?)`. Reemplazan a `esHoyLocal` (se elimina, junto con sus pruebas, por no tener más usos).
- Consumes: `resumen.hoy` (día de la app en Bogotá, de `GET /cobros/resumen`).

- [ ] **Step 1: Pruebas que fallan** — en `formato.test.js` eliminar las pruebas de `esHoyLocal` y agregar:

```js
import { diaEnZona, esDelDia } from './formato.js'

test('diaEnZona: el día de Bogotá, no el UTC', () => {
  assert.equal(diaEnZona('2026-10-25T03:30:00.000Z'), '2026-10-24') // 22:30 del 24 en Bogotá
  assert.equal(diaEnZona('2026-10-25T05:00:00.000Z'), '2026-10-25') // 00:00 del 25 en Bogotá
})

test('diaEnZona: fecha inválida o vacía -> cadena vacía', () => {
  assert.equal(diaEnZona('no es fecha'), '')
  assert.equal(diaEnZona(''), '')
  assert.equal(diaEnZona(undefined), '')
})

test('esDelDia compara contra el día dado', () => {
  assert.equal(esDelDia('2026-10-25T03:30:00.000Z', '2026-10-24'), true)
  assert.equal(esDelDia('2026-10-25T03:30:00.000Z', '2026-10-25'), false)
})
```
(Ajustar el `import` existente de `formato.test.js` para no duplicar.) Run: `node --test src/lib/formato.test.js` → FAIL.

- [ ] **Step 2: Implementar** en `formato.js` (reemplaza `esHoyLocal`):

```js
// Día calendario ('AAAA-MM-DD') de un instante ISO UTC en la zona de la app (Bogotá, igual que backend/cobros.js).
export const diaEnZona = (isoUtc, zona = 'America/Bogota') => {
  const t = isoUtc ? Date.parse(isoUtc) : NaN
  if (Number.isNaN(t)) return ''
  return new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t))
}

export const esDelDia = (isoUtc, diaISO, zona) => diaEnZona(isoUtc, zona) === diaISO
```

- [ ] **Step 3: Dashboard** — importar `esDelDia` en vez de `esHoyLocal`; en `stats`, definir `const hoyApp = resumen?.hoy || aISOLocal(ahora)` y usar:

```js
      enviados: historial.filter((h) => h.estado === 'Enviado' && esDelDia(h.fecha, hoyApp)).length,
      fallidos: historial.filter((h) => h.estado === 'Fallido' && esDelDia(h.fecha, hoyApp)).length,
```
y `proximos: proximosCobros(suscripciones, clientes, hoyApp)`.

- [ ] **Step 4: Verificar y commit**

Run: `cd sgcrc-frontend-export && npm test && npm run build` → PASS.

```bash
git add sgcrc-frontend-export/src/lib/formato.js sgcrc-frontend-export/src/lib/formato.test.js sgcrc-frontend-export/src/views/Dashboard.jsx
git commit -m "fix(frontend): los enviados y fallidos de hoy se cuentan por día de Bogotá"
```

---

### Task 9: Estado de envío real en los cobros pasados del Calendario

**Files:**
- Modify: `sgcrc-frontend-export/src/lib/calendario.js`, `sgcrc-frontend-export/src/lib/calendario.test.js`
- Modify: `sgcrc-frontend-export/src/views/Calendario.jsx`
- Modify: `sgcrc-frontend-export/src/styles/ui.css` (solo si hace falta espacio para el distintivo en `.cal-item-cab`)

**Interfaces:**
- Produces en `calendario.js`: `indexarEnvios(historial): Map<string, 'Enviado'|'Fallido'>` con clave `` `${suscripcion_id}|${AAAA-MM-DD de Bogotá}` `` (si hay Enviado y Fallido el mismo día gana `Enviado`); `estadoEnvio(envios, subId, iso, hoyISO): null | 'Enviado' | 'Fallido' | 'Sin registro'` (`null` si `iso > hoyISO`, cobro futuro).
- Consumes: `diaEnZona` (Task 8), `useCarga` (Task 5), `EstadoBadge`/`Badge` de `ui/Badge.jsx`.
- Semántica: el historial guarda la fecha del ENVÍO; un reintento de un cobro vencido figura el día en que salió. "Sin registro" es neutro (también aplica a días anteriores al uso del sistema), no una alarma.

- [ ] **Step 1: Pruebas que fallan** — en `calendario.test.js`:

```js
import { indexarEnvios, estadoEnvio } from './calendario.js'

const hist = [
  { suscripcion_id: 1, estado: 'Fallido', fecha: '2026-10-20T13:00:00.000Z' },
  { suscripcion_id: 1, estado: 'Enviado', fecha: '2026-10-20T14:00:00.000Z' },
  { suscripcion_id: 2, estado: 'Fallido', fecha: '2026-10-21T13:00:00.000Z' },
  { suscripcion_id: 3, estado: 'Pendiente', fecha: '2026-10-22T13:00:00.000Z' },
]

test('indexarEnvios: por suscripción y día de Bogotá; Enviado gana a Fallido', () => {
  const m = indexarEnvios(hist)
  assert.equal(m.get('1|2026-10-20'), 'Enviado')
  assert.equal(m.get('2|2026-10-21'), 'Fallido')
  assert.equal(m.has('3|2026-10-22'), false)
})

test('estadoEnvio: futuro null; pasado con envío, con fallo o sin registro', () => {
  const m = indexarEnvios(hist)
  assert.equal(estadoEnvio(m, 1, '2026-10-25', '2026-10-24'), null)
  assert.equal(estadoEnvio(m, 1, '2026-10-20', '2026-10-24'), 'Enviado')
  assert.equal(estadoEnvio(m, 2, '2026-10-21', '2026-10-24'), 'Fallido')
  assert.equal(estadoEnvio(m, 2, '2026-10-19', '2026-10-24'), 'Sin registro')
  assert.equal(estadoEnvio(m, 2, '2026-10-24', '2026-10-24'), 'Sin registro') // hoy aún sin envío
})

test('indexarEnvios tolera entrada no válida', () => {
  assert.equal(indexarEnvios(undefined).size, 0)
  assert.equal(indexarEnvios([{ suscripcion_id: 1, estado: 'Enviado', fecha: 'x' }]).size, 0)
})
```
Run: `node --test src/lib/calendario.test.js` → FAIL.

- [ ] **Step 2: Implementar** en `calendario.js` (añadir `import { diaEnZona } from './formato.js'` arriba):

```js
// Envíos reales por suscripción y día (Bogotá): 'Enviado' o 'Fallido'. Si un día tiene ambos, gana 'Enviado'.
export const indexarEnvios = (historial) => {
  const mapa = new Map()
  for (const h of Array.isArray(historial) ? historial : []) {
    if (h.estado !== 'Enviado' && h.estado !== 'Fallido') continue
    const dia = diaEnZona(h.fecha || h.fecha_envio)
    if (!dia) continue
    const clave = `${h.suscripcion_id}|${dia}`
    if (mapa.get(clave) !== 'Enviado') mapa.set(clave, h.estado)
  }
  return mapa
}

// Estado de un cobro proyectado: null si es futuro; si no, lo que dice el historial ese día.
// El historial guarda la fecha del envío (un reintento figura el día en que salió).
export const estadoEnvio = (envios, subId, iso, hoyISO) =>
  iso > hoyISO ? null : (envios.get(`${subId}|${iso}`) || 'Sin registro')
```

- [ ] **Step 3: Vista** — en `Calendario.jsx`: el cargador del hook añade el historial (`api.getHistorial()` dentro del `Promise.all`) y devuelve `{ subs, clientes, historial }`; calcular `const envios = useMemo(() => indexarEnvios(datos?.historial), [datos])`. Definir `hoyISO` con `aISOLocal(hoy)` (de `lib/dashboard.js`) y una función `isoDia = (dia) => \`${view.year}-${String(view.month + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}\``. En los dos lugares donde se pinta un item (`cal-agenda` y `cal-detalle`), junto al `cal-chip` de frecuencia, mostrar:

```jsx
{(() => {
  const e = estadoEnvio(envios, s.id, isoDia(dia), hoyISO)   // `dia` = día de la agenda, o `selected` en el detalle
  return e && (e === 'Sin registro'
    ? <span className="cal-chip">Sin registro de envío</span>
    : <EstadoBadge estado={e} />)
})()}
```
Extraer ese fragmento a un componente interno `EstadoDia({ s, dia })` para no duplicarlo. Importar `EstadoBadge` de `../ui/Badge.jsx`. Si el distintivo desborda en 320 px, permitir `flex-wrap: wrap; gap: 0.375rem` en `.cal-item-cab` (verificar a 360 px con el iframe descrito en `CLAUDE.md` del frontend).

- [ ] **Step 4: Verificar y commit**

Run: `cd sgcrc-frontend-export && npm test && npm run build` → PASS. En navegador: mes actual, un cobro de un día pasado con envío muestra "Enviado"; uno de un día futuro no muestra estado.

```bash
git add sgcrc-frontend-export/src/lib/calendario.js sgcrc-frontend-export/src/lib/calendario.test.js sgcrc-frontend-export/src/views/Calendario.jsx sgcrc-frontend-export/src/styles/ui.css
git commit -m "feat(frontend): el Calendario muestra el estado real de envío de los cobros pasados"
```

---

### Task 10: Retirar Tailwind CDN con reset propio y revisar rendimiento

**Files:**
- Modify: `sgcrc-frontend-export/index.html`, `sgcrc-frontend-export/src/styles/base.css`

**Contexto:** el CSS propio NO define `box-sizing` ni los resets que aporta el preflight de Tailwind (`h1..h6`, `p`, `ul`, `button`, `table`…), así que quitar el CDN sin reemplazo puede cambiar el aspecto. Se verifica visualmente antes y después.

- [ ] **Step 1: Línea base** — con backend (secreto temporal) y `npm run dev`, abrir cada vista (Login, Dashboard, Clientes, Planes, Suscripciones, Historial, Calendario, Configuración) a 1280 px y a 360 px (iframe) y guardar capturas en el directorio temporal de la sesión. Anotar medidas clave de referencia por JavaScript: `getComputedStyle` de `h1`, `button`, `input`, `table` (`box-sizing`, `margin`, `font-size`, `border-collapse`).

- [ ] **Step 2: Añadir el reset** al inicio de `base.css` (subconjunto del preflight de Tailwind 3 que el proyecto necesita; ajustar tras comparar):

```css
/* Reset mínimo (sustituye al preflight del CDN de Tailwind, ya retirado). */
*, ::before, ::after { box-sizing: border-box; border-width: 0; border-style: solid; border-color: currentColor; }
html { line-height: 1.5; -webkit-text-size-adjust: 100%; }
h1, h2, h3, h4, h5, h6 { font-size: inherit; font-weight: inherit; margin: 0; }
p, figure, blockquote, dl, dd, pre { margin: 0; }
ul, ol, menu { list-style: none; margin: 0; padding: 0; }
a { color: inherit; text-decoration: inherit; }
button, input, select, textarea { font: inherit; color: inherit; margin: 0; padding: 0; line-height: inherit; }
button, [role="button"] { cursor: pointer; background: transparent; }
button:disabled { cursor: default; }
table { border-collapse: collapse; border-color: inherit; text-indent: 0; }
img, svg, video, canvas { display: block; max-width: 100%; }
[hidden] { display: none; }
```
(Colocarlo ANTES de las reglas existentes de `base.css` para que no pise `h1, h2, h3 { font-family… }` ni el foco. Cuidado con `h1..h6 { font-size: inherit }`: las clases de `ui.css`/`shell.css` ya fijan los tamaños de títulos; si algún título cambia, fijarlo en su clase.)

- [ ] **Step 3: Quitar el CDN** — eliminar la línea `<script src="https://cdn.tailwindcss.com"></script>` de `index.html`. Retirar también del comentario de `:focus-visible` en `base.css` la referencia a Tailwind y, tras comprobar con `grep -rn "outline-none" src` que no hay usos, simplificar el comentario.

- [ ] **Step 4: Comparar** — repetir las capturas y mediciones del Step 1 con el reset y sin CDN (desconectar la red no es necesario: ya no hay petición externa; comprobar en la pestaña de red que no se pide `cdn.tailwindcss.com`). Corregir cualquier diferencia visible (espaciados, tamaños de título, bordes de tablas/controles, scroll horizontal a 360 px) ajustando el reset o la clase afectada. `npm run build && npm run preview` y repetir la inspección sobre el build.

- [ ] **Step 5: Revisión de rendimiento (web-perf, solo medir)** — con `npm run build`, listar tamaños de `dist/assets` (`Get-ChildItem dist/assets | Sort-Object Length -Descending | Select-Object Name, Length`). Comprobar que las fuentes cargadas son los subsets realmente usados (latín; `@fontsource` genera un `@font-face` por subset con `unicode-range`, el navegador solo descarga los necesarios). Registrar en el reporte el peso total de `dist/` y las fuentes descargadas en la pestaña de red; el preload de fuentes queda descartado (nombres con hash de Vite + `font-display: swap`). No hay cambios de código en este paso salvo que se detecte un subset claramente innecesario importado en `main.jsx`.

- [ ] **Step 6: Commit**

```bash
git add sgcrc-frontend-export/index.html sgcrc-frontend-export/src/styles/base.css
git commit -m "refactor(frontend): se retira Tailwind CDN y se agrega un reset CSS propio"
```

---

### Task 11: Documentación y cierre

**Files:**
- Modify: `sgcrc-frontend-export/CLAUDE.md`, `CLAUDE.md` (raíz, si menciona lo cambiado)

- [ ] **Step 1: Actualizar `sgcrc-frontend-export/CLAUDE.md`**: tabla de `src/` (nuevas filas `lib/carga.js`, `lib/useCarga.js`; `formato.js` ahora con `diaEnZona`/`esDelDia` en vez de `esHoyLocal`; `calendario.js` con `indexarEnvios`/`estadoEnvio`; `errores.js` con las marcas `esRed`/`respuestaInvalida`; `api.js` las pone); sección "Listas y carga" (usar `useCarga`, `ErrorMsg` con `cargando`, `reintentar` mueve el foco al `h1`); sección "Pendiente de migrar" y "Tailwind por CDN" (Tailwind retirado; reset en `base.css`; quitar el aviso de `npm run preview` sobre el preflight del CDN); sección Dashboard (los conteos de hoy usan el día de Bogotá de `resumen.hoy`); sección Calendario (estados de envío).
- [ ] **Step 2: Verificación final** — `cd sgcrc-frontend-export && npm test && npm run build`; `cd backend && npm run test:unit && npm run test:security`. Todo PASS.
- [ ] **Step 3: Commit**

```bash
git add sgcrc-frontend-export/CLAUDE.md CLAUDE.md
git commit -m "docs: documenta la Fase 7 (useCarga, errores de red, color único, Calendario con estados, sin Tailwind)"
```

---

## Self-Review

- **Cobertura del diferido:** hook `useCarga` y foco de "Reintentar" (Tasks 1-5); marca de red en `api.js` (6); color único (7, incluye la constante verificada en la prueba de paridad); días pasados del Calendario vs envíos reales (9); minor de conteos de "hoy" por Bogotá (8); retirar Tailwind CDN (10); preload de fuentes evaluado (10, Step 5). "`require` backend en prueba de paridad": la prueba ya usa `createRequire` con `t.skip` si el backend no existe (el frontend puede desplegarse solo); no se cambia y la Task 7 añade la comparación de la constante.
- **Placeholders:** sin pendientes; los fragmentos de migración de vistas indican qué líneas reemplazar porque dependen del código vecino que el implementador debe leer.
- **Consistencia de tipos:** `useCarga` devuelve `{datos, cargando, error, hayDatos, cargar, reintentar, setDatos}`; las vistas lo desestructuran con esos nombres (`error: errorCarga`, `hayDatos: conDatos`, `hayDatos: cargado`). `diaEnZona`/`esDelDia` (Task 8) se usan en Task 9; `useCarga` en Task 9 viene de Task 5.
- **Riesgo:** Task 7 cambia el comportamiento en producción para usuarios NUEVOS (color por defecto); decidido por el rediseño ("verde #1F6B4F"), existentes sin cambios.
