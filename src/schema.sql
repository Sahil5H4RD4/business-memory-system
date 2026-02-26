-- ============================================================================
-- Business Context Memory Engine — PostgreSQL Schema
-- ============================================================================
-- Tables: suppliers, invoices, issues
-- Run: psql -d context_memory -f src/schema.sql
-- ============================================================================

-- Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    industry    VARCHAR(255),
    rating      NUMERIC(3,2) DEFAULT 0.50,
    contact     VARCHAR(255),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
    id              SERIAL PRIMARY KEY,
    supplier_id     INT REFERENCES suppliers(id) ON DELETE CASCADE,
    amount          NUMERIC(12,2) NOT NULL,
    invoice_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date        DATE,
    payment_status  VARCHAR(50) DEFAULT 'pending',
    description     TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Issues Table
CREATE TABLE IF NOT EXISTS issues (
    id              SERIAL PRIMARY KEY,
    supplier_id     INT REFERENCES suppliers(id) ON DELETE CASCADE,
    description     TEXT NOT NULL,
    severity        INT CHECK (severity BETWEEN 1 AND 5) DEFAULT 3,
    status          VARCHAR(50) DEFAULT 'open',
    resolution      TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at     TIMESTAMP
);
