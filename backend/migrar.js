const db = require('./database');
const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, 'data', 'db.json');
if (!fs.existsSync(jsonPath)) {
    console.error("❌ No se encontró db.json para migrar.");
    process.exit(1);
}

const dataVieja = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

try {
    // 1. Crear usuario admin
    const insertUser = db.prepare('INSERT OR IGNORE INTO usuarios (id, email, password, nombre) VALUES (?, ?, ?, ?)');
    insertUser.run(1, 'admin@correo.com', 'admin123', 'Administrador');
    
    const adminId = 1;
    console.log("🚀 Iniciando migración al nuevo modelo de Catálogo...");

    const iniciarMigracion = db.transaction(() => {
        
        // 2. Migrar Clientes (Igual que antes)
        const insertCliente = db.prepare('INSERT OR REPLACE INTO clientes (id, nombre, correo, usuario_id) VALUES (?, ?, ?, ?)');
        dataVieja.clientes.forEach(c => {
            insertCliente.run(c.id, c.nombre, c.correo, adminId);
        });

        // 3. GENERAR CATÁLOGO DE PLANES
        // Usaremos un Map para no duplicar planes si varios clientes tenían el mismo 'tipo' y 'monto'
        const planMap = new Map(); 
        const insertPlan = db.prepare(`
            INSERT OR REPLACE INTO planes (usuario_id, nombre_plan, monto, frecuencia, dia_cobro) 
            VALUES (?, ?, ?, ?, ?)
        `);

        // 4. Migrar Suscripciones vinculándolas a los Planes
        const insertSuscripcion = db.prepare(`
            INSERT OR REPLACE INTO suscripciones (id, cliente_id, plan_id, usuario_id, activa) 
            VALUES (?, ?, ?, ?, ?)
        `);

        dataVieja.suscripciones.forEach(s => {
            // Creamos una clave única para identificar planes idénticos
            const planKey = `${s.tipo}-${s.monto}-${s.dia_cobro}-${s.frecuencia || 'mensual'}`;
            
            let planId;
            if (!planMap.has(planKey)) {
                // Si el plan no existe en nuestro catálogo temporal, lo creamos en la DB
                const infoPlan = insertPlan.run(
                    adminId, 
                    s.tipo, 
                    s.monto, 
                    s.frecuencia || 'mensual', 
                    s.dia_cobro || 1
                );
                planId = infoPlan.lastInsertRowid;
                planMap.set(planKey, planId);
            } else {
                planId = planMap.get(planKey);
            }

            // Ahora insertamos la suscripción vinculada a ese planId
            insertSuscripcion.run(s.id, s.cliente_id, planId, adminId, s.activa ? 1 : 0);
        });

        // 5. Migrar Historial
        const insertHistorial = db.prepare(`
            INSERT OR REPLACE INTO historial (id, suscripcion_id, usuario_id, fecha, estado, detalles, monto) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        dataVieja.historial.forEach(h => {
            const fechaSegura = h.fecha || new Date().toISOString();
            const detallesSeguros = h.mensaje || h.detalles || 'Sin detalles';
            const montoSeguro = h.monto || 0;
            
            insertHistorial.run(h.id, h.suscripcion_id, adminId, fechaSegura, h.estado, detallesSeguros, montoSeguro);
        });
    });

    iniciarMigracion();
    console.log("✨ Migración exitosa: Datos normalizados en el modelo de Planes.");

} catch (err) {
    console.error("❌ Error durante la migración:", err.message);
}