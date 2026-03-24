const db = require('./database');

// --- HELPER PARA FORMATEAR RESULTADOS ---
const fixBool = (obj) => {
    if (!obj) return null;
    return { ...obj, activa: obj.activa === 1 };
};

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
    // ... (resto de funciones de planes igual)
    update(id, campos) {
        const { id: _id, usuario_id, ...validos } = campos;
        const keys = Object.keys(validos);
        const values = Object.values(validos);
        if (keys.length === 0) return this.find(id);
        const setClause = keys.map(key => `${key} = ?`).join(', ');
        const stmt = db.prepare(`UPDATE planes SET ${setClause} WHERE id = ?`);
        stmt.run(...values, id);
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
    update(id, campos) {
        const { id: _id, usuario_id, ...validos } = campos;
        const keys = Object.keys(validos);
        const values = Object.values(validos);
        if (keys.length === 0) return this.find(id);
        const setClause = keys.map(key => `${key} = ?`).join(', ');
        const stmt = db.prepare(`UPDATE clientes SET ${setClause} WHERE id = ?`);
        stmt.run(...values, id);
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

        try {
            // Si no envías fecha, usa la fecha actual (YYYY-MM-DD)
            const fechaFinal = fecha_alta || new Date().toISOString().split('T')[0];

            const stmt = db.prepare(`
                INSERT INTO suscripciones (cliente_id, plan_id, usuario_id, activa, descripcion, fecha_alta) 
                VALUES (?, ?, ?, 1, ?, ?)
            `);
            const info = stmt.run(cliente_id, plan_id, usuarioId, descripcion || '', fechaFinal);
            return this.find(info.lastInsertRowid);
        } catch (err) {
            if (err.message.includes("FOREIGN KEY")) {
                throw new Error("VALIDATION_ERROR: El cliente o el plan seleccionado no existen.");
            }
            throw err;
        }
    },

    // 3. UPDATE actualizado: Permite cambiar la fecha o descripción dinámicamente
    update(id, campos) {
        if (campos.activa !== undefined) campos.activa = campos.activa ? 1 : 0;
        if (campos.plan_id !== undefined) campos.plan_id = Number(campos.plan_id);

        // Extraemos campos calculados para que no intenten guardarse en la tabla 'suscripciones'
        const { id: _id, usuario_id, tipo, monto, dia_cobro, frecuencia, ...validos } = campos;
        const keys = Object.keys(validos);
        const values = Object.values(validos);
        
        if (keys.length > 0) {
            const setClause = keys.map(key => `${key} = ?`).join(', ');
            const stmt = db.prepare(`UPDATE suscripciones SET ${setClause} WHERE id = ?`);
            stmt.run(...values, id);
        }
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