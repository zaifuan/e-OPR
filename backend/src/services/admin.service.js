const bcrypt = require('bcryptjs');
const pool = require('../db/pool');

const SALT_ROUNDS = 12;

async function findByUsername(username) {
  const { rows } = await pool.query(
    'SELECT id, name, username, password_hash, is_active FROM admins WHERE username = $1',
    [username]
  );
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await pool.query(
    'SELECT id, name, username, is_active FROM admins WHERE id = $1 AND is_active = true',
    [id]
  );
  return rows[0] || null;
}

async function verifyPassword(admin, plainPassword) {
  return bcrypt.compare(plainPassword, admin.password_hash);
}

async function createAdmin({ name, username, password }) {
  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  const { rows } = await pool.query(
    `INSERT INTO admins (name, username, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, username, created_at`,
    [name, username, password_hash]
  );
  return rows[0];
}

module.exports = { findByUsername, findById, verifyPassword, createAdmin };
