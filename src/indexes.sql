-- ============================================================================
-- Database Indexes for Performance Optimization
-- ============================================================================
-- Run: psql -d context_memory -f src/indexes.sql
-- ============================================================================

-- Supplier lookups by industry
CREATE INDEX IF NOT EXISTS idx_suppliers_industry
    ON suppliers (industry);

-- Invoice lookups by supplier
CREATE INDEX IF NOT EXISTS idx_invoices_supplier_id
    ON invoices (supplier_id);

-- Invoice date-based queries (overdue detection)
CREATE INDEX IF NOT EXISTS idx_invoices_due_date
    ON invoices (due_date);

-- Invoice filtering by payment status
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status
    ON invoices (payment_status);

-- Invoice temporal queries
CREATE INDEX IF NOT EXISTS idx_invoices_created_at
    ON invoices (created_at);

-- Issue lookups by supplier
CREATE INDEX IF NOT EXISTS idx_issues_supplier_id
    ON issues (supplier_id);

-- Issue temporal queries
CREATE INDEX IF NOT EXISTS idx_issues_created_at
    ON issues (created_at);

-- Issue filtering by severity (for high-severity lookups)
CREATE INDEX IF NOT EXISTS idx_issues_severity
    ON issues (severity);

-- Issue filtering by status
CREATE INDEX IF NOT EXISTS idx_issues_status
    ON issues (status);

-- Composite index for recent issues by supplier (most common query)
CREATE INDEX IF NOT EXISTS idx_issues_supplier_created
    ON issues (supplier_id, created_at DESC);
