const database = require("./database"); // O la ruta a tu conexión de BD

try {
    console.log("=== TABLAS EN LA BASE DE DATOS ===");
    const tablas = database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    
    tablas.forEach(tabla => {
        console.log(`\n📌 TABLA: ${tabla.name}`);
        console.log("--------------------------------------");
        const columnas = database.prepare(`PRAGMA table_info(${tabla.name})`).all();
        
        columnas.forEach(col => {
            console.log(`- ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : ''}`);
        });
    });
} catch (error) {
    console.error("Error al leer la base de datos:", error.message);
}