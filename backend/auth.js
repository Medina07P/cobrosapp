const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./database'); 

const SECRET_KEY = process.env.JWT_SECRET || 'clave_maestra_super_secreta_123';

// Helper para enviar JSON (Mantenemos el tuyo, es correcto)
function enviarJSON(res, status, data) {
    res.writeHead(status, { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
    });
    res.end(JSON.stringify(data));
}

// NUEVO: Helper para leer el body en Node.js puro
async function getBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                resolve({});
            }
        });
        req.on('error', (err) => reject(err));
    });
}

const auth = {
    async registrar(req, res) {
        // Leemos el body manualmente si no viene pre-procesado
        const body = req.body || await getBody(req);
        const { email, password, nombre } = body;
        
        if (!email || !password) {
            return enviarJSON(res, 400, { error: "Email y contraseña son requeridos" });
        }

        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            const stmt = db.prepare('INSERT INTO usuarios (email, password, nombre, color_tema) VALUES (?, ?, ?, ?)');
            
            // Usamos el color corporativo por defecto
            const info = stmt.run(email, hashedPassword, nombre || 'Café Valdore Admin', '#4f46e5');
            
            return enviarJSON(res, 201, { 
                id: info.lastInsertRowid, 
                message: "Usuario creado con éxito" 
            });
            
        } catch (err) {
            console.error("❌ Error en registro:", err.message);
            const msg = err.message.includes('UNIQUE') ? "El email ya existe" : "Error en la base de datos";
            return enviarJSON(res, 400, { error: msg });
        }
    },

    async login(req, res) {
        // ASEGURAMOS LA LECTURA DEL BODY
        const body = req.body || await getBody(req);
        const { email, password } = body;

        console.log(`[Auth] Intento de login para: ${email}`);
        
        try {
            const user = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
            
            // Verificamos usuario y comparamos el hash de la contraseña
            if (!user || !(await bcrypt.compare(password, user.password))) {
                console.warn(`[Auth] Credenciales inválidas para: ${email}`);
                return enviarJSON(res, 401, { error: "Credenciales incorrectas" });
            }

            // Generamos el Token JWT
            const token = jwt.sign(
                { id: user.id, email: user.email, nombre: user.nombre },
                SECRET_KEY,
                { expiresIn: '24h' }
            );

            console.log(`[Auth] Login exitoso: ${user.nombre}`);

            return enviarJSON(res, 200, { 
                token, 
                user: { 
                    id: user.id, 
                    nombre: user.nombre, 
                    email: user.email, 
                    color_tema: user.color_tema 
                } 
            });

        } catch (err) {
            console.error("❌ Error en login:", err.message);
            return enviarJSON(res, 500, { error: "Error interno del servidor" });
        }
    }
};

module.exports = auth;