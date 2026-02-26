/**
 * Retrieval Engine — Intelligent context retrieval pipeline.
 *
 * Pipeline:
 *   1. New invoice arrives
 *   2. Fetch related supplier
 *   3. Fetch related issues
 *   4. Compute relevance scores
 *   5. Rank results
 *   6. Return top 5 with reasons
 */

const SupplierModel = require('../models/supplier.model');
const InvoiceModel = require('../models/invoice.model');
const IssueModel = require('../models/issue.model');
const relevance = require('./relevance.engine');
const lifecycle = require('./lifecycle.engine');

// ---------------------------------------------------------------------------
// Context Retrieval Pipeline
// ---------------------------------------------------------------------------

/**
 * Run the full retrieval pipeline for a supplier context.
 *
 * Given a supplier ID, gathers all related memories (issues, invoices),
 * scores them, ranks them, and returns the top N with explanations.
 *
 * @param {number} supplierId — The supplier to evaluate.
 * @param {object} options
 * @param {string[]} options.keywords  — Extra search keywords.
 * @param {number}   options.topK      — Number of results (default 5).
 * @param {number}   options.issueDays — Look-back window in days (default 120).
 * @returns {Promise<object>} Retrieval result with flag, reasons, and scored items.
 */
async function retrieveContext(supplierId, options = {}) {
    const { keywords = [], topK = 5, issueDays = 120 } = options;

    // Step 1: Fetch supplier
    const supplier = await SupplierModel.getSupplierById(supplierId);
    if (!supplier) {
        return { flag: false, reasons: ['Supplier not found'], items: [] };
    }

    // Step 2: Fetch related issues
    const issues = await IssueModel.getRecentIssues(supplierId, issueDays);

    // Step 3: Fetch related invoices
    const invoices = await InvoiceModel.getInvoicesBySupplier(supplierId);

    // Combine all records into a single memory pool
    const memoryPool = [
        ...issues.map(i => ({
            ...i,
            record_type: 'issue',
            industry: supplier.industry,
        })),
        ...invoices.map(inv => ({
            ...inv,
            record_type: 'invoice',
            industry: supplier.industry,
        })),
    ];

    if (memoryPool.length === 0) {
        return {
            flag: false,
            reasons: ['No related memories found for this supplier'],
            items: [],
            supplier: supplier,
        };
    }

    // Step 4: Score and rank
    const scored = relevance.scoreAndRank(
        memoryPool,
        supplierId,
        supplier.industry,
        keywords
    );

    // Step 5: Take top K
    const topItems = scored.slice(0, topK);

    // Step 6: Generate reasons and flag
    const reasons = generateReasons(topItems, issues, invoices, supplier);
    const flag = reasons.length > 0;

    return {
        flag,
        reasons,
        items: topItems.map(item => ({
            record_type: item.record_type,
            id: item.id,
            description: item.description || item.payment_status || '',
            severity: item.severity || null,
            status: item.status || item.payment_status || '',
            created_at: item.created_at,
            scores: item.scores,
        })),
        supplier: {
            id: supplier.id,
            name: supplier.name,
            industry: supplier.industry,
            rating: supplier.rating,
        },
        summary: {
            total_issues: issues.length,
            total_invoices: invoices.length,
            memories_scored: scored.length,
        },
    };
}

// ---------------------------------------------------------------------------
// Reason Generator
// ---------------------------------------------------------------------------

/**
 * Analyse the scored memories and produce human-readable reasons.
 *
 * @param {object[]} topItems
 * @param {object[]} issues
 * @param {object[]} invoices
 * @param {object}   supplier
 * @returns {string[]}
 */
function generateReasons(topItems, issues, invoices, supplier) {
    const reasons = [];

    // Issue frequency
    if (issues.length >= 3) {
        reasons.push(`${issues.length} issues in the look-back window`);
    }

    // High severity issues
    const highSeverity = issues.filter(i => i.severity >= 4);
    if (highSeverity.length > 0) {
        reasons.push(`${highSeverity.length} high-severity issue(s) detected`);
    }

    // Open issues
    const openIssues = issues.filter(i => i.status === 'open');
    if (openIssues.length > 0) {
        reasons.push(`${openIssues.length} unresolved issue(s) still open`);
    }

    // Overdue invoices
    const overdue = invoices.filter(inv =>
        inv.payment_status === 'pending' &&
        inv.due_date && new Date(inv.due_date) < new Date()
    );
    if (overdue.length > 0) {
        reasons.push(`${overdue.length} overdue invoice(s) found`);
    }

    // Low supplier rating
    if (supplier.rating && parseFloat(supplier.rating) < 0.3) {
        reasons.push(`Supplier reliability rating is low (${supplier.rating})`);
    }

    // Temporal concern — recent high-score items
    const recentHighScore = topItems.filter(
        item => item.scores.temporal > 0.9 && item.scores.finalScore > 0.7
    );
    if (recentHighScore.length >= 2) {
        reasons.push('Multiple high-relevance recent memories detected');
    }

    return reasons;
}

// ---------------------------------------------------------------------------
// Quick Lookup
// ---------------------------------------------------------------------------

/**
 * Quick check — is this supplier flagged?
 * Returns just the flag boolean and reasons.
 */
async function quickCheck(supplierId) {
    const result = await retrieveContext(supplierId);
    return {
        flag: result.flag,
        reasons: result.reasons,
    };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
    retrieveContext,
    generateReasons,
    quickCheck,
};
