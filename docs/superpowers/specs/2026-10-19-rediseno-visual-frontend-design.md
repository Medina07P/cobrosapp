# Rediseño visual del frontend SGCRC

Fecha: 2026-10-19 · Alcance: `sgcrc-frontend-export/` · Contexto: `PRODUCT.md`, crítica en `.impeccable/critique/`

## Objetivo

Pasar de una plantilla genérica (17/40 en la crítica) a una interfaz propia de cobros recurrentes: sin emojis, con un único sistema visual, accesible (WCAG AA) y usable en móvil. Dirección elegida: **"libro de caja cálido"**.

## Decisiones

- **Un solo tema.** Se retira el tema oscuro/morado de Historial, Calendario y `components.jsx`.
- **Tokens en `:root`** (`--surface`, `--ink`, `--line`, `--ok`, `--warn`, `--bad`, `--info`), definidos en `main.jsx` junto a `--color-primario`. Los componentes usan variables, no hex ni colores de Tailwind.
- **Paleta:** papel `#F6F3EC`, superficies `#FFFFFF`/`#FBF9F4`, líneas `#E3DED2`, tinta `#1F2421`, texto secundario `#5C625C`. Acento por defecto `#1F6B4F`, sustituido por `color_tema` del usuario.
- **Contraste de marca:** se calcula `--color-primario-contraste` (blanco o tinta según luminancia) para que un color elegido no rompa botones. `${color}33` deja de asumir hex de 6 dígitos.
- **Estados fijos**, independientes de la marca y siempre con icono y texto: cobrado `#1F7A4D`, pendiente `#7F5800` sobre `#FBF1D6` (el `#9A6B00` original daba 4.17:1 y no cumplía AA), vencido/fallido `#B3261E` sobre `#FBE4E1`, enviado/info `#2D5F8B`.
- **Tipografía:** Fraunces (títulos y cifras grandes), IBM Plex Sans (interfaz), `tabular-nums` en montos alineados a la derecha. Fuentes autoalojadas en `woff2` con preload (servidor tras Starlink). Base 15 px, mínimo 12 px.
- **Iconos:** componente `Icon.jsx` con SVG inline de Phosphor (regular), `currentColor`, `aria-hidden`. Solo los iconos usados, sin librería completa. Se eliminan los 19 emojis y símbolos.
- **Logo SGCRC:** marca SVG (sello/recibo estilizado) que usa `currentColor`. Se retira el "●" y el nombre por defecto "Café Valdore" (`App.jsx:124,155`).
- **Sin sombras** salvo modales y menús flotantes. Radios de 6-8 px, líneas de 1 px.
- **Movimiento:** 120-180 ms en hover, foco y entrada de paneles. Sin `animate-pulse` infinito. Se respeta `prefers-reduced-motion`. Se eliminan las clases `animate-in` que no existen en Tailwind CDN.
- **Restricción técnica:** Tailwind sigue por CDN, sin `tailwind.config.js`. Los tokens se consumen con CSS propio y estilos en `main.jsx`/archivo CSS importado, no con utilidades personalizadas de Tailwind.

## Componentes base (fase 2)

`Field` (label visible, ayuda, error en línea, foco `outline: 2px solid var(--color-primario)`), `Button` (primario, secundario, peligro), `Badge` (rectangular, icono + texto), `Dialog` (`role="dialog"`, trampa de foco, Escape; reemplaza `confirm`), `Toast` (`aria-live`; reemplaza `alert`), `EmptyState` y `Skeleton`. `components.jsx` actual se reemplaza; el `Modal`, `Input` y `DateInput` sin uso se eliminan.

## Vistas

- **Shell:** sidebar clara con línea derecha y barra de 3 px en el ítem activo (`aria-current`). Nombre de empresa una sola vez. Estado del servidor como punto discreto. Móvil: barra inferior de 5 destinos con etiqueta y objetivos de 48 px.
- **Dashboard:** franja "Hoy" (a cobrar hoy, vencido, enviado, fallido) con cifras serif y acción directa. Lista de próximos cobros estilo libro de cuentas. "Forzar cobros" pasa a acción secundaria con diálogo que resume qué se enviará y a quién.
- **Clientes, Planes, Suscripciones, Historial:** tablas con filas separadas por línea, montos a la derecha, búsqueda y filtros, estados vacíos con CTA. En móvil cada fila pasa a tarjeta apilada. Todos los campos con `<label>` asociado (`htmlFor`/`id`).
- **Calendario:** celdas como `<button>` con `aria-label` y navegación por teclado. En móvil, vista de agenda por día.
- **Configuración:** corrige el texto "Recarga para ver los cambios", valida contraste del color elegido y muestra el estado de guardado en una región `aria-live`.
- **Login:** tokens del tema, sin `animate-pulse` ni borde lateral en el error, con `autoComplete` y mostrar contraseña.

## Fuera de alcance

Cambios de backend, salvo el de cobros vencidos descrito abajo. El hack `usuario_id: 1` de `Clientes.jsx:33` se reporta, pero no se rediseña aquí. El registro abierto del login se mantiene.

## Cobros vencidos (cambio de backend aprobado)

Hoy `tocaCobrar` en `backend/scheduler.js` solo decide por frecuencia y fecha base, así que un cobro que no salió en su día (error de envío, servidor caído) nunca se reintenta ni se considera vencido. Se incorpora como trabajo propio, con su propia fase:

- Definir "vencido": suscripción activa cuyo último cobro esperado ya pasó sin un envío exitoso registrado en el historial.
- El scheduler incluye los vencidos en `procesarCobrosDelDia()`, respetando el mutex `procesandoCobros` y sin duplicar envíos ya exitosos.
- Un endpoint de resumen (por cobrar, vencido) en `api.js`/`db.js`, filtrado por `usuario_id` del JWT, que alimenta la franja "Hoy" del Dashboard.
- Pruebas: ampliar el smoke test o añadir un caso con base de datos de prueba; no se verifica contra producción.
- Las reglas exactas (límite de reintentos, antigüedad máxima) se fijan en el plan, ya con el código del scheduler a la vista.

## Fases y verificación

1. Fundaciones: tokens, fuentes, `Icon`, logo.
2. Componentes base.
3. Migración de las 8 vistas y retirada de emojis.
4. Accesibilidad (`harden`).
5. Móvil (`adapt`).
6. Dashboard (`distill`, `bolder`).
7. Cierre: `polish` y una pasada del detector `detect.mjs` sobre lo cambiado.

Cada fase deja la app funcionando y se verifica con `npm run build` y revisión en navegador a 360 px y a escritorio. Los cambios con efectos sobre datos (como el flujo de "Forzar cobros") se prueban contra una base de pruebas, no contra producción.

## Decisiones abiertas

- Reglas de reintento de cobros vencidos (límite y antigüedad máxima).
