/**
 * Lifecycle Engine — Time decay and memory age management.
 *
 * Core formula:
 *   temporalScore = e^(-λ × daysOld)      where λ = 0.01
 *
 * Age-based rules:
 *   < 6 months   → weight 1.0  (high priority)
 *   6–24 months  → weight 0.5  (down-weighted)
 *   > 24 months  → weight 0.0  (auto-archive)
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LAMBDA = 0.01;       // Decay rate
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const HIGH_DAYS = 180;        // 6 months
const ARCHIVE_DAYS = 730;        // 2 years

// ---------------------------------------------------------------------------
// Temporal Score
// ---------------------------------------------------------------------------

/**
 * Calculate the temporal (time-decay) score for a record.
 *
 * @param {Date|string} createdAt — The creation timestamp.
 * @returns {number} Score in the range (0, 1].
 */
function calculateTemporalScore(createdAt) {
    const created = new Date(createdAt);
    const daysOld = (Date.now() - created.getTime()) / MS_PER_DAY;
    return Math.exp(-LAMBDA * Math.max(daysOld, 0));
}

// ---------------------------------------------------------------------------
// Age Weight
// ---------------------------------------------------------------------------

/**
 * Return an age-bracket multiplier.
 *
 *   < 6 months  → 1.0
 *   6–24 months → 0.5
 *   > 24 months → 0.0 (should be archived)
 *
 * @param {Date|string} createdAt
 * @returns {number}
 */
function getAgeWeight(createdAt) {
    const created = new Date(createdAt);
    const daysOld = (Date.now() - created.getTime()) / MS_PER_DAY;

    if (daysOld < HIGH_DAYS) return 1.0;
    if (daysOld < ARCHIVE_DAYS) return 0.5;
    return 0.0;   // too old
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/**
 * Classify a timestamp into an age bracket.
 *
 * @param {Date|string} createdAt
 * @returns {'recent' | 'aging' | 'stale'}
 */
function classifyAge(createdAt) {
    const weight = getAgeWeight(createdAt);
    if (weight >= 1.0) return 'recent';
    if (weight >= 0.5) return 'aging';
    return 'stale';
}

// ---------------------------------------------------------------------------
// Combined Lifecycle Score
// ---------------------------------------------------------------------------

/**
 * Compute a combined lifecycle score.
 *
 *   lifecycleScore = temporalScore × ageWeight
 *
 * @param {Date|string} createdAt
 * @returns {number}
 */
function lifecycleScore(createdAt) {
    return calculateTemporalScore(createdAt) * getAgeWeight(createdAt);
}

// ---------------------------------------------------------------------------
// Batch Archival Check
// ---------------------------------------------------------------------------

/**
 * Given an array of records, return those that should be archived
 * (age weight = 0 or lifecycle score < threshold).
 *
 * @param {Array}  records   — Each must have a `created_at` field.
 * @param {number} threshold — Score below which to archive (default 0.05).
 * @returns {Array} Records that should be archived.
 */
function findStaleRecords(records, threshold = 0.05) {
    return records.filter(rec => {
        const score = lifecycleScore(rec.created_at);
        return score < threshold || getAgeWeight(rec.created_at) === 0.0;
    });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
    LAMBDA,
    calculateTemporalScore,
    getAgeWeight,
    classifyAge,
    lifecycleScore,
    findStaleRecords,
};
