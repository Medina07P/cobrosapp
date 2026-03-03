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
        const keys = Object.keys(campos);
        const values = Object.values(campos);
        const setClause = keys.map(key => `${key} = ?`).join(', ');
        const stmt = db.prepare(`UPDATE clientes SET ${setClause} WHERE id = ?`);
        stmt.run(...values, id);
        return this.find(id);
    },
    delete(id) {
        db.prepare('DELETE FROM clientes WHERE id = ?').run(id);
        return { ok: true };
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
    // MEJORADO: Validación estricta de monto y cliente
    create({ cliente_id, tipo, monto, dia_cobro, frecuencia }, usuarioId = 1) {
        // Validación manual antes de intentar el SQL
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
            // Traducimos el error técnico de la base de datos a algo lógico
            if (err.message.includes("FOREIGN KEY")) {
                throw new Error("VALIDATION_ERROR: El cliente seleccionado no existe en el sistema.");
            }
            throw err;
        }
    },
    update(id, campos) {
        if (campos.activa !== undefined) campos.activa = campos.activa ? 1 : 0;
        const keys = Object.keys(campos);
        const values = Object.values(campos);
        const setClause = keys.map(key => `${key} = ?`).join(', ');
        const stmt = db.prepare(`UPDATE suscripciones SET ${setClause} WHERE id = ?`);
        stmt.run(...values, id);
        return this.find(id);
    }
};

const historial = {
    all(usuarioId = 1) {
        return db.prepare('SELECT * FROM historial WHERE usuario_id = ? ORDER BY fecha DESC').all(usuarioId);
    },
    // MANTENIDO: Lógica de inserción sin la columna 'monto' si tu tabla no la tiene
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
            detalles 
        };
    }
};

module.exports = { clientes, suscripciones, historial };