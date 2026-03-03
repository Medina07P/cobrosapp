const db = require('./database');

// --- HELPER PARA FORMATEAR RESULTADOS ---
const fixBool = (obj) => {
    if (!obj) return null;
    return { ...obj, activa: obj.activa === 1 };
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

            if (info.changes === 0) {
                throw new Error("Cliente no encontrado o no tienes permiso para eliminarlo.");
            }
            return { ok: true };
        } catch (err) {
            if (err.message.includes("FOREIGN KEY constraint failed")) {
                throw new Error("No se puede eliminar: el cliente tiene suscripciones activas vinculadas.");
            }
            throw err;
        }
    }
};

const suscripciones = {
    all(usuarioId = 1) {
        return db.prepare('SELECT * FROM suscripciones WHERE usuario_id = ?').all(usuarioId).map(fixBool);
    },
    activas(usuarioId = 1) {
        return db.prepare('SELECT * FROM suscripciones WHERE activa = 1 AND usuario_id = ?').all(usuarioId).map(fixBool);
    },
    find(id) {
        return fixBool(db.prepare('SELECT * FROM suscripciones WHERE id = ?').get(id));
    },
    create({ cliente_id, tipo, monto, dia_cobro, frecuencia }, usuarioId = 1) {
        if (!cliente_id) throw new Error("VALIDATION_ERROR: Debe seleccionar un cliente.");
        
        const montoFinal = parseFloat(monto);
        if (isNaN(montoFinal) || montoFinal <= 0) {
            throw new Error("VALIDATION_ERROR: El monto debe ser un número válido mayor a 0.");
        }

        try {
            const stmt = db.prepare(`
                INSERT INTO suscripciones (cliente_id, usuario_id, tipo, monto, dia_cobro, frecuencia, activa) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            
            const valorFrecuencia = frecuencia || 'mensual';
            const diaFinal = Number(dia_cobro) || 1;

            const info = stmt.run(cliente_id, usuarioId, tipo, montoFinal, diaFinal, valorFrecuencia, 1);
            
            return { 
                id: info.lastInsertRowid, 
                cliente_id, 
                tipo, 
                monto: montoFinal, 
                dia_cobro: diaFinal, 
                frecuencia: valorFrecuencia, 
                activa: true 
            };
        } catch (err) {
            if (err.message.includes("FOREIGN KEY")) {
                throw new Error("VALIDATION_ERROR: El cliente seleccionado no existe en el sistema.");
            }
            throw err;
        }
    },
    update(id, campos) {
        if (campos.activa !== undefined) campos.activa = campos.activa ? 1 : 0;
        if (campos.dia_cobro !== undefined) campos.dia_cobro = Number(campos.dia_cobro);
        if (campos.monto !== undefined) campos.monto = parseFloat(campos.monto);
        if (campos.cliente_id !== undefined) campos.cliente_id = Number(campos.cliente_id);

        const { descripcion, id: _id, usuario_id, ...soloColumnasReales } = campos;
        const keys = Object.keys(soloColumnasReales);
        const values = Object.values(soloColumnasReales);
        
        if (keys.length === 0) return this.find(id);

        const setClause = keys.map(key => `${key} = ?`).join(', ');
        const stmt = db.prepare(`UPDATE suscripciones SET ${setClause} WHERE id = ?`);
        stmt.run(...values, id);
        return this.find(id);
    },
    delete(id, usuarioId) {
        try {
            const stmt = db.prepare('DELETE FROM suscripciones WHERE id = ? AND usuario_id = ?');
            const info = stmt.run(id, usuarioId);

            if (info.changes === 0) {
                throw new Error("La suscripción no existe o no tienes permiso.");
            }
            return { ok: true };
        } catch (err) {
            throw new Error("Error al eliminar la suscripción: " + err.message);
        }
    }
};

const historial = {
    all(usuarioId = 1) {
        return db.prepare('SELECT * FROM historial WHERE usuario_id = ? ORDER BY fecha DESC').all(usuarioId);
    },
    create({ suscripcion_id, estado, detalles, fecha }, usuarioId = 1) {
        const stmt = db.prepare(`
            INSERT INTO historial (suscripcion_id, usuario_id, fecha, estado, detalles) 
            VALUES (?, ?, ?, ?, ?)
        `);
        
        const fechaFinal = fecha || new Date().toISOString();
        const info = stmt.run(suscripcion_id, usuarioId, fechaFinal, estado, detalles);
        
        return { 
            id: info.lastInsertRowid, 
            suscripcion_id, 
            fecha: fechaFinal, 
            estado, 
            detalles: detalles 
        };
    }
};

module.exports = { clientes, suscripciones, historial };