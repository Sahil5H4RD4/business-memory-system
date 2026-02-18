import time
from datetime import datetime, timedelta
from src.memory_store import ImmediateMemory, EpisodicMemory, SemanticMemory, TemporalMemory, MemoryItem
from src.retrieval import RetrievalEngine, ScoringModule
from src.lifecycle import MemoryLifecycleManager
from src.shared_context import MultiAgentSharedContext

def main():
    print("=== AI Context and Memory Management System Prototype ===\n")

    # 1. Initialize Components
    print("1. Initializing System Components...")
    immediate = ImmediateMemory()
    episodic = EpisodicMemory()
    semantic = SemanticMemory()
    temporal = TemporalMemory()
    
    # All stores list
    memory_stores = [immediate, episodic, semantic, temporal]
    
    scoring = ScoringModule(w1=0.7, w2=0.2, w3=0.1)
    retrieval = RetrievalEngine(scoring)
    lifecycle = MemoryLifecycleManager(archive_threshold=0.3)
    shared_context = MultiAgentSharedContext()

    # 2. Ingest Data (Simulate Input)
    print("\n2. Ingesting Data (Simulating Input)...")
    
    # Invoice Data into Episodic Memory
    invoice_event = MemoryItem(
        id="evt_INV-001_created",
        content="Invoice INV-001 created for Client Acme Corp for $5000.",
        memory_type="episodic",
        metadata={"entity": "INV-001", "action": "create", "amount": 5000},
        importance=0.9,
        embedding=[0.1, 0.2, 0.9] # Mock embedding
    )
    episodic.add(invoice_event)
    print(f"  -> Added Episodic Memory: {invoice_event.content}")

    # Semantic Fact
    client_fact = MemoryItem(
        id="fact_acme_corp_vip",
        content="Acme Corp is a VIP client with Platinum status.",
        memory_type="semantic",
        metadata={"entity": "Acme Corp", "status": "VIP"},
        importance=1.0,
        embedding=[0.1, 0.2, 0.95] # Similar vector
    )
    semantic.add(client_fact)
    print(f"  -> Added Semantic Memory: {client_fact.content}")

    # Immediate Context/Query
    user_query_item = MemoryItem(
        id="curr_ctx_query_1",
        content="User asks about the status of INV-001.",
        memory_type="immediate",
        importance=0.8,
        embedding=[0.1, 0.21, 0.88]
    )
    immediate.add(user_query_item)
    print(f"  -> Added Immediate Memory: {user_query_item.content}")

    # Temporal Trend
    temporal.add_metric("server_latency", 45.0)

    # 3. Retrieval Ranking
    print("\n3. Retrieving Context for Query: 'Status of INV-001'...")
    query_vector = [0.1, 0.2, 0.9] # Vector close to invoice & client
    
    results = retrieval.retrieve("Status of INV-001", query_vector, memory_stores)
    
    print("  -> Ranked Context Results:")
    for idx, (item, score) in enumerate(results):
        print(f"     {idx+1}. [{item.memory_type.upper()}] {item.content} (Score: {score:.4f})")
        # Simulate access for lifecycle updates
        item.last_accessed = datetime.now()
        item.access_count += 1
        
        # If highly relevant, broadcast to shared context
        if score > 0.8:
            shared_context.broadcast(item)

    # 4. Simulate Time Passage & Lifecycle Management
    print("\n4. Simulating Time Passage (One Week Later) & Lifecycle Logic...")
    
    # Artificially age a memory to test decay
    stale_memory = MemoryItem(
        id="temp_note_old",
        content="Temporary scratchpad note about lunch.",
        memory_type="immediate",
        importance=0.2,
        created_at=datetime.now() - timedelta(days=7),
        last_accessed=datetime.now() - timedelta(days=7),
        embedding=[0.9, 0.1, 0.0]
    )
    immediate.add(stale_memory)
    print(f"  -> Added Stale Memory (7 days old): {stale_memory.content}")
    
    # Run lifecycle manager
    lifecycle.decay_and_maintain(memory_stores)
    
    # Verify Archival
    print(f"  -> Archived Items Count: {len(lifecycle.archive_store)}")

    print("\n=== Prototype Execution Complete ===")

if __name__ == "__main__":
    main()
