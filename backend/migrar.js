const db = require('./database');
const fs = require('fs');
const path = require('path');

// 1. Cargar tu JSON viejo
const jsonPath = path.join(__dirname, 'data', 'db.json');
if (!fs.existsSync(jsonPath)) {
    console.error("❌ No se encontró db.json para migrar.");
    process.exit(1);
}

const dataVieja = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

try {
    // 2. Crear tu primer usuario (TÚ como admin)
    const insertUser = db.prepare('INSERT OR IGNORE INTO usuarios (id, email, password, nombre) VALUES (?, ?, ?, ?)');
    insertUser.run(1, 'admin@correo.com', 'admin123', 'Administrador');
    
    const adminId = 1;

    console.log("🚀 Iniciando migración de datos...");

    // Iniciar una transacción para que si algo falla, no se guarde nada a medias
    const iniciarMigracion = db.transaction(() => {
        
        // 3. Migrar Clientes
        const insertCliente = db.prepare('INSERT OR REPLACE INTO clientes (id, nombre, correo, usuario_id) VALUES (?, ?, ?, ?)');
        dataVieja.clientes.forEach(c => {
            insertCliente.run(c.id, c.nombre, c.correo, adminId);
        });

        // 4. Migrar Suscripciones
        const insertSuscripcion = db.prepare('INSERT OR REPLACE INTO suscripciones (id, cliente_id, usuario_id, tipo, monto, dia_cobro, activa) VALUES (?, ?, ?, ?, ?, ?, ?)');
        dataVieja.suscripciones.forEach(s => {
            insertSuscripcion.run(s.id, s.cliente_id, adminId, s.tipo, s.monto, s.dia_cobro, s.activa ? 1 : 0);
        });

        // 5. Migrar Historial (Aquí estaba el error)
        const insertHistorial = db.prepare('INSERT OR REPLACE INTO historial (id, suscripcion_id, usuario_id, fecha, estado, detalles) VALUES (?, ?, ?, ?, ?, ?)');
        dataVieja.historial.forEach(h => {
            // Si h.fecha no existe, usamos la fecha y hora actual
            const fechaSegura = h.fecha || new Date().toISOString();
            const detallesSeguros = h.mensaje || h.detalles || 'Sin detalles';
            
            insertHistorial.run(h.id, h.suscripcion_id, adminId, fechaSegura, h.estado, detallesSeguros);
        });
    });

    iniciarMigracion();

    console.log("✨ Migración completada con éxito. Ya puedes usar sgcrc.db");

} catch (err) {
    console.error("❌ Error durante la migración:", err.message);
}