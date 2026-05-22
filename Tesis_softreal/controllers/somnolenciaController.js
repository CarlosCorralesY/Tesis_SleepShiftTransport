const pool = require('../db/connection');

exports.registrarPrueba = async (req, res) => {
    try {
        const conductorId = req.user.id;
        console.log('registrarPrueba - conductorId:', conductorId);
        console.log('registrarPrueba - body:', req.body);

        const { puntuacion, perclos, ear, mar, parpadeos, bostezos, apto } = req.body;

        if (puntuacion == null) {
            return res.status(400).json({ error: 'Falta la puntuación.' });
        }

        const query = `
            INSERT INTO pruebas_somnolencia
                (conductor_id, puntuacion, perclos_final, ear_final, mar_final, parpadeos_total, bostezos_total, apto)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`;
        const values = [
            conductorId,
            puntuacion,
            perclos || null,
            ear || null,
            mar || null,
            parpadeos || null,
            bostezos || null,
            apto !== undefined ? apto : null
        ];

        console.log('Insertando prueba con values:', values);
        const result = await pool.query(query, values);
        console.log('Prueba insertada:', result.rows[0]);

        // Actualizar última puntuación en conductores
        await pool.query(
            `UPDATE conductores SET ultima_puntuacion_somnolencia = $1, fecha_ultima_prueba = NOW() WHERE id = $2`,
            [puntuacion, conductorId]
        );

        res.status(201).json({ success: true, prueba: result.rows[0] });
    } catch (error) {
        console.error('Error en registrarPrueba:', error);
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
};