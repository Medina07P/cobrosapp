const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'sgcrc.db');
const db = new Database(dbPath);

// Optimización: Activa llaves foráneas y modo WAL
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// --- CREACIÓN DE TABLAS ---

// 1. Usuarios (Sin cambios)
db.prepare(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nombre TEXT,
    config_smtp TEXT,
    color_tema TEXT DEFAULT '#4f46e5'
  )
`).run();

// 2. Clientes (Sin cambios)
db.prepare(`
  CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    correo TEXT NOT NULL,
    usuario_id INTEGER NOT NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  )
`).run();

// 3. NUEVA TABLA: Planes (Catálogo reutilizable)
// Aquí movemos la lógica de 'tipo', 'monto' y 'frecuencia'
db.prepare(`
  CREATE TABLE IF NOT EXISTS planes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    nombre_plan TEXT NOT NULL, -- Ej: 'Netflix Familiar', 'Café Oro'
    monto REAL NOT NULL,
    frecuencia TEXT DEFAULT 'mensual',
    dia_cobro INTEGER NOT NULL,
    descripcion TEXT,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  )
`).run();

// 4. TABLA REFACTORIZADA: Suscripciones
// Ahora solo vincula un Cliente con un Plan.
// 4. TABLA REFACTORIZADA: Suscripciones
// 4. TABLA: Suscripciones (Con fecha_alta manual)
db.prepare(`
  CREATE TABLE IF NOT EXISTS suscripciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL,
    plan_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    activa INTEGER DEFAULT 1,
    fecha_alta TEXT, -- Quitamos el DEFAULT para poder enviarla nosotros
    descripcion TEXT,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT, 
    FOREIGN KEY (plan_id) REFERENCES planes(id) ON DELETE RESTRICT, 
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  )
`).run();


// 5. Historial (Se mantiene igual, vinculado a la suscripción)
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
 * Nota técnica: Como has cambiado la estructura de 'suscripciones', 
 * si ejecutas esto en una base de datos con datos viejos, fallará 
 * porque la tabla vieja no tiene 'plan_id'. 
 */
try { db.prepare("ALTER TABLE planes ADD COLUMN descripcion TEXT").run(); } catch(e) {}
try { db.prepare("ALTER TABLE historial ADD COLUMN monto REAL").run(); } catch(e) {}
try { db.prepare("ALTER TABLE suscripciones ADD COLUMN descripcion TEXT").run(); } catch(e) {}
// Bloque de migración por si ya existe la tabla sin esa columna
try { db.prepare("ALTER TABLE suscripciones ADD COLUMN fecha_alta TEXT").run(); } catch(e) {}
/**
 * --- BLOQUE DE MIGRACIÓN SEGURO ---
 */
try { db.prepare("ALTER TABLE usuarios ADD COLUMN color_tema TEXT DEFAULT '#4f46e5'").run(); } catch(e) {}
// ... los otros try/catch que ya tenías
/**
 * --- BLOQUE DE MIGRACIÓN SEGURO ---
 */



console.log("✅ Base de datos refactorizada: Modelo de Planes Reutilizables listo.");

console.log("✅ Base de datos refactorizada: Modelo de Planes Reutilizables listo.");

module.exports = db;