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
    // CORRECCIÓN: Se añade 'frecuencia' a la inserción
    create({ cliente_id, tipo, monto, dia_cobro, frecuencia }, usuarioId = 1) {
        const stmt = db.prepare(`
            INSERT INTO suscripciones (cliente_id, usuario_id, tipo, monto, dia_cobro, frecuencia, activa) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const valorFrecuencia = frecuencia || 'mensual';
        const info = stmt.run(cliente_id, usuarioId, tipo, Number(monto), Number(dia_cobro), valorFrecuencia, 1);
        return { id: info.lastInsertRowid, cliente_id, tipo, monto, dia_cobro, frecuencia: valorFrecuencia, activa: true };
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
        // Se recomienda unir con clientes o suscripciones para mostrar nombres en el frontend si es necesario
        return db.prepare('SELECT * FROM historial WHERE usuario_id = ? ORDER BY fecha DESC').all(usuarioId);
    },
    // CORRECCIÓN: Se añade 'monto' para evitar el error NaN en la interfaz
    create({ suscripcion_id, monto, estado, detalles, fecha }, usuarioId = 1) {
        const stmt = db.prepare(`
            INSERT INTO historial (suscripcion_id, usuario_id, fecha, monto, estado, detalles) 
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        // Si no viene fecha, generamos una nueva. Aseguramos que el monto sea un número.
        const fechaFinal = fecha || new Date().toISOString();
        const montoFinal = Number(monto) || 0;
        
        const info = stmt.run(suscripcion_id, usuarioId, fechaFinal, montoFinal, estado, detalles);
        return { id: info.lastInsertRowid, suscripcion_id, fecha: fechaFinal, monto: montoFinal, estado, detalles };
    }
};

module.exports = { clientes, suscripciones, historial };