/**
 * Invoice Model — Data access layer for the invoices table.
 *
 * Functions:
 *   createInvoice(data)             → Insert a new invoice
 *   getInvoiceById(id)              → Fetch a single invoice
 *   getInvoicesBySupplier(suppId)   → Fetch invoices for a supplier
 *   getOverdueInvoices()            → Fetch all overdue invoices
 *   updateInvoiceStatus(id, status) → Update payment status
 */

const { query } = require('../db');

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

async function createInvoice({ supplier_id, amount, invoice_date, due_date, payment_status, description }) {
    const result = await query(
        `INSERT INTO invoices (supplier_id, amount, invoice_date, due_date, payment_status, description)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
            supplier_id,
            amount,
            invoice_date || new Date().toISOString().split('T')[0],
            due_date || null,
            payment_status || 'pending',
            description || null,
        ]
    );
    return result.rows[0];
}

// ---------------------------------------------------------------------------
// READ
// ---------------------------------------------------------------------------

async function getInvoiceById(id) {
    const result = await query(
        'SELECT * FROM invoices WHERE id = $1',
        [id]
    );
    return result.rows[0] || null;
}

async function getInvoicesBySupplier(supplierId) {
    const result = await query(
        `SELECT * FROM invoices
         WHERE supplier_id = $1
         ORDER BY created_at DESC`,
        [supplierId]
    );
    return result.rows;
}

async function getAllInvoices() {
    const result = await query(
        'SELECT * FROM invoices ORDER BY created_at DESC'
    );
    return result.rows;
}

/**
 * Fetch invoices that are past due_date and still marked 'pending'.
 */
async function getOverdueInvoices() {
    const result = await query(
        `SELECT i.*, s.name AS supplier_name
         FROM invoices i
         JOIN suppliers s ON s.id = i.supplier_id
         WHERE i.due_date < CURRENT_DATE
           AND i.payment_status = 'pending'
         ORDER BY i.due_date ASC`
    );
    return result.rows;
}

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------

async function updateInvoiceStatus(id, payment_status) {
    const result = await query(
        `UPDATE invoices
         SET payment_status = $2
         WHERE id = $1
         RETURNING *`,
        [id, payment_status]
    );
    return result.rows[0] || null;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
    createInvoice,
    getInvoiceById,
    getInvoicesBySupplier,
    getAllInvoices,
    getOverdueInvoices,
    updateInvoiceStatus,
};
