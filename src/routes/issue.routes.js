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
        const issues = await IssueModel.getOpenIssues();
        res.json({ success: true, data: issues });
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
