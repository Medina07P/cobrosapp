# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Subproyecto: Frontend

React 18 + Vite. SPA que enruta por estado (sin React Router). Tailwind CSS cargado por CDN.

## Comandos

```bash
npm run dev      # Servidor Vite en puerto 5173, proxy /api → http://localhost:3000
npm run build    # Build de producción en dist/
npm run preview  # Preview del build local
```

## Estructura de src/

| Archivo / Carpeta | Rol |
|---|---|
| `main.jsx` | Bootstrap React: importa fuentes y los estilos `src/styles/tokens.css` y `src/styles/base.css`, y monta la app |
| `styles/` | `tokens.css` (variables CSS) y `base.css` (estilos base) |
| `lib/colorTema.js` | `aplicarColorTema` y helpers de contraste del color de marca (tests: `npm test`) |
| `ui/Icon.jsx` | Componente de iconos; `npm run icons` regenera `ui/icons.generated.js` |
| `ui/Logo.jsx` | Logo SGCRC en SVG |
| `App.jsx` | Shell de la SPA: estado `view`, objeto `VIEWS`, sidebar desktop + tabs mobile |
| `api.js` | Cliente HTTP con `fetch`, base `/api`, inyecta `Authorization: Bearer <token>`, borra la sesión del localStorage en 401 (sin recargar) |
| `components.jsx` | Componentes compartidos (tarjetas, tabla, modal, badges) |
| `views/Login.jsx` | Login y registro (toggle en la misma vista) |
| `views/Dashboard.jsx` | KPIs + próximos cobros + botón "ejecutar cobros del día" |
| `views/Clientes.jsx` | ABM de clientes |
| `views/Planes.jsx` | ABM del catálogo de planes |
| `views/Suscripciones.jsx` | ABM de suscripciones (vincula cliente + plan) |
| `views/Historial.jsx` | Listado de envíos con estado y monto |
| `views/Calendario.jsx` | Vista calendario de próximos cobros |
| `views/Configuracion.jsx` | Perfil: nombre + color de marca + WhatsApp |

## Cómo agregar una vista

1. Crear `src/views/MiVista.jsx` exportando un componente React.
2. En `App.jsx`, importar el componente y registrarlo en el objeto `VIEWS`:
   ```jsx
   const VIEWS = {
     // ... existentes ...
     mivista: MiVista,
   };
   ```
3. Agregar el ítem en el array de navegación del sidebar y las tabs mobile (buscar donde están los demás items con `onClick={() => setView('clientes')}`).

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
- El color de marca se aplica SOLO mediante `aplicarColorTema(document.documentElement, hex)` de `src/lib/colorTema.js` (llamada desde `App.jsx` al login/refrescar perfil y desde `Configuracion.jsx` para la vista previa en vivo). Define `--color-primario`, `--color-primario-glow` y `--color-primario-contraste`.
- El texto sobre un fondo con color de marca debe usar `var(--color-primario-contraste)`, no `text-white`.
- Nunca llamar a `setProperty('--color-primario', ...)` directamente.
- Los componentes deben usar `var(--color-primario)` en estilos inline o clases Tailwind con `[color:var(--color-primario)]`. No hardcodear colores de marca.

## Tailwind por CDN

Tailwind se carga desde CDN en `index.html`. **No hay `tailwind.config.js` ni PostCSS instalado.** No agregar esos archivos esperando que funcionen — el build de Vite los ignorará ya que Tailwind no está en las dependencias.

## Sesión / Auth

- El JWT se guarda en `localStorage` con la clave `sgcrc_session` como objeto `{ token, user }`.
- `api.js` lee `sgcrc_session.token` para el header `Authorization`.
- En cualquier respuesta 401, `api.js` elimina `sgcrc_session` del localStorage pero NO recarga la página ni redirige (el `reload` está comentado); `App.jsx` cierra sesión cuando una petición de perfil falla con 401.

## Gotchas

- `axios` está declarado en `package.json` pero **no se usa** — el código usa `fetch` nativo en `api.js`. No mezclar los dos en código nuevo.
- El proxy Vite (`/api` → `:3000`) solo funciona en desarrollo. En producción, el frontend sirve desde nginx/apache y el backend en `:3000` debe ser accesible directamente o vía proxy reverso.
