# Rediseño visual, Fase 5 (adapt): móvil. Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer SGCRC usable a 360 px: barra de navegación inferior, tablas convertidas en tarjetas apiladas, agenda del calendario por día y objetivos táctiles de 44 px, sin regresiones en escritorio.

**Architecture:** La partición de destinos de navegación (cuáles van en la barra inferior y cuáles bajo "Más") es lógica pura en `src/lib/navegacion.js` con pruebas `node:test`. El shell móvil es un componente nuevo `src/ui/NavMovil.jsx` (barra inferior + panel "Más"). Las tablas pasan a tarjetas solo con CSS (las celdas ya tienen `data-label`). El Calendario añade una agenda renderizada en JSX y visible solo en móvil; la rejilla y el detalle se ocultan en móvil. La verificación real se hace a 360 px con un iframe de ese ancho sobre la app en ejecución.

**Tech Stack:** React 18, Vite 7, CSS propio con tokens (`src/styles/`), `node:test`.

Spec: `docs/superpowers/specs/2026-10-19-rediseno-visual-frontend-design.md` (shell: "barra inferior de 5 destinos con etiqueta y objetivos de 48 px"; tablas: "en móvil cada fila pasa a tarjeta apilada"; calendario: "en móvil, vista de agenda por día"). Fase previa: `docs/superpowers/plans/2026-10-20-rediseno-fase-4-harden.md`.

## Global Constraints

- Rama `develop`. Un commit por tarea con el trailer final exacto `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Sin push.
- Todo dentro de `sgcrc-frontend-export/` salvo este plan. Tailwind sigue por CDN (sin `tailwind.config.js`); `fetch`, no `axios`.
- En lo que se toque no se añaden clases de Tailwind ni colores hardcodeados: clases de `src/styles/*.css` y `var(--...)`. Texto sobre marca: `var(--color-primario-contraste)`.
- Punto de corte móvil único: `@media (width < 768px)` (complemento exacto del `@media (width >= 768px)` del shell, sin franja sin navegación; donde aparece la barra inferior).
- Objetivos táctiles ≥ 44 px (`2.75rem`) en móvil, incluidos los botones `sm`; foco visible siempre; texto ≥ 13 px; contraste 4.5:1 en texto y 3:1 en componentes; sin emojis; iconos solo con `<Icon>` (`list` ya existe en `scripts/gen-icons.mjs`); textos en español con tildes.
- Sin desbordamiento horizontal de la página a 360 px (`document.documentElement.scrollWidth <= window.innerWidth`).
- Verificación de cada tarea (desde `sgcrc-frontend-export/`): `npm test` y `npm run build` en verde. Escritorio (≥768 px) no cambia visualmente.
- Lo que NO entra en esta fase (queda para 6 y 7): rediseño del Dashboard, hook `useCarga`, color por defecto único.

## File Structure

- Crear `src/lib/navegacion.js`, `src/lib/navegacion.test.js`: `NAV` y partición de destinos.
- Crear `src/ui/NavMovil.jsx`: barra inferior + panel "Más".
- Modificar `src/App.jsx`, `src/styles/shell.css`, `index.html`, `src/styles/ui.css` (toast y tablas/botones en móvil).
- Modificar `src/lib/calendario.js`, `src/lib/calendario.test.js`, `src/views/Calendario.jsx`.
- Modificar `sgcrc-frontend-export/CLAUDE.md` (documentar la fase).

## Tareas

### Task 1: Partición de destinos de navegación (lógica pura)

**Files:**
- Create: `src/lib/navegacion.js`, `src/lib/navegacion.test.js`
- Modify: `src/App.jsx` (importar `NAV` desde la lib y borrar la constante local)

**Interfaces:**
- Produces:
  - `NAV: Array<{ id: string, label: string, icon: string }>` (los 7 destinos actuales, mismo orden).
  - `IDS_BARRA_MOVIL: string[]` = `['dashboard', 'clientes', 'suscripciones', 'calendario']`.
  - `particionarNav(nav = NAV): { barra: Item[], mas: Item[] }` — `barra` conserva el orden de `IDS_BARRA_MOVIL`; `mas` son los restantes en el orden de `nav` (Planes, Historial, Configuración).
  - `vistaEnMas(view: string, nav = NAV): boolean` — `true` si `view` pertenece a `mas`.

- [ ] **Step 1: Escribir la prueba que falla** — `src/lib/navegacion.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NAV, IDS_BARRA_MOVIL, particionarNav, vistaEnMas } from './navegacion.js'

test('NAV conserva los 7 destinos con id, label e icon', () => {
  assert.equal(NAV.length, 7)
  for (const n of NAV) {
    assert.ok(n.id && n.label && n.icon, `destino incompleto: ${JSON.stringify(n)}`)
  }
})

test('particionarNav: la barra tiene 4 destinos fijos y el resto va a "Más"', () => {
  const { barra, mas } = particionarNav()
  assert.deepEqual(barra.map((n) => n.id), IDS_BARRA_MOVIL)
  assert.deepEqual(mas.map((n) => n.id), ['planes', 'historial', 'configuracion'])
  assert.equal(barra.length + mas.length, NAV.length)
})

test('particionarNav no pierde ni duplica destinos', () => {
  const { barra, mas } = particionarNav()
  const ids = [...barra, ...mas].map((n) => n.id).sort()
  assert.deepEqual(ids, NAV.map((n) => n.id).sort())
})

test('vistaEnMas distingue vistas de la barra y de "Más"', () => {
  assert.equal(vistaEnMas('dashboard'), false)
  assert.equal(vistaEnMas('calendario'), false)
  assert.equal(vistaEnMas('planes'), true)
  assert.equal(vistaEnMas('configuracion'), true)
  assert.equal(vistaEnMas('inexistente'), false)
})
```

- [ ] **Step 2: Ejecutar y ver el fallo** — `npm test` → FALLA con "Cannot find module './navegacion.js'".

- [ ] **Step 3: Implementar** — `src/lib/navegacion.js`:

```js
// Destinos de navegación y su reparto en móvil: la barra inferior lleva los de uso diario y
// "Más" agrupa el resto. Lógica pura para poder probarla sin DOM.

export const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'squares-four' },
  { id: 'clientes', label: 'Clientes', icon: 'users' },
  { id: 'planes', label: 'Planes', icon: 'tag' },
  { id: 'suscripciones', label: 'Suscripciones', icon: 'arrows-clockwise' },
  { id: 'historial', label: 'Historial', icon: 'clock-counter-clockwise' },
  { id: 'calendario', label: 'Calendario', icon: 'calendar-blank' },
  { id: 'configuracion', label: 'Configuración', icon: 'gear' },
]

export const IDS_BARRA_MOVIL = ['dashboard', 'clientes', 'suscripciones', 'calendario']

export const particionarNav = (nav = NAV) => ({
  barra: IDS_BARRA_MOVIL.map((id) => nav.find((n) => n.id === id)).filter(Boolean),
  mas: nav.filter((n) => !IDS_BARRA_MOVIL.includes(n.id)),
})

export const vistaEnMas = (view, nav = NAV) => particionarNav(nav).mas.some((n) => n.id === view)
```

En `src/App.jsx`: añadir `import { NAV } from './lib/navegacion.js'` y borrar la constante local `NAV`.

- [ ] **Step 4: Verificar** — `npm test` (todo verde, incluidas las 4 pruebas nuevas) y `npm run build`.

- [ ] **Step 5: Commit**

```bash
git add sgcrc-frontend-export/src/lib/navegacion.js sgcrc-frontend-export/src/lib/navegacion.test.js sgcrc-frontend-export/src/App.jsx
git commit -m "refactor(frontend): reparto de destinos de navegación en una lib probada

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 2: Shell móvil: barra inferior con panel "Más"

**Files:**
- Create: `src/ui/NavMovil.jsx`
- Modify: `src/App.jsx`, `src/styles/shell.css`, `src/styles/ui.css` (posición del toast), `index.html`

**Interfaces:**
- Consumes: `particionarNav`, `vistaEnMas`, `NAV` de `src/lib/navegacion.js` (Task 1); `Icon`, `Button`.
- Produces: `<NavMovil view={string} onNavegar={(id) => void} onSalir={() => void} />`.

**Requisitos:**
- `index.html`: el viewport pasa a `width=device-width, initial-scale=1.0, viewport-fit=cover` (para `env(safe-area-inset-bottom)`).
- `NavMovil` renderiza un `<nav className="nav-inferior" aria-label="Principal">` con: los 4 destinos de `barra` como `<button className="nav-inf-item" aria-current="page" si view===id>` (icono 22 px arriba, etiqueta visible debajo, texto 13 px) y un quinto botón "Más" (icono `list`) con `aria-expanded`, `aria-controls="panel-mas"`; recibe `aria-current="page"` cuando `vistaEnMas(view)` es verdadero y muestra la etiqueta del destino activo de "Más" solo mediante `aria-current` (la etiqueta visible sigue siendo "Más").
- Panel "Más": `<div id="panel-mas" className="panel-mas" hidden={!abierto}>` con los destinos de `mas` como botones (`.nav-item`, `aria-current` en el activo) y un botón "Salir" (`Button variante="secundario" icono="sign-out"`). Elegir un destino llama `onNavegar(id)` y cierra; "Salir" llama `onSalir` y cierra. Cierra con Escape (devolviendo el foco al botón "Más") y con clic fuera (un `mousedown` en `document` cuyo objetivo no esté dentro del contenedor del `NavMovil`). Al abrir, el foco pasa al primer destino del panel. No se atrapa el foco (no es modal); el panel se superpone justo encima de la barra.
- Barra superior móvil (`.barra-movil`): solo marca + estado del servidor (se quita "Salir", que vive en "Más"; el escritorio conserva su "Salir" en `.lateral-pie`). Se elimina la fila `.nav-movil` y sus reglas.
- `App.jsx`: sustituir `<nav className="nav-movil">` por `<NavMovil view={view} onNavegar={setView} onSalir={handleLogout} />` (dentro de `.shell`, fuera de `main`). El `h1` de la vista y el foco por vista existentes siguen funcionando sin cambios.
- CSS en `shell.css` (solo bajo `@media (width < 768px)` salvo que se indique):
  - `.nav-inferior { position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; display: flex; justify-content: space-around; (ítems `flex: 1 1 auto; min-width: 2.75rem`); background: var(--surface); border-top: 1px solid var(--line); padding-bottom: env(safe-area-inset-bottom); }` y `display: none` a partir de 768 px.
  - `.nav-inf-item`: columna centrada, `min-height: 3.5rem` (56 px, ≥48), `gap: 0.15rem`, `font-size: 0.8125rem`, color `var(--ink-2)`, sin borde; activo: color `var(--ink)`, `font-weight: 600` y barra superior de 3 px `var(--color-primario)` (pseudo-elemento, igual criterio que `.nav-item[aria-current]` del escritorio) y icono en `var(--color-primario)`.
  - `.panel-mas { position: fixed; left: 0.75rem; right: 0.75rem; bottom: calc(3.5rem + env(safe-area-inset-bottom) + 0.5rem); z-index: 45; ...superficie, borde var(--line), radio 8px, sombra como .dialog, padding 0.5rem, display grid, gap 0.25rem }` (con `hidden` debe quedar oculto: `.panel-mas[hidden] { display: none; }`).
  - `.contenido { padding-bottom: calc(3.5rem + env(safe-area-inset-bottom) + 1.5rem); }` para que la barra no tape contenido.
  - `.barra-movil`: `padding: 0.75rem 1rem; border-bottom: 1px solid var(--line); background: var(--surface); margin: 0` (quitar las reglas de margen `.principal > .barra-movil, .principal > .nav-movil` y el `margin-bottom`; la barra pasa a ocupar todo el ancho). Texto del estado puede envolver en dos líneas sin desbordar.
  - `.toast-region { bottom: calc(3.5rem + env(safe-area-inset-bottom) + 0.75rem); }` en móvil (en `ui.css`, para que el toast no quede bajo la barra).
- Sin pruebas unitarias del componente (el repo no tiene entorno DOM); se verifica en la tarea 5.

- [ ] **Step 1:** Escribir `NavMovil.jsx`, CSS, cambios en `App.jsx` e `index.html` según los requisitos.
- [ ] **Step 2:** `npm test` y `npm run build` en verde.
- [ ] **Step 3: Comprobación manual rápida** — `npm run dev` y, con el ancho de ventana < 768 px (o el iframe de la tarea 5), comprobar que se ve la barra de 5 botones, que "Más" abre/cierra con clic, Escape y clic fuera, y que en ≥768 px solo se ve la sidebar. Detener el servidor al terminar.
- [ ] **Step 4: Commit**

```bash
git add sgcrc-frontend-export/index.html sgcrc-frontend-export/src/ui/NavMovil.jsx sgcrc-frontend-export/src/App.jsx sgcrc-frontend-export/src/styles/shell.css sgcrc-frontend-export/src/styles/ui.css
git commit -m "feat(frontend): barra de navegación inferior en móvil con panel Más

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 3: Tablas como tarjetas y objetivos táctiles de 44 px

**Files:** `src/styles/ui.css` (solo CSS; las celdas de Clientes, Planes, Suscripciones e Historial ya tienen `data-label`).

**Requisitos (todo bajo `@media (width < 768px)`):**
- `.tabla-wrap`: sin borde ni fondo ni `overflow-x` (las tarjetas llevan el borde).
- Cabecera oculta pero accesible: `.tabla thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; }`.
- `.tabla, .tabla tbody { display: block; }`; `.tabla tr { display: grid; gap: 0.5rem; margin-bottom: 0.75rem; padding: 0.75rem 1rem; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; }`.
- `.tabla td { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 0; border: 0; text-align: right; min-width: 0; overflow-wrap: anywhere; }` y `.tabla td::before { content: attr(data-label); flex-shrink: 0; font-size: 0.8125rem; font-weight: 600; color: var(--ink-2); text-align: left; }`.
- Celda de acciones: `.tabla td.acciones { justify-content: stretch; gap: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--line); }` sin etiqueta (`.tabla td.acciones::before { content: none; }`), con `.tabla td.acciones > * { flex: 1; margin-left: 0; }` y los botones al ancho disponible.
- `.tabla td.num` y `.tabla td.hist-fecha` conservan `font-variant-numeric: tabular-nums`; `white-space: normal` en `td`.
- Objetivos táctiles: `.btn-sm { min-height: 2.75rem; }` en móvil (cubre Editar/Eliminar, filtros de Historial y "Actualizar"); `.hist-filtros` envuelve sin desbordar; `.hist-tarjeta { min-width: 0; }`.
- Notas: se confía en que los navegadores modernos conservan la semántica de tabla al cambiar `display` (Chrome ≥ 80, Firefox, Safari reciente). Si en la verificación (tarea 5) un lector o el árbol de accesibilidad pierde las filas, añadir `role` explícitos (`table`, `rowgroup`, `row`, `cell`, `columnheader`) en las cuatro vistas.

- [ ] **Step 1:** Añadir el bloque `@media` a `ui.css` según los requisitos.
- [ ] **Step 2:** `npm test` y `npm run build` en verde.
- [ ] **Step 3: Commit**

```bash
git add sgcrc-frontend-export/src/styles/ui.css
git commit -m "feat(frontend): tablas como tarjetas apiladas y botones de 44 px en móvil

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 4: Agenda del Calendario en móvil

**Files:**
- Modify: `src/lib/calendario.js`, `src/lib/calendario.test.js`, `src/views/Calendario.jsx`, `src/styles/ui.css`

**Interfaces:**
- Produces en `calendario.js`: `diaSemanaCorto(anio: number, mes: number, dia: number): string` → `'Lun'`, `'Mar'`, `'Mié'`, `'Jue'`, `'Vie'`, `'Sáb'`, `'Dom'`; `etiquetaAgenda(anio, mes, dia): string` → `'Lun 5 de octubre'` (día de la semana corto + día + « de » + mes en minúscula, sin año).

- [ ] **Step 1: Pruebas que fallan** — añadir a `src/lib/calendario.test.js` (importar `diaSemanaCorto`, `etiquetaAgenda`):

```js
test('diaSemanaCorto: usa el día local de la semana', () => {
  assert.equal(diaSemanaCorto(2026, 9, 5), 'Lun')   // 5 de octubre de 2026
  assert.equal(diaSemanaCorto(2026, 9, 4), 'Dom')
  assert.equal(diaSemanaCorto(2026, 1, 28), 'Sáb')  // 28 de febrero de 2026
})

test('etiquetaAgenda: día corto, número y mes en minúscula, sin año', () => {
  assert.equal(etiquetaAgenda(2026, 9, 5), 'Lun 5 de octubre')
  assert.equal(etiquetaAgenda(2026, 11, 31), 'Jue 31 de diciembre')
})
```

Ejecutar `npm test` → falla porque las funciones no existen. (Comprobar las fechas del calendario real antes de fijar los literales: 5/oct/2026 es lunes, 28/feb/2026 es sábado, 31/dic/2026 es jueves; si alguna difiere, corregir la prueba, no la función.)

- [ ] **Step 2: Implementar** en `calendario.js`:

```js
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export const diaSemanaCorto = (anio, mes, dia) => DIAS_CORTOS[new Date(anio, mes, dia).getDay()]

// 'Lun 5 de octubre'
export const etiquetaAgenda = (anio, mes, dia) =>
  `${diaSemanaCorto(anio, mes, dia)} ${dia} de ${MESES[mes].toLowerCase()}`
```

`npm test` verde.

- [ ] **Step 3: Agenda en la vista** (`Calendario.jsx`). Dentro del `.panel.cal-panel`, después de la rejilla, añadir una sección solo móvil:

```jsx
<section className="cal-agenda" aria-label="Agenda del mes">
  {diasConCobros.length === 0 ? (
    <p className="cal-detalle-vacio">Este mes no tiene cobros</p>
  ) : diasConCobros.map((dia) => {
    const datos = cobrosPorDia[dia]
    const esHoy = dia === hoy.getDate() && view.month === hoy.getMonth() && view.year === hoy.getFullYear()
    return (
      <article key={dia} className={`cal-agenda-dia${esHoy ? ' cal-agenda-hoy' : ''}`} aria-current={esHoy ? 'date' : undefined}>
        <h3 className="cal-agenda-titulo">
          {etiquetaAgenda(view.year, view.month, dia)}{esHoy && ' (hoy)'}
          <span className="cal-agenda-total">{fmt(datos.total)}</span>
        </h3>
        {datos.items.map((s, idx) => (
          <div key={`${s.id}-${idx}`} className="cal-item">
            <div className="cal-item-cab">
              <div className="cal-item-nombre">{s.cl?.nombre || 'Cliente eliminado'}</div>
              <span className="cal-chip">{s.frecuencia || 'mensual'}</span>
            </div>
            <div className="cal-item-tipo">{s.tipo}</div>
            <div className="cal-item-monto">{fmt(s.monto)}</div>
          </div>
        ))}
      </article>
    )
  })}
</section>
```

con `const diasConCobros = Object.keys(cobrosPorDia).map(Number).sort((a, b) => a - b)` calculado con `useMemo` junto a `cobrosPorDia` (antes de los `return` tempranos, para respetar el orden de hooks) e importar `etiquetaAgenda`.

- [ ] **Step 4: CSS** (`ui.css`):
  - Por defecto (escritorio): `.cal-agenda { display: none; }`.
  - `@media (width < 768px)`: `.cal-agenda { display: grid; gap: 0.75rem; }`, `.cal-semana, .cal-rejilla, .cal-detalle { display: none; }`, `.cal-layout { grid-template-columns: minmax(0, 1fr); }`, `.cal-agenda-dia { padding: 0.75rem 1rem; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); }`, `.cal-agenda-hoy { border: 2px solid var(--ink); padding: calc(0.75rem - 1px) calc(1rem - 1px); }`, `.cal-agenda-titulo { display: flex; justify-content: space-between; gap: 0.75rem; margin: 0 0 0.25rem; font-size: 1rem; font-family: var(--font-ui); }`, `.cal-agenda-total { font-variant-numeric: tabular-nums; font-weight: 700; }`. Los botones del navegador de mes (`.cal-nav`, `.cal-hoy`) ya miden 44 px. Quitar de la regla `max-width: 40rem` existente lo que quede sin uso (celdas ocultas), sin cambiar el comportamiento ≥ 41 rem.
  - En móvil el botón "Hoy" solo cambia el mes (la selección de un día no aplica); `irAHoy` no cambia.

- [ ] **Step 5:** `npm test` y `npm run build` en verde.
- [ ] **Step 6: Commit**

```bash
git add sgcrc-frontend-export/src/lib/calendario.js sgcrc-frontend-export/src/lib/calendario.test.js sgcrc-frontend-export/src/views/Calendario.jsx sgcrc-frontend-export/src/styles/ui.css
git commit -m "feat(frontend): agenda por día del calendario en móvil

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### Task 5: Verificación real a 360 px, correcciones y documentación

**Files:** los que la verificación obligue a corregir (solo CSS/JSX de la fase), y `sgcrc-frontend-export/CLAUDE.md`.

**Requisitos:**
- Arrancar el backend de desarrollo con un `JWT_SECRET` temporal en la variable de entorno (sin tocar `backend/.env`) y `npm run dev` del frontend. Iniciar sesión con el usuario de prueba local.
- Para simular 360 px sin depender del tamaño mínimo de la ventana del navegador: en una pestaña de la app (ya con sesión) inyectar un `<iframe src="/" style="width:360px;height:740px">` en una página en blanco del mismo origen, o abrir la app en una ventana redimensionada; la medición y los clics se hacen dentro del iframe (mismo origen). Los media queries se evalúan contra el ancho del iframe.
- Para CADA vista (Dashboard, Clientes, Planes, Suscripciones, Historial, Calendario, Configuración, Login con sesión cerrada) a 360 px: (a) `scrollWidth <= innerWidth` del documento del iframe; (b) lista de elementos interactivos visibles con alto o ancho < 44 px (excepto enlaces de texto en línea y la casilla nativa dentro de `.check`); (c) texto recortado o solapado bajo la barra inferior al llegar al final del scroll; (d) "Más": abrir, elegir Configuración, comprobar `aria-current` y foco al h1; Escape devuelve el foco al botón; (e) un diálogo (editar cliente) cabe en pantalla y su pie es alcanzable; (f) un toast no queda tapado por la barra.
- A 768 px y 1280 px: la sidebar y las tablas siguen idénticas a antes (sin barra inferior, sin tarjetas, sin agenda).
- Corregir en esta tarea los defectos hallados que sean de la fase (desbordes, objetivos < 44 px, solapes con la barra). El Dashboard solo se corrige si desborda o es inalcanzable; su rediseño es la Fase 6 (anotar lo demás en el informe).
- Si el árbol de accesibilidad (`read_page`) de una tabla en modo tarjeta no muestra filas/celdas, añadir `role` explícitos según la nota de la Task 3.
- Documentar en `sgcrc-frontend-export/CLAUDE.md` los cambios de la Fase 5 (archivos nuevos, breakpoint único, `NavMovil`, tarjetas por `data-label`, agenda) en el mismo estilo de las secciones existentes.
- Detener los procesos que se arranquen (backend, Vite) al terminar; no dejar procesos en segundo plano (la máquina anda justa de memoria).
- Informe final: tabla vista × (desborde, objetivos pequeños, solapes) con los resultados medidos antes y después de las correcciones.

- [ ] **Step 1:** Ejecutar la verificación y anotar los hallazgos.
- [ ] **Step 2:** Corregir; repetir la verificación hasta que no queden hallazgos de la fase.
- [ ] **Step 3:** `npm test` y `npm run build` en verde.
- [ ] **Step 4: Commit**

```bash
git add -A sgcrc-frontend-export
git commit -m "fix(frontend): ajustes de la verificación móvil a 360 px y documentación de la Fase 5

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

## Self-review del plan

- Cobertura del diferido de la Fase 5: barra inferior (T2), tablas como tarjetas con `data-label` (T3), agenda del calendario (T4), objetivos táctiles de "Ver más"/"Actualizar"/filtros `sm` a 44 px (T3), márgenes de `.principal` (T2), prueba a 360 px (T5).
- Orden: T1 → T2 → T3 → T4 secuenciales por compartir `ui.css`/`App.jsx`; T5 al final.
- Tipos: `particionarNav`, `vistaEnMas`, `IDS_BARRA_MOVIL`, `NAV` (T1) los usa `NavMovil` (T2); `etiquetaAgenda`/`diaSemanaCorto` (T4) los usa `Calendario.jsx`.
