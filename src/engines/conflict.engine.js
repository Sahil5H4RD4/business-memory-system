/**
 * Conflict Resolution Engine — Trend detection and weighted prioritization.
 *
 * Handles conflicting signals in memory data:
 *   - If severity is increasing → risk trend → boost scores
 *   - If severity is decreasing → improvement trend → dampen negative scores
 *   - Weighted average of recent vs older data for balanced view
 */

const IssueModel = require('../models/issue.model');

// ---------------------------------------------------------------------------
// Trend Detection
// ---------------------------------------------------------------------------

/**
 * Analyse the severity trend for a supplier based on issue history.
 *
 * Compares the average severity of the 3 most recent issues
 * against older issues to determine direction.
 *
 * @param {number} supplierId
 * @returns {Promise<object>}
 *   { trend: 'worsening'|'improving'|'stable',
 *     recentAvg, olderAvg, delta, totalIssues }
 */
async function detectTrend(supplierId) {
    const trendData = await IssueModel.getIssueTrend(supplierId);
    return {
        trend: trendData.trend,
        recentAvg: trendData.recent_avg,
        olderAvg: trendData.older_avg,
        delta: Math.round((trendData.recent_avg - trendData.older_avg) * 100) / 100,
        totalIssues: trendData.total_issues,
    };
}

// ---------------------------------------------------------------------------
// Score Adjustment
// ---------------------------------------------------------------------------

/**
 * Adjust relevance scores based on detected trends.
 *
 * Rules:
 *   worsening trend → multiply final scores by 1.3 (boost risk signal)
 *   improving trend → multiply final scores by 0.7 (dampen old negatives)
 *   stable          → no adjustment
 *
 * @param {object[]} scoredItems — Items with a `scores.finalScore` property.
 * @param {object}   trendInfo   — Output from detectTrend().
 * @returns {object[]} Adjusted items with `conflictAdjustment` metadata.
 */
function adjustScoresForTrend(scoredItems, trendInfo) {
    const { trend } = trendInfo;

    let multiplier = 1.0;
    let label = 'none';

    if (trend === 'worsening') {
        multiplier = 1.3;
        label = 'risk_boosted';
    } else if (trend === 'improving') {
        multiplier = 0.7;
        label = 'improvement_dampened';
    }

    return scoredItems.map(item => {
        const adjusted = Math.round(item.scores.finalScore * multiplier * 10000) / 10000;
        return {
            ...item,
            scores: {
                ...item.scores,
                finalScore: adjusted,
                originalScore: item.scores.finalScore,
                conflictMultiplier: multiplier,
            },
            conflictAdjustment: label,
        };
    });
}

// ---------------------------------------------------------------------------
// Weighted Average Logic
// ---------------------------------------------------------------------------

/**
 * Compute a weighted average severity considering recency.
 *
 * More recent issues get higher weight (linear decay).
 *
 * @param {object[]} issues — Sorted newest-first, each has `severity` & `created_at`.
 * @returns {number} Weighted average severity.
 */
function weightedAverageSeverity(issues) {
    if (!issues.length) return 0;

    let totalWeight = 0;
    let weightedSum = 0;

    issues.forEach((issue, index) => {
        // Linear weight: most recent = N, oldest = 1
        const weight = issues.length - index;
        weightedSum += issue.severity * weight;
        totalWeight += weight;
    });

    return Math.round((weightedSum / totalWeight) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Full Conflict Resolution Pipeline
// ---------------------------------------------------------------------------

/**
 * Run the complete conflict resolution process.
 *
 * 1. Detect trends from issue history
 * 2. Compute weighted severity
 * 3. Adjust relevance scores based on trend
 * 4. Add metadata about adjustments
 *
 * @param {number}   supplierId
 * @param {object[]} scoredItems — Pre-scored items from relevance engine.
 * @returns {Promise<object>} { adjustedItems, trendInfo, weightedSeverity }
 */
async function resolveConflicts(supplierId, scoredItems) {
    // Step 1: Trend detection
    const trendInfo = await detectTrend(supplierId);

    // Step 2: Get all issues for weighted severity
    const issues = await IssueModel.getRecentIssues(supplierId, 365);
    const weightedSev = weightedAverageSeverity(issues);

    // Step 3: Adjust scores
    const adjustedItems = adjustScoresForTrend(scoredItems, trendInfo);

    // Step 4: Re-sort after adjustment
    adjustedItems.sort((a, b) => b.scores.finalScore - a.scores.finalScore);

    return {
        adjustedItems,
        trendInfo: {
            ...trendInfo,
            weightedSeverity: weightedSev,
        },
    };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
    detectTrend,
    adjustScoresForTrend,
    weightedAverageSeverity,
    resolveConflicts,
};
