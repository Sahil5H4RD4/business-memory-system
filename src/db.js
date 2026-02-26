/**
 * Database Connection — PostgreSQL via pg Pool
 * 
 * Provides a connection pool to the PostgreSQL database.
 * Configuration loaded from .env file.
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
    user: process.env.DB_USER || 'montage',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'context_memory',
    password: process.env.DB_PASSWORD || '',
    port: parseInt(process.env.DB_PORT || '5432'),
});

// Test connection on load
pool.query('SELECT NOW()')
    .then(res => {
        console.log(`✅ PostgreSQL connected at ${res.rows[0].now}`);
    })
    .catch(err => {
        console.error('❌ PostgreSQL connection error:', err.message);
    });

module.exports = pool;
