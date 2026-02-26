/**
 * Invoice Routes — REST API for invoice management.
 *
 * Endpoints:
 *   POST   /api/invoices              → Submit new invoice (triggers retrieval)
 *   GET    /api/invoices              → List all invoices
 *   GET    /api/invoices/:id          → Get invoice by ID
 *   GET    /api/invoices/overdue      → Get overdue invoices
 *   PATCH  /api/invoices/:id/status   → Update payment status
 */

const express = require('express');
const router = express.Router();

const InvoiceModel = require('../models/invoice.model');
const IssueModel = require('../models/issue.model');
const retrieval = require('../engines/retrieval.engine');
const conflict = require('../engines/conflict.engine');

// ---------------------------------------------------------------------------
// POST /api/invoices — Submit Invoice (triggers retrieval logic)
// ---------------------------------------------------------------------------

router.post('/', async (req, res) => {
    try {
        // Step 1: Create the invoice
        const invoice = await InvoiceModel.createInvoice(req.body);

        // Step 2: Automatically run retrieval for the supplier
        let contextResult = null;
        if (invoice.supplier_id) {
            const rawResult = await retrieval.retrieveContext(
                invoice.supplier_id,
                { keywords: ['invoice', 'payment', 'overdue'] }
            );

            // Step 3: Apply conflict resolution
            if (rawResult.items.length > 0) {
                const conflictResult = await conflict.resolveConflicts(
                    invoice.supplier_id,
                    rawResult.items
                );
                rawResult.items = conflictResult.adjustedItems;
                rawResult.trendInfo = conflictResult.trendInfo;
            }

            contextResult = rawResult;
        }

        res.status(201).json({
            success: true,
            data: {
                invoice,
                context: contextResult,
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ---------------------------------------------------------------------------
// GET /api/invoices — List All
// ---------------------------------------------------------------------------

router.get('/', async (req, res) => {
    try {
        const invoices = await InvoiceModel.getAllInvoices();
        res.json({ success: true, data: invoices });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ---------------------------------------------------------------------------
// GET /api/invoices/overdue — Overdue Invoices
// ---------------------------------------------------------------------------

router.get('/overdue', async (req, res) => {
    try {
        const overdue = await InvoiceModel.getOverdueInvoices();
        res.json({ success: true, data: overdue });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ---------------------------------------------------------------------------
// GET /api/invoices/:id — Get by ID
// ---------------------------------------------------------------------------

router.get('/:id', async (req, res) => {
    try {
        const invoice = await InvoiceModel.getInvoiceById(req.params.id);
        if (!invoice) {
            return res.status(404).json({ success: false, error: 'Invoice not found' });
        }
        res.json({ success: true, data: invoice });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ---------------------------------------------------------------------------
// PATCH /api/invoices/:id/status — Update Payment Status
// ---------------------------------------------------------------------------

router.patch('/:id/status', async (req, res) => {
    try {
        const { payment_status } = req.body;
        if (!payment_status) {
            return res.status(400).json({
                success: false,
                error: 'payment_status is required',
            });
        }
        const invoice = await InvoiceModel.updateInvoiceStatus(
            req.params.id, payment_status
        );
        if (!invoice) {
            return res.status(404).json({ success: false, error: 'Invoice not found' });
        }
        res.json({ success: true, data: invoice });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
