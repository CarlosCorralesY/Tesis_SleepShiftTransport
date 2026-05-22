const pool = require('../db/connection');
exports.findByUsername = async (username) => {
    const query = 'SELECT id, username, password_hash, role FROM usuarios WHERE username = $1';
    const result = await pool.query(query, [username]);
    return result.rows[0] || null;
};