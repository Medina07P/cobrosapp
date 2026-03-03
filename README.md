# ☕ SGCRC - Sistema de Gestión de Cobros Recurrentes

Este sistema automatiza el envío de recordatorios de cobro y la gestión de suscripciones. Combina un backend robusto en Node.js con un dashboard moderno en React para centralizar la operación comercial.

## 🚀 Características Principales
* **Automatización de Cobros:** Scheduler integrado que procesa pagos diariamente a las 08:00 AM.
* **Dashboard Administrativo:** Visualización en tiempo real de ingresos mensuales, clientes activos y estados de envío.
* **Historial Inteligente:** Registro detallado de cada correo enviado con trazabilidad de montos y estados.
* **Infraestructura Local:** Desplegado en un servidor Ubuntu con conectividad Starlink en la Vereda Miravalle.

## 🛠️ Stack Tecnológico
### Backend
* **Node.js**: Servidor HTTP nativo para alto rendimiento.
* **SQLite**: Base de datos ligera y eficiente para almacenamiento local.
* **PM2**: Gestor de procesos para garantizar disponibilidad 24/7.
* **Nodemailer**: Motor de envío de correos con plantillas personalizadas.

### Frontend
* **React + Vite**: Interfaz de usuario rápida y reactiva.
* **Tailwind CSS**: Diseño moderno y adaptativo (Mobile First).
* **JWT**: Autenticación segura para el panel administrativo.

## 📋 Requisitos de Instalación
```bash
# Clonar el repositorio
git clone https://github.com/Medina07P/cobrosapp.git

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales SMTP y SECRET_KEY

⚙️ Comandos de Despliegue (Producción)
Para actualizar el sistema en el servidor:

1. Actualizar Frontend
Bash
cd sgcrc-frontend-export
npm run build
sudo cp -r dist/* /var/www/cobrosapp/frontend/
2. Reiniciar Backend
Bash
cd backend
pm2 restart sgcrc-backend
Desarrollado por: Jarol Medina
