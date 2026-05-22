const express = require('express');
const router = express.Router();
const conductorController = require('../controllers/conductorController');
const auth = require('../middleware/auth');

router.get('/conductor/dashboard', auth('conductor'), conductorController.dashboard);

module.exports = router;