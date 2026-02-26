/**
 * Database Connection Module — PostgreSQL via pg Pool
 *
 * Features:
 *   - Connection pool management via pg.Pool
 *   - Auto-initialization: runs schema.sql on first connect
 *   - Environment-based configuration from .env
 *   - Query helper with error handling
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

// ---------------------------------------------------------------------------
// Pool Configuration
// ---------------------------------------------------------------------------

const pool = new Pool({
    user: process.env.DB_USER || 'montage',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'context_memory',
    password: process.env.DB_PASSWORD || '',
    port: parseInt(process.env.DB_PORT || '5432'),
});

// ---------------------------------------------------------------------------
// Connection Test
// ---------------------------------------------------------------------------

async function testConnection() {
    try {
        const res = await pool.query('SELECT NOW()');
        console.log(`✅ PostgreSQL connected at ${res.rows[0].now}`);
        return true;
    } catch (err) {
        console.error('❌ PostgreSQL connection error:', err.message);
        return false;
    }
}

// ---------------------------------------------------------------------------
// Schema Initialization
// ---------------------------------------------------------------------------

async function initializeSchema() {
    try {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schema);
        console.log('✅ Database schema initialized');
    } catch (err) {
        console.error('❌ Schema initialization error:', err.message);
    }
}

// ---------------------------------------------------------------------------
// Query Helper
// ---------------------------------------------------------------------------

/**
 * Execute a parameterized query.
 *
 * @param {string} text   - SQL query string with $1, $2, ... placeholders
 * @param {Array}  params - Parameter values
 * @returns {object}      - pg Result object
 */
async function query(text, params) {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        // Log slow queries (> 500ms)
        if (duration > 500) {
            console.warn(`⚠️  Slow query (${duration}ms): ${text.substring(0, 80)}...`);
        }
        return res;
    } catch (err) {
        console.error(`❌ Query error: ${err.message}`);
        console.error(`   Query: ${text.substring(0, 120)}`);
        throw err;
    }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
    pool,
    query,
    testConnection,
    initializeSchema,
};
