# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Subproyecto: Frontend

React 18 + Vite. SPA que enruta por estado (sin React Router). El shell, `ui/*` y las vistas migradas usan CSS propio (`src/styles/`); Tailwind por CDN solo sigue en las vistas pendientes de migrar (ver "Pendiente de migrar").

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
| `styles/` | `tokens.css` (variables CSS), `base.css` (estilos base), `ui.css` (clases de los componentes base y de estructura de vistas) y `shell.css` (shell: sidebar clara, barra y navegación móvil, y `.acceso*` del login) |
| `lib/colorTema.js` | `aplicarColorTema`, `parseHex`, `ratioContraste`, `textoSobre`, `COLOR_POR_DEFECTO`, `TINTA` (contraste del color de marca; tests: `npm test`) |
| `lib/validaciones.js` | `validarCliente`, `validarPlan`, `validarSuscripcion`, `validarPerfil`: espejo de las reglas del backend; devuelven un objeto `{campo: mensaje}` (vacío si es válido) |
| `lib/formularios.js` | `enfocarPrimerInvalido(contenedor)` (y `primerInvalido`): enfoca el primer campo con error |
| `lib/formato.js` | `fmt` (moneda COP) y `fmtFecha` (`AAAA-MM-DD` a `DD/MM/AAAA`, sin desfase de zona horaria) |
| `lib/toastStore.js`, `lib/focoDialog.js` | Almacén de toasts y trampa de foco (con pruebas, `npm test`) |
| `ui/Icon.jsx` | Componente de iconos; `npm run icons` regenera `ui/icons.generated.js` |
| `ui/Logo.jsx` | Logo SGCRC en SVG |
| `ui/PageHeader.jsx` | Encabezado de página (`titulo`, `descripcion`, `acciones`): el único `h1` de cada vista |
| `ui/` | Componentes base (Button, Badge/EstadoBadge, Field, Dialog, ConfirmDialog, Toast, EmptyState, Skeleton, ErrorMsg, PageHeader, Icon, Logo); estilos en `styles/ui.css` |
| `App.jsx` | Shell de la SPA: estado `view`, `NAV` y objeto `VIEWS`. Escritorio: sidebar clara (`.lateral`) con `aria-current="page"` en el ítem activo. Móvil: barra superior (`.barra-movil`) y navegación en fila (`.nav-movil`). Enlace "Saltar al contenido" (`.saltar`) hacia `main#contenido`. Ya no usa Tailwind |
| `api.js` | Cliente HTTP con `fetch`, base `/api`, inyecta `Authorization: Bearer <token>`, borra la sesión del localStorage en 401 (sin recargar) |
| `views/Login.jsx` | Login y registro (toggle en la misma vista); usa `.acceso*` de `shell.css` |
| `views/Dashboard.jsx` | KPIs + próximos cobros + botón "ejecutar cobros del día" (estilos antiguos, pendiente de migrar) |
| `views/Clientes.jsx` | ABM de clientes con búsqueda (patrón de formulario de referencia) |
| `views/Planes.jsx` | ABM del catálogo de planes (se llama "Planes" en el menú) |
| `views/Suscripciones.jsx` | ABM de suscripciones (vincula cliente + plan) con filtros |
| `views/Historial.jsx` | Listado de envíos con estado y monto (estilos antiguos, pendiente de migrar) |
| `views/Calendario.jsx` | Vista calendario de próximos cobros (estilos antiguos, pendiente de migrar) |
| `views/Configuracion.jsx` | Perfil: nombre + color de marca (con validación de contraste y vista previa en vivo) + WhatsApp |

## Pendiente de migrar

Dashboard, Historial y Calendario conservan estilos antiguos (clases Tailwind y estilos en línea) hasta las Fases 5-6 del rediseño; por eso `index.html` aún carga Tailwind por CDN. El resto del frontend (shell, `ui/*`, Login, Clientes, Planes, Suscripciones, Configuración) ya no usa Tailwind.

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
3. Si es válido: `Button cargando={guardando}`, llamada a `api`, `toast.exito(...)` o `toast.error(err.message)`.
4. Borrar siempre con `ConfirmDialog` (`peligro`), nunca `confirm`.

### Listas y carga

- `Skeleton` solo en la carga inicial; si falla, `ErrorMsg` con `onRetry`. `reintentar` vuelve a poner `cargando`.
- Un fallo de recarga posterior (tras guardar o eliminar) muestra `toast.error` y conserva la lista.

## Cómo agregar una vista

1. Crear `src/views/MiVista.jsx` exportando un componente React.
2. En `App.jsx`, importar el componente y registrarlo en el objeto `VIEWS`:
   ```jsx
   const VIEWS = {
     // ... existentes ...
     mivista: MiVista,
   };
   ```
3. Agregar el ítem al array `NAV` de `App.jsx` (`id`, `label`, `icon`); alimenta tanto el sidebar como la navegación móvil.
4. Encabezar la vista con `PageHeader` (único `h1`) dentro de `.pagina`.

## Patrón de llamadas a la API

Toda comunicación con el backend pasa por `src/api.js`. Agregar métodos ahí para nuevos endpoints:

```js
export const miRecurso = {
  getAll: () => apiFetch('/mi-recurso'),
  create: (data) => apiFetch('/mi-recurso', { method: 'POST', body: JSON.stringify(data) }),
};
```

`apiFetch` ya inyecta el token JWT y maneja el 401 automáticamente.

## Theming

- El color del usuario se guarda en DB como `color_tema` (hex, ej: `#4f46e5`).
- El color de marca se aplica SOLO mediante `aplicarColorTema(elemento, hex)` de `src/lib/colorTema.js`. `App.jsx` lo llama sobre `document.documentElement` al login/refrescar perfil y `Configuracion.jsx` tras guardar. Define `--color-primario`, `--color-primario-glow` y `--color-primario-contraste`.
- La vista previa en vivo de Configuración usa `aplicarColorTema(previaRef.current, color)` sobre su propio elemento (`.vista-previa`), no sobre `documentElement`: el color de la app solo cambia al guardar.
- El correo (`backend/mailer.js`) usa SIEMPRE texto blanco sobre el color del usuario; por eso Configuración calcula el contraste contra blanco (`ratioContraste(color, '#FFFFFF')`, mínimo 4.5). La app, en cambio, usa `--color-primario-contraste` para el texto sobre el color de marca.
- Nunca llamar a `setProperty('--color-primario', ...)` directamente. No hardcodear colores de marca.
- En `ui/*`, el shell y las vistas migradas se usan las clases de `ui.css`/`shell.css` y variables CSS, sin Tailwind. Solo las vistas pendientes de migrar usan estilos en línea con `var(--color-primario)` o clases Tailwind.

## Tailwind por CDN

Tailwind se carga desde CDN en `index.html` únicamente por las vistas pendientes de migrar. **No hay `tailwind.config.js` ni PostCSS instalado.** No agregar esos archivos esperando que funcionen — el build de Vite los ignorará ya que Tailwind no está en las dependencias. No usar Tailwind en código nuevo.

## Sesión / Auth

- El JWT se guarda en `localStorage` con la clave `sgcrc_session` como objeto `{ token, user }`.
- `api.js` lee `sgcrc_session.token` para el header `Authorization`.
- En cualquier respuesta 401, `api.js` elimina `sgcrc_session` del localStorage pero NO recarga la página ni redirige (el `reload` está comentado); `App.jsx` cierra sesión cuando una petición de perfil falla con 401.

## Gotchas

- `axios` está declarado en `package.json` pero **no se usa** — el código usa `fetch` nativo en `api.js`. No mezclar los dos en código nuevo.
- El proxy Vite (`/api` → `:3000`) solo funciona en desarrollo. En producción, el frontend sirve desde nginx/apache y el backend en `:3000` debe ser accesible directamente o vía proxy reverso.
