# Business Context Memory Engine

> An intelligent memory management system for business AI agents — built with Node.js, Express, and PostgreSQL. Scores, ranks, and retrieves the most relevant business context using temporal decay, relational proximity, and semantic similarity.

## 🧠 Problem Statement

AI systems in business environments process a constant stream of events — invoices, supplier issues, customer interactions. Without structured memory management, critical context gets lost and decision quality degrades over time.

This engine solves that by providing:
- **Structured memory storage** with relational linking
- **Intelligent retrieval** that surfaces the most relevant context
- **Time decay** that naturally deprioritizes stale information
- **Conflict resolution** that handles contradictory signals
- **Explainable decisions** with full scoring breakdowns

## 🏗 Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     API Layer (Express)                   │
│  POST/GET /api/suppliers    POST/GET /api/invoices        │
└─────────────┬────────────────────────┬───────────────────┘
              │                        │
              ▼                        ▼
┌──────────────────────┐  ┌─────────────────────────────┐
│    Models Layer      │  │      Engine Layer            │
│  ┌────────────────┐  │  │  ┌───────────────────────┐  │
│  │ supplier.model │  │  │  │ lifecycle.engine      │  │
│  │ invoice.model  │  │  │  │ relevance.engine      │  │
│  │ issue.model    │  │  │  │ retrieval.engine      │  │
│  └────────────────┘  │  │  │ conflict.engine       │  │
│                      │  │  │ explainability.engine  │  │
│                      │  │  └───────────────────────┘  │
└──────────┬───────────┘  └──────────────┬──────────────┘
           │                             │
           ▼                             ▼
┌──────────────────────────────────────────────────────────┐
│              PostgreSQL (context_memory)                  │
│  ┌────────────┐  ┌───────────┐  ┌──────────┐            │
│  │ suppliers  │  │ invoices  │  │ issues   │            │
│  └────────────┘  └───────────┘  └──────────┘            │
│  + 10 performance indexes                                │
└──────────────────────────────────────────────────────────┘
```

## 📊 Memory Types

| Type | Description | Key Fields |
|------|-------------|------------|
| **Supplier** | Vendor profiles | name, industry, rating, contact |
| **Invoice** | Payment records | amount, due_date, payment_status |
| **Issue** | Quality/delivery problems | severity (1-5), status, resolution |

## 🔬 Retrieval Logic

When a new invoice arrives, the system runs a **5-step pipeline**:

1. **Fetch** — Get the supplier profile
2. **Gather** — Collect all related issues and invoices
3. **Score** — Apply the relevance formula to each memory
4. **Rank** — Sort by composite score, take top 5
5. **Explain** — Generate human-readable reasoning

### Scoring Formula

```
Final Score = 0.4 × Temporal + 0.3 × Relational + 0.3 × Semantic
```

| Component | Method | Range |
|-----------|--------|-------|
| **Temporal** | `e^(-0.01 × daysOld)` | (0, 1] |
| **Relational** | Same supplier=1.0, Same industry=0.6, Different=0.2 | [0.2, 1.0] |
| **Semantic** | Keyword match ratio | [0, 1] |

## ⏳ Lifecycle Rules

| Age | Weight | Action |
|-----|--------|--------|
| < 6 months | 1.0 | High priority |
| 6–24 months | 0.5 | Down-weighted |
| > 2 years | 0.0 | Auto-archive |

## ⚔️ Conflict Resolution

When contradictory signals exist (old negative + new positive):

- **Worsening trend** → Boost scores by **1.3×** (emphasize risk)
- **Improving trend** → Dampen scores by **0.7×** (reduce old negatives)
- **Stable** → No adjustment

Trends are detected by comparing average severity of the 3 most recent issues against older ones.

## 📈 Scaling Strategy

- **10 PostgreSQL indexes** on frequently queried columns
- **Composite index** on `(supplier_id, created_at DESC)` for the most common query
- **Paginated queries** with LIMIT/OFFSET helpers
- **Batch retrieval** for bulk operations
- **Performance logger** that times every operation

## 🔒 Privacy & Security

- Parameterized queries throughout (SQL injection prevention)
- Environment-based configuration (`.env` not committed)
- Role-based access ready (extensible permission model)

## 🚀 Setup & Usage

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### Installation

```bash
git clone https://github.com/Sahil5H4RD4/business-memory-system.git
cd business-memory-system
npm install
```

### Database Setup

```bash
# Create database
createdb context_memory

# Run schema
psql -d context_memory -f src/schema.sql

# Create indexes (optional, for performance)
psql -d context_memory -f src/indexes.sql
```

### Configuration

Create a `.env` file:
```env
PORT=3000
DB_USER=your_username
DB_PASSWORD=
DB_HOST=localhost
DB_PORT=5432
DB_NAME=context_memory
```

### Running

```bash
npm start
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/suppliers` | Create a supplier |
| `GET` | `/api/suppliers` | List all suppliers |
| `GET` | `/api/suppliers/:id` | Get supplier |
| `GET` | `/api/suppliers/:id/summary` | Supplier with stats |
| `GET` | `/api/suppliers/:id/context` | Run context retrieval |
| `POST` | `/api/invoices` | Submit invoice (auto-retrieval) |
| `GET` | `/api/invoices` | List all invoices |
| `GET` | `/api/invoices/overdue` | Overdue invoices |
| `PATCH` | `/api/invoices/:id/status` | Update payment status |

### Example: Submit Invoice & Get Context

```bash
# Create a supplier
curl -X POST http://localhost:3000/api/suppliers \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Corp", "industry": "Manufacturing", "rating": 0.45}'

# Submit an invoice (auto-triggers context retrieval)
curl -X POST http://localhost:3000/api/invoices \
  -H "Content-Type: application/json" \
  -d '{"supplier_id": 1, "amount": 5000, "due_date": "2026-03-15"}'
```

## 📁 Project Structure

```
business-memory-system/
├── package.json
├── .env                          # Environment config (not committed)
├── README.md
├── ARCHITECTURE.md
└── src/
    ├── server.js                 # Express server entry point
    ├── db.js                     # PostgreSQL connection pool
    ├── schema.sql                # Database table definitions
    ├── indexes.sql               # Performance indexes
    ├── scalability.js            # Pagination & batch helpers
    ├── models/
    │   ├── supplier.model.js     # Supplier data access layer
    │   ├── invoice.model.js      # Invoice data access layer
    │   └── issue.model.js        # Issue data access layer
    ├── engines/
    │   ├── lifecycle.engine.js   # Time decay & age management
    │   ├── relevance.engine.js   # Weighted relevance scoring
    │   ├── retrieval.engine.js   # Context retrieval pipeline
    │   ├── conflict.engine.js    # Trend detection & resolution
    │   └── explainability.engine.js  # Decision reasoning output
    └── routes/
        ├── supplier.routes.js    # Supplier REST API
        └── invoice.routes.js     # Invoice REST API
```

## 📜 License

ISC
