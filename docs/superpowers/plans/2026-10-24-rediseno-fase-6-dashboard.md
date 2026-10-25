# Rediseño visual, Fase 6 (Dashboard): franja "Hoy" y libro de próximos cobros. Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rehacer el Dashboard según el spec: franja "Hoy" (a cobrar, vencido, enviado, fallido) alimentada por `GET /cobros/resumen`, lista de próximos cobros estilo libro de cuentas calculada con las reglas reales de cobro, y "Forzar cobros" como acción secundaria con diálogo que resume qué se enviará y a quién. Sin Tailwind en la vista.

**Architecture:** La lógica nueva (fecha local, próximos cobros por suscripción, texto de días) es pura en `src/lib/dashboard.js` y reutiliza `tocaCobrarEn` de `src/lib/calendario.js` (réplica del backend con prueba de paridad), con pruebas `node:test`. `api.js` gana `getResumenCobros`. La vista `Dashboard.jsx` se reescribe con clases propias de `src/styles/ui.css` y tokens.

**Tech Stack:** React 18, Vite 7, CSS propio con tokens, `node:test`. Backend sin cambios (el endpoint ya existe y filtra por `usuario_id`).

Spec: `docs/superpowers/specs/2026-10-19-rediseno-visual-frontend-design.md` (sección Dashboard). Fase previa: `docs/superpowers/plans/2026-10-24-rediseno-fase-5-movil.md`.

## Global Constraints

- Rama `develop`. Un commit por tarea con el trailer final exacto `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Sin push.
- Todo dentro de `sgcrc-frontend-export/` salvo este plan. Tailwind sigue por CDN pero NO se usa en lo que se toque; `fetch`, no `axios`.
- Sin colores hardcodeados: clases de `src/styles/*.css` y `var(--...)`. Texto de marca: `var(--color-primario-texto)`; texto sobre fondo de marca: `var(--color-primario-contraste)`. Nunca `setProperty('--color-primario', ...)` directo.
- Texto ≥ 13 px; contraste 4.5:1 en texto y 3:1 en componentes; objetivos táctiles ≥ 44 px; foco visible; sin emojis; iconos solo con `<Icon>` (lista en `scripts/gen-icons.mjs`; si falta uno, agregarlo y `npm run icons`); textos en español con tildes; un solo `h1` (PageHeader) y jerarquía h1 > h2 > h3 sin saltos.
- Cifras en moneda con `fmt` de `src/lib/formato.js` (no duplicar el formateador); fechas con `fmtFecha`. Montos y cifras con `font-variant-numeric: tabular-nums`.
- Punto de corte móvil: `@media (width < 768px)`; el Dashboard debe funcionar a 320 y 360 px sin desborde horizontal.
- "Forzar cobros" mantiene su contrato con el backend: `api.runCobros({ confirmarReenvio })`; el 409 con `requiereConfirmacion` sigue mostrando su diálogo de reenvío. Las pruebas en navegador NO deben enviar correos reales.
- Verificación de cada tarea (desde `sgcrc-frontend-export/`): `npm test` y `npm run build` en verde.

## File Structure

- Crear `src/lib/dashboard.js`, `src/lib/dashboard.test.js`.
- Modificar `src/api.js` (un método), `src/views/Dashboard.jsx` (reescritura), `src/styles/ui.css` (bloque Dashboard), `sgcrc-frontend-export/CLAUDE.md`.

## Tareas

### Task 1: Lógica pura del Dashboard

**Files:** Create `src/lib/dashboard.js`, `src/lib/dashboard.test.js`.

**Interfaces — Produces:**
- `aISOLocal(fecha: Date = new Date()): string` → `'AAAA-MM-DD'` con componentes locales.
- `sumarDiasISO(iso: string, n: number): string` → `iso` más `n` días (calendario local, cruza meses y años).
- `proximosCobros(subs, clientes, desdeISO, opciones?: { max = 5, ventana = 60 }): Array<{ id, fecha, dias, cliente, plan, monto, frecuencia }>` — solo suscripciones con `activa` verdadera; para cada una, la PRIMERA fecha en `[desdeISO, desdeISO + ventana]` en la que `tocaCobrarEn(sus, fecha)` es verdadero (una fila por suscripción, aunque sea semanal); ordenado por `dias` y luego por `id`; recortado a `max`. `cliente` = nombre del cliente o `'Cliente eliminado'`; `plan` = `sus.tipo`; `frecuencia` = `sus.frecuencia || 'mensual'`; `dias` = diferencia en días desde `desdeISO`.
- `textoDias(n: number): string` → `'Hoy'` (0), `'Mañana'` (1), `` `En ${n} días` `` (n ≥ 2).

- [ ] **Step 1: Pruebas que fallan** — `src/lib/dashboard.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aISOLocal, sumarDiasISO, proximosCobros, textoDias } from './dashboard.js'

test('aISOLocal usa componentes locales con ceros a la izquierda', () => {
  assert.equal(aISOLocal(new Date(2026, 0, 5, 23, 59)), '2026-01-05')
  assert.equal(aISOLocal(new Date(2026, 11, 31, 0, 0)), '2026-12-31')
})

test('sumarDiasISO cruza meses y años', () => {
  assert.equal(sumarDiasISO('2026-10-24', 10), '2026-11-03')
  assert.equal(sumarDiasISO('2026-12-31', 1), '2027-01-01')
  assert.equal(sumarDiasISO('2026-03-01', -1), '2026-02-28')
  assert.equal(sumarDiasISO('2026-10-24', 0), '2026-10-24')
})

test('textoDias', () => {
  assert.equal(textoDias(0), 'Hoy')
  assert.equal(textoDias(1), 'Mañana')
  assert.equal(textoDias(5), 'En 5 días')
})

const clientes = [{ id: 1, nombre: 'Ana' }, { id: 2, nombre: 'Beto' }]
const mensual = (id, cliente_id, dia, extra = {}) => ({
  id, cliente_id, activa: 1, monto: 50000, tipo: 'Plan A', frecuencia: 'mensual',
  fecha_alta: `2026-01-${String(dia).padStart(2, '0')}`, ...extra,
})

test('proximosCobros: mensual futuro, hoy y orden por días', () => {
  const subs = [mensual(10, 2, 15), mensual(11, 1, 12)]
  const r = proximosCobros(subs, clientes, '2026-10-12')
  assert.deepEqual(r.map((x) => [x.id, x.fecha, x.dias]), [[11, '2026-10-12', 0], [10, '2026-10-15', 3]])
  assert.equal(r[0].cliente, 'Ana')
  assert.equal(r[0].plan, 'Plan A')
  assert.equal(r[0].monto, 50000)
})

test('proximosCobros: una fila por suscripción aunque sea semanal', () => {
  const sem = mensual(20, 1, 5, { frecuencia: 'semanal', fecha_alta: '2026-10-05' }) // lunes
  const r = proximosCobros([sem], clientes, '2026-10-24', { max: 5 })
  assert.equal(r.length, 1)
  assert.equal(r[0].fecha, '2026-10-26')
  assert.equal(r[0].dias, 2)
  assert.equal(r[0].frecuencia, 'semanal')
})

test('proximosCobros: excluye inactivas y respeta max y ventana', () => {
  const subs = [mensual(1, 1, 20, { activa: 0 }), mensual(2, 1, 21), mensual(3, 1, 22), mensual(4, 1, 23)]
  assert.deepEqual(proximosCobros(subs, clientes, '2026-10-19', { max: 2 }).map((x) => x.id), [2, 3])
  assert.deepEqual(proximosCobros([mensual(5, 1, 15, { frecuencia: 'anual', fecha_alta: '2026-03-15' })], clientes, '2026-10-19', { ventana: 60 }), [])
})

test('proximosCobros: cliente inexistente y suscripción que aún no empieza', () => {
  const futura = mensual(7, 99, 3, { fecha_alta: '2026-12-03' })
  const r = proximosCobros([futura], clientes, '2026-10-24', { ventana: 60 })
  assert.equal(r.length, 1)
  assert.equal(r[0].fecha, '2026-12-03')
  assert.equal(r[0].cliente, 'Cliente eliminado')
})
```

  Nota para el implementador: si algún literal de estas pruebas contradice el calendario real (p. ej. 2026-10-26 debe ser lunes; 2026-12-03 está a 40 días de 2026-10-24, dentro de la ventana de 60), corrige la prueba, no la función; verifica los días de la semana con `new Date(2026, 9, 26).getDay()`.

- [ ] **Step 2:** `npm test` → falla con módulo inexistente.
- [ ] **Step 3: Implementar** `src/lib/dashboard.js`:

```js
// Lógica pura del Dashboard: fechas locales y próximos cobros según las reglas reales de cobro.
import { tocaCobrarEn } from './calendario.js'

const pad = (n) => String(n).padStart(2, '0')

export const aISOLocal = (fecha = new Date()) =>
  `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`

export const sumarDiasISO = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number)
  return aISOLocal(new Date(y, m - 1, d + n))
}

export const textoDias = (n) => (n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : `En ${n} días`)

// Una fila por suscripción activa: la primera fecha de cobro dentro de la ventana, ordenada por cercanía.
export const proximosCobros = (subs, clientes, desdeISO, { max = 5, ventana = 60 } = {}) => {
  const nombres = new Map(clientes.map((c) => [c.id, c.nombre]))
  const pendientes = subs.filter((s) => s.activa)
  const filas = []
  for (let dias = 0; dias <= ventana && pendientes.length > 0; dias++) {
    const fecha = sumarDiasISO(desdeISO, dias)
    for (let i = pendientes.length - 1; i >= 0; i--) {
      const s = pendientes[i]
      if (!tocaCobrarEn(s, fecha)) continue
      filas.push({
        id: s.id, fecha, dias,
        cliente: nombres.get(s.cliente_id) || 'Cliente eliminado',
        plan: s.tipo, monto: s.monto, frecuencia: s.frecuencia || 'mensual',
      })
      pendientes.splice(i, 1)
    }
  }
  return filas.sort((a, b) => a.dias - b.dias || a.id - b.id).slice(0, max)
}
```

- [ ] **Step 4:** `npm test` y `npm run build` en verde.
- [ ] **Step 5: Commit**

```bash
git add sgcrc-frontend-export/src/lib/dashboard.js sgcrc-frontend-export/src/lib/dashboard.test.js
git commit -m "feat(frontend): lógica pura de próximos cobros del Dashboard con las reglas reales de cobro

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 2: Vista del Dashboard, estilos, verificación y documentación

**Files:** Modify `src/api.js`, `src/views/Dashboard.jsx` (reescritura), `src/styles/ui.css`, `sgcrc-frontend-export/CLAUDE.md`.

**Interfaces — Consumes:** `proximosCobros`, `textoDias`, `aISOLocal` (Task 1); `fmt`, `fmtFecha`, `esHoyLocal` de `lib/formato.js`; `mensajeError`; `PageHeader`, `Button`, `ErrorMsg`, `Skeleton`, `EmptyState`, `ConfirmDialog`, `Icon`, `toast`. **Produces:** `api.getResumenCobros()` → `GET /cobros/resumen` con forma `{ hoy, ventanaDias, paraHoy: Item[], vencidos: Item[], perdidos: Item[] }`, `Item = { suscripcion_id, cliente, plan, monto, fechaCobro, diasVencido }`.

**Requisitos de la vista:**
- Carga: `Promise.all([getClientes, getSuscripciones, getHistorial, getResumenCobros])`. Estado de carga y error dentro de `<div className="pagina">` con `PageHeader` + `Skeleton`/`ErrorMsg` (reintentar). Si el refresco tras forzar cobros falla, el error se muestra sin perder los datos previos.
- Estructura (sin Tailwind, con `className="pagina"` como raíz):
  1. `PageHeader` titulo "Dashboard", descripción `Resumen de {mes año}`, acciones: `Button variante="secundario" icono="paper-plane-tilt"` "Revisar y enviar cobros de hoy" que ABRE el diálogo de resumen (no envía directamente). Se deshabilita (`disabled`) si no hay `paraHoy` ni `vencidos`, mostrando la razón en texto visible bajo el título ("No hay cobros pendientes de enviar hoy.").
  2. `<section aria-labelledby="dash-hoy">` con `h2#dash-hoy` "Hoy" (visible) y una rejilla `.hoy-franja` de 4 cifras en `<dl>`: "A cobrar hoy" (`paraHoy.length`, y debajo la suma de montos con `fmt`), "Vencidos" (`vencidos.length`; clase de énfasis `--bad` solo si > 0), "Enviados hoy" (historial con `estado === 'Enviado'` y `esHoyLocal(h.fecha)`), "Fallidos" (historial `estado === 'Fallido'` con `esHoyLocal(h.fecha)`; el total histórico de errores deja de ser una cifra de la franja). Cifras con la fuente `var(--font-display)`, tamaño grande (≥ 1.75rem), `tabular-nums`. Cada cifra con su rótulo (`dt`) ≥ 13 px y color `var(--ink-2)`. Si hay `perdidos.length > 0`, una línea de aviso bajo la franja: "{n} cobros quedaron fuera de la ventana de reintento ({ventanaDias} días) y ya no se reenvían."
  3. `<section aria-labelledby="dash-resumen">` con `h2` "Tu negocio" y tres cifras secundarias (Clientes, Suscripciones activas, Ingresos mensuales activos = suma de `monto` de activas con `fmt`), más discretas (misma estructura `dl`, cifra ≤ 1.375rem).
  4. `<section aria-labelledby="dash-proximos">` con `h2` "Próximos cobros" y descripción "Las próximas 5 suscripciones activas según su calendario de cobro.". Lista `<ol className="libro">`: cada `<li>` es una fila de libro de cuentas con: fecha `fmtFecha(fila.fecha)` + `textoDias(fila.dias)` (cuando `dias === 0`, `Badge` de aviso "Hoy" con icono `bell`, sin tamaño de letra < 13 px), cliente (peso 600), plan y frecuencia en texto secundario, y monto alineado a la derecha. Sin la inicial en círculo ni "Inició". Vacío: `EmptyState` nivel 2, icono `calendar-blank`, título "Sin cobros próximos", texto "No hay cobros en los próximos 60 días." (contraste correcto, no `text-slate-400`).
  5. `ConfirmDialog` de resumen "Enviar cobros de hoy": lista `ul` con cliente, plan, monto y, para vencidos, "vencido hace {diasVencido} días"; total; botón "Enviar {n} cobros". Al confirmar llama `handleForzarCobros(false)`. Solo se cierra cuando termina (usa `cargando`).
  6. `ConfirmDialog` de reenvío existente (409 `requiereConfirmacion`) se conserva con su texto y flujo.
- Lógica de "forzar": conserva `handleForzarCobros(confirmarReenvio)`; tras éxito, `toast.exito(res.message)` y recarga datos. El texto del botón de acción en carga: el estado `cargando` del `Button` basta (sin cambiar el texto a "Procesando...").
- Eliminar de la vista: `calcularDiasFaltantes`, el `fmt` local, el icono `bell` suelto fuera del Badge, los `style={{...}}` en línea y todas las clases de Tailwind.
- `api.js`: `getResumenCobros: () => req('GET', '/cobros/resumen')`.
- CSS en `ui.css` (bloque "Dashboard"; clases: `.hoy-franja`, `.cifra`, `.cifra-valor`, `.cifra-rotulo`, `.cifra-sub`, `.cifra-mal`, `.negocio`, `.libro`, `.libro-fila`, `.libro-fecha`, `.libro-cliente`, `.libro-detalle`, `.libro-monto`, `.dash-aviso`, `.resumen-envio`): tarjetas/paneles con `var(--surface)`, borde `var(--line)`, radio 8 px; `.hoy-franja` en rejilla `repeat(auto-fit, minmax(10rem, 1fr))`; `.libro-fila` en rejilla de 3 columnas (fecha | cliente+detalle | monto) que a `@media (width < 768px)` pasa a dos líneas sin desborde; línea divisoria `var(--line)` entre filas (estilo libro), monto `tabular-nums` a la derecha; ninguna regla con colores literales.

**Verificación en navegador (obligatoria, antes del commit):** backend con `JWT_SECRET` temporal en la variable de entorno (no tocar `backend/.env`), `npm run dev` en segundo plano; usuario temporal por la API de registro y datos de siembra (3 clientes, 2 planes, 5 suscripciones: una con cobro hoy, una vencida —alta pasada sin envío en historial dentro de 7 días—, una semanal, una anual fuera de ventana, una inactiva; un par de envíos Enviado/Fallido de hoy en historial insertados directo en la base temporal). NO pulsar "Enviar" en el diálogo (enviaría correos): abrir el diálogo, comprobar contenido, foco y cierre con Cancelar/Escape. Comprobar a 360 px y 1280 px: sin desborde horizontal, objetivos ≥ 44 px, jerarquía de encabezados (h1, h2 × 3), cifras correctas contra `GET /cobros/resumen` y la base, estado vacío (usuario sin suscripciones), estado de error (backend detenido → mensaje en español y "Reintentar"). Limpiar al final: borrar el usuario temporal y sus filas, parar backend y Vite, confirmar puertos 3000/5173 libres.

- [ ] **Step 1:** Implementar vista, API, CSS.
- [ ] **Step 2:** `npm test` y `npm run build` en verde.
- [ ] **Step 3:** Verificación en navegador y corrección de lo hallado.
- [ ] **Step 4:** Documentar la fase en `sgcrc-frontend-export/CLAUDE.md` (estilo de las secciones existentes: Dashboard, `lib/dashboard.js`, clases nuevas, diálogo de resumen).
- [ ] **Step 5: Commit**

```bash
git add -A sgcrc-frontend-export
git commit -m "feat(frontend): Dashboard con franja Hoy, libro de próximos cobros y diálogo de resumen de envío

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

## Self-review del plan

- Cobertura del diferido de la Fase 6: `tocaCobrarEn` en lugar de `calcularDiasFaltantes` (T1/T2), estado de carga sin `.pagina` ajeno (T2), contraste de "No hay cobros" (EmptyState, T2), h3 que salta h2 (T2, h2), "Inició" con fecha ISO (eliminado, T2), `fmt` duplicado (T2), franja "Hoy" con `GET /cobros/resumen` (T2), spec: "Forzar cobros" secundario con diálogo de resumen (T2).
- Tipos: `proximosCobros`, `textoDias`, `aISOLocal`, `sumarDiasISO` (T1) usados por la vista (T2); forma de `getResumenCobros` coincide con `backend/scheduler.js:resumenCobros`.
