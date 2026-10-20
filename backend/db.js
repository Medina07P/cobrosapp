const db = require('./database');
const cobros = require('./cobros');

// --- HELPER PARA FORMATEAR RESULTADOS ---
const fixBool = (obj) => {
    if (!obj) return null;
    return { ...obj, activa: obj.activa === 1 };
};

// Columnas que la API puede actualizar. Los nombres de columna nunca vienen del cliente.
const COLUMNAS = {
    clientes: ['nombre', 'correo'],
    planes: ['nombre_plan', 'monto', 'frecuencia', 'dia_cobro', 'descripcion'],
    suscripciones: ['cliente_id', 'plan_id', 'activa', 'descripcion', 'fecha_alta'],
};

// Se queda solo con las columnas permitidas de la tabla
function filtrar(tabla, campos) {
    return Object.fromEntries(
        Object.entries(campos || {}).filter(([k, v]) => COLUMNAS[tabla].includes(k) && v !== undefined)
    );
}

// --- VALIDACIÓN DE VALORES ---
const invalido = (msg) => { throw new Error("VALIDATION_ERROR: " + msg); };

function texto(v, etiqueta, max, { obligatorio = true } = {}) {
    if (v === undefined || v === null) {
        if (obligatorio) invalido(`${etiqueta} es obligatorio.`);
        return '';
    }
    if (typeof v !== 'string') invalido(`${etiqueta} debe ser texto.`);
    const t = v.trim();
    if (obligatorio && t === '') invalido(`${etiqueta} es obligatorio.`);
    if (t.length > max) invalido(`${etiqueta} no puede superar ${max} caracteres.`);
    return t;
}

// Número (o cadena numérica) -> number; booleanos, objetos y arreglos se rechazan
function numero(v, etiqueta) {
    let n;
    if (typeof v === 'number') n = v;
    else if (typeof v === 'string' && v.trim() !== '') n = Number(v);
    else invalido(`${etiqueta} debe ser un número.`);
    if (!Number.isFinite(n)) invalido(`${etiqueta} debe ser un número.`);
    return n;
}

function entero(v, etiqueta, min, max) {
    const n = numero(v, etiqueta);
    if (!Number.isInteger(n) || n < min || (max !== undefined && n > max)) {
        invalido(max !== undefined
            ? `${etiqueta} debe ser un entero entre ${min} y ${max}.`
            : `${etiqueta} debe ser un entero positivo.`);
    }
    return n;
}

function fechaISO(v, etiqueta) {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) invalido(`${etiqueta} debe tener formato AAAA-MM-DD.`);
    const [a, m, d] = v.split('-').map(Number);
    const f = new Date(Date.UTC(a, m - 1, d));
    if (f.getUTCFullYear() !== a || f.getUTCMonth() !== m - 1 || f.getUTCDate() !== d) invalido(`${etiqueta} no es una fecha válida.`);
    return v;
}

const FRECUENCIAS = ['semanal', 'quincenal', 'mensual', 'anual'];

// Cada validador recibe los campos ya filtrados. En alta exige los obligatorios y aplica
// valores por defecto; en edición solo valida las claves presentes.
const VALIDADORES = {
    clientes(c, crear) {
        const r = {};
        if (crear || 'nombre' in c) r.nombre = texto(c.nombre, 'El nombre', 120);
        if (crear || 'correo' in c) {
            r.correo = texto(c.correo, 'El correo', 254);
            if (!r.correo.includes('@')) invalido('El correo no es válido.');
        }
        return r;
    },
    planes(c, crear) {
        const r = {};
        if (crear || 'nombre_plan' in c) r.nombre_plan = texto(c.nombre_plan, 'El nombre del plan', 120);
        if (crear || 'monto' in c) {
            const m = numero(c.monto, 'El monto');
            if (m < 0) invalido('El monto no puede ser negativo.');
            r.monto = m;
        }
        if (crear || 'frecuencia' in c) {
            const f = (crear && (c.frecuencia === undefined || c.frecuencia === null)) ? 'mensual' : c.frecuencia;
            const fl = typeof f === 'string' ? f.trim().toLowerCase() : null;
            if (!FRECUENCIAS.includes(fl)) invalido('La frecuencia debe ser semanal, quincenal, mensual o anual.');
            r.frecuencia = fl;
        }
        if (crear || 'dia_cobro' in c) {
            const d = (crear && (c.dia_cobro === undefined || c.dia_cobro === null)) ? 1 : c.dia_cobro;
            r.dia_cobro = entero(d, 'El día de cobro', 1, 31);
        }
        if (crear || 'descripcion' in c) r.descripcion = texto(c.descripcion, 'La descripción', 500, { obligatorio: false });
        return r;
    },
    suscripciones(c, crear) {
        const r = {};
        if (crear || 'cliente_id' in c) r.cliente_id = entero(c.cliente_id, 'El cliente', 1);
        if (crear || 'plan_id' in c) r.plan_id = entero(c.plan_id, 'El plan', 1);
        if ('descripcion' in c) r.descripcion = texto(c.descripcion, 'La descripción', 500, { obligatorio: false });
        if ('activa' in c) {
            const a = c.activa;
            if (a === true || a === 1) r.activa = 1;
            else if (a === false || a === 0) r.activa = 0;
            else invalido('El estado activa debe ser verdadero o falso.');
        }
        if ('fecha_alta' in c) {
            const f = c.fecha_alta;
            if (crear && (f === '' || f === null)) r.fecha_alta = cobros.hoyISO();
            else r.fecha_alta = fechaISO(f, 'La fecha de alta');
        } else if (crear) r.fecha_alta = cobros.hoyISO();
        return r;
    },
};

// Filtra por lista blanca, coerciona y valida. Lanza VALIDATION_ERROR.
function validar(tabla, campos, crear) {
    return VALIDADORES[tabla](filtrar(tabla, campos), crear);
}

function existePropia(tabla, id, usuarioId) {
    return !!db.prepare(`SELECT 1 FROM ${tabla} WHERE id = ? AND usuario_id = ?`).get(id, usuarioId);
}

// UPDATE de una fila del usuario. Las claves ya fueron filtradas por filtrar() o son internas.
function ejecutarUpdate(tabla, id, campos, usuarioId) {
    const claves = Object.keys(campos);
    if (claves.length === 0) return;
    const setClause = claves.map(k => `${k} = ?`).join(', ');
    db.prepare(`UPDATE ${tabla} SET ${setClause} WHERE id = ? AND usuario_id = ?`)
        .run(...Object.values(campos), id, usuarioId);
}

// El cliente y el plan de una suscripción deben ser del usuario
function validarPropiedad({ cliente_id, plan_id }, usuarioId) {
    if (cliente_id !== undefined && !existePropia('clientes', cliente_id, usuarioId)) {
        throw new Error("VALIDATION_ERROR: El cliente seleccionado no existe.");
    }
    if (plan_id !== undefined && !existePropia('planes', plan_id, usuarioId)) {
        throw new Error("VALIDATION_ERROR: El plan seleccionado no existe.");
    }
}

// 1. OBJETO: Planes
const planes = {
    all(usuarioId = 1) {
        return db.prepare('SELECT * FROM planes WHERE usuario_id = ?').all(usuarioId);
    },
    find(id) {
        return db.prepare('SELECT * FROM planes WHERE id = ?').get(id);
    },
    create(campos, usuarioId = 1) {
        const v = validar('planes', campos, true);
        const info = db.prepare(`
            INSERT INTO planes (usuario_id, nombre_plan, monto, frecuencia, dia_cobro, descripcion)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(usuarioId, v.nombre_plan, v.monto, v.frecuencia, v.dia_cobro, v.descripcion);
        return { id: info.lastInsertRowid, nombre_plan: v.nombre_plan, monto: v.monto, frecuencia: v.frecuencia };
    },
    update(id, campos, usuarioId) {
        const actual = db.prepare('SELECT * FROM planes WHERE id = ? AND usuario_id = ?').get(id, usuarioId);
        if (!actual) return null;
        const nuevos = validar('planes', campos, false);
        db.transaction(() => {
            ejecutarUpdate('planes', id, nuevos, usuarioId);
            // Un cambio de calendario no debe generar cobros vencidos falsos
            const cambiaCalendario = (nuevos.frecuencia !== undefined && nuevos.frecuencia !== actual.frecuencia) ||
                (nuevos.dia_cobro !== undefined && nuevos.dia_cobro !== actual.dia_cobro);
            if (cambiaCalendario) {
                db.prepare('UPDATE suscripciones SET cobro_desde = ? WHERE plan_id = ? AND usuario_id = ?')
                    .run(cobros.hoyISO(), id, usuarioId);
            }
        })();
        return this.find(id);
    },
    delete(id, usuarioId) {
        try {
            const stmt = db.prepare('DELETE FROM planes WHERE id = ? AND usuario_id = ?');
            const info = stmt.run(id, usuarioId);
            return { ok: info.changes > 0 };
        } catch (err) {
            if (err.message.includes("FOREIGN KEY")) throw new Error("No puedes eliminar un plan con clientes suscritos.");
            throw err;
        }
    }
};

const clientes = {
    all(usuarioId = 1) {
        return db.prepare('SELECT * FROM clientes WHERE usuario_id = ?').all(usuarioId);
    },
    find(id) {
        return db.prepare('SELECT * FROM clientes WHERE id = ?').get(id);
    },
    create(campos, usuarioId = 1) {
        const { nombre, correo } = validar('clientes', campos, true);
        const stmt = db.prepare('INSERT INTO clientes (nombre, correo, usuario_id) VALUES (?, ?, ?)');
        const info = stmt.run(nombre, correo, usuarioId);
        return { id: info.lastInsertRowid, nombre, correo };
    },
    update(id, campos, usuarioId) {
        if (!existePropia('clientes', id, usuarioId)) return null;
        ejecutarUpdate('clientes', id, validar('clientes', campos, false), usuarioId);
        return this.find(id);
    },
    delete(id, usuarioId) {
        try {
            const stmt = db.prepare('DELETE FROM clientes WHERE id = ? AND usuario_id = ?');
            const info = stmt.run(id, usuarioId);
            return { ok: true };
        } catch (err) {
            if (err.message.includes("FOREIGN KEY")) throw new Error("Cliente con suscripciones vinculadas.");
            throw err;
        }
    }
};

// 2. OBJETO REFACTORIZADO: Suscripciones (CORREGIDO)
const suscripciones = {
    // 1. SELECTs actualizados: s.* ya trae 'descripcion' y 'fecha_alta'
    all(usuarioId = 1) {
        return db.prepare(`
            SELECT s.*, p.nombre_plan as tipo, p.monto, p.frecuencia, p.dia_cobro 
            FROM suscripciones s
            JOIN planes p ON s.plan_id = p.id
            WHERE s.usuario_id = ?
        `).all(usuarioId).map(fixBool);
    },
    
    activas(usuarioId = 1) {
        return db.prepare(`
            SELECT s.*, p.nombre_plan as tipo, p.monto, p.frecuencia, p.dia_cobro 
            FROM suscripciones s
            JOIN planes p ON s.plan_id = p.id
            WHERE s.activa = 1 AND s.usuario_id = ?
        `).all(usuarioId).map(fixBool);
    },

    find(id) {
        return fixBool(db.prepare(`
            SELECT s.*, p.nombre_plan as tipo, p.monto, p.frecuencia, p.dia_cobro 
            FROM suscripciones s
            JOIN planes p ON s.plan_id = p.id
            WHERE s.id = ?
        `).get(id));
    },

    // 2. CREATE actualizado: Ahora recibe y guarda 'fecha_alta'
    create(campos, usuarioId = 1) {
        const v = validar('suscripciones', campos, true);
        validarPropiedad(v, usuarioId);
        const { cliente_id, plan_id } = v;
        const descripcion = v.descripcion || '';

        try {
            // Si no envías fecha, usa la fecha de hoy (YYYY-MM-DD, zona de la aplicación)
            const hoy = cobros.hoyISO();
            const fechaFinal = v.fecha_alta;

            // cobro_desde = hoy: una fecha_alta pasada no genera cobros "vencidos" anteriores al registro
            const stmt = db.prepare(`
                INSERT INTO suscripciones (cliente_id, plan_id, usuario_id, activa, descripcion, fecha_alta, cobro_desde)
                VALUES (?, ?, ?, 1, ?, ?, ?)
            `);
            const info = stmt.run(cliente_id, plan_id, usuarioId, descripcion, fechaFinal, hoy);
            return this.find(info.lastInsertRowid);
        } catch (err) {
            if (err.message.includes("FOREIGN KEY")) {
                throw new Error("VALIDATION_ERROR: El cliente o el plan seleccionado no existen.");
            }
            throw err;
        }
    },

    // Solo actualiza suscripciones del usuario. Reactivar o cambiar fecha_alta fija cobro_desde = hoy.
    update(id, campos, usuarioId) {
        const actual = db.prepare('SELECT * FROM suscripciones WHERE id = ? AND usuario_id = ?').get(id, usuarioId);
        if (!actual) return null;

        const nuevos = validar('suscripciones', campos, false);

        validarPropiedad(nuevos, usuarioId);

        const reactiva = nuevos.activa === 1 && actual.activa !== 1;
        const cambiaAlta = nuevos.fecha_alta !== undefined &&
            String(nuevos.fecha_alta).slice(0, 10) !== String(actual.fecha_alta || '').slice(0, 10);
        if (reactiva || cambiaAlta) nuevos.cobro_desde = cobros.hoyISO();

        ejecutarUpdate('suscripciones', id, nuevos, usuarioId);
        return this.find(id);
    },

    delete(id, usuarioId) {
        const stmt = db.prepare('DELETE FROM suscripciones WHERE id = ? AND usuario_id = ?');
        const info = stmt.run(id, usuarioId);
        return { ok: info.changes > 0 };
    }
};

const historial = {
    all(usuarioId = 1) {
        return db.prepare('SELECT * FROM historial WHERE usuario_id = ? ORDER BY fecha DESC').all(usuarioId);
    },
    create({ suscripcion_id, estado, detalles, fecha, monto }, usuarioId = 1) {
        const stmt = db.prepare(`
            INSERT INTO historial (suscripcion_id, usuario_id, fecha, estado, detalles, monto) 
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const fechaFinal = fecha || new Date().toISOString();
        const info = stmt.run(suscripcion_id, usuarioId, fechaFinal, estado, detalles, monto);
        return { id: info.lastInsertRowid, suscripcion_id, fecha: fechaFinal, estado, monto };
    }
};
// 3. OBJETO: Usuarios (Configuración y Perfil)
const usuarios = {
    // Cambiamos el nombre a findById para coincidir con lo que pide server.js
    findById(id) {
        return db.prepare('SELECT id, email, nombre, color_tema, config_smtp FROM usuarios WHERE id = ?').get(id);
    },
    
    // Mantenemos find por si otras partes del código lo usan
    find(id) {
        return this.findById(id);
    },

    updateTema(id, color) {
        const stmt = db.prepare('UPDATE usuarios SET color_tema = ? WHERE id = ?');
        stmt.run(color, id);
        return { id, color_tema: color };
    },

    // Agregamos updateNombre para que el formulario de configuración funcione completo
    updateNombre(id, nombre) {
        const stmt = db.prepare('UPDATE usuarios SET nombre = ? WHERE id = ?');
        stmt.run(nombre, id);
        return { id, nombre };
    }
};

module.exports = { clientes, suscripciones, historial, planes, usuarios };