---
target: frontend sgcrc-frontend-export
total_score: 17
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-10-19T22-22-49Z
slug: sgcrc-frontend-export-src
---
Method: dual-agent (A: revisión de diseño · B: detector y evidencia estática)

# Crítica del frontend SGCRC (sgcrc-frontend-export)

## Puntuación: 17/40 (banda Pobre)
1 Estado del sistema 2 · 2 Mundo real 3 · 3 Control 2 · 4 Consistencia 1 · 5 Prevención de errores 1 · 6 Reconocer 2 · 7 Eficiencia 1 · 8 Minimalismo 2 · 9 Recuperación 2 · 10 Ayuda 1

## Especificidad
Plantilla intercambiable. Dos sistemas visuales: claro (Tailwind) y oscuro/morado inline (Historial, Calendario, components.jsx).

## Problemas prioritarios
- [P1] Dos sistemas visuales: colorize, layout
- [P1] Accesibilidad (foco, teclado, labels, contraste, aria): harden
- [P1] Móvil roto (calendario, tablas, menú): adapt
- [P2] Dashboard decorativo, Forzar Cobros demasiado prominente: distill, bolder
- [P2] Emojis (19) y alert/confirm nativos: polish
- [P3] Tipografía sin cargar (Playfair) y escala caótica: typeset
- [P3] Motion decorativo y estados vacíos/carga: quieter, clarify

## Detector
side-tab real en Login.jsx:69; gray-on-color en App.jsx:172 es falso positivo parcial (solo hover).

## Dirección elegida
Libro de caja cálido: papel #F6F3EC, tinta #1F2421, verde #1F6B4F, Fraunces + IBM Plex Sans, iconos Phosphor SVG, sin sombras.
