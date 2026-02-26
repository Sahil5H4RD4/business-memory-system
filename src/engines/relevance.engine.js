/**
 * Relevance Engine — Weighted scoring for memory importance.
 *
 * Final Score = 0.4 × temporal + 0.3 × relational + 0.3 × semantic
 *
 * Components:
 *   Temporal   — From lifecycle engine decay function.
 *   Relational — Same supplier → 1.0 | Same industry → 0.6 | Different → 0.2
 *   Semantic   — Simple keyword match in issue description.
 */

const lifecycle = require('./lifecycle.engine');

// ---------------------------------------------------------------------------
// Weights
// ---------------------------------------------------------------------------

const W_TEMPORAL = 0.4;
const W_RELATIONAL = 0.3;
const W_SEMANTIC = 0.3;

// ---------------------------------------------------------------------------
// Temporal Score
// ---------------------------------------------------------------------------

/**
 * Wrapper around lifecycle temporal score.
 *
 * @param {Date|string} createdAt
 * @returns {number} (0, 1]
 */
function temporalScore(createdAt) {
    return lifecycle.calculateTemporalScore(createdAt);
}

// ---------------------------------------------------------------------------
// Relational Score
// ---------------------------------------------------------------------------

/**
 * Score based on relational proximity.
 *
 *   Same supplier → 1.0
 *   Same industry → 0.6
 *   Different     → 0.2
 *
 * @param {object} record        — The memory record (issue/invoice).
 * @param {number} contextSuppId — The supplier ID being queried.
 * @param {string} contextIndustry — The industry of the context supplier.
 * @returns {number}
 */
function relationalScore(record, contextSuppId, contextIndustry) {
    // Direct supplier match
    if (record.supplier_id === contextSuppId) {
        return 1.0;
    }

    // Industry match (if supplier has an industry field)
    if (contextIndustry && record.industry &&
        record.industry.toLowerCase() === contextIndustry.toLowerCase()) {
        return 0.6;
    }

    return 0.2;
}

// ---------------------------------------------------------------------------
// Semantic Score
// ---------------------------------------------------------------------------

/**
 * Simple keyword-based semantic similarity.
 * Counts how many query keywords appear in the record's text fields.
 *
 * @param {object}   record   — Must have a `description` or text field.
 * @param {string[]} keywords — Search keywords to match against.
 * @returns {number} Normalised score (0–1).
 */
function semanticScore(record, keywords = []) {
    if (!keywords.length) return 0;

    // Build searchable text from the record
    const text = [
        record.description || '',
        record.status || '',
        record.resolution || '',
        record.payment_status || '',
    ].join(' ').toLowerCase();

    if (!text.trim()) return 0;

    let hits = 0;
    for (const kw of keywords) {
        if (text.includes(kw.toLowerCase())) {
            hits++;
        }
    }

    return Math.min(hits / keywords.length, 1.0);
}

// ---------------------------------------------------------------------------
// Final Score
// ---------------------------------------------------------------------------

/**
 * Compute the composite relevance score.
 *
 * @param {object}   record          — The memory record.
 * @param {number}   contextSuppId   — Supplier in context.
 * @param {string}   contextIndustry — Industry in context.
 * @param {string[]} keywords        — Semantic keywords.
 * @returns {{ temporal: number, relational: number, semantic: number, finalScore: number }}
 */
function calculateFinalScore(record, contextSuppId, contextIndustry, keywords = []) {
    const t = temporalScore(record.created_at);
    const r = relationalScore(record, contextSuppId, contextIndustry);
    const s = semanticScore(record, keywords);

    const finalScore = W_TEMPORAL * t + W_RELATIONAL * r + W_SEMANTIC * s;

    return {
        temporal: Math.round(t * 10000) / 10000,
        relational: Math.round(r * 10000) / 10000,
        semantic: Math.round(s * 10000) / 10000,
        finalScore: Math.round(finalScore * 10000) / 10000,
    };
}

// ---------------------------------------------------------------------------
// Batch Scoring
// ---------------------------------------------------------------------------

/**
 * Score an array of records and sort by finalScore (descending).
 *
 * @param {object[]} records
 * @param {number}   contextSuppId
 * @param {string}   contextIndustry
 * @param {string[]} keywords
 * @returns {object[]} Records augmented with a `scores` property, sorted.
 */
function scoreAndRank(records, contextSuppId, contextIndustry, keywords = []) {
    const scored = records.map(rec => ({
        ...rec,
        scores: calculateFinalScore(rec, contextSuppId, contextIndustry, keywords),
    }));

    scored.sort((a, b) => b.scores.finalScore - a.scores.finalScore);
    return scored;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
    W_TEMPORAL,
    W_RELATIONAL,
    W_SEMANTIC,
    temporalScore,
    relationalScore,
    semanticScore,
    calculateFinalScore,
    scoreAndRank,
};
