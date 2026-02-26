/**
 * Issue Routes — REST API for issue management.
 *
 * Endpoints:
 *   POST   /api/issues          → Create issue
 *   GET    /api/issues          → List open issues
 *   GET    /api/issues/:id      → Get issue by ID
 *   PATCH  /api/issues/:id/resolve → Resolve an issue
 */

const express = require('express');
const router = express.Router();
const IssueModel = require('../models/issue.model');

router.post('/', async (req, res) => {
    try {
        const issue = await IssueModel.createIssue(req.body);
        res.status(201).json({ success: true, data: issue });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/', async (req, res) => {
    try {
        // Join with suppliers to get name for dashboard display
        const { query: dbQuery } = require('../db');
        const result = await dbQuery(`
            SELECT i.*, s.name as supplier_name
            FROM issues i
            LEFT JOIN suppliers s ON i.supplier_id = s.id
            WHERE i.status = 'open'
            ORDER BY i.severity DESC, i.created_at DESC
        `);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const issue = await IssueModel.getIssueById(req.params.id);
        if (!issue) return res.status(404).json({ success: false, error: 'Issue not found' });
        res.json({ success: true, data: issue });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.patch('/:id/resolve', async (req, res) => {
    try {
        const issue = await IssueModel.resolveIssue(req.params.id, req.body.resolution);
        if (!issue) return res.status(404).json({ success: false, error: 'Issue not found' });
        res.json({ success: true, data: issue });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
