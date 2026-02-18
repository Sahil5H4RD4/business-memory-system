import math
from datetime import datetime
from typing import List, Tuple
from src.memory_store import MemoryItem, BaseMemoryStore

class ScoringModule:
    def __init__(self, w1=0.6, w2=0.2, w3=0.2, decay_lambda=0.01):
        self.w1 = w1  # Similarity weight
        self.w2 = w2  # Recency weight
        self.w3 = w3  # Importance weight
        self.decay_lambda = decay_lambda

    def calculate_recency(self, item: MemoryItem) -> float:
        time_diff = (datetime.now() - item.last_accessed).total_seconds() / 3600 # hours
        return 1.0 / (1.0 + self.decay_lambda * time_diff)

    def calculate_score(self, item: MemoryItem, query_vector: List[float]) -> float:
        # Mock cosine similarity for prototype
        # In a real system, you'd use numpy or torch to compute dot product of embeddings
        similarity = 0.5 
        if item.embedding and query_vector:
             # simplistic dot product for demo if dimensions match
             if len(item.embedding) == len(query_vector):
                 similarity = sum(x*y for x,y in zip(item.embedding, query_vector))
        
        recency = self.calculate_recency(item)
        importance = item.importance

        score = (self.w1 * similarity) + (self.w2 * recency) + (self.w3 * importance)
        return score

class RetrievalEngine:
    def __init__(self, scoring_module: ScoringModule):
        self.scoring = scoring_module

    def retrieve(self, query: str, query_vector: List[float], memory_stores: List[BaseMemoryStore], top_k: int = 5) -> List[Tuple[MemoryItem, float]]:
        candidates = []
        for store in memory_stores:
            items = store.get_all()
            for item in items:
                score = self.scoring.calculate_score(item, query_vector)
                candidates.append((item, score))
        
        # Sort by score descending
        candidates.sort(key=lambda x: x[1], reverse=True)
        return candidates[:top_k]
