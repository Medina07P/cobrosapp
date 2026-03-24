const database = require("./database");

try {
    console.log("=== REVISIÓN DE ESTRUCTURA Y DATOS ===");
    const tablas = database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    
    tablas.forEach(tabla => {
        console.log(`\n📌 TABLA: ${tabla.name}`);
        console.log("--------------------------------------");
        
        // Ver columnas
        const columnas = database.prepare(`PRAGMA table_info(${tabla.name})`).all();
        columnas.forEach(col => {
            console.log(`- ${col.name} (${col.type}) ${col.pk ? '[PK]' : ''}`);
        });

        // VER UNA MUESTRA DE DATOS (Crucial para fecha_alta)
        console.log("\n--- Muestra de los últimos 2 registros ---");
        const rows = database.prepare(`SELECT * FROM ${tabla.name} ORDER BY id DESC LIMIT 2`).all();
        console.table(rows); 
    });
} catch (error) {
    console.error("❌ Error al leer la base de datos:", error.message);
}