const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Base de datos simulada
const users = [
    { id: 1, username: 'conductor1', password: '123456', role: 'conductor', nombre: 'Carlos Mamani' },
    { id: 2, username: 'supervisor', password: 'super123', role: 'supervisor', nombre: 'Luis Quispe' }
];

const conductores = [
    { id: 1, nombre: 'Carlos Mamani', disponible: true, fatiga_actual: 2, lat: -16.3989, lng: -71.5370 },
    { id: 2, nombre: 'Ana Flores', disponible: true, fatiga_actual: 7, lat: -16.4090, lng: -71.5450 },
    { id: 3, nombre: 'Jorge Rios', disponible: true, fatiga_actual: 4, lat: -16.4000, lng: -71.5300 }
];

const rutas = [
    { id: 1, origen: 'Planta Química Suiza', destino: 'Mina Cerro Verde', distancia_km: 45, duracion_estimada_min: 60 },
    { id: 2, origen: 'Oficina Arequipa', destino: 'Almacén Yura', distancia_km: 30, duracion_estimada_min: 40 }
];

let viajesAsignados = [];

// ---------- ENDPOINTS ----------

// 1. Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        res.json({ success: true, message: 'Login exitoso', user: { id: user.id, username: user.username, role: user.role, nombre: user.nombre } });
    } else {
        res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }
});

// 2. Control de somnolencia (recibe métricas del módulo de visión)
app.post('/api/somnolencia', (req, res) => {
    const { conductor_id, puntaje_fatiga, ear_promedio, perclos, timestamp } = req.body;
    if (!conductor_id || puntaje_fatiga === undefined) {
        return res.status(400).json({ success: false, message: 'Faltan datos: conductor_id y puntaje_fatiga son requeridos' });
    }
    const conductor = conductores.find(c => c.id === conductor_id);
    if (conductor) {
        conductor.fatiga_actual = puntaje_fatiga;
        if (puntaje_fatiga >= 8) conductor.disponible = false;
    }
    console.log(`[SOMNOLENCIA] Conductor ${conductor_id} - Fatiga: ${puntaje_fatiga}`);
    res.json({ 
        success: true, 
        message: 'Datos de somnolencia recibidos',
        umbral_superado: puntaje_fatiga >= 8,
        recomendacion: puntaje_fatiga >= 8 ? 'Descanso obligatorio' : (puntaje_fatiga >= 6 ? 'Precaución' : 'Normal')
    });
});

// 3. Asignación de viaje
app.post('/api/asignar-viaje', (req, res) => {
    const { origen, destino, prioridad } = req.body;
    const disponibles = conductores.filter(c => c.disponible === true && c.fatiga_actual < 6);
    if (disponibles.length === 0) {
        return res.status(404).json({ success: false, message: 'No hay conductores disponibles con fatiga baja' });
    }
    disponibles.sort((a,b) => a.fatiga_actual - b.fatiga_actual);
    const seleccionado = disponibles[0];
    const ruta = rutas.find(r => r.origen === origen && r.destino === destino) || rutas[0];
    const viaje = {
        id: viajesAsignados.length + 1,
        conductor: seleccionado,
        origen,
        destino,
        ruta,
        asignado_en: new Date().toISOString(),
        estado: 'pendiente'
    };
    viajesAsignados.push(viaje);
    seleccionado.disponible = false;
    res.json({ success: true, message: 'Viaje asignado', viaje });
});

// 4. Comprobación de ruta por ID
app.get('/api/ruta/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const ruta = rutas.find(r => r.id === id);
    ruta ? res.json({ success: true, ruta }) : res.status(404).json({ success: false, message: 'Ruta no encontrada' });
});

// 5. Listar todas las rutas
app.get('/api/rutas', (req, res) => {
    res.json({ success: true, rutas });
});

// 6. Estado de conductores (para supervisor)
app.get('/api/conductores', (req, res) => {
    res.json({ success: true, conductores });
});

// 7. Finalizar viaje (liberar conductor)
app.post('/api/finalizar-viaje', (req, res) => {
    const { viaje_id, conductor_id } = req.body;
    const viaje = viajesAsignados.find(v => v.id === viaje_id);
    if (viaje) {
        viaje.estado = 'completado';
        const conductor = conductores.find(c => c.id === conductor_id);
        if (conductor) conductor.disponible = true;
        res.json({ success: true, message: 'Viaje finalizado' });
    } else {
        res.status(404).json({ success: false, message: 'Viaje no encontrado' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});