# Rediseño visual, Fase 1: Fundaciones. Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar listas las fundaciones visuales del frontend (tokens, fuentes autoalojadas, helper de color de marca, sistema de iconos SVG y logo SGCRC) y conectarlas al shell sin romper ninguna vista.

**Architecture:** Los tokens viven en CSS real (`src/styles/`), importado desde `main.jsx`, en lugar del `<style>` inyectado por JS. El color de marca se aplica con un helper puro y testeable (`src/lib/colorTema.js`) que también calcula el color de contraste. Los iconos se generan una sola vez desde `@phosphor-icons/core` a un módulo JS con solo los iconos usados, y se renderizan con `<Icon name="..." />`. Las vistas siguen funcionando; se migran en la Fase 3.

**Tech Stack:** React 18, Vite 7, Tailwind por CDN (sin config local), `@fontsource-variable/fraunces`, `@fontsource/ibm-plex-sans`, `@phosphor-icons/core` (solo devDependency para generar), `node:test` para el helper.

Spec: `docs/superpowers/specs/2026-10-19-rediseno-visual-frontend-design.md`

## Global Constraints

- Rama de trabajo: `develop`. Un commit por tarea.
- Todo el trabajo es dentro de `sgcrc-frontend-export/`, salvo `.gitignore` si hace falta.
- Tailwind sigue por CDN. No crear `tailwind.config.js` ni PostCSS.
- Usar `fetch`, no `axios`.
- Los componentes usan variables CSS (`var(--...)`), no colores hardcodeados.
- Texto mínimo 12 px. Contraste mínimo 4.5:1 en texto normal (WCAG AA).
- Valores de la paleta: papel `#F6F3EC`, superficie `#FFFFFF`/`#FBF9F4`, línea `#E3DED2`, tinta `#1F2421`, texto secundario `#5C625C`, acento por defecto `#1F6B4F`.
- Estados: cobrado `#1F7A4D`, pendiente `#7F5800` sobre `#FBF1D6`, vencido `#B3261E` sobre `#FBE4E1`, info `#2D5F8B`. (El `#9A6B00` del spec para pendiente da 4.17:1 y no cumple AA; se corrige a `#7F5800`, 5.66:1.)
- Tipografía: Fraunces para títulos y cifras grandes, IBM Plex Sans para la interfaz.
- Iconos: Phosphor regular, SVG inline, `currentColor`, `aria-hidden` salvo que lleven `label`.
- El nombre "Café Valdore" no debe aparecer en el código del producto.

## Estructura de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `package.json` | Modificar | Dependencias de fuentes, devDependency de iconos, scripts `test` e `icons` |
| `src/styles/tokens.css` | Crear | Variables CSS de superficie, texto, estados, fuentes y color de marca por defecto |
| `src/styles/base.css` | Crear | Reset de cuerpo, tipografía base, foco visible, reduced-motion, utilidades `.bg-brand` etc. |
| `src/lib/colorTema.js` | Crear | Parseo de hex, contraste WCAG, `aplicarColorTema` |
| `src/lib/colorTema.test.js` | Crear | Pruebas del helper y de los contrastes de `tokens.css` |
| `scripts/gen-icons.mjs` | Crear | Genera `src/ui/icons.generated.js` desde Phosphor |
| `src/ui/icons.generated.js` | Crear (generado) | Mapa nombre a contenido SVG |
| `src/ui/Icon.jsx` | Crear | Componente `<Icon>` |
| `src/ui/Logo.jsx` | Crear | Marca SVG de SGCRC |
| `src/main.jsx` | Modificar | Importa fuentes y estilos; elimina el `<style>` inyectado |
| `index.html` | Modificar | Quita `bg-slate-100` del `body` |
| `src/App.jsx` | Modificar | Usa `aplicarColorTema`, `Logo`, `Icon`; quita emoji y "Café Valdore" |
| `src/views/Configuracion.jsx` | Modificar | Usa `aplicarColorTema` y la constante de color por defecto |

---

### Task 1: Dependencias, fuentes y tokens CSS

**Files:**
- Modify: `package.json`
- Create: `src/styles/tokens.css`, `src/styles/base.css`
- Modify: `src/main.jsx`, `index.html`
- Possibly modify: `../.gitignore`

**Interfaces:**
- Produces: variables CSS `--surface-page`, `--surface`, `--surface-alt`, `--line`, `--ink`, `--ink-2`, `--ok`, `--ok-bg`, `--warn`, `--warn-bg`, `--bad`, `--bad-bg`, `--info`, `--info-bg`, `--font-display`, `--font-ui`, `--color-primario`, `--color-primario-glow`, `--color-primario-contraste`; clases `.bg-brand`, `.text-brand`, `.border-brand`, `.hover-brand`, `.tabular`.

- [ ] **Step 1: Confirmar que `node_modules` no se versiona**

Run (desde `sgcrc-frontend-export/`): `git check-ignore -v node_modules dist`
Expected: dos líneas que indican la regla que los ignora. Si no imprime nada, agregar al `.gitignore` de la raíz del repo las líneas `node_modules/` y `dist/` antes de seguir.

- [ ] **Step 2: Instalar dependencias**

Run:
```bash
npm install
npm install @fontsource-variable/fraunces @fontsource/ibm-plex-sans
npm install -D @phosphor-icons/core
```
Expected: sin errores; `git status` no lista `node_modules`.

- [ ] **Step 3: Agregar scripts a `package.json`**

En `"scripts"`, dejar:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "node --test src/lib/colorTema.test.js",
  "icons": "node scripts/gen-icons.mjs"
},
```

- [ ] **Step 4: Crear `src/styles/tokens.css`**

```css
/* Tokens de diseño de SGCRC. Valores de superficie, texto y estado; el color de
   marca (--color-primario*) lo sobrescribe aplicarColorTema() en tiempo de ejecución. */
:root {
  --surface-page: #F6F3EC;
  --surface: #FFFFFF;
  --surface-alt: #FBF9F4;
  --line: #E3DED2;
  --ink: #1F2421;
  --ink-2: #5C625C;

  --ok: #1F7A4D;
  --ok-bg: #EAF5EE;
  --warn: #7F5800;
  --warn-bg: #FBF1D6;
  --bad: #B3261E;
  --bad-bg: #FBE4E1;
  --info: #2D5F8B;
  --info-bg: #E3EDF5;

  --font-display: 'Fraunces Variable', Georgia, 'Times New Roman', serif;
  --font-ui: 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;

  --color-primario: #1F6B4F;
  --color-primario-glow: rgba(31, 107, 79, 0.2);
  --color-primario-contraste: #FFFFFF;
}
```

- [ ] **Step 5: Crear `src/styles/base.css`**

```css
body {
  margin: 0;
  background: var(--surface-page);
  color: var(--ink);
  font-family: var(--font-ui);
  font-size: 0.9375rem;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3 {
  font-family: var(--font-display);
  font-weight: 600;
}

.tabular { font-variant-numeric: tabular-nums; }

/* Foco visible en todo elemento interactivo. !important porque varias vistas
   aplican outline-none (Tailwind) o outline:none inline sin reemplazo. */
:focus-visible {
  outline: 2px solid var(--color-primario) !important;
  outline-offset: 2px !important;
}

/* Utilidades de color de marca usadas por las vistas */
.bg-brand { background-color: var(--color-primario) !important; }
.text-brand { color: var(--color-primario) !important; }
.border-brand { border-color: var(--color-primario) !important; }
.hover-brand:hover {
  filter: brightness(1.1);
  box-shadow: 0 4px 12px var(--color-primario-glow);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 6: Reemplazar `src/main.jsx` completo**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/fraunces'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import './styles/tokens.css'
import './styles/base.css'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 7: Quitar la clase de fondo del `body` en `index.html`**

Cambiar `<body class="bg-slate-100">` por `<body>`.

- [ ] **Step 8: Verificar el build y que las fuentes se empaquetan**

Run: `npm run build`
Expected: termina sin errores. Luego `ls dist/assets | grep -i -E "fraunces|plex"` lista archivos `.woff2`.

- [ ] **Step 9: Verificar en el navegador**

Run: `npm run dev` y abrir `http://localhost:5173` (la pantalla de login no necesita backend).
Expected: el fondo de la página es papel cálido, no gris azulado. En la consola del navegador, `document.fonts.check('600 16px "Fraunces Variable"')` devuelve `true` y `getComputedStyle(document.body).fontFamily` empieza por `"IBM Plex Sans"`. Detener el servidor.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json src/styles src/main.jsx index.html ../.gitignore
git commit -m "feat(ui): tokens CSS, fuentes autoalojadas y base de estilos

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
(Si `.gitignore` no cambió, `git add` lo ignora sin error.)

---

### Task 2: Helper de color de marca (TDD)

**Files:**
- Create: `src/lib/colorTema.js`, `src/lib/colorTema.test.js`
- Modify: `src/App.jsx:47-61`, `src/views/Configuracion.jsx:5,23`

**Interfaces:**
- Produces (de `src/lib/colorTema.js`):
  - `COLOR_POR_DEFECTO: string` = `'#1F6B4F'`, `TINTA: string` = `'#1F2421'`
  - `parseHex(hex: string): {r,g,b} | null`
  - `ratioContraste(a: string, b: string): number` (hex válidos)
  - `textoSobre(hex: string): '#FFFFFF' | '#1F2421'`
  - `aplicarColorTema(root: {style:{setProperty}}, hex: string): string` (devuelve el color realmente aplicado)

- [ ] **Step 1: Escribir las pruebas que fallan, `src/lib/colorTema.test.js`**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  COLOR_POR_DEFECTO, TINTA, parseHex, ratioContraste, textoSobre, aplicarColorTema,
} from './colorTema.js'

test('parseHex acepta 6 y 3 dígitos y rechaza basura', () => {
  assert.deepEqual(parseHex('#1F6B4F'), { r: 31, g: 107, b: 79 })
  assert.deepEqual(parseHex('#fff'), { r: 255, g: 255, b: 255 })
  assert.equal(parseHex('azul'), null)
  assert.equal(parseHex('#12345'), null)
  assert.equal(parseHex(undefined), null)
})

test('textoSobre elige blanco sobre oscuros y tinta sobre claros', () => {
  assert.equal(textoSobre('#1F6B4F'), '#FFFFFF')
  assert.equal(textoSobre('#4f46e5'), '#FFFFFF')
  assert.equal(textoSobre('#FFD400'), TINTA)
  assert.equal(textoSobre('#ffffff'), TINTA)
})

test('aplicarColorTema fija las tres variables', () => {
  const m = {}
  const root = { style: { setProperty: (k, v) => { m[k] = v } } }
  const usado = aplicarColorTema(root, '#1F6B4F')
  assert.equal(usado, '#1F6B4F')
  assert.equal(m['--color-primario'], '#1F6B4F')
  assert.equal(m['--color-primario-glow'], 'rgba(31, 107, 79, 0.2)')
  assert.equal(m['--color-primario-contraste'], '#FFFFFF')
})

test('aplicarColorTema acepta hex corto y cae al valor por defecto si es inválido', () => {
  const m = {}
  const root = { style: { setProperty: (k, v) => { m[k] = v } } }
  aplicarColorTema(root, '#fff')
  assert.equal(m['--color-primario-glow'], 'rgba(255, 255, 255, 0.2)')
  assert.equal(m['--color-primario-contraste'], TINTA)
  assert.equal(aplicarColorTema(root, 'rojo'), COLOR_POR_DEFECTO)
  assert.equal(m['--color-primario'], COLOR_POR_DEFECTO)
})

test('los tokens de tokens.css cumplen WCAG AA (4.5:1) en sus pares de uso', () => {
  const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8')
  const t = {}
  for (const [, k, v] of css.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)) t[k] = v
  const pares = [
    ['ink', 'surface-page'], ['ink-2', 'surface-page'], ['ink-2', 'surface'],
    ['ok', 'ok-bg'], ['warn', 'warn-bg'], ['bad', 'bad-bg'], ['info', 'info-bg'],
    ['ok', 'surface'], ['bad', 'surface'],
  ]
  for (const [a, b] of pares) {
    const r = ratioContraste(t[a], t[b])
    assert.ok(r >= 4.5, `--${a} sobre --${b}: ${r.toFixed(2)}:1 (< 4.5)`)
  }
  assert.ok(ratioContraste('#FFFFFF', t['color-primario']) >= 4.5, 'blanco sobre el acento por defecto')
})
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `npm test`
Expected: FAIL con `Cannot find module` o `ERR_MODULE_NOT_FOUND` apuntando a `colorTema.js`.

- [ ] **Step 3: Implementar `src/lib/colorTema.js`**

```js
export const COLOR_POR_DEFECTO = '#1F6B4F'
export const TINTA = '#1F2421'
const BLANCO = '#FFFFFF'

export function parseHex(hex) {
  if (typeof hex !== 'string') return null
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  let h = m[1]
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function luminancia({ r, g, b }) {
  const canal = (v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)
}

export function ratioContraste(a, b) {
  const la = luminancia(parseHex(a))
  const lb = luminancia(parseHex(b))
  const [alto, bajo] = la >= lb ? [la, lb] : [lb, la]
  return (alto + 0.05) / (bajo + 0.05)
}

// Texto legible sobre un fondo de marca: el que dé más contraste
export function textoSobre(hex) {
  return ratioContraste(hex, BLANCO) >= ratioContraste(hex, TINTA) ? BLANCO : TINTA
}

export function aplicarColorTema(root, hex) {
  const color = parseHex(hex) ? hex : COLOR_POR_DEFECTO
  const { r, g, b } = parseHex(color)
  root.style.setProperty('--color-primario', color)
  root.style.setProperty('--color-primario-glow', `rgba(${r}, ${g}, ${b}, 0.2)`)
  root.style.setProperty('--color-primario-contraste', textoSobre(color))
  return color
}
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `npm test`
Expected: 5 tests, 5 pass. Si el test de tokens falla por un par concreto, oscurecer ese color en `tokens.css` hasta cumplir 4.5:1 y registrar el cambio en el mensaje del commit.

- [ ] **Step 5: Usar el helper en `src/App.jsx`**

Agregar el import junto a los demás (después de la línea de `setApiKey`):
```jsx
import { aplicarColorTema } from './lib/colorTema.js'
```
Reemplazar el bloque de las líneas 47-61 (`try { ... } catch (err) { ... }` dentro de `refrescarConfiguracion`) por:
```jsx
      try {
        const perfil = await api.getPerfil();
        aplicarColorTema(document.documentElement, perfil.color_tema);

        // Actualizamos la sesión local por si el nombre cambió
        const nuevaSesion = { ...session, user: perfil };
        setSession(nuevaSesion);
        localStorage.setItem('sgcrc_session', JSON.stringify(nuevaSesion));
      } catch (err) {
        // Si falla el fetch inicial, usamos lo que tengamos en sesión
        aplicarColorTema(document.documentElement, session.user?.color_tema);
      }
```

- [ ] **Step 6: Usar el helper en `src/views/Configuracion.jsx`**

Agregar al inicio: `import { aplicarColorTema, COLOR_POR_DEFECTO } from '../lib/colorTema.js';`
Línea 5: cambiar `color_tema: '#4f46e5'` por `color_tema: COLOR_POR_DEFECTO`.
Línea 23: reemplazar `document.documentElement.style.setProperty('--color-primario', usuario.color_tema);` por `aplicarColorTema(document.documentElement, usuario.color_tema);`

- [ ] **Step 7: Verificar**

Run: `npm test && npm run build`
Expected: pruebas en verde y build sin errores.

- [ ] **Step 8: Commit**

```bash
git add src/lib src/App.jsx src/views/Configuracion.jsx
git commit -m "feat(ui): helper de color de marca con contraste calculado

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Sistema de iconos

**Files:**
- Create: `scripts/gen-icons.mjs`, `src/ui/icons.generated.js` (generado), `src/ui/Icon.jsx`

**Interfaces:**
- Produces: `ICONOS: Record<string, string>` (en `icons.generated.js`); `Icon({ name, size = 20, label, className, style })` (default export de `Icon.jsx`). Sin `label` el SVG lleva `aria-hidden`; con `label` lleva `role="img"` y `aria-label`.
- Nombres disponibles: `squares-four`, `users`, `tag`, `arrows-clockwise`, `clock-counter-clockwise`, `calendar-blank`, `gear`, `warning-circle`, `warning`, `check-circle`, `check`, `x`, `x-circle`, `arrow-clockwise`, `caret-left`, `caret-right`, `caret-down`, `paper-plane-tilt`, `envelope-simple`, `coins`, `bell`, `sign-out`, `magnifying-glass`, `plus`, `pencil-simple`, `trash`, `eye`, `eye-slash`, `list`.

- [ ] **Step 1: Crear `scripts/gen-icons.mjs`**

```js
// Genera src/ui/icons.generated.js con solo los iconos Phosphor (peso regular) que usa la app.
// Para agregar uno: añadir su nombre a ICONOS y ejecutar `npm run icons`.
import { readFileSync, writeFileSync } from 'node:fs'

const ICONOS = [
  'squares-four', 'users', 'tag', 'arrows-clockwise', 'clock-counter-clockwise',
  'calendar-blank', 'gear', 'warning-circle', 'warning', 'check-circle', 'check',
  'x', 'x-circle', 'arrow-clockwise', 'caret-left', 'caret-right', 'caret-down',
  'paper-plane-tilt', 'envelope-simple', 'coins', 'bell', 'sign-out',
  'magnifying-glass', 'plus', 'pencil-simple', 'trash', 'eye', 'eye-slash', 'list',
]

const base = new URL('../node_modules/@phosphor-icons/core/assets/regular/', import.meta.url)
const salida = new URL('../src/ui/icons.generated.js', import.meta.url)

const lineas = ICONOS.map((nombre) => {
  const svg = readFileSync(new URL(`${nombre}.svg`, base), 'utf8')
  const m = /<svg[^>]*>([\s\S]*)<\/svg>/.exec(svg)
  if (!m) throw new Error(`SVG inválido: ${nombre}`)
  return `  ${JSON.stringify(nombre)}: ${JSON.stringify(m[1].trim())},`
})

const contenido = `// GENERADO por scripts/gen-icons.mjs a partir de @phosphor-icons/core. No editar a mano.
export const ICONOS = {
${lineas.join('\n')}
}
`
writeFileSync(salida, contenido)
console.log(`${ICONOS.length} iconos escritos en src/ui/icons.generated.js`)
```

- [ ] **Step 2: Generar y comprobar**

Run: `npm run icons`
Expected: imprime `29 iconos escritos en src/ui/icons.generated.js`. Luego `node -e "import('./src/ui/icons.generated.js').then(m=>console.log(Object.keys(m.ICONOS).length, m.ICONOS.gear.slice(0,30)))"` imprime `29 <path d="M128,80a48,48,0,1`.

- [ ] **Step 3: Crear `src/ui/Icon.jsx`**

```jsx
import { ICONOS } from './icons.generated.js'

// Iconos Phosphor (regular) en SVG inline. Decorativo por defecto (aria-hidden);
// si el icono es el único contenido de un botón, pasar `label`.
export default function Icon({ name, size = 20, label, className, style }) {
  const interior = ICONOS[name]
  if (!interior) {
    if (import.meta.env.DEV) console.warn(`Icon: "${name}" no existe en icons.generated.js`)
    return null
  }
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width={size}
      height={size}
      fill="currentColor"
      focusable="false"
      className={className}
      style={{ flexShrink: 0, ...style }}
      {...a11y}
      dangerouslySetInnerHTML={{ __html: interior }}
    />
  )
}
```
(`dangerouslySetInnerHTML` es seguro aquí: el contenido sale de un archivo generado en build desde un paquete fijado, nunca de entrada de usuario.)

- [ ] **Step 4: Verificar el build**

Run: `npm run build`
Expected: termina sin errores.

- [ ] **Step 5: Commit**

```bash
git add scripts src/ui package.json
git commit -m "feat(ui): sistema de iconos Phosphor inline con generador

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Logo SGCRC

**Files:**
- Create: `src/ui/Logo.jsx`

**Interfaces:**
- Produces: `Logo({ size = 28, className, style })` (default export). Marca de un recibo con borde inferior en zigzag y dos flechas circulares (recurrencia). Dibujada con trazo `currentColor`, por lo que hereda el color de marca.

- [ ] **Step 1: Crear `src/ui/Logo.jsx`**

```jsx
// Marca de SGCRC: un recibo con dos flechas circulares (cobro recurrente).
// Hereda el color del texto (currentColor), así sigue el color de marca del cliente.
export default function Logo({ size = 28, className, style }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="SGCRC"
      className={className}
      style={{ flexShrink: 0, ...style }}
    >
      <path d="M7 3h18v26l-3-2.5-3 2.5-3-2.5-3 2.5-3-2.5L7 29z" />
      <path d="M11.2 14a5 5 0 0 1 9.1-1.6M20.5 9v3.5H17" />
      <path d="M20.8 17a5 5 0 0 1-9.1 1.6M11.5 22v-3.5H15" />
    </svg>
  )
}
```

- [ ] **Step 2: Verificar el trazo visualmente**

No hay vista previa aparte: el logo se revisa en el Task 5 dentro de la app, a 30 px y ampliado con el zoom del navegador. Si en ese momento las flechas se ven torcidas o se salen del recibo, ajustar las coordenadas de los dos últimos `<path>` y repetir la revisión una sola vez.

- [ ] **Step 3: Verificar el build**

Run: `npm run build`
Expected: termina sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/ui/Logo.jsx
git commit -m "feat(ui): logo SGCRC en SVG

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Conectar Logo e Iconos al shell y limpiar emoji y "Café Valdore"

**Files:**
- Modify: `src/App.jsx` (imports, `NAV`, sidebar, nombre por defecto, tabs móviles, fondo raíz)

**Interfaces:**
- Consumes: `Icon` (`src/ui/Icon.jsx`), `Logo` (`src/ui/Logo.jsx`).

- [ ] **Step 1: Imports**

Agregar tras el import de `aplicarColorTema` en `src/App.jsx`:
```jsx
import Icon from './ui/Icon.jsx'
import Logo from './ui/Logo.jsx'
```

- [ ] **Step 2: Reemplazar `NAV` (líneas 12-20)**

```jsx
const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'squares-four' },
  { id: 'clientes', label: 'Clientes', icon: 'users' },
  { id: 'planes', label: 'Catálogo de Planes', icon: 'tag' },
  { id: 'suscripciones', label: 'Suscripciones', icon: 'arrows-clockwise' },
  { id: 'historial', label: 'Historial', icon: 'clock-counter-clockwise' },
  { id: 'calendario', label: 'Calendario', icon: 'calendar-blank' },
  { id: 'configuracion', label: 'Configuración', icon: 'gear' },
]
```

- [ ] **Step 3: Logo en el sidebar**

Reemplazar
```jsx
          <span style={{ color: 'var(--color-primario)' }}>●</span> 
```
por
```jsx
          <Logo size={30} style={{ color: 'var(--color-primario)' }} />
```

- [ ] **Step 4: Icono en los botones del sidebar de escritorio**

En el `<button>` del `NAV.map` del sidebar, cambiar `className` para que incluya `flex items-center gap-3` junto a las clases existentes, y reemplazar `{n.label}` por:
```jsx
              <Icon name={n.icon} size={18} />
              {n.label}
```
Además, el color activo debe usar el contraste calculado: en `activeStyle` cambiar `color: 'white'` por `color: 'var(--color-primario-contraste)'`.

- [ ] **Step 5: Quitar "Café Valdore" y el hack del emoji**

- Línea del sidebar `Empresa: {session.user?.nombre || 'Café Valdore'}` → `Empresa: {session.user?.nombre || 'Mi negocio'}`
- En el header, `{session.user?.nombre || 'Café Valdore'}` → `{session.user?.nombre || 'Mi negocio'}` y `(session.user?.nombre || 'C').charAt(0)` → `(session.user?.nombre || 'M').charAt(0)`
- En las tabs móviles, `{n.label.replace('⚙️ ', '')}` → `{n.label}`; y en su `className` activo, reemplazar `text-white shadow-md` por `shadow-md` y añadir al `style` activo `color: 'var(--color-primario-contraste)'`, quedando `style={view === n.id ? { backgroundColor: 'var(--color-primario)', color: 'var(--color-primario-contraste)' } : {}}`.

- [ ] **Step 6: Quitar el fondo fijo del contenedor raíz**

En `<div className="min-h-screen bg-slate-100 text-slate-800 flex">` quitar `bg-slate-100 text-slate-800` (el `body` ya aporta fondo y color de texto).

- [ ] **Step 7: Verificar que no queda ningún emoji de navegación ni Café Valdore en el shell**

Run: `grep -n "⚙️\|Café Valdore" src/App.jsx`
Expected: sin resultados. (`src/api.js:82` tiene un comentario con "Café Valdore"; cambiarlo a `// Obtiene nombre y color_tema del usuario` en este mismo commit.)

- [ ] **Step 8: Build y revisión en navegador**

Run: `npm run build`, luego `npm run dev` y, con el backend en `:3000` y una sesión iniciada, abrir `http://localhost:5173`.
Expected, a 1280 px y a 360 px:
- Sidebar con logo en el color de marca y un icono por ítem; el ítem activo tiene texto legible.
- Fondo de página en papel cálido; las tarjetas de las vistas siguen blancas y funcionan.
- En Configuración, cambiar el color a un amarillo (`#FFD400`) y guardar: el ítem activo y el texto de los botones pasan a tinta oscura legible.
- Al tabular por el sidebar se ve el anillo de foco.
- Las vistas Historial y Calendario (todavía oscuras) siguen mostrándose y funcionando.
Si el backend no está disponible, verificar al menos el login y que no hay errores en consola.

- [ ] **Step 9: Pruebas y commit**

Run: `npm test`
Expected: 5 pass.
```bash
git add src/App.jsx src/api.js
git commit -m "feat(ui): logo e iconos en el shell; quita emoji y nombre ajeno

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Criterio de cierre de la Fase 1

- `npm test` y `npm run build` en verde.
- Tokens y fuentes cargados; página con fondo papel; foco visible global.
- `aplicarColorTema` es el único lugar que escribe `--color-primario*`.
- `Icon` y `Logo` en uso en el shell; ni `⚙️` ni "Café Valdore" en `App.jsx`/`api.js`.
- Ninguna vista rota (Historial y Calendario conservan su tema oscuro hasta la Fase 3).

## Notas para fases siguientes

- **Preload de fuentes:** se omite en la Fase 1 porque Vite genera nombres con hash; `font-display: swap` de Fontsource evita bloqueo. Evaluar con `web-perf` en la Fase 7.
- **Fase 2 (componentes base)** debe consumir `Icon`, los tokens y `aplicarColorTema`; `components.jsx` se reemplaza ahí.
- **Plan aparte para "cobros vencidos" (backend):** requiere leer `backend/scheduler.js` y `backend/db.js`; se planifica en su propio documento.
