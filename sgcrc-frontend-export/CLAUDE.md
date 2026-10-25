# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Subproyecto: Frontend

React 18 + Vite. SPA que enruta por estado (sin React Router). El shell, `ui/*` y las vistas migradas usan CSS propio (`src/styles/`); ninguna vista usa ya Tailwind (el CDN de `index.html` queda sin uso; ver "Pendiente de migrar").

## Comandos

```bash
npm run dev      # Servidor Vite en puerto 5173, proxy /api → http://localhost:3000
npm run build    # Build de producción en dist/
npm run preview  # Preview del build local
```

## Estructura de src/

| Archivo / Carpeta | Rol |
|---|---|
| `main.jsx` | Bootstrap React: importa fuentes y los estilos `src/styles/tokens.css`, `base.css`, `ui.css` y `shell.css`, y monta la app junto con `ToastRegion` |
| `styles/` | `tokens.css` (variables CSS), `base.css` (estilos base), `ui.css` (clases de los componentes base y de estructura de vistas) y `shell.css` (shell: sidebar clara, barra superior y barra inferior móviles, y `.acceso*` del login) |
| `lib/colorTema.js` | `aplicarColorTema`, `parseHex`, `ratioContraste`, `textoSobre`, `COLOR_POR_DEFECTO`, `TINTA`, más `colorLegibleSobreBlanco` (color de marca si contrasta >= 4.5 con blanco, si no `TINTA`; mismo contrato que `backend/perfil.js`) y `colorTextoMarca` (variante del color mezclada con la tinta hasta contrastar >= 4.5 sobre blanco, `--surface-page` y `--surface-alt`; alimenta `--color-primario-texto`). Tests: `npm test` |
| `lib/contrasteCorreo.js` | `estadoContrasteCorreo(hex)`: `{ ratio, suficiente, textoBoton, colorMonto }` con la regla real del correo (contraste del texto del botón; el monto cae a tinta si el color no contrasta con blanco) |
| `lib/errores.js` | `mensajeError(e)`: texto en español para cualquier error capturado (red/`TypeError`, `SyntaxError` por respuesta no JSON, `Error NNN` sin cuerpo JSON como lo construye `api.js`; el resto conserva el mensaje del backend) |
| `lib/historial.js` | Lógica pura del Historial: `enriquecerHistorial`, `indexarPorId`, `limitarFilas` (`LIMITE_FILAS` = 100), `fechaHistorial`, `textoRegistros` |
| `lib/calendario.js` | Lógica pura del Calendario: fechas locales, rejilla del mes, `agruparCobrosPorDia` y `tocaCobrarEn`, réplica exacta de `backend/cobros.js` (una prueba de paridad en `calendario.test.js` las compara) |
| `lib/dashboard.js` | Lógica pura del Dashboard: `aISOLocal`, `sumarDiasISO`, `proximosCobros(subs, clientes, desdeISO, { max, ventana })` (una fila por suscripción activa, primera fecha de cobro en la ventana de 60 días según `tocaCobrarEn`) y `textoDias` (`Hoy`, `Mañana`, `En N días`). Tests: `npm test` |
| `lib/navegacion.js` | `NAV` (los 7 destinos), `IDS_BARRA_MOVIL`, `particionarNav` (`{ barra, mas }`) y `vistaEnMas`: reparto de destinos entre la barra inferior y "Más" en móvil. Tests: `npm test` |
| `lib/validaciones.js` | `validarCliente`, `validarPlan`, `validarSuscripcion`, `validarPerfil`: espejo de las reglas del backend; devuelven un objeto `{campo: mensaje}` (vacío si es válido) |
| `lib/formularios.js` | `enfocarPrimerInvalido(contenedor)` (y `primerInvalido`): enfoca el primer campo con error |
| `lib/formato.js` | `fmt` (moneda COP), `fmtFecha` (`AAAA-MM-DD` a `DD/MM/AAAA`, sin desfase de zona horaria) y `esHoyLocal` (¿una fecha ISO UTC cae hoy en el día calendario local?) |
| `lib/toastStore.js`, `lib/focoDialog.js` | Almacén de toasts y trampa de foco (con pruebas, `npm test`) |
| `ui/Icon.jsx` | Componente de iconos; `npm run icons` regenera `ui/icons.generated.js` |
| `ui/Logo.jsx` | Logo SGCRC en SVG |
| `ui/NavMovil.jsx` | Barra inferior móvil (4 destinos fijos + "Más") y panel "Más" (resto de destinos y "Salir"); ver "Móvil (Fase 5)" |
| `ui/PageHeader.jsx` | Encabezado de página (`titulo`, `descripcion`, `acciones`): el único `h1` de cada vista |
| `ui/` | Componentes base (Button, Badge/EstadoBadge, Field, Dialog, ConfirmDialog, Toast, EmptyState, Skeleton, ErrorMsg, PageHeader, Icon, Logo); estilos en `styles/ui.css` |
| `App.jsx` | Shell de la SPA: estado `view`, `NAV` y objeto `VIEWS`. Escritorio: sidebar clara (`.lateral`) con `aria-current="page"` en el ítem activo. Móvil: barra superior (`.barra-movil`) y `NavMovil` (barra inferior fija); `div.principal` envuelve la barra superior y `main#contenido`. `NAV` vive en `lib/navegacion.js`. Enlace "Saltar al contenido" (`.saltar`) hacia `main#contenido`. Al cambiar de vista actualiza `document.title` y mueve el foco al `h1` de la vista (o a `main` si no hay; no lo hace en el primer render ni sin sesión). El estado del servidor se anuncia con una región `role="status"` `sr-only` siempre montada, una sola vez en el shell; el texto visible (`.estado-server`) no lleva `role`. Ya no usa Tailwind |
| `api.js` | Cliente HTTP con `fetch`, base `/api`, inyecta `Authorization: Bearer <token>`, borra la sesión del localStorage en 401 (sin recargar) |
| `views/Login.jsx` | Login y registro (toggle en la misma vista); usa `.acceso*` de `shell.css` |
| `views/Dashboard.jsx` | Migrado (Fase 6): franja "Hoy" (`.hoy-franja`: pendientes hoy, vencidos, enviados y fallidos de hoy, alimentada por `api.getResumenCobros()` = `GET /cobros/resumen`), "Tu negocio", libro de próximos cobros (`ol.libro`) y diálogo de resumen de envío; ver "Dashboard (Fase 6)" |
| `views/Clientes.jsx` | ABM de clientes con búsqueda (patrón de formulario de referencia) |
| `views/Planes.jsx` | ABM del catálogo de planes (se llama "Planes" en el menú) |
| `views/Suscripciones.jsx` | ABM de suscripciones (vincula cliente + plan) con filtros |
| `views/Historial.jsx` | Listado de envíos con estado y monto (migrado: accesible, con límite de filas y estados vacíos; usa `lib/historial.js`) |
| `views/Calendario.jsx` | Calendario de próximos cobros (migrado: panel de detalle anunciado, rejilla que se apila y, en móvil, agenda por día `.cal-agenda`; usa `lib/calendario.js`) |
| `views/Configuracion.jsx` | Perfil: nombre + color de marca (con validación de contraste y vista previa en vivo) + WhatsApp |

## Móvil (Fase 5)

- **Un solo breakpoint móvil**: `@media (width < 768px)` (sintaxis de rango; complementa sin hueco al `@media (width >= 768px)` del shell de escritorio, así que a 767 y 768 px siempre hay exactamente una navegación). Ahí aparece la barra inferior y las tablas pasan a tarjetas.
- **`NavMovil`**: barra inferior fija (`.nav-inferior`, flex con `space-around`; los ítems se reparten según su contenido) con Dashboard, Clientes, Suscripciones, Calendario y "Más" (`aria-expanded`, `aria-controls="panel-mas"`). El panel `.panel-mas` lista Planes, Historial, Configuración y "Salir"; se cierra con Escape (devuelve el foco a "Más") o clic fuera; si se elige la vista ya activa, el foco vuelve a "Más". "Más" lleva `aria-current` cuando la vista activa está en el panel. Las etiquetas de la barra son completas (nombre accesible = texto visible). El panel es `role="group"` con `aria-label="Más opciones"`, se cierra al salir el foco del contenedor y al pasar a escritorio, y su Escape se ignora si hay un diálogo abierto. Las zonas seguras laterales (`viewport-fit=cover`) se aplican con `env(safe-area-inset-left/right)` en `.lateral`, `.contenido`, `.barra-movil`, `.nav-inferior` y `.panel-mas`. `.contenido` y `.toast-region` reservan espacio para la barra.
- **Tablas como tarjetas**: solo con CSS (`ui.css`). El `thead` se oculta visualmente, cada `tr` es una tarjeta y cada `td` muestra su `data-label` como etiqueta (`td::before`). Toda tabla nueva debe poner `data-label` en cada celda (`Acciones` sin etiqueta). Toda tabla nueva debe llevar `role` explícitos (`table`, `rowgroup`, `row`, `columnheader`, `cell`) para conservar la semántica con `display` distinto de `table`.
- **Objetivos táctiles**: en móvil botones, campos y filtros miden al menos 44 px (también los `btn-sm`).
- **Agenda del Calendario**: en móvil se oculta la rejilla y el detalle y se muestra `.cal-agenda` (un bloque por día con cobros; `etiquetaAgenda` y `diaSemanaCorto` de `lib/calendario.js`).
- **Cómo verificar a 360 px**: con sesión iniciada, inyectar en una pestaña de la app un `<iframe src="/" style="width:360px;height:740px">` (mismo origen) y medir ahí (`scrollWidth <= innerWidth`, objetivos < 44 px, contenido bajo la barra).

## Dashboard (Fase 6)

- Estructura: `PageHeader` con el botón secundario de acción, con tres estados: con pendientes (`paraHoy` o `vencidos`) "Revisar y enviar cobros de hoy" (abre el diálogo, no envía); sin pendientes pero con envíos 'Enviado' hoy, "Reenviar cobros de hoy" (llama directo a `handleForzarCobros(false)`: el 409 `requiereConfirmacion` abre el diálogo de reenvío; es la única vía del reenvío manual); sin ninguno, `disabled` con la razón visible "No hay cobros pendientes de enviar hoy." enlazada con `aria-describedby`. Tras un envío correcto el foco pasa a `h2#dash-hoy` (`tabIndex={-1}`). `desdeISO` de los próximos cobros es `resumen.hoy` (fecha de la app, America/Bogota); tres `section` con `h2` (`Hoy`, `Tu negocio`, `Próximos cobros`). Carga con `Promise.all` de clientes, suscripciones, historial y `getResumenCobros`; si el refresco posterior falla, `ErrorMsg` sin perder los datos (excepción a "`toast.error` en recargas": el Dashboard no usa toast ahí).
- Cifras: `dl` con `.cifra` (`dt.cifra-rotulo`, `dd.cifra-valor` en `--font-display`, `dd.cifra-sub`). `.hoy-franja` (cifras grandes, `.cifra-mal` solo con vencidos > 0) y `.negocio` (cifras discretas). "Enviados hoy" y "Fallidos" salen del historial con `esHoyLocal`; "Fallidos" cuenta registros del historial de hoy, no suscripciones. `.dash-aviso` para el aviso de cobros perdidos (fuera de la ventana de reintento) y el de "sin pendientes".
- Libro de próximos cobros: `ol.libro` > `li.libro-fila` (fecha + `textoDias` o `Badge` "Hoy" con `bell` | cliente + plan y frecuencia | monto), 3 columnas que a `width < 768px` pasan a dos líneas. Vacío: `EmptyState` (h3, para no repetir nivel dentro de la sección h2).
- Diálogo de resumen (`ConfirmDialog` "Enviar cobros de hoy"): lista `.resumen-envio` con cliente, plan, monto y "vencido hace N días", total y botón "Enviar N cobros"; solo se cierra al terminar. El diálogo de reenvío (409 `requiereConfirmacion`) se conserva.
- Al probar en navegador NO pulsar "Enviar" (envía correos reales); basta abrir y cerrar el diálogo.

## Pendiente de migrar

Nada: todas las vistas usan CSS propio. Queda por retirar el `<script>` de Tailwind CDN de `index.html` (ya sin uso) y el preflight asociado.

## Componentes base

- Usar `toast.exito/error/info` (de `ui/Toast.jsx`) en vez de `alert`.
- Usar `ConfirmDialog` en vez de `confirm`.
- Usar `Field` (label obligatorio y asociado) en vez de `<input>` suelto.
- `Button` con `variante` (`primario`/`secundario`/`peligro`), `tam` (`md`/`sm`) y `cargando`. Con `cargando` usa `aria-disabled` (no `disabled` nativo) para conservar el foco y no ejecuta `onClick`.
- `ToastRegion` se monta una sola vez (en `main.jsx`).
- `data-autofocus` en un elemento del `Dialog` elige el foco inicial.
- `ConfirmDialog` usa `role="alertdialog"` (el `Dialog` acepta la prop `rol`) y enlaza el cuerpo con `aria-describedby`.
- Cada vista tiene un único `h1`, mediante `PageHeader`.

### Estructura de vistas (`ui.css`)

`.pagina` (contenedor de la vista), `.panel` (+ `.panel-titulo`), `.form-grid`, `.form-acciones`, `.herramientas` (búsqueda y filtros), `.check`, `.tabla-wrap` y `.tabla`. La tabla va en `<div className="tabla-wrap" tabIndex={0} role="region" aria-label="...">` con `<caption className="sr-only">`, `th scope="col"` y `data-label` en las celdas (para la vista móvil).

### Patrón de formulario (referencia: `Clientes.jsx`)

1. `<form ref={formRef} noValidate onSubmit={guardar}>` con campos `Field` (`error={errores.campo}`); al escribir se limpia el error de ese campo.
2. Al enviar: `validar*(form)` de `lib/validaciones.js`. Si hay errores, `setErrores(v)` y `requestAnimationFrame(() => enfocarPrimerInvalido(formRef.current))`, sin llamar a la API.
3. Si es válido: `Button cargando={guardando}`, llamada a `api`, `toast.exito(...)` o `toast.error(mensajeError(e))` (de `lib/errores.js`, nunca `err.message` directo).
4. Borrar siempre con `ConfirmDialog` (`peligro`), nunca `confirm`.

### Listas y carga

- `Skeleton` solo en la carga inicial; si falla, `ErrorMsg` con `onRetry`. `reintentar` vuelve a poner `cargando`.
- Un fallo de recarga posterior (tras guardar o eliminar) muestra `toast.error` y conserva la lista.

## Cómo agregar una vista

1. Crear `src/views/MiVista.jsx` exportando un componente React.
2. En `App.jsx`, importar el componente y registrarlo en el objeto `VIEWS`, que guarda elementos JSX (no se memoiza, para que los callbacks como `onGuardado` nunca queden obsoletos):
   ```jsx
   const VIEWS = {
     // ... existentes ...
     mivista: <MiVista />,
   }
   ```
3. Agregar el ítem al array `NAV` de `src/lib/navegacion.js` (`id`, `label`, `icon`); alimenta el sidebar y la navegación móvil. Un destino nuevo cae en el panel "Más" de la barra móvil salvo que su `id` se agregue a `IDS_BARRA_MOVIL` (la barra admite pocos ítems; ver `navegacion.test.js`).
4. Encabezar la vista con `PageHeader` (único `h1`) dentro de `.pagina`.

## Patrón de llamadas a la API

Toda comunicación con el backend pasa por `src/api.js`. Agregar métodos ahí para nuevos endpoints:

```js
// dentro del objeto exportado `api`
getMisRecursos: () => req('GET', '/mi-recurso'),
createMiRecurso: (data) => req('POST', '/mi-recurso', data),
```

`req(method, path, body)` es el cliente interno (no se exporta; se exporta el objeto `api`). Antepone `/api`, serializa el cuerpo a JSON, inyecta el token JWT y lanza un `Error` con `err.response = { status, data }` si la respuesta no es OK.

## Theming

- El color del usuario se guarda en DB como `color_tema` (hex, ej: `#4f46e5`).
- El color de marca se aplica SOLO mediante `aplicarColorTema(elemento, hex)` de `src/lib/colorTema.js`. `App.jsx` lo llama sobre `document.documentElement` al login/refrescar perfil y `Configuracion.jsx` tras guardar. Define `--color-primario`, `--color-primario-glow`, `--color-primario-contraste` (`textoSobre`) y `--color-primario-texto` (`colorTextoMarca`, para usar la marca como texto: clase `.text-brand`).
- `--line-control` (`tokens.css`) es el borde de controles interactivos (>= 3:1 sobre las superficies); `--line` queda para divisores decorativos. El anillo de foco (`base.css`, `:focus-visible`) usa la tinta y es independiente del color de marca; `.contenido:focus-visible` (`shell.css`) lo anula solo en el `main`, no en el `h1`.
- La vista previa en vivo de Configuración usa `aplicarColorTema(previaRef.current, color)` sobre su propio elemento (`.vista-previa`), no sobre `documentElement`: el color de la app solo cambia al guardar.
- Regla del correo (`backend/perfil.js` y `backend/mailer.js`): el botón lleva `textoSobre(color)` (blanco o `#1F2421`) y el monto lleva el color de marca si contrasta >= 4.5 con blanco, si no `#1F2421`. Configuración usa `estadoContrasteCorreo` (contraste del texto del botón, mínimo 4.5), avisa cuando el monto se oscurece y dibuja la vista previa sobre una tarjeta blanca (`.vista-previa-correo`, como el correo). La app usa `--color-primario-contraste` para el texto sobre el color de marca.
- Nunca llamar a `setProperty('--color-primario', ...)` directamente. No hardcodear colores de marca.
- En `ui/*`, el shell y las vistas migradas se usan las clases de `ui.css`/`shell.css` y variables CSS, sin Tailwind. El Dashboard ya sigue el mismo patrón.

## Tailwind por CDN

Tailwind sigue cargándose desde CDN en `index.html`, pero ninguna vista lo usa ya (pendiente retirarlo). **No hay `tailwind.config.js` ni PostCSS instalado.** No agregar esos archivos esperando que funcionen — el build de Vite los ignorará ya que Tailwind no está en las dependencias. No usar Tailwind en código nuevo.

## Sesión / Auth

- El JWT se guarda en `localStorage` con la clave `sgcrc_session` como objeto `{ token, user }`.
- `api.js` guarda el token en memoria (variable `runtimeToken`) mediante `setApiKey(token)`; no lee `localStorage`. `App.jsx` lo establece al restaurar la sesión desde `sgcrc_session` y en el login, y lo vacía al cerrar sesión.
- En cualquier respuesta 401, `api.js` elimina `sgcrc_session` del localStorage pero NO recarga la página ni redirige (el `reload` está comentado); `App.jsx` cierra sesión (`handleLogout`) cuando `getPerfil` o el health check fallan con 401.
- Al guardar Configuración, `onGuardado(payload)` actualiza `session.user` y `sgcrc_session`, de modo que el nombre del shell se refleja sin recargar.
- Antes de desplegar, probar `npm run build && npm run preview`: el preflight de Tailwind CDN puede interactuar con las clases de `ui.css`.

## Gotchas

- `axios` está declarado en `package.json` pero **no se usa** — el código usa `fetch` nativo en `api.js`. No mezclar los dos en código nuevo.
- El proxy Vite (`/api` → `:3000`) solo funciona en desarrollo. En producción, el frontend sirve desde nginx/apache y el backend en `:3000` debe ser accesible directamente o vía proxy reverso.
