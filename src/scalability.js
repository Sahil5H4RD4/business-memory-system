/**
 * Scalability Utilities — Pagination, batch operations, performance logging.
 *
 * Provides reusable helpers for scaling the memory engine:
 *   - Paginated queries
 *   - Batch retrieval
 *   - Performance timing and logging
 */

const { query } = require('./db');

// ---------------------------------------------------------------------------
// Pagination Helper
// ---------------------------------------------------------------------------

/**
 * Execute a paginated query.
 *
 * @param {string} baseQuery — SQL query WITHOUT LIMIT/OFFSET.
 * @param {Array}  params    — Query parameters.
 * @param {number} page      — Page number (1-indexed).
 * @param {number} pageSize  — Items per page (default 20).
 * @returns {Promise<object>} { data, page, pageSize, total }
 */
async function paginatedQuery(baseQuery, params = [], page = 1, pageSize = 20) {
    // Count total
    const countQuery = `SELECT COUNT(*) FROM (${baseQuery}) AS _count`;
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Paginated data
    const offset = (page - 1) * pageSize;
    const pagedQuery = `${baseQuery} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const dataResult = await query(pagedQuery, [...params, pageSize, offset]);

    return {
        data: dataResult.rows,
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
    };
}

// ---------------------------------------------------------------------------
// Batch Retrieval
// ---------------------------------------------------------------------------

/**
 * Fetch multiple records by IDs in a single query.
 *
 * @param {string}   table — Table name.
 * @param {number[]} ids   — Array of IDs to fetch.
 * @returns {Promise<object[]>}
 */
async function batchRetrieve(table, ids) {
    if (!ids.length) return [];

    // Validate table name (prevent SQL injection)
    const allowedTables = ['suppliers', 'invoices', 'issues'];
    if (!allowedTables.includes(table)) {
        throw new Error(`Invalid table name: ${table}`);
    }

    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    const result = await query(
        `SELECT * FROM ${table} WHERE id IN (${placeholders})`,
        ids
    );
    return result.rows;
}

// ---------------------------------------------------------------------------
// Performance Logger
// ---------------------------------------------------------------------------

class PerformanceLogger {
    constructor() {
        this.logs = [];
    }

    /**
     * Time an async operation and log the result.
     *
     * @param {string}   operationName
     * @param {Function} fn — Async function to time.
     * @returns {Promise<any>} The result of fn().
     */
    async time(operationName, fn) {
        const start = Date.now();
        try {
            const result = await fn();
            const duration = Date.now() - start;
            this.logs.push({
                operation: operationName,
                duration,
                status: 'success',
                timestamp: new Date().toISOString(),
            });
            return result;
        } catch (err) {
            const duration = Date.now() - start;
            this.logs.push({
                operation: operationName,
                duration,
                status: 'error',
                error: err.message,
                timestamp: new Date().toISOString(),
            });
            throw err;
        }
    }

    /**
     * Get performance summary statistics.
     */
    getReport() {
        if (!this.logs.length) return { message: 'No operations logged' };

        const durations = this.logs
            .filter(l => l.status === 'success')
            .map(l => l.duration);

        return {
            totalOperations: this.logs.length,
            successCount: durations.length,
            errorCount: this.logs.filter(l => l.status === 'error').length,
            avgDuration: durations.length
                ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
                : 0,
            maxDuration: durations.length ? Math.max(...durations) : 0,
            minDuration: durations.length ? Math.min(...durations) : 0,
            logs: this.logs,
        };
    }

    /** Clear all logs. */
    clear() {
        this.logs = [];
    }
}

// ---------------------------------------------------------------------------
// Database Index Setup
// ---------------------------------------------------------------------------

/**
 * Create performance indexes (safe to run multiple times).
 */
async function createIndexes() {
    const fs = require('fs');
    const path = require('path');

    const indexPath = path.join(__dirname, 'indexes.sql');
    const sql = fs.readFileSync(indexPath, 'utf8');
    await query(sql);
    console.log('✅ Database indexes created');
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
    paginatedQuery,
    batchRetrieve,
    PerformanceLogger,
    createIndexes,
};
