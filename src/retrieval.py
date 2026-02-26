"""
Context Retrieval Pipeline — Intelligent memory retrieval with ranked output.

Flow:
    1. New event / query arrives.
    2. Extract entity references and keywords.
    3. Fetch related memories from the store.
    4. Score each memory with the relevance engine.
    5. Apply conflict resolution.
    6. Sort and return top-N results with explanations.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple

from src.memory_store import MemoryStore
from src.lifecycle import LifecycleManager
from src.relevance import RelevanceEngine


# ---------------------------------------------------------------------------
# Context Result
# ---------------------------------------------------------------------------

class ContextResult:
    """
    A single retrieval result with score breakdown and explanation.
    """

    def __init__(self, memory: Dict[str, Any], scores: Dict[str, float],
                 explanation: str, rank: int):
        self.memory = memory
        self.scores = scores
        self.explanation = explanation
        self.rank = rank

    def to_dict(self) -> Dict[str, Any]:
        return {
            "rank": self.rank,
            "memory_id": self.memory.get("id", ""),
            "memory_type": self.memory.get("type", ""),
            "content": self.memory.get("content", ""),
            "scores": self.scores,
            "explanation": self.explanation,
        }

    def __repr__(self) -> str:
        return (f"ContextResult(rank={self.rank}, "
                f"type={self.memory.get('type')}, "
                f"score={self.scores.get('final_score', 0):.4f})")


# ---------------------------------------------------------------------------
# Retrieval Engine
# ---------------------------------------------------------------------------

class RetrievalEngine:
    """
    Intelligent context retrieval pipeline.

    Given a query or event, fetches and ranks the most relevant memories
    and produces human-readable explanations for each.

    Parameters:
        store:      MemoryStore instance.
        lifecycle:  LifecycleManager instance.
        relevance:  RelevanceEngine instance.
        top_k:      Default number of top results to return.
    """

    def __init__(self, store: MemoryStore, lifecycle: LifecycleManager,
                 relevance: RelevanceEngine, top_k: int = 5):
        self.store = store
        self.lifecycle = lifecycle
        self.relevance = relevance
        self.top_k = top_k

    # -- Main Retrieval Pipeline ---------------------------------------------

    def retrieve_context(
        self,
        query: str,
        entity_id: Optional[str] = None,
        entity_name: Optional[str] = None,
        industry: Optional[str] = None,
        top_k: Optional[int] = None,
        verbose: bool = True,
    ) -> List[ContextResult]:
        """
        Execute the full context retrieval pipeline.

        Parameters:
            query:        Natural-language query or event description.
            entity_id:    ID of the entity to scope retrieval around.
            entity_name:  Name of the entity (for entity index lookups).
            industry:     Industry context for relational scoring.
            top_k:        Override the default number of results.
            verbose:      Print results to stdout.

        Returns:
            List of ContextResult objects, ranked by relevance.
        """
        k = top_k or self.top_k
        keywords = self._extract_keywords(query)

        if verbose:
            print(f"\n{'='*60}")
            print(f"  CONTEXT RETRIEVAL: {query}")
            print(f"{'='*60}")
            print(f"  Keywords: {keywords}")

        # Step 1: Gather candidate memories
        candidates = self._gather_candidates(entity_id, entity_name)

        if verbose:
            print(f"  Candidates found: {len(candidates)}")

        if not candidates:
            if verbose:
                print("  No relevant memories found.\n")
            return []

        # Step 2: Score each candidate
        scored = self.relevance.score_memories(
            candidates,
            query_keywords=keywords,
            context_entity_id=entity_id,
            context_industry=industry,
        )

        # Step 3: Conflict resolution
        scored = self.relevance.resolve_conflicts(scored)

        # Step 4: Take top-K
        top_results = scored[:k]

        # Step 5: Generate explanations
        results = []
        for rank, mem in enumerate(top_results, 1):
            scores = mem.get("scores", {})
            explanation = self._generate_explanation(mem, scores, query)
            result = ContextResult(
                memory=mem,
                scores=scores,
                explanation=explanation,
                rank=rank,
            )
            results.append(result)

        if verbose:
            self._print_results(results)

        return results

    # -- Candidate Gathering -------------------------------------------------

    def _gather_candidates(self, entity_id: Optional[str] = None,
                           entity_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Fetch candidate memories using multiple strategies:
        1. Entity name lookup (entity index).
        2. Entity ID lookup (related memories via links).
        3. General active memory scan (fallback).
        """
        candidates: Dict[str, Dict[str, Any]] = {}

        # Strategy 1: Entity name lookup
        if entity_name:
            by_name = self.store.get_memory_by_entity(entity_name)
            for mem in by_name:
                candidates[mem["id"]] = mem

        # Strategy 2: Related memory traversal
        if entity_id:
            direct = self.store.get_memory(entity_id)
            if direct:
                candidates[direct["id"]] = direct
            related = self.store.get_related_memories(entity_id, max_depth=2)
            for mem in related:
                candidates[mem["id"]] = mem

        # Strategy 3: Fallback — active memories
        if not candidates:
            active = self.store.search_memories(
                filters={"status": "active"}, limit=100
            )
            for mem in active:
                candidates[mem["id"]] = mem

        return list(candidates.values())

    # -- Explanation Generator -----------------------------------------------

    def _generate_explanation(self, memory: Dict[str, Any],
                              scores: Dict[str, float],
                              query: str) -> str:
        """
        Produce a human-readable explanation of why this memory was
        retrieved and how it was scored.
        """
        reasons = []
        mem_type = memory.get("type", "unknown")
        content = memory.get("content", "")
        meta = memory.get("metadata", {})

        # Temporal reasoning
        t_score = scores.get("temporal", 0)
        if t_score > 0.8:
            reasons.append("Recent and highly active memory")
        elif t_score > 0.4:
            reasons.append("Moderately recent memory")
        else:
            reasons.append("Older memory with reduced temporal weight")

        # Relational reasoning
        r_score = scores.get("relational", 0)
        if r_score >= 1.0:
            reasons.append("Directly related to the queried entity")
        elif r_score >= 0.6:
            reasons.append("Same industry/category as the query context")
        else:
            reasons.append("Indirectly related")

        # Semantic reasoning
        s_score = scores.get("semantic", 0)
        if s_score > 0.3:
            reasons.append("Strong keyword match with query")
        elif s_score > 0.1:
            reasons.append("Partial keyword overlap")

        # Conflict adjustment
        adjustment = scores.get("conflict_adjustment", "")
        if adjustment == "old_negative_dampened":
            reasons.append("Score adjusted: older negative data dampened due to newer positive trend")
        elif adjustment == "recent_positive_boosted":
            reasons.append("Score boosted: recent positive trend detected")

        # Type-specific details
        if mem_type == "issue":
            severity = meta.get("severity", "")
            status = meta.get("resolution_status", "")
            if severity:
                reasons.append(f"Issue severity: {severity}")
            if status:
                reasons.append(f"Resolution status: {status}")
        elif mem_type == "invoice":
            payment = meta.get("payment_status", "")
            if payment:
                reasons.append(f"Payment status: {payment}")

        explanation = "Flagged due to:\n" + "\n".join(f"  - {r}" for r in reasons)
        return explanation

    # -- Output Formatting ---------------------------------------------------

    def _print_results(self, results: List[ContextResult]):
        """Pretty-print retrieval results to stdout."""
        print(f"\n  Top {len(results)} Retrieved Memories:")
        print(f"  {'-'*50}")
        for r in results:
            scores = r.scores
            print(f"\n  #{r.rank} [{r.memory['type'].upper()}] "
                  f"(Score: {scores.get('final_score', 0):.4f})")
            print(f"     Content: {r.memory.get('content', '')[:80]}")
            print(f"     Temporal: {scores.get('temporal', 0):.3f} | "
                  f"Relational: {scores.get('relational', 0):.3f} | "
                  f"Semantic: {scores.get('semantic', 0):.3f}")
            print(f"     {r.explanation}")
        print(f"\n{'='*60}\n")

    # -- Keyword Extraction --------------------------------------------------

    def _extract_keywords(self, query: str) -> Set[str]:
        """
        Extract searchable keywords from a query string.
        Removes common stop words.
        """
        stop_words = {
            "the", "a", "an", "is", "are", "was", "were", "be", "been",
            "being", "have", "has", "had", "do", "does", "did", "will",
            "would", "could", "should", "may", "might", "can", "shall",
            "of", "in", "to", "for", "with", "on", "at", "by", "from",
            "about", "into", "through", "during", "before", "after",
            "and", "but", "or", "nor", "not", "no", "so", "yet",
            "this", "that", "these", "those", "it", "its", "what",
            "which", "who", "whom", "how", "when", "where", "why",
        }
        words = query.lower().split()
        return {w.strip(".,!?;:'\"()[]{}") for w in words if w not in stop_words and len(w) > 1}
