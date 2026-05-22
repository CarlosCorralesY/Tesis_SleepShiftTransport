const bcrypt = require('bcryptjs');

// Cambia esta contraseña por la que quieras hashear
const password = 'Conductor123';

// Número de "salt rounds" (10 es un buen equilibrio)
const saltRounds = 10;

bcrypt.hash(password, saltRounds)
    .then(hash => {
        console.log('Contraseña original:', password);
        console.log('Hash generado:', hash);
        console.log('\nCopia este hash en la tabla usuarios, campo password_hash');
    })
    .catch(err => {
        console.error('Error al generar hash:', err);
    });