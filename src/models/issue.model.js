/**
 * Issue Model — Data access layer for the issues table.
 *
 * Functions:
 *   createIssue(data)             → Insert a new issue
 *   getIssueById(id)              → Fetch a single issue
 *   getRecentIssues(suppId, days) → Fetch recent issues for a supplier
 *   getOpenIssues()               → All open issues
 *   resolveIssue(id, resolution)  → Mark issue as resolved
 *   getIssueTrend(suppId)         → Severity trend analysis
 */

const { query } = require('../db');

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

async function createIssue({ supplier_id, description, severity, status }) {
    const result = await query(
        `INSERT INTO issues (supplier_id, description, severity, status)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [
            supplier_id,
            description,
            severity || 3,
            status || 'open',
        ]
    );
    return result.rows[0];
}

// ---------------------------------------------------------------------------
// READ
// ---------------------------------------------------------------------------

async function getIssueById(id) {
    const result = await query(
        'SELECT * FROM issues WHERE id = $1',
        [id]
    );
    return result.rows[0] || null;
}

/**
 * Fetch issues for a supplier within the last N days.
 * Default: 120 days (≈ 4 months).
 */
async function getRecentIssues(supplierId, days = 120) {
    const result = await query(
        `SELECT * FROM issues
         WHERE supplier_id = $1
           AND created_at >= CURRENT_TIMESTAMP - INTERVAL '1 day' * $2
         ORDER BY created_at DESC`,
        [supplierId, days]
    );
    return result.rows;
}

async function getOpenIssues() {
    const result = await query(
        `SELECT i.*, s.name AS supplier_name
         FROM issues i
         JOIN suppliers s ON s.id = i.supplier_id
         WHERE i.status = 'open'
         ORDER BY i.severity DESC, i.created_at DESC`
    );
    return result.rows;
}

/**
 * Analyse the severity trend for a supplier's issues.
 *
 * Returns:
 *   { trend: 'improving' | 'worsening' | 'stable',
 *     recent_avg: number,
 *     older_avg: number,
 *     total_issues: number }
 */
async function getIssueTrend(supplierId) {
    // Recent half
    const recent = await query(
        `SELECT COALESCE(AVG(severity), 0) AS avg_sev, COUNT(*)::int AS cnt
         FROM (
             SELECT severity FROM issues
             WHERE supplier_id = $1
             ORDER BY created_at DESC
             LIMIT 3
         ) r`,
        [supplierId]
    );

    // Older half
    const older = await query(
        `SELECT COALESCE(AVG(severity), 0) AS avg_sev, COUNT(*)::int AS cnt
         FROM (
             SELECT severity FROM issues
             WHERE supplier_id = $1
             ORDER BY created_at DESC
             OFFSET 3
         ) o`,
        [supplierId]
    );

    const recentAvg = parseFloat(recent.rows[0].avg_sev);
    const olderAvg = parseFloat(older.rows[0].avg_sev);
    const total = recent.rows[0].cnt + older.rows[0].cnt;

    let trend = 'stable';
    if (total >= 3) {
        if (recentAvg < olderAvg - 0.3) trend = 'improving';
        else if (recentAvg > olderAvg + 0.3) trend = 'worsening';
    }

    return {
        trend,
        recent_avg: recentAvg,
        older_avg: olderAvg,
        total_issues: total,
    };
}

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------

async function resolveIssue(id, resolution) {
    const result = await query(
        `UPDATE issues
         SET status = 'resolved',
             resolution = $2,
             resolved_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [id, resolution || 'Resolved']
    );
    return result.rows[0] || null;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
    createIssue,
    getIssueById,
    getRecentIssues,
    getOpenIssues,
    getIssueTrend,
    resolveIssue,
};
