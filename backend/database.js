const Database = require('better-sqlite3');
const path = require('path');

// Ubicación de la base de datos dentro de tu carpeta data
const dbPath = path.join(__dirname, 'data', 'sgcrc.db');
const db = new Database(dbPath);

// Optimización: Activa llaves foráneas y modo WAL para velocidad
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// --- CREACIÓN DE TABLAS (Esquema SaaS) ---

// 1. Usuarios
db.prepare(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nombre TEXT,
    config_smtp TEXT 
  )
`).run();

// 2. Clientes
db.prepare(`
  CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    correo TEXT NOT NULL,
    usuario_id INTEGER NOT NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  )
`).run();

// 3. Suscripciones (Con columna FRECUENCIA añadida)
db.prepare(`
  CREATE TABLE IF NOT EXISTS suscripciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    monto REAL NOT NULL,
    dia_cobro INTEGER NOT NULL,
    frecuencia TEXT DEFAULT 'mensual', -- Nueva columna para semanal, quincenal, etc.
    activa INTEGER DEFAULT 1,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  )
`).run();

// 4. Historial (Con columna MONTO añadida para evitar el error NaN en la vista)
db.prepare(`
  CREATE TABLE IF NOT EXISTS historial (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    suscripcion_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    fecha TEXT NOT NULL,
    monto REAL, -- Almacenar el monto al momento del cobro evita el error NaN
    estado TEXT NOT NULL, 
    detalles TEXT,
    FOREIGN KEY (suscripcion_id) REFERENCES suscripciones(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  )
`).run();

console.log("✅ Base de datos SQLite lista y tablas actualizadas.");

module.exports = db;