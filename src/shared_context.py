from typing import List, Dict
from src.memory_store import MemoryItem

class MultiAgentSharedContext:
    def __init__(self):
        self.shared_blackboard: Dict[str, MemoryItem] = {}

    def broadcast(self, item: MemoryItem):
        """
        Broadcasts a high-relevance memory to all agents via the shared context.
        """
        print(f"[Shared Context] Broadcasting memory {item.id} to all agents.")
        self.shared_blackboard[item.id] = item

    def get_context(self, agent_id: str) -> List[MemoryItem]:
        """
        Retrieves relevant context for a specific agent.
        """
        return list(self.shared_blackboard.values())
