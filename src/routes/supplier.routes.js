/**
 * Supplier Routes — REST API for supplier management.
 *
 * Endpoints:
 *   POST   /api/suppliers          → Create supplier
 *   GET    /api/suppliers          → List all suppliers
 *   GET    /api/suppliers/:id      → Get supplier by ID
 *   GET    /api/suppliers/:id/summary → Get supplier with stats
 *   PUT    /api/suppliers/:id      → Update supplier
 *   DELETE /api/suppliers/:id      → Delete supplier
 *   GET    /api/suppliers/:id/context → Run context retrieval
 */

const express = require('express');
const router = express.Router();

const SupplierModel = require('../models/supplier.model');
const retrieval = require('../engines/retrieval.engine');
const conflict = require('../engines/conflict.engine');

// ---------------------------------------------------------------------------
// POST /api/suppliers — Create
// ---------------------------------------------------------------------------

router.post('/', async (req, res) => {
    try {
        const supplier = await SupplierModel.createSupplier(req.body);
        res.status(201).json({ success: true, data: supplier });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ---------------------------------------------------------------------------
// GET /api/suppliers — List All
// ---------------------------------------------------------------------------

router.get('/', async (req, res) => {
    try {
        const suppliers = await SupplierModel.getAllSuppliers();
        res.json({ success: true, data: suppliers });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ---------------------------------------------------------------------------
// GET /api/suppliers/:id — Get by ID
// ---------------------------------------------------------------------------

router.get('/:id', async (req, res) => {
    try {
        const supplier = await SupplierModel.getSupplierById(req.params.id);
        if (!supplier) {
            return res.status(404).json({ success: false, error: 'Supplier not found' });
        }
        res.json({ success: true, data: supplier });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ---------------------------------------------------------------------------
// GET /api/suppliers/:id/summary — Get with Stats
// ---------------------------------------------------------------------------

router.get('/:id/summary', async (req, res) => {
    try {
        const summary = await SupplierModel.getSupplierSummary(req.params.id);
        if (!summary) {
            return res.status(404).json({ success: false, error: 'Supplier not found' });
        }
        res.json({ success: true, data: summary });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ---------------------------------------------------------------------------
// PUT /api/suppliers/:id — Update
// ---------------------------------------------------------------------------

router.put('/:id', async (req, res) => {
    try {
        const supplier = await SupplierModel.updateSupplier(req.params.id, req.body);
        if (!supplier) {
            return res.status(404).json({ success: false, error: 'Supplier not found' });
        }
        res.json({ success: true, data: supplier });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ---------------------------------------------------------------------------
// DELETE /api/suppliers/:id — Delete
// ---------------------------------------------------------------------------

router.delete('/:id', async (req, res) => {
    try {
        const deleted = await SupplierModel.deleteSupplier(req.params.id);
        if (!deleted) {
            return res.status(404).json({ success: false, error: 'Supplier not found' });
        }
        res.json({ success: true, message: 'Supplier deleted' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ---------------------------------------------------------------------------
// GET /api/suppliers/:id/context — Context Retrieval
// ---------------------------------------------------------------------------

router.get('/:id/context', async (req, res) => {
    try {
        const keywords = req.query.keywords
            ? req.query.keywords.split(',')
            : [];

        // Run retrieval pipeline
        const result = await retrieval.retrieveContext(
            parseInt(req.params.id),
            { keywords }
        );

        // Run conflict resolution
        if (result.items.length > 0) {
            const conflictResult = await conflict.resolveConflicts(
                parseInt(req.params.id),
                result.items
            );
            result.items = conflictResult.adjustedItems;
            result.trendInfo = conflictResult.trendInfo;
        }

        res.json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
