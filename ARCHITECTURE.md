# Architecture — Business Context Memory Engine

This document provides the technical architecture details, data flow diagrams, scoring mathematics, and design rationale for the Business Context Memory Engine.

## System Architecture Diagram

```mermaid
graph TD
    subgraph API_Layer["API Layer (Express)"]
        SR["/api/suppliers"] --> SM["Supplier Routes"]
        IR["/api/invoices"] --> IM["Invoice Routes"]
    end

    subgraph Models["Data Models"]
        SM --> S["supplier.model"]
        IM --> I["invoice.model"]
        ISS["issue.model"]
    end

    subgraph Engines["Engine Layer"]
        LE["Lifecycle Engine<br/>Time Decay"]
        RE["Relevance Engine<br/>Weighted Scoring"]
        RTE["Retrieval Engine<br/>Context Pipeline"]
        CE["Conflict Engine<br/>Trend Detection"]
        EE["Explainability Engine<br/>Decision Reasoning"]
    end

    subgraph DB["PostgreSQL"]
        T1["suppliers"]
        T2["invoices"]
        T3["issues"]
    end

    S --> T1
    I --> T2
    ISS --> T3

    IM -->|"Submit Invoice"| RTE
    SM -->|"Context Query"| RTE

    RTE --> S
    RTE --> I
    RTE --> ISS
    RTE --> RE
    RE --> LE
    RTE --> CE
    RTE --> EE
```

## Data Flow

```mermaid
sequenceDiagram
    participant Client
    participant API as Express API
    participant RT as Retrieval Engine
    participant RL as Relevance Engine
    participant LC as Lifecycle Engine
    participant CF as Conflict Engine
    participant EX as Explainability Engine
    participant DB as PostgreSQL

    Client->>API: POST /api/invoices
    API->>DB: Insert invoice
    API->>RT: retrieveContext(supplierId)
    RT->>DB: Fetch supplier
    RT->>DB: Fetch recent issues
    RT->>DB: Fetch invoices
    RT->>RL: scoreAndRank(memories)
    RL->>LC: calculateTemporalScore()
    RL-->>RT: Scored items
    RT->>CF: resolveConflicts(items)
    CF->>DB: getIssueTrend()
    CF-->>RT: Adjusted items
    RT->>EX: generateExplanation()
    EX-->>RT: Explanation
    RT-->>API: Context result
    API-->>Client: JSON response
```

## Memory Hierarchy

```
┌─────────────────────────────────────────────┐
│              Active Memory Pool              │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Suppliers │  │ Invoices │  │  Issues  │  │
│  │  (rated)  │  │ (tracked)│  │(severity)│  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│       │              │              │        │
│       └──────── FK ──┴──── FK ──────┘        │
│                                              │
├──────────────────────────────────────────────┤
│           Temporal Decay Layer               │
│  Score = e^(-0.01 × daysOld) × ageWeight    │
│  <6mo: 1.0 | 6-24mo: 0.5 | >24mo: 0.0     │
├──────────────────────────────────────────────┤
│           Relevance Scoring                  │
│  Final = 0.4T + 0.3R + 0.3S                │
├──────────────────────────────────────────────┤
│           Conflict Resolution                │
│  Worsening: ×1.3 | Improving: ×0.7         │
├──────────────────────────────────────────────┤
│           Archive (>2 years)                 │
└──────────────────────────────────────────────┘
```

## Retrieval Pipeline Detail

The retrieval engine follows a 5-step pipeline:

### Step 1: Candidate Gathering
```sql
-- Fetch supplier issues (look-back window)
SELECT * FROM issues
WHERE supplier_id = $1
  AND created_at >= CURRENT_TIMESTAMP - INTERVAL '120 days'
ORDER BY created_at DESC;

-- Fetch supplier invoices
SELECT * FROM invoices
WHERE supplier_id = $1
ORDER BY created_at DESC;
```

### Step 2: Scoring

For each memory M:
```
temporal   = e^(-0.01 × age_in_days)
relational = 1.0 if same supplier, 0.6 if same industry, 0.2 otherwise
semantic   = keyword_hits / total_keywords
finalScore = 0.4 × temporal + 0.3 × relational + 0.3 × semantic
```

### Step 3: Conflict Resolution

```
recentAvgSeverity = avg(last 3 issues severity)
olderAvgSeverity  = avg(older issues severity)

if recentAvg > olderAvg + 0.3 → "worsening" → multiply scores × 1.3
if recentAvg < olderAvg - 0.3 → "improving" → multiply scores × 0.7
else                          → "stable"    → no adjustment
```

### Step 4: Ranking

Sort all scored memories by `finalScore` descending. Return top 5.

### Step 5: Explanation

Generate structured JSON with:
- Flag decision (FLAGGED / CLEAR)
- Human-readable narrative
- Per-item scoring breakdown
- Trend analysis summary

## Database Schema

```mermaid
erDiagram
    SUPPLIERS ||--o{ INVOICES : "has"
    SUPPLIERS ||--o{ ISSUES : "has"

    SUPPLIERS {
        int id PK
        varchar name
        varchar industry
        numeric rating
        varchar contact
        timestamp created_at
        timestamp updated_at
    }

    INVOICES {
        int id PK
        int supplier_id FK
        numeric amount
        date invoice_date
        date due_date
        varchar payment_status
        text description
        timestamp created_at
    }

    ISSUES {
        int id PK
        int supplier_id FK
        text description
        int severity
        varchar status
        text resolution
        timestamp created_at
        timestamp resolved_at
    }
```

## Performance Indexes

| Index | Table | Column(s) | Purpose |
|-------|-------|-----------|---------|
| `idx_suppliers_industry` | suppliers | industry | Industry filtering |
| `idx_invoices_supplier_id` | invoices | supplier_id | Supplier lookups |
| `idx_invoices_due_date` | invoices | due_date | Overdue detection |
| `idx_invoices_payment_status` | invoices | payment_status | Status filtering |
| `idx_invoices_created_at` | invoices | created_at | Temporal queries |
| `idx_issues_supplier_id` | issues | supplier_id | Supplier lookups |
| `idx_issues_created_at` | issues | created_at | Temporal queries |
| `idx_issues_severity` | issues | severity | Severity filtering |
| `idx_issues_status` | issues | status | Status filtering |
| `idx_issues_supplier_created` | issues | (supplier_id, created_at) | Composite — most used query |

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| PostgreSQL over NoSQL | Relational data with strong FK constraints needed for entity linking |
| Express.js | Lightweight, industry-standard REST framework |
| No ORM (raw SQL) | Full control over queries, easier to optimize and index |
| Exponential decay | Natural decay curve — recent data stays relevant longest |
| Three-score composite | Balances recency, relationships, and content relevance |
| Keyword matching over LLM | Lightweight, deterministic, no API costs |
