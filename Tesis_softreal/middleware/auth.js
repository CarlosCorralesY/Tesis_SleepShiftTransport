const jwt = require('jsonwebtoken');

function auth(requiredRole) {
    return (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token no proporcionado.' });
        }
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
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