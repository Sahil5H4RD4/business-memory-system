from datetime import datetime
import json
from dataclasses import dataclass, field
from typing import List, Dict, Any

@dataclass
class MemoryItem:
    id: str
    content: str
    memory_type: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    relevance_score: float = 1.0
    importance: float = 1.0
    created_at: datetime = field(default_factory=datetime.now)
    last_accessed: datetime = field(default_factory=datetime.now)
    access_count: int = 0
    embedding: List[float] = field(default_factory=list)

    def to_dict(self):
        return {
            "id": self.id,
            "content": self.content,
            "memory_type": self.memory_type,
            "metadata": self.metadata,
            "relevance_score": self.relevance_score,
            "importance": self.importance,
            "created_at": self.created_at.isoformat(),
            "last_accessed": self.last_accessed.isoformat(),
            "access_count": self.access_count
        }

class BaseMemoryStore:
    def __init__(self):
        self.store: Dict[str, MemoryItem] = {}

    def add(self, item: MemoryItem):
        self.store[item.id] = item

    def get(self, item_id: str) -> MemoryItem:
        if item_id in self.store:
            item = self.store[item_id]
            item.last_accessed = datetime.now()
            item.access_count += 1
            return item
        return None

    def get_all(self) -> List[MemoryItem]:
        return list(self.store.values())
    
    def remove(self, item_id: str):
        if item_id in self.store:
            del self.store[item_id]

class ImmediateMemory(BaseMemoryStore):
    """Short-term working memory."""
    pass

class EpisodicMemory(BaseMemoryStore):
    """Event-based long-term memory."""
    pass

class SemanticMemory(BaseMemoryStore):
    """Structured facts and knowledge graph."""
    pass

class TemporalMemory(BaseMemoryStore):
    """Time-series trends and metrics."""
    def add_metric(self, metric_name: str, value: float, timestamp: datetime = None):
        # Specific implementation for time-series data
        if timestamp is None:
            timestamp = datetime.now()
        # Storing as a special memory item for simplicity in this prototype
        item = MemoryItem(
            id=f"{metric_name}_{timestamp.timestamp()}",
            content=f"{metric_name}: {value}",
            memory_type="temporal",
            metadata={"metric": metric_name, "value": value, "timestamp": timestamp.isoformat()}
        )
        self.add(item)
