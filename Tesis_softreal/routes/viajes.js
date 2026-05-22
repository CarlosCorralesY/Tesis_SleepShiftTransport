const express = require('express');
const router = express.Router();
const viajesController = require('../controllers/viajesController');
const auth = require('../middleware/auth');

router.get('/viajes/conductor', auth('conductor'), viajesController.getViajesConductor);
router.put('/viajes/:id/asignar', auth('conductor'), viajesController.asignarViaje);

module.exports = router;