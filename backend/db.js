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
    // Dentro del objeto planes -> create
    create({ nombre_plan, monto, dia_cobro, frecuencia, descripcion }, usuarioId = 1) {
        const stmt = db.prepare(`
            INSERT INTO planes (usuario_id, nombre_plan, monto, frecuencia, dia_cobro, descripcion) 
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        // Usamos || 1 para que nunca sea NULL si la base de datos no lo permite
        const info = stmt.run(usuarioId, nombre_plan, parseFloat(monto), frecuencia || 'mensual', Number(dia_cobro) || 1, descripcion || '');
        return { id: info.lastInsertRowid, nombre_plan, monto, frecuencia };
    },
    update(id, campos, usuarioId) {
        if (!existePropia('planes', id, usuarioId)) return null;
        ejecutarUpdate('planes', id, filtrar('planes', campos), usuarioId);
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
    create({ nombre, correo }, usuarioId = 1) {
        const stmt = db.prepare('INSERT INTO clientes (nombre, correo, usuario_id) VALUES (?, ?, ?)');
        const info = stmt.run(nombre, correo, usuarioId);
        return { id: info.lastInsertRowid, nombre, correo };
    },
    update(id, campos, usuarioId) {
        if (!existePropia('clientes', id, usuarioId)) return null;
        ejecutarUpdate('clientes', id, filtrar('clientes', campos), usuarioId);
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
    create({ cliente_id, plan_id, descripcion, fecha_alta }, usuarioId = 1) {
        if (!cliente_id || !plan_id) throw new Error("VALIDATION_ERROR: Cliente y Plan son obligatorios.");
        validarPropiedad({ cliente_id: Number(cliente_id), plan_id: Number(plan_id) }, usuarioId);

        try {
            // Si no envías fecha, usa la fecha de hoy (YYYY-MM-DD, zona de la aplicación)
            const hoy = cobros.hoyISO();
            const fechaFinal = fecha_alta || hoy;

            // cobro_desde = hoy: una fecha_alta pasada no genera cobros "vencidos" anteriores al registro
            const stmt = db.prepare(`
                INSERT INTO suscripciones (cliente_id, plan_id, usuario_id, activa, descripcion, fecha_alta, cobro_desde)
                VALUES (?, ?, ?, 1, ?, ?, ?)
            `);
            const info = stmt.run(cliente_id, plan_id, usuarioId, descripcion || '', fechaFinal, hoy);
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

        const nuevos = filtrar('suscripciones', campos);
        if (nuevos.activa !== undefined) nuevos.activa = nuevos.activa ? 1 : 0;
        if (nuevos.plan_id !== undefined) nuevos.plan_id = Number(nuevos.plan_id);
        if (nuevos.cliente_id !== undefined) nuevos.cliente_id = Number(nuevos.cliente_id);

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