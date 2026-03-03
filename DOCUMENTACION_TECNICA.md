# Documentación Técnica: Arquitectura del Sistema de Cobros

## 1. Introducción
El presente documento describe la arquitectura de software del sistema "cobrosapp", diseñado para la gestión de clientes.

## 2. Arquitectura de Red
El sistema utiliza un túnel de **Cloudflare** para exponer de manera segura el servidor local, permitiendo el acceso al Dashboard desde cualquier ubicación sin necesidad de abrir puertos críticos en el router local.



## 3. Modelo de Datos (SQLite)
* **Clientes:** Almacena información demográfica y de contacto.
* **Suscripciones:** Define el monto, día de cobro y tipo de servicio (Cobro Mensual).
* **Historial:** Registro de auditoría para cada transacción de correo electrónico.

## 4. Referencias Bibliográficas
* Documentation of Git and Vim for technical reporting.
* IEEE Standards for Software Engineering Documentation.