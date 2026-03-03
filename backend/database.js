const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'sgcrc.db');
const db = new Database(dbPath);

// Optimización: Activa llaves foráneas y modo WAL
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// --- CREACIÓN DE TABLAS ---

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

// 3. Suscripciones 
// CAMBIO: Se usa ON DELETE RESTRICT en cliente_id para que NO borre en automático
// 3. Suscripciones 
db.prepare(`
  CREATE TABLE IF NOT EXISTS suscripciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    monto REAL NOT NULL,
    dia_cobro INTEGER NOT NULL,
    frecuencia TEXT DEFAULT 'mensual',
    activa INTEGER DEFAULT 1,
    -- CAMBIO AQUÍ: RESTRICT impide borrar al cliente si tiene suscripciones
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT, 
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  )
`).run();

// 4. Historial
db.prepare(`
  CREATE TABLE IF NOT EXISTS historial (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    suscripcion_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    fecha TEXT NOT NULL,
    monto REAL,
    estado TEXT NOT NULL, 
    detalles TEXT,
    FOREIGN KEY (suscripcion_id) REFERENCES suscripciones(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  )
`).run();

/**
 * --- BLOQUE DE MIGRACIÓN SEGURO ---
 * Si la tabla ya existía antes de agregar 'frecuencia' o 'monto', 
 * estas líneas aseguran que las columnas se añadan sin borrar datos.
 */
try { db.prepare("ALTER TABLE suscripciones ADD COLUMN frecuencia TEXT DEFAULT 'mensual'").run(); } catch(e) {}
try { db.prepare("ALTER TABLE historial ADD COLUMN monto REAL").run(); } catch(e) {}

console.log("✅ Base de datos SQLite lista y protegida contra borrados accidentales.");

module.exports = db;