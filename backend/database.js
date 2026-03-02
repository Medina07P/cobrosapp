const Database = require('better-sqlite3');
const path = require('path');

// Ubicación de la base de datos dentro de tu carpeta data
const dbPath = path.join(__dirname, 'data', 'sgcrc.db');
const db = new Database(dbPath);

// Optimización: Activa llaves foráneas y modo WAL para velocidad
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// --- CREACIÓN DE TABLAS (Esquema SaaS) ---

// 1. Usuarios (Tus futuros clientes que te compran el software)
db.prepare(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nombre TEXT,
    config_smtp TEXT -- Aquí guardaremos el JSON encriptado del SMTP
  )
`).run();

// 2. Clientes (Los deudores de tus usuarios)
db.prepare(`
  CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    correo TEXT NOT NULL,
    usuario_id INTEGER NOT NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  )
`).run();

// 3. Suscripciones (Los cobros recurrentes)
db.prepare(`
  CREATE TABLE IF NOT EXISTS suscripciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    monto REAL NOT NULL,
    dia_cobro INTEGER NOT NULL,
    activa INTEGER DEFAULT 1,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  )
`).run();

// 4. Historial (Registro de correos enviados)
db.prepare(`
  CREATE TABLE IF NOT EXISTS historial (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    suscripcion_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    fecha TEXT NOT NULL,
    estado TEXT NOT NULL, -- 'Enviado' o 'Fallido'
    detalles TEXT,
    FOREIGN KEY (suscripcion_id) REFERENCES suscripciones(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  )
`).run();

console.log("✅ Base de datos SQLite lista y tablas verificadas.");

module.exports = db;