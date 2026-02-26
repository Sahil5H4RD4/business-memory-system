/**
 * Supplier Model — Data access layer for the suppliers table.
 *
 * Functions:
 *   createSupplier(data)        → Insert a new supplier
 *   getSupplierById(id)         → Fetch a single supplier
 *   getAllSuppliers()            → Fetch all suppliers
 *   getSupplierIssues(id)       → Fetch issues linked to a supplier
 *   updateSupplier(id, data)    → Update supplier fields
 *   deleteSupplier(id)          → Remove a supplier
 */

const { query } = require('../db');

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

async function createSupplier({ name, industry, rating, contact }) {
    const result = await query(
        `INSERT INTO suppliers (name, industry, rating, contact)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [name, industry || null, rating || 0.50, contact || null]
    );
    return result.rows[0];
}

// ---------------------------------------------------------------------------
// READ
// ---------------------------------------------------------------------------

async function getSupplierById(id) {
    const result = await query(
        'SELECT * FROM suppliers WHERE id = $1',
        [id]
    );
    return result.rows[0] || null;
}

async function getAllSuppliers() {
    const result = await query(
        'SELECT * FROM suppliers ORDER BY created_at DESC'
    );
    return result.rows;
}

/**
 * Fetch all issues associated with a supplier.
 * Includes issue count and average severity.
 */
async function getSupplierIssues(supplierId) {
    const result = await query(
        `SELECT * FROM issues
         WHERE supplier_id = $1
         ORDER BY created_at DESC`,
        [supplierId]
    );
    return result.rows;
}

/**
 * Get supplier summary with aggregated stats.
 */
async function getSupplierSummary(supplierId) {
    const supplier = await getSupplierById(supplierId);
    if (!supplier) return null;

    const issueStats = await query(
        `SELECT
            COUNT(*)::int AS total_issues,
            COALESCE(AVG(severity), 0) AS avg_severity,
            COUNT(*) FILTER (WHERE status = 'open')::int AS open_issues
         FROM issues
         WHERE supplier_id = $1`,
        [supplierId]
    );

    const invoiceStats = await query(
        `SELECT
            COUNT(*)::int AS total_invoices,
            COALESCE(SUM(amount), 0) AS total_amount,
            COUNT(*) FILTER (WHERE payment_status = 'overdue')::int AS overdue_count
         FROM invoices
         WHERE supplier_id = $1`,
        [supplierId]
    );

    return {
        ...supplier,
        issues: issueStats.rows[0],
        invoices: invoiceStats.rows[0],
    };
}

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------

async function updateSupplier(id, { name, industry, rating, contact }) {
    const result = await query(
        `UPDATE suppliers
         SET name = COALESCE($2, name),
             industry = COALESCE($3, industry),
             rating = COALESCE($4, rating),
             contact = COALESCE($5, contact),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [id, name, industry, rating, contact]
    );
    return result.rows[0] || null;
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

async function deleteSupplier(id) {
    const result = await query(
        'DELETE FROM suppliers WHERE id = $1 RETURNING id',
        [id]
    );
    return result.rowCount > 0;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
    createSupplier,
    getSupplierById,
    getAllSuppliers,
    getSupplierIssues,
    getSupplierSummary,
    updateSupplier,
    deleteSupplier,
};
