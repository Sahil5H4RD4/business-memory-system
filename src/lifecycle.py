from datetime import datetime
from typing import List
from src.memory_store import MemoryItem, BaseMemoryStore

class MemoryLifecycleManager:
    def __init__(self, archive_threshold: float = 0.2, consolidate_threshold: int = 5):
        self.archive_threshold = archive_threshold
        self.consolidate_threshold = consolidate_threshold
        self.archive_store: List[MemoryItem] = []

    def decay_and_maintain(self, memory_stores: List[BaseMemoryStore]):
        """
        Iterates through all memories, applies decay logic, and moves low-score items to archive.
        """
        print("\n[Lifecycle Manager] Running maintenance cycle...")
        for store in memory_stores:
            items_to_remove = []
            for item in store.get_all():
                # Simple decay logic based on time since created or last accessed
                # Here we simulate decay by reducing importance if not accessed recently
                hours_unused = (datetime.now() - item.last_accessed).total_seconds() / 3600
                decay_factor = math.exp(-0.1 * hours_unused)
                
                current_score = item.importance * decay_factor
                
                # Check for archival
                if current_score < self.archive_threshold:
                    print(f"  -> Archiving memory: {item.id} (Score: {current_score:.4f})")
                    self.archive_store.append(item)
                    items_to_remove.append(item.id)
                elif item.access_count > self.consolidate_threshold:
                     print(f"  -> Promoting/Consolidating memory: {item.id} (Access Count: {item.access_count})")
                     # Logic to promote to a higher-level memory or summarize would go here
                     # For prototype, we just log it.

            # Remove archived items from active store
            for item_id in items_to_remove:
                store.remove(item_id)
        print("[Lifecycle Manager] Maintenance complete.\n")

import math
