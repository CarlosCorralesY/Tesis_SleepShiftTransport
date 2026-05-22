require('dotenv').config();
const express = require('express');
const path = require('path');

// Importar rutas
const authRoutes = require('./routes/auth');
const conductorRoutes = require('./routes/conductor');
const viajesRoutes = require('./routes/viajes');
const somnolenciaRoutes = require('./routes/somnolencia');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para parsear JSON
app.use(express.json());

// Servir archivos estáticos (frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Redirigir la raíz al panel del conductor
app.get('/', (req, res) => {
    res.redirect('/conductor.html');
});

// Montar rutas de la API
app.use('/api', authRoutes);
app.use('/api', conductorRoutes);
app.use('/api', viajesRoutes);
app.use('/api', somnolenciaRoutes);

// Capturar errores no manejados (sin matar el proceso)
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ UNHANDLED REJECTION:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('❌ UNCAUGHT EXCEPTION:', err);
    // No matamos el proceso; el servidor se mantiene vivo para seguir viendo logs.
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});git