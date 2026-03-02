const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./database'); 

const SECRET_KEY = process.env.JWT_SECRET || 'clave_maestra_super_secreta_123';

// Helper interno para enviar JSON ya que no tenemos Express
function enviarJSON(res, status, data) {
    res.writeHead(status, { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
    });
    res.end(JSON.stringify(data));
}

const auth = {
    async registrar(req, res) {
        const { email, password, nombre } = req.body;
        
        if (!email || !password) {
            return enviarJSON(res, 400, { error: "Email y contraseña son requeridos" });
        }

        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            const stmt = db.prepare('INSERT INTO usuarios (email, password, nombre) VALUES (?, ?, ?)');
            const info = stmt.run(email, hashedPassword, nombre || 'Usuario');
            
            return enviarJSON(res, 201, { 
                id: info.lastInsertRowid, 
                message: "Usuario creado con éxito" 
            });
            
        } catch (err) {
            console.error("Error en registro:", err.message);
            const msg = err.message.includes('UNIQUE') ? "El email ya existe" : "Error en la base de datos";
            return enviarJSON(res, 400, { error: msg });
        }
    },

    async login(req, res) {
        const { email, password } = req.body;
        
        try {
            const user = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
            
            if (!user || !(await bcrypt.compare(password, user.password))) {
                return enviarJSON(res, 401, { error: "Credenciales incorrectas" });
            }

            const token = jwt.sign(
                { id: user.id, email: user.email, nombre: user.nombre },
                SECRET_KEY,
                { expiresIn: '24h' }
            );

            return enviarJSON(res, 200, { 
                token, 
                user: { id: user.id, nombre: user.nombre, email: user.email } 
            });

        } catch (err) {
            console.error("Error en login:", err.message);
            return enviarJSON(res, 500, { error: "Error interno del servidor" });
        }
    }
};

module.exports = auth;