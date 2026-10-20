# Rediseño visual, Fase 4 (harden): accesibilidad, contraste y estados. Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar los huecos de accesibilidad (WCAG 2.2 AA), contraste, navegación y estados de error/vacío hallados en la auditoría de la Fase 4, y adaptar Configuración a la nueva regla de contraste del correo.

**Architecture:** Se parte de la auditoría (`.git/sdd/f4-auditoria.md`, 22 hallazgos numerados; cada tarea cita sus números). Primero los tokens de contraste y foco que no dependen del color de marca, el shell (título y foco por vista) y un helper de errores de red; después Historial y Calendario con clases propias en lugar de estilos en línea, y por último Configuración y los textos de ayuda. La lógica con comportamiento (colores, errores, calendario) vive en `src/lib/` con pruebas `node:test`.

**Tech Stack:** React 18, Vite 7, CSS propio con tokens (`src/styles/`), Tailwind CDN solo en el Dashboard (Fase 6), `node:test`.

Spec: `docs/superpowers/specs/2026-10-19-rediseno-visual-frontend-design.md` · Fases previas: `docs/superpowers/plans/2026-10-20-rediseno-fase-3-migracion-vistas.md`.

## Global Constraints

- Rama `develop`. Un commit por tarea con el trailer final exacto `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Sin push.
- Todo dentro de `sgcrc-frontend-export/` salvo este plan. Tailwind sigue por CDN (sin `tailwind.config.js`); `fetch`, no `axios`.
- En lo que se toque no se añaden clases de Tailwind ni colores hardcodeados: se usan clases de `src/styles/*.css` y `var(--...)`. Texto sobre marca: `var(--color-primario-contraste)`. Nunca `setProperty('--color-primario', ...)` directo: solo `aplicarColorTema`.
- Texto mínimo 12 px (preferir 13 px); contraste 4.5:1 en texto normal, 3:1 en texto grande y en componentes de interfaz (bordes de campos, foco); objetivos táctiles de 44 px salvo botones `sm` en filas de tabla de escritorio; foco visible siempre.
- Sin emojis; iconos solo con `<Icon>` (lista en `scripts/gen-icons.mjs`; si falta uno, agregarlo y `npm run icons`). Textos en español con tildes.
- Reglas de color del correo (backend, ya aprobadas): texto del botón `textoSobre(color)` (blanco o `#1F2421`) y monto en el color de marca si contrasta ≥4.5 con blanco, si no `#1F2421`.
- Verificación de cada tarea (desde `sgcrc-frontend-export/`): `npm test` y `npm run build` en verde.
- Orden: T1 y T2 pueden ir en paralelo (archivos disjuntos); luego T3 → T4 → T5 → T6 → T7 secuenciales (comparten `ui.css` y vistas).

## Tareas

### Task 1: Tokens de contraste y foco (auditoría 1, 2, 8 parte token, 21 placeholder)

**Files:** `src/styles/tokens.css`, `src/styles/base.css`, `src/styles/ui.css`, `src/lib/colorTema.js`, `src/lib/colorTema.test.js`.

**Requisitos:**
- Token `--line-control: #7F847C` (≥3:1 sobre `--surface`, `--surface-alt` y `--surface-page`; la prueba existente de contrastes de `tokens.css` en `colorTema.test.js` debe ampliarse para comprobarlo). Usarlo como borde en `.field-control`, `.btn-secundario`, `.color-input`, los filtros de Historial y el botón de navegación del Calendario (estos dos últimos se migran en T5/T6: aquí solo CSS/tokens). `--line` queda solo para divisores y paneles.
- Foco independiente del color de marca: en `base.css`, `:focus-visible` pasa a `outline: 2px solid var(--ink); outline-offset: 2px;` más un halo `box-shadow: 0 0 0 5px var(--surface)` para que el anillo se vea sobre fondos oscuros o de marca (conservar `!important` solo donde ya estaba y justificarlo en un comentario).
- `::placeholder { color: var(--ink-2); opacity: 1; }`.
- En `colorTema.js`: función exportada `colorLegibleSobreBlanco(hex)` con el MISMO contrato que `backend/perfil.js` (el mismo `hex` si contrasta ≥4.5 con blanco, si no la tinta `#1F2421`; entrada inválida → tinta) y `colorTextoMarca(hex)`: oscurece el color de marca mezclándolo con la tinta en pasos del 10 % hasta alcanzar ≥4.5:1 contra blanco (entrada inválida → `COLOR_POR_DEFECTO`). `aplicarColorTema` define además `--color-primario-texto` = `colorTextoMarca(color)`. `tokens.css` declara `--color-primario-texto: #1F6B4F` por defecto. `base.css` `.text-brand` usa `var(--color-primario-texto)`.
- Pruebas (`colorTema.test.js`): `colorLegibleSobreBlanco` y `textoSobre` coinciden con los casos del backend (`#FFD400`→tinta/tinta; `#1F6B4F` y `#4f46e5`→ellos mismos/blanco; `#FFFFFF`→tinta); `colorTextoMarca('#FFD400')` contrasta ≥4.5 con blanco y conserva matiz (R>B); `colorTextoMarca('#1F6B4F')` devuelve el mismo; `aplicarColorTema` fija `--color-primario-texto`; contraste de `--line-control` ≥3 en las tres superficies.

### Task 2: Shell: título, foco por vista y estado del servidor (auditoría 3, 19, 20)

**Files:** `src/App.jsx`, `src/ui/PageHeader.jsx`, `src/styles/shell.css`.

**Requisitos:**
- `PageHeader`: el `h1` lleva `tabIndex={-1}`.
- `App.jsx`: un `useEffect([view])` (omitiendo la primera ejecución) que ponga `document.title = \`${etiqueta} · SGCRC\`` (etiqueta de `NAV`; título inicial `SGCRC — Cobros Recurrentes` se conserva en `index.html`; también al montar con la vista actual) y mueva el foco, tras el siguiente render, al `h1` de `#contenido` (`document.querySelector('#contenido h1')`) o, si aún no existe (vista cargando), al propio `main#contenido`. Tras cerrar sesión (login) el título vuelve a `SGCRC — Cobros Recurrentes`.
- Estructura móvil: sacar `barra-movil` y `nav-movil` de `<main>`: un contenedor `div.principal` (`flex: 1; min-width: 0; display: flex; flex-direction: column`) con `barra-movil`, `nav-movil` y `main#contenido` dentro, de modo que "Saltar al contenido" salte de verdad el menú en móvil; el relleno de `.contenido` no cambia a escritorio. No introducir cambios visuales en escritorio.
- Estado del servidor: `role="status"` solo cuando `backendOk === false` (error); en los demás estados es texto sin rol (se evita el anuncio doble en cada login). Mantener el texto y el punto.

### Task 3: Errores de red en español y Dashboard puntual (auditoría 5 mensajes crudos, 9, 10, 11, 22)

**Files:** `src/lib/errores.js` + `src/lib/errores.test.js` (nuevos), todas las vistas que muestran `e.message` de carga/guardado (`Clientes.jsx`, `Planes.jsx`, `Suscripciones.jsx`, `Configuracion.jsx`, `Historial.jsx`, `Calendario.jsx`, `Dashboard.jsx`), `Login.jsx` (usar el helper en lugar de su lógica propia).

**Requisitos:**
- `mensajeError(e: unknown): string`: si `e` es un `TypeError` (fallo de red de `fetch`: "Failed to fetch", "NetworkError…", "Load failed") → `'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.'`; si `e.message` es una cadena no vacía → esa cadena; si no → `'Ocurrió un error inesperado.'`. Pruebas: `TypeError('Failed to fetch')`, `Error('Cliente con suscripciones vinculadas.')`, `null`, `{}`, `Error('')`.
- Sustituir `e.message` por `mensajeError(e)` en cada `catch` que alimente `ErrorMsg`, `toast.error` o el estado de error de carga. En Login, usar el helper manteniendo el caso "Respuesta inesperada del servidor." y los mensajes del backend.
- Dashboard (solo puntual, sin rediseño; la Fase 6 lo reemplaza): (a) `hoyStr` y la comparación de "Enviados Hoy" con la fecha LOCAL (componentes locales; comparar el día local de `new Date(h.fecha)` con el de hoy; probado con una función pura exportada en `lib/formato.js` o `lib/fechas.js` — `esHoyLocal(isoUtc, ahora = new Date())` — con pruebas que incluyan un envío a las 20:00 locales de Bogotá, que en UTC ya es el día siguiente: usar `new Date(2026, 9, 20, 20, 0)` local y su ISO); (b) eliminar el chip "INFO"; (c) textos sin `text-[10px]`: "Inició…" a `text-sm` con color de tinta secundaria legible (≥4.5:1) y "TOCA COBRAR HOY" a `text-sm` con rojo más oscuro; (d) estados de carga y error con `Skeleton` y `ErrorMsg` dentro de un `PageHeader` (hoy sin `h1`); (e) quitar `animate-in fade-in duration-500` y el `p-4` que duplica el relleno de `.contenido`.

### Task 4: Historial (auditoría 4, 5, 12, 13, 14, 15)

**Files:** `src/views/Historial.jsx`, `src/styles/ui.css`, y lógica pura nueva en `src/lib/historial.js` + `src/lib/historial.test.js` si se extrae (índices por id, orden seguro, límite de filas).

**Requisitos:**
- Carga: `Skeleton` solo en la primera carga (cuando aún no hay datos); "Actualizar" y "Reintentar" mantienen el encabezado, los filtros y la tabla visibles con `Button cargando={...}` (el foco no se pierde). Con error de carga no se muestran tarjetas de resumen ni "Sin registros" (afirmaría falsamente que no hay envíos): solo `ErrorMsg` con reintento; si ya había datos previos se conservan y el error va en `toast.error`.
- Vacío: `EmptyState` fuera de la tabla ("Aún no hay envíos" o, con filtro activo, "Ningún envío con ese estado" con acción "Quitar filtro").
- Tabla: `caption.sr-only`, contenedor `.tabla-wrap` con `tabIndex={0} role="region" aria-label="Historial de envíos"`, `th scope="col"` (ya) y filas con `data-label`; usar las clases `.tabla`/`.num` de `ui.css` en lugar de estilos en línea; importes a la derecha con `.num`.
- Filtros: `role="group" aria-label="Filtrar por estado"`, botones con `Button tam="sm" aria-pressed` (primario el activo), y un `<p className="sr-only" aria-live="polite">` con `N registros` al cambiar de filtro; sin estilos en línea.
- Rendimiento: índices (`Map`) de clientes y suscripciones por id en lugar de `find` por fila; orden descendente seguro (`Date.parse(...) || 0`); mostrar los primeros 100 registros con botón "Ver más" (suma 100) y texto "Mostrando X de N". Fechas: `toLocaleString('es-CO')` para ISO con hora y `fmtFecha` para cadenas solo con fecha.
- Celdas sin dato: `<span aria-hidden="true">—</span><span className="sr-only">Sin dato</span>`.
- Pruebas para la lógica pura extraída (orden, límite, mapa, formato de fecha).

### Task 5: Calendario (auditoría 5, 6, 7, 8, 16, 17, 18, 21)

**Files:** `src/views/Calendario.jsx`, `src/styles/ui.css`, y lógica pura en `src/lib/calendario.js` + `src/lib/calendario.test.js` (agrupar cobros por día del mes, huso local, días del mes).

**Requisitos:**
- Encabezado siempre presente: `PageHeader` también en carga y error (el error con `ErrorMsg` + reintento dentro de la vista, conservando el calendario previo si ya había datos); `EmptyState` cuando no hay suscripciones activas y texto "Este mes no tiene cobros" cuando el mes no tiene ninguno (en lugar de "Selecciona un día con cobros").
- Jerarquía: mes como `h2` con `aria-live="polite"` (el cambio de mes se anuncia) y panel del día con `h3`; botón "Hoy" que vuelve al mes y día actuales; botones de mes de 44 px.
- Selección: `prev`/`next` reinician el día seleccionado; el panel de detalle es una región `role="region" aria-label="Detalle del día"` con `aria-live="polite"` y título con fecha completa (`15 de octubre de 2026`).
- Celdas: botones con `aria-label` (ya) más `aria-pressed`; la celda de hoy con `aria-current="date"`; días sin cobros sin ruido (oculta para lectores o `aria-label` "sin cobros"); importe con `title` completo y color de tinta (no `--ok` sobre la celda seleccionada: 4.33:1); fuente ≥13 px en importe y chips.
- Móvil mínimo (la Fase 5 hará la vista de agenda): la rejilla se apila con `grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr))`, el panel de detalle debajo del calendario, celdas con `min-width: 0` y, a ancho estrecho, solo número y contador de cobros.
- Fechas: `fmtFecha(s.fecha_alta) || 'Sin fecha'`; `cliente?.nombre || 'Cliente eliminado'`; parsear `fecha_alta` como fecha local (`new Date(f + 'T00:00:00')`), no UTC. Sustituir estilos en línea por clases de `ui.css` (`.cal-*`) usando solo tokens y `--line-control` en el borde de los botones.
- Pruebas de la lógica pura: agrupación por día, mes de 28/29/30/31 días, una suscripción con fecha de alta el 31 en un mes de 30 días, huso (usar `new Date(y, m, d)` locales).

### Task 6: Configuración y textos de ayuda (adaptación al correo, aria-live; auditoría ya conocida)

**Files:** `src/views/Configuracion.jsx`, `src/views/Clientes.jsx`, `src/views/Planes.jsx`, `src/ui/ErrorMsg.jsx`, `src/styles/ui.css`.

**Requisitos:**
- Configuración refleja la regla real del correo: el botón de la vista previa usa `textoSobre(colorValido)` (fondo `var(--color-primario)`, texto con `var(--color-primario-contraste)`: el `aplicarColorTema` acotado ya lo calcula) en lugar de blanco fijo; el monto de muestra usa `colorLegibleSobreBlanco(color)` (inline style con ese valor). El contraste mostrado es `ratioContraste(color, textoSobre(color))` (texto del botón): ≥4.5 → "Contraste suficiente en tus correos (X:1)"; <4.5 (tonos medios) → "Contraste bajo en tus correos (X:1): el texto del botón se leerá mal. Prueba un tono más oscuro o más claro.". Eliminar la advertencia antigua sobre "texto blanco".
- `aria-live`: la línea visible NO es región viva; un `<p className="sr-only" aria-live="polite">` aparte contiene un texto fijo por estado ("Contraste suficiente" / "Contraste bajo") para que solo se anuncie al cambiar de estado, no al arrastrar el selector.
- Clientes: el mensaje del `ConfirmDialog` añade "Si tiene suscripciones (incluso inactivas) no se puede eliminar: elimínalas primero."
- Planes: `ayuda` del día de cobro: "Solo se usa en suscripciones sin fecha de inicio; en las demás el cobro cae el día de su fecha de inicio."
- `ErrorMsg`: el botón Reintentar pasa a tamaño normal (44 px; quitar `tam="sm"`).

### Task 7: Documentación y cierre

**Files:** `sgcrc-frontend-export/CLAUDE.md`.

- [ ] Documentar `lib/errores.js`, `lib/historial.js`, `lib/calendario.js`, `--line-control`, el foco independiente de la marca, `--color-primario-texto`, `document.title` y foco al `h1` por vista, la estructura `.principal`, y la regla del correo (texto del botón y color del monto) en "Theming". Verificar con `npm test` y `npm run build`. Commit `docs(frontend): documenta los cambios de accesibilidad de la Fase 4`.
