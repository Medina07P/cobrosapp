# Estructura sugerida del nuevo Dashboard (SGCRC)

## 1) Autenticación
- `src/views/Login.jsx`
  - Formulario de inicio de sesión para administradores.
  - Captura opcional de API Key (si backend la exige).

## 2) Layout principal
- `src/App.jsx`
  - Sidebar de navegación responsive.
  - Header con estado del backend y cierre de sesión.
  - Renderizado por vista: Dashboard, Clientes, Suscripciones, Historial y Calendario.

## 3) Vistas operativas
- `src/views/Dashboard.jsx`
  - Tarjetas de estadísticas (clientes, suscripciones activas, ingresos, enviados, fallidos).
  - Lista de próximos cobros.
  - Acción para forzar cobros (`POST /run`).

- `src/views/Clientes.jsx`
  - ABM visual de clientes.
  - Tabla de clientes + cantidad de suscripciones activas por cliente.

- `src/views/Suscripciones.jsx`
  - ABM visual de suscripciones.
  - Estado activo/inactivo, día de cobro, monto y relación a cliente.

## 4) Capa de API
- `src/api.js`
  - Centraliza requests al backend.
  - Soporta API Key dinámica de sesión (login).
  - Mantiene endpoints existentes sin renombrar.

## 5) Estilo visual
- `index.html`
  - Tailwind CSS vía CDN para UI moderna, limpia y responsive.
