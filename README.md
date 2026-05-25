# ☕ SGCRC - Sistema de Gestión de Cobros Recurrentes

Automatiza el envío de recordatorios de cobro y la gestión de suscripciones recurrentes. Combina un backend en Node.js con un dashboard en React para centralizar la operación comercial.

## Características principales

- **Automatización de cobros:** Scheduler integrado que procesa cobros diariamente a las 08:00 AM (hora Colombia, configurable).
- **Dashboard administrativo:** KPIs en tiempo real (ingresos mensuales, clientes activos, estados de envío).
- **Catálogo de planes:** Planes reutilizables con frecuencia mensual, quincenal, semanal o anual.
- **Historial de envíos:** Registro de cada correo con monto, estado y trazabilidad.
- **Multi-tenant:** Múltiples usuarios con datos completamente aislados.
- **Infraestructura local:** Desplegado en servidor Ubuntu con conectividad Starlink en la Vereda Miravalle, expuesto mediante túnel Cloudflare.

## Stack tecnológico

**Backend**
- Node.js (servidor HTTP nativo, sin Express)
- SQLite con `better-sqlite3` (modo WAL, foreign keys)
- JWT (`jsonwebtoken`) + bcrypt para autenticación
- Nodemailer (SMTP, por defecto Gmail)
- node-cron (scheduler diario)
- PM2 (gestor de procesos en producción)

**Frontend**
- React 18 + Vite
- Tailwind CSS (CDN)
- SPA con navegación por estado (sin React Router)
- JWT almacenado en `localStorage`

## Instalación

```bash
# Backend
cd backend
npm install
cp .env.example .env
# Editar .env: SMTP_*, PORT, CRON_HORA, CRON_MIN, JWT_SECRET
npm run dev

# Frontend (en otra terminal)
cd sgcrc-frontend-export
npm install
npm run dev
# Acceder en http://localhost:5173
```

Ver `backend/README.md` para documentación completa de la API y configuración SMTP.

## Despliegue en producción

```bash
# 1. Build del frontend
cd sgcrc-frontend-export
npm run build
sudo cp -r dist/* /var/www/cobrosapp/frontend/

# 2. Reiniciar backend
cd backend
pm2 restart sgcrc-backend
```

## Tests

```bash
cd backend && npm test    # Smoke test de la API (requiere backend detenido)
```

---

Desarrollado por: Jarol Medina
