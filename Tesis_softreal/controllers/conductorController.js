const pool = require('../db/connection');

exports.dashboard = async (req, res) => {
    try {
        const conductorId = req.user.id;
        console.log('Dashboard conductorId:', conductorId);

        // 1. Viajes de hoy
        const viajesHoyQuery = await pool.query(
            `SELECT COUNT(*)::int AS total FROM viajes
             WHERE conductor_id = $1
               AND fecha_hora_salida::date = CURRENT_DATE`,
            [conductorId]
        );
        const viajesHoy = viajesHoyQuery.rows[0].total;

        // 2. Última puntuación de somnolencia
        const puntuacionQuery = await pool.query(
            `SELECT puntuacion FROM pruebas_somnolencia
             WHERE conductor_id = $1
             ORDER BY fecha_prueba DESC LIMIT 1`,
            [conductorId]
        );
        const puntuacion = puntuacionQuery.rows[0]?.puntuacion ?? null;

        // 3. Próximo viaje
        const proximoQuery = await pool.query(
            `SELECT fecha_hora_salida FROM viajes
             WHERE conductor_id = $1 AND estado IN ('asignado','pendiente')
               AND fecha_hora_salida > NOW()
             ORDER BY fecha_hora_salida ASC LIMIT 1`,
            [conductorId]
        );
        const proximoViaje = proximoQuery.rows[0]
            ? new Date(proximoQuery.rows[0].fecha_hora_salida).toLocaleString('es-PE')
            : '--';

        // 4. Últimos 5 viajes
        const ultimosQuery = await pool.query(
            `SELECT id, origen, destino, fecha_hora_salida, estado
             FROM viajes WHERE conductor_id = $1
             ORDER BY fecha_hora_salida DESC LIMIT 5`,
            [conductorId]
        );

        res.json({
            viajesHoy,
            puntuacionSomnolencia: puntuacion,
            proximoViaje,
            ultimosViajes: ultimosQuery.rows
        });
    } catch (error) {
        console.error('Error en dashboard conductor:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};