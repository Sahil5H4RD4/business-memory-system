/**
 * Explainability Engine — Decision reasoning and scoring breakdown.
 *
 * Generates human-readable explanations for why the retrieval engine
 * flagged a supplier or surfaced specific memories. Provides full
 * scoring breakdowns for transparency and auditability.
 */

// ---------------------------------------------------------------------------
// Explanation Generator
// ---------------------------------------------------------------------------

/**
 * Generate a detailed explanation for a set of scored/adjusted items.
 *
 * @param {object}   params
 * @param {object}   params.supplier   — Supplier info { id, name, industry, rating }
 * @param {object[]} params.items      — Scored items from retrieval pipeline.
 * @param {string[]} params.reasons    — Flagging reasons from retrieval engine.
 * @param {object}   params.trendInfo  — Trend data from conflict engine.
 * @param {object}   params.summary    — Stats summary.
 * @returns {object} Full explanation object.
 */
function generateExplanation({ supplier, items, reasons, trendInfo, summary }) {
    const explanation = {
        timestamp: new Date().toISOString(),
        supplier: supplier || {},
        decision: reasons.length > 0 ? 'FLAGGED' : 'CLEAR',

        // Human-readable summary
        narrative: buildNarrative(supplier, reasons, trendInfo),

        // Structured reasons
        reasons,

        // Trend analysis
        trend: trendInfo ? {
            direction: trendInfo.trend,
            recentSeverityAvg: trendInfo.recentAvg,
            olderSeverityAvg: trendInfo.olderAvg,
            delta: trendInfo.delta,
            weightedSeverity: trendInfo.weightedSeverity,
        } : null,

        // Per-item score breakdown
        scoringBreakdown: items.map((item, idx) => ({
            rank: idx + 1,
            recordType: item.record_type,
            id: item.id,
            description: item.description || '',
            temporal: item.scores?.temporal,
            relational: item.scores?.relational,
            semantic: item.scores?.semantic,
            finalScore: item.scores?.finalScore,
            originalScore: item.scores?.originalScore || item.scores?.finalScore,
            conflictMultiplier: item.scores?.conflictMultiplier || 1.0,
            conflictAdjustment: item.conflictAdjustment || 'none',
        })),

        // Aggregate stats
        statistics: summary || {},
    };

    return explanation;
}

// ---------------------------------------------------------------------------
// Narrative Builder
// ---------------------------------------------------------------------------

/**
 * Build a human-readable narrative paragraph.
 *
 * @param {object}   supplier
 * @param {string[]} reasons
 * @param {object}   trendInfo
 * @returns {string}
 */
function buildNarrative(supplier, reasons, trendInfo) {
    const name = supplier?.name || 'Unknown Supplier';
    const parts = [];

    if (reasons.length === 0) {
        return `${name} has no significant risk factors. All indicators are within normal parameters.`;
    }

    parts.push(`⚠️  ${name} has been flagged with ${reasons.length} concern(s):`);
    reasons.forEach(r => parts.push(`  • ${r}`));

    if (trendInfo) {
        if (trendInfo.trend === 'worsening') {
            parts.push(`\n📈 Severity trend is WORSENING (recent avg: ${trendInfo.recentAvg}, older avg: ${trendInfo.olderAvg}). Scores have been boosted to reflect increased risk.`);
        } else if (trendInfo.trend === 'improving') {
            parts.push(`\n📉 Severity trend is IMPROVING (recent avg: ${trendInfo.recentAvg}, older avg: ${trendInfo.olderAvg}). Older negative signals have been dampened.`);
        } else {
            parts.push(`\n📊 Severity trend is STABLE.`);
        }
    }

    return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Console Output
// ---------------------------------------------------------------------------

/**
 * Print an explanation to the console in a formatted way.
 *
 * @param {object} explanation — Output from generateExplanation().
 */
function printExplanation(explanation) {
    console.log('\n' + '='.repeat(60));
    console.log('  DECISION EXPLANATION');
    console.log('='.repeat(60));
    console.log(`  Supplier: ${explanation.supplier.name || 'N/A'}`);
    console.log(`  Decision: ${explanation.decision}`);
    console.log(`  Time:     ${explanation.timestamp}`);
    console.log('-'.repeat(60));
    console.log(explanation.narrative);
    console.log('-'.repeat(60));

    if (explanation.scoringBreakdown.length > 0) {
        console.log('\n  Scoring Breakdown:');
        explanation.scoringBreakdown.forEach(item => {
            console.log(`\n    #${item.rank} [${item.recordType?.toUpperCase()}] ID: ${item.id}`);
            console.log(`       ${item.description.substring(0, 60)}`);
            console.log(`       Temporal: ${item.temporal} | Relational: ${item.relational} | Semantic: ${item.semantic}`);
            console.log(`       Final: ${item.finalScore} (conflict: ${item.conflictAdjustment})`);
        });
    }

    console.log('\n' + '='.repeat(60) + '\n');
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
    generateExplanation,
    buildNarrative,
    printExplanation,
};
