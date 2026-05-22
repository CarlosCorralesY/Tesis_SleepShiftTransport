const express = require('express');
const router = express.Router();
const somnolenciaController = require('../controllers/somnolenciaController');
const auth = require('../middleware/auth');

router.post('/conductor/somnolencia', auth('conductor'), somnolenciaController.registrarPrueba);

module.exports = router;