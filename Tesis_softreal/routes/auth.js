const jwt = require('jsonwebtoken');

/**
 * Middleware de autenticación y autorización.
 * Verifica el token JWT y, opcionalmente, el rol necesario para acceder a la ruta.
 * 
 * Uso:
 *   router.get('/ruta-protegida', auth(), controlador.metodo);       // cualquier usuario autenticado
 *   router.get('/ruta-admin', auth('coordinador'), controlador.metodo); // solo coordinador
 *   router.get('/ruta-conductor', auth('conductor'), controlador.metodo); // solo conductor
 * 
 * @param {string} [requiredRole] - Rol requerido para la ruta ('coordinador', 'conductor'). Si no se proporciona, permite cualquier rol autenticado.
 * @returns {Function} Express middleware
 */
function auth(requiredRole) {
    return (req, res, next) => {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token no proporcionado.' });
        }

        const token = authHeader.split(' ')[1];

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded; // { id, username, role }

            // Si se requiere un rol específico, verificamos
            if (requiredRole && req.user.role !== requiredRole) {
                return res.status(403).json({ error: 'Acceso denegado. Rol no autorizado.' });
            }

            next();
        } catch (error) {
            return res.status(401).json({ error: 'Token inválido o expirado.' });
        }
    };
}

module.exports = auth;