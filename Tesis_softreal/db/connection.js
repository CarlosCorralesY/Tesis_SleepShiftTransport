const { Pool } = require('pg');
require('dotenv').config();

// Configuración del pool usando la variable de entorno DATABASE_URL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Opciones adicionales (ajusta según necesites)
    max: 10,                        // máximo de conexiones en el pool
    idleTimeoutMillis: 30000,       // tiempo máximo de inactividad antes de cerrar
    connectionTimeoutMillis: 5000,  // tiempo máximo para establecer conexión
});

// Verificar la conexión al iniciar (opcional pero útil para debug)
pool.connect()
    .then(client => {
        console.log('✅ Conexión exitosa a PostgreSQL');
        client.release(); // liberar el cliente de prueba
    })
    .catch(err => {
        console.error('❌ Error al conectar a PostgreSQL:', err.message);
        // No detenemos la aplicación, pero puedes decidir si hacer process.exit(1)
    });

// También podemos escuchar eventos del pool para monitoreo
pool.on('error', (err) => {
    console.error('⚠️ Error inesperado en el pool de PostgreSQL:', err);
});

module.exports = pool;