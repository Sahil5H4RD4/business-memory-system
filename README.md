# AI Context and Memory Management System

A robust memory management layer designed for AI agents in business environments. This system orchestrates Immediate, Episodic, Semantic, and Temporal memory types to ensure AI agents maintain relevant context for decision-making.

## Features

-   **Multi-Modal Memory Architecture**:
    -   **Immediate Memory**: Short-term working context (e.g., current conversation).
    -   **Episodic Memory**: Event-based logs/audit trails (e.g., "User X updated Invoice Y").
    -   **Semantic Memory**: Structured knowledge graph (e.g., "Client A is VIP").
    -   **Temporal Memory**: Time-series trends (e.g., server latency metrics).
-   **Lifecycle Management**: Automated decay, consolidation, and archival of memories to prevent bloat.
-   **Smart Retrieval**: Context retrieval based on Vector Similarity, Recency, and Importance scoring.
-   **Multi-Agent Context**: Shared context broadcasting for collaborative agent systems.

## Architecture

The system follows a layered architecture for processing, storing, and retrieving context.

```mermaid
graph TD
    %% Input Layer
    subgraph Input_Layer [Input Layer]
        In1[Invoice / Document] --> |Ingest| API
        In2[Support Ticket] --> |Ingest| API
        In3[User Query] --> |Ingest| API
    end

    %% API Gateway
    API[API Gateway] --> |Route| P[Processing Engine]
    
    %% Processing & Routing
    subgraph Processing_Layer [Processing & Routing]
        P --> |Extract Entities| NER[Named Entity Recognition]
        P --> |Analyze Sentiment| SA[Sentiment Analysis]
        P --> |Vectorize| EMB[Embedding Model]
    end

    %% Memory Stores
    subgraph Memory_Stores [Memory Stores]
        direction TB
        IM[Immediate Memory<br/>(Short-term/Working)]
        EM[Episodic Memory<br/>(Event-based Logs)]
        SM[Semantic Memory<br/>(Structured Facts/KG)]
        TM[Temporal Memory<br/>(Time-series Trends)]
    end

    %% Data Flow to Memory
    NER --> SM
    NER --> EM
    SA --> EM
    EMB --> IM
    EMB --> EM

    %% Lifecycle Management
    subgraph Lifecycle_Management [Lifecycle Management]
        MLM[Memory Lifecycle Manager]
        ARC[Archive Storage<br/>(Cold Store)]
        
        MLM --> |Monitor Access| IM
        MLM --> |Consolidate| EM
        MLM --> |Prune/Archive| ARC
        
        IM -.-> |Promote if recurring| EM
        EM -.-> |Abstract patterns| SM
        EM -.-> |Move stale events| ARC
    end

    %% Start of Retrieval Flow
    subgraph Retrieval_System [Retrieval & Context]
        Q[Query / Context Request] --> RE[Retrieval Engine]
        
        RE --> |Fetch Relevant| IM
        RE --> |Search Similar| EM
        RE --> |Query Facts| SM
        RE --> |Get Trends| TM
        
        RE --> SC[Scoring Module]
        
        SC --> |Rank & Filter| RC[Ranked Context]
        
        RC --> MAC[Multi-Agent Shared Context]
    end

    %% Experiential Pattern Engine
    subgraph Pattern_Engine [Experiential Pattern Engine]
        EPE[Pattern Recognizer]
        
        EM --> |Feed Events| EPE
        TM --> |Feed Trends| EPE
        EPE --> |Update Rules| SM
    end
```

## Setup & Usage

### Prerequisites
- Python 3.8+

### Installation
1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd business-memory-system
   ```

2. Install dependencies (currently standard library only):
   ```bash
   pip install -r requirements.txt
   ```

### Running the Prototype
Execute the main script to see the memory system in action:

```bash
python3 -m src.main
```

This will run a simulation that:
1.  Initializes memory stores.
2.  Ingests sample data (Invoices, Semantic Facts).
3.  Simulates a user query ("Status of INV-001").
4.  Demonstrates retrieval ranking.
5.  Simulates time passage and memory decay/archival.

## Directory Structure
- `src/`: Source code for memory modules.
    - `memory_store.py`: Class definitions for memory types.
    - `retrieval.py`: Scoring and retrieval logic.
    - `lifecycle.py`: Management of memory decay and archival.
    - `shared_context.py`: Inter-agent context sharing.
    - `main.py`: Entry point for the prototype demonstration.
