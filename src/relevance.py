"""
Relevance Engine — Score memory importance using composite weighting.

Scoring formula:
    Final Score = 0.4 × temporal_score + 0.3 × relational_score + 0.3 × semantic_score

Components:
    Temporal  — From lifecycle decay function.
    Relational — Same supplier → 1.0, Same industry → 0.6, Different → 0.2.
    Semantic  — Simple keyword overlap (Jaccard similarity, no LLM).

Conflict handling:
    When older negative data coexists with newer positive trends, the engine
    applies trend weighting and recency multipliers to surface the most
    relevant picture.
"""

import math
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set

from src.lifecycle import LifecycleManager
from src.memory_store import MemoryStore


# ---------------------------------------------------------------------------
# Weights
# ---------------------------------------------------------------------------

W_TEMPORAL = 0.4
W_RELATIONAL = 0.3
W_SEMANTIC = 0.3

RECENCY_BOOST_DAYS = 30       # Memories < 30 days get a 1.5× multiplier
RECENCY_MULTIPLIER = 1.5

# Severity weights for conflict resolution
SEVERITY_WEIGHTS = {
    "critical": 1.0,
    "high": 0.8,
    "medium": 0.5,
    "low": 0.3,
}


# ---------------------------------------------------------------------------
# Relevance Engine
# ---------------------------------------------------------------------------

class RelevanceEngine:
    """
    Scores memories by combining temporal recency, relational proximity,
    and semantic keyword similarity.

    Parameters:
        store:      MemoryStore instance.
        lifecycle:  LifecycleManager instance (for temporal scores).
    """

    def __init__(self, store: MemoryStore, lifecycle: LifecycleManager):
        self.store = store
        self.lifecycle = lifecycle

    # -- Temporal Score ------------------------------------------------------

    def temporal_score(self, memory: Dict[str, Any]) -> float:
        """
        Temporal relevance from lifecycle decay.
        Returns a value in (0.0, 1.0].
        """
        return self.lifecycle.lifecycle_score(memory)

    # -- Relational Score ----------------------------------------------------

    def relational_score(self, memory: Dict[str, Any],
                         context_entity_id: Optional[str] = None,
                         context_industry: Optional[str] = None) -> float:
        """
        Score based on relational proximity to the query context.

            Same supplier/entity → 1.0
            Same industry        → 0.6
            Different            → 0.2
        """
        if context_entity_id is None and context_industry is None:
            return 0.2

        meta = memory.get("metadata", {})

        # Check direct entity match
        if context_entity_id:
            # Check supplier_id, source_entity, target_entity in metadata
            for key in ("supplier_id", "source_entity", "target_entity", "id"):
                if meta.get(key) == context_entity_id:
                    return 1.0
            # Check related_ids
            related = memory.get("related_ids", [])
            if context_entity_id in related:
                return 1.0

        # Check industry match
        if context_industry:
            mem_industry = meta.get("category", "") or meta.get("industry", "")
            if mem_industry and mem_industry.lower() == context_industry.lower():
                return 0.6

        return 0.2

    # -- Semantic Score ------------------------------------------------------

    def semantic_score(self, memory: Dict[str, Any],
                       query_keywords: Set[str]) -> float:
        """
        Simple Jaccard similarity between query keywords and memory content.

        No LLM — purely keyword overlap.
        """
        if not query_keywords:
            return 0.0

        # Build memory keyword set from content + tags + metadata values
        memory_text = self._extract_text(memory)
        memory_keywords = set(memory_text.lower().split())

        query_lower = {kw.lower() for kw in query_keywords}

        intersection = memory_keywords & query_lower
        union = memory_keywords | query_lower

        if not union:
            return 0.0

        return len(intersection) / len(union)

    # -- Composite Score -----------------------------------------------------

    def score_memory(self, memory: Dict[str, Any],
                     query_keywords: Optional[Set[str]] = None,
                     context_entity_id: Optional[str] = None,
                     context_industry: Optional[str] = None) -> Dict[str, float]:
        """
        Compute the final composite relevance score.

        Returns a dict with individual component scores and the final score:
            {
                "temporal": ...,
                "relational": ...,
                "semantic": ...,
                "final_score": ...
            }
        """
        t_score = self.temporal_score(memory)
        r_score = self.relational_score(memory, context_entity_id, context_industry)
        s_score = self.semantic_score(memory, query_keywords or set())

        final = (W_TEMPORAL * t_score +
                 W_RELATIONAL * r_score +
                 W_SEMANTIC * s_score)

        # Apply recency boost
        final *= self._recency_multiplier(memory)

        return {
            "temporal": round(t_score, 4),
            "relational": round(r_score, 4),
            "semantic": round(s_score, 4),
            "final_score": round(final, 4),
        }

    # -- Batch Scoring -------------------------------------------------------

    def score_memories(self, memories: List[Dict[str, Any]],
                       query_keywords: Optional[Set[str]] = None,
                       context_entity_id: Optional[str] = None,
                       context_industry: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Score a list of memories and return them sorted by final_score descending.

        Each memory dict gets an additional 'scores' key with the breakdown.
        """
        scored = []
        for mem in memories:
            scores = self.score_memory(
                mem, query_keywords, context_entity_id, context_industry
            )
            mem["scores"] = scores
            scored.append(mem)

        scored.sort(key=lambda m: m["scores"]["final_score"], reverse=True)
        return scored

    # -- Conflict Resolution -------------------------------------------------

    def resolve_conflicts(self, memories: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Handle conflicting signals in memory data.

        Scenarios handled:
        1. Older negative data + newer positive trend → boost positive.
        2. Multiple issues of increasing severity → boost importance.

        Adjusts the 'final_score' in each memory's 'scores' dict.
        """
        if len(memories) < 2:
            return memories

        # Separate by sentiment/nature
        negative = []
        positive = []
        for mem in memories:
            meta = mem.get("metadata", {})
            content = self._extract_text(mem).lower()
            severity = meta.get("severity", "")
            resolution = meta.get("resolution_status", "")

            is_negative = (
                severity in ("high", "critical") or
                resolution == "open" or
                any(w in content for w in ("issue", "problem", "complaint", "overdue", "dispute"))
            )
            is_positive = (
                resolution in ("resolved", "closed") or
                any(w in content for w in ("paid", "resolved", "improvement", "positive"))
            )

            if is_negative:
                negative.append(mem)
            elif is_positive:
                positive.append(mem)

        # Trend weighting: if we have BOTH negative and positive data,
        # boost recent positive items and dampen old negative ones
        if negative and positive:
            for mem in negative:
                age_weight = self.lifecycle.get_age_weight(mem.get("created_at", ""))
                if age_weight < 1.0 and "scores" in mem:
                    # Old negative → reduce its score
                    mem["scores"]["final_score"] *= 0.7
                    mem["scores"]["conflict_adjustment"] = "old_negative_dampened"

            for mem in positive:
                recency = self._recency_multiplier(mem)
                if recency > 1.0 and "scores" in mem:
                    # Recent positive → boost
                    mem["scores"]["final_score"] *= 1.3
                    mem["scores"]["conflict_adjustment"] = "recent_positive_boosted"

        # Re-sort after adjustments
        memories.sort(key=lambda m: m.get("scores", {}).get("final_score", 0), reverse=True)
        return memories

    # -- Helpers -------------------------------------------------------------

    def _recency_multiplier(self, memory: Dict[str, Any]) -> float:
        """Return 1.5 for memories < 30 days old, otherwise 1.0."""
        try:
            created = datetime.fromisoformat(memory.get("created_at", ""))
            age_days = (datetime.now() - created).total_seconds() / 86400.0
            if age_days < RECENCY_BOOST_DAYS:
                return RECENCY_MULTIPLIER
        except (ValueError, TypeError):
            pass
        return 1.0

    def _extract_text(self, memory: Dict[str, Any]) -> str:
        """Extract searchable text from a memory dict."""
        parts = [
            str(memory.get("content", "")),
            " ".join(memory.get("tags", [])),
        ]
        meta = memory.get("metadata", {})
        for key in ("name", "title", "description", "event_type",
                     "category", "invoice_number", "notes"):
            val = meta.get(key, "")
            if val:
                parts.append(str(val))
        return " ".join(parts)
