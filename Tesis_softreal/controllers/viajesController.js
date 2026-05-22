const pool = require('../db/connection');

exports.getViajesConductor = async (req, res) => {
    try {
        const conductorId = req.user.id;
        const pendientes = await pool.query(
            `SELECT id, origen, destino, fecha_hora_salida, estado
             FROM viajes WHERE estado = 'pendiente' AND conductor_id IS NULL
             ORDER BY fecha_hora_salida ASC`
        );
        const asignados = await pool.query(
            `SELECT id, origen, destino, fecha_hora_salida, estado
             FROM viajes WHERE conductor_id = $1 AND estado IN ('asignado','en_curso')
             ORDER BY fecha_hora_salida ASC`,
            [conductorId]
        );
        res.json({ pendientes: pendientes.rows, asignados: asignados.rows });
    } catch (error) {
        console.error('Error al obtener viajes conductor:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

exports.asignarViaje = async (req, res) => {
    const viajeId = req.params.id;
    const conductorId = req.user.id;
    try {
        const viajeQuery = await pool.query(`SELECT id, estado FROM viajes WHERE id = $1`, [viajeId]);
        if (viajeQuery.rows.length === 0) return res.status(404).json({ error: 'Viaje no encontrado' });
        if (viajeQuery.rows[0].estado !== 'pendiente') return res.status(400).json({ error: 'El viaje no está disponible' });

        const aptoQuery = await pool.query(
            `SELECT puntuacion, fecha_prueba FROM pruebas_somnolencia
             WHERE conductor_id = $1 ORDER BY fecha_prueba DESC LIMIT 1`,
            [conductorId]
        );
        if (aptoQuery.rows.length === 0) return res.status(400).json({ error: 'Sin prueba de somnolencia' });
        const p = aptoQuery.rows[0];
        if (p.puntuacion > 50) return res.status(400).json({ error: 'No apto por somnolencia alta' });
        const horas = (Date.now() - new Date(p.fecha_prueba).getTime()) / 3600000;
        if (horas > 4) return res.status(400).json({ error: 'Prueba expirada' });

        await pool.query(
            `UPDATE viajes SET conductor_id = $1, estado = 'asignado', updated_at = NOW() WHERE id = $2`,
            [conductorId, viajeId]
        );
        res.json({ message: 'Viaje asignado correctamente' });
    } catch (error) {
        console.error('Error al asignar viaje:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};