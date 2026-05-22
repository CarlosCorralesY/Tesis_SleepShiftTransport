const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/connection');
const userModel = require('../models/userModel');

exports.login = async (req, res) => {
    try {
        const { username, password, role } = req.body;
        console.log(`[LOGIN] Intento: ${username} como ${role}`);

        if (!username || !password || !role) {
            return res.status(400).json({ error: 'Usuario, contraseña y rol son requeridos.' });
        }

        // Buscar usuario
        const user = await userModel.findByUsername(username);
        if (!user) {
            console.log('[LOGIN] Usuario no encontrado');
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        // Verificar rol
        if (user.role !== role) {
            console.log(`[LOGIN] Rol incorrecto: esperado ${role}, real ${user.role}`);
            return res.status(401).json({ error: `Este usuario no tiene el rol de ${role}.` });
        }

        // Verificar contraseña
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            console.log('[LOGIN] Contraseña incorrecta');
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        // Obtener el id real de conductor si el rol es 'conductor'
        let conductorId = null;
        if (role === 'conductor') {
            try {
                const result = await pool.query(
                    'SELECT id FROM conductores WHERE usuario_id = $1',
                    [user.id]
                );
                if (result.rows.length > 0) {
                    conductorId = result.rows[0].id;
                    console.log(`[LOGIN] Conductor encontrado: conductor_id=${conductorId}`);
                } else {
                    console.warn(`[LOGIN] No hay registro en conductores para usuario_id=${user.id}`);
                }
            } catch (err) {
                console.error('[LOGIN] Error al buscar conductor:', err);
                // No detenemos el login; simplemente conductorId queda null
            }
        }

        // Payload del token
        const tokenPayload = {
            id: conductorId || user.id,   // para conductor: conductorId; para coordinador: user.id
            username: user.username,
            role: user.role
        };

        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '24h' });

        console.log(`[LOGIN] Token generado para id=${tokenPayload.id} (${tokenPayload.role})`);

        res.json({
            token,
            user: {
                id: tokenPayload.id,
                username: user.username,
                role: user.role
            }
        });
    } catch (error) {
        console.error('[LOGIN] Error inesperado:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};