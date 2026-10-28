# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Dueños de negocios pequeños en Colombia que cobran de forma recurrente (mensualidades, suscripciones, planes) a sus clientes. Revisan el panel pocas veces por semana, con frecuencia desde el móvil, y necesitan saber de un vistazo quién debe pagar, quién ya pagó y si los recordatorios por correo salieron bien.

## Product Purpose

SGCRC (Sistema de Gestión de Cobros Recurrentes) automatiza el envío de recordatorios de cobro por correo electrónico según la frecuencia de cada suscripción (mensual, quincenal, semanal, anual). Éxito: el dueño deja de perseguir pagos manualmente y confía en que los recordatorios salen a tiempo.

## Positioning

Herramienta de cobros recurrentes por correo pensada para negocios pequeños de Colombia: montos en COP, interfaz en español y un panel por empresa, sin la complejidad de un ERP o una pasarela de pagos.

## Operating Context

Aplicación multi-empresa (SaaS): cada negocio se registra y ve solo sus datos, aislados por `usuario_id`. Backend Node.js con SQLite y un scheduler diario, desplegado en una VPS con Docker detrás del Caddy que ya corría allí, por lo que conviene autoalojar fuentes y mantener los recursos livianos.

## Capabilities and Constraints

- Vistas: Dashboard, Clientes, Planes, Suscripciones, Calendario, Historial y Configuración, más login y registro.
- Cada usuario elige un color de marca (`color_tema`) que se aplica en tiempo de ejecución con CSS custom properties; debe seguir siendo configurable.
- Frontend React 18 + Vite con enrutamiento por estado y CSS propio con tokens (`src/styles/`), sin Tailwind ni PostCSS; no usar axios.
- Terminología: "Cobros", "Suscripciones", "Planes", "Clientes", "Historial".
- Decisión abierta: si el registro abierto se mantiene tal cual o se controla.

## Brand Commitments

- El nombre del producto es SGCRC (Sistema de Gestión de Cobros Recurrentes).
- "Café Valdore" no pertenece a este producto: es una empresa aparte del autor. Debe retirarse como nombre por defecto del código.
- El autor quiere un logo propio para SGCRC; hoy no existe ninguno (solo un "●" provisional).

## Evidence on Hand

No hay testimonios, clientes de referencia, métricas ni logo. No inventar ninguno.

## Product Principles

- Claridad financiera primero: lo vencido y lo próximo a cobrar son lo más visible.
- El móvil es un contexto principal, no una adaptación posterior.
- La acción peligrosa (enviar correos reales) nunca es la más prominente ni se confirma con un diálogo nativo.
- El color del cliente personaliza la marca sin romper la legibilidad.
- Sin adornos: cada elemento ayuda a cobrar o a entender el estado de los cobros.

## Accessibility & Inclusion

Cumplir WCAG AA: contraste mínimo 4.5:1, foco visible, navegación completa por teclado, etiquetas en todos los campos, texto no menor a 12 px, `prefers-reduced-motion` y estados que no dependan solo del color. Interfaz en español.
