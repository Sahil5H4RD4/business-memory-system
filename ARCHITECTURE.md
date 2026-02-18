# Architecture Details

For the high-level system overview and architecture diagram, please refer to [README.md](README.md).

This document outlines the specific reasoning behind component choices, the mathematical models for retrieval scoring, and the logic for memory lifecycle management.

## Component Reasoning

### 1. Immediate Memory (Short-term)
- **Purpose**: Holds the current conversation context and recently accessed information.
- **Reasoning**: LLMs have limited context windows. We need a scratchpad for immediate relevance (e.g., "the invoice you just mentioned").
- **Implementation**: In-memory cache (Redis) or ephemeral vector store.

### 2. Episodic Memory (Event-based)
- **Purpose**: Stores sequences of events, interactions, and modifications.
- **Reasoning**: Business logic relies on "who did what and when". We need an audit trail of actions (e.g., "User X updated Invoice Y on Date Z").
- **Implementation**: Time-series database or Append-only log with vector indices.

### 3. Semantic Memory (Structured Facts)
- **Purpose**: detailed knowledge graph of entities and their relationships.
- **Reasoning**: Raw text is ambiguous. We need structured facts (e.g., "Client A is a VIP", "Product B belongs to Category C").
- **Implementation**: Graph Database (Neo4j) or Relational DB (PostgreSQL).

### 4. Temporal Memory (Time-series Trends)
- **Purpose**: Tracks metrics and trends over time.
- **Reasoning**: Business decisions often need historical context (e.g., "Sales for Q1 are down compared to last year").
- **Implementation**: Time-series DB (InfluxDB) or columnar store.

### 5. Experiential Pattern Engine
- **Purpose**: Learns from historical data to identifying recurring issues or successful workflows.
- **Reasoning**: AI should get "smarter" over time, not just store more data. It needs to generalize patterns (e.g., "Tickets from Client X usually involve Payment issues").

### 6. Memory Lifecycle Manager
- **Purpose**: Manages the "health" of the memory, preventing bloat.
- **Reasoning**: Storing everything forever is costly and adds noise. We need to forget irrelevant details while keeping critical facts.
- **Logic**:
    - **Decay**: Memories lose `relevance_score` over time unless accessed.
    - **Promotion**: Frequently accessed immediate memories become episodic/semantic.
    - **Archival**: Low-score memories move to cold storage.

## Retrieval & Scoring Math

The `Retrieval Engine` uses a composite score to rank memories for a given query $q$.

$$ Score(m, q) = w_1 \cdot Sim(m, q) + w_2 \cdot Recency(m) + w_3 \cdot Importance(m) $$

Where:
- $m$: A memory item.
- $q$: The query vector.
- $Sim(m, q)$ : Cosine similarity between memory vector and query vector.
- $Recency(m) = \frac{1}{1 + \lambda \cdot (t_{now} - t_{m})} $ : Time decay function. Memories fade unless reinforced.
- $Importance(m)$ : A static or dynamic weight assigned to the memory type (e.g., a "Critical Error" log has high importance).
- $w_1, w_2, w_3$ : Tunable weights (e.g., $0.6, 0.2, 0.2$).

## Memory Lifecycle Logic

1. **Ingestion**: New memory $m$ created at $t_0$ with $Importance(m)$.
2. **Access**: Every time $m$ is retrieved, update:
3.    - $LastAccess(m) = t_{now}$
4.    - $AccessCount(m) \leftarrow AccessCount(m) + 1$
5. **Decay (Periodic Job)**:
6.    - $CurrentScore(m) = Importance(m) \cdot e^{-\alpha (t_{now} - LastAccess(m))}$
7.    - If $CurrentScore(m) < Threshold_{archive}$, move to **Archive**.
8.    - If $AccessCount(m) > Threshold_{consolidate}$, trigger **Pattern Engine** to generalize.
