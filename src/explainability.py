"""
Explainability Layer — Decision logging, scoring breakdown, and reasoning traces.

When a memory is retrieved and scored, this module:
    1. Logs the reason it was surfaced.
    2. Stores the full scoring breakdown (temporal, relational, semantic).
    3. Attaches human-readable explanation metadata.
    4. Persists everything to the `explanation_log` SQLite table.
"""

import json
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

from src.memory_store import MemoryStore


# ---------------------------------------------------------------------------
# Explanation Entry
# ---------------------------------------------------------------------------

@dataclass
class ExplanationEntry:
    """
    A single reasoning trace for a retrieved memory.

    Attributes:
        memory_id:      ID of the memory that was retrieved.
        query:          The query / event that triggered retrieval.
        temporal_score: Temporal relevance component.
        relational_score: Relational relevance component.
        semantic_score: Semantic relevance component.
        final_score:    Composite final score.
        reasoning:      Human-readable explanation text.
        conflict_adjustment: Any conflict resolution adjustment applied.
        timestamp:      When the explanation was generated.
    """

    memory_id: str = ""
    query: str = ""
    temporal_score: float = 0.0
    relational_score: float = 0.0
    semantic_score: float = 0.0
    final_score: float = 0.0
    reasoning: str = ""
    conflict_adjustment: str = ""
    timestamp: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "memory_id": self.memory_id,
            "query": self.query,
            "temporal_score": self.temporal_score,
            "relational_score": self.relational_score,
            "semantic_score": self.semantic_score,
            "final_score": self.final_score,
            "reasoning": self.reasoning,
            "conflict_adjustment": self.conflict_adjustment,
            "timestamp": self.timestamp.isoformat(),
        }

    def __repr__(self) -> str:
        return (f"ExplanationEntry(memory={self.memory_id[:16]}..., "
                f"score={self.final_score:.4f})")


# ---------------------------------------------------------------------------
# Decision Explainer
# ---------------------------------------------------------------------------

class DecisionExplainer:
    """
    Generates, logs, and retrieves reasoning traces for memory retrievals.

    Parameters:
        store: MemoryStore instance (for database access).
    """

    def __init__(self, store: MemoryStore):
        self.store = store
        self._create_table()

    # -- Schema --------------------------------------------------------------

    def _create_table(self):
        """Create the explanation_log table if it doesn't exist."""
        self.store.conn.execute("""
            CREATE TABLE IF NOT EXISTS explanation_log (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                memory_id       TEXT NOT NULL,
                query           TEXT NOT NULL DEFAULT '',
                temporal_score  REAL NOT NULL DEFAULT 0.0,
                relational_score REAL NOT NULL DEFAULT 0.0,
                semantic_score  REAL NOT NULL DEFAULT 0.0,
                final_score     REAL NOT NULL DEFAULT 0.0,
                reasoning       TEXT NOT NULL DEFAULT '',
                conflict_adjustment TEXT NOT NULL DEFAULT '',
                timestamp       TEXT NOT NULL
            )
        """)
        self.store.conn.commit()

    # -- Generate Explanation ------------------------------------------------

    def generate_explanation(self, memory: Dict[str, Any],
                             scores: Dict[str, float],
                             query: str = "") -> ExplanationEntry:
        """
        Create an ExplanationEntry from a scored memory.

        Parameters:
            memory: The memory dict (with 'id', 'type', 'content', etc.).
            scores: The scoring breakdown dict from RelevanceEngine.
            query:  The original query that triggered retrieval.

        Returns:
            A populated ExplanationEntry.
        """
        reasoning_parts = []
        mem_type = memory.get("type", "unknown")
        meta = memory.get("metadata", {})

        # Temporal reasoning
        t_score = scores.get("temporal", 0)
        if t_score > 0.8:
            reasoning_parts.append("High temporal relevance — memory is recent and active")
        elif t_score > 0.4:
            reasoning_parts.append("Moderate temporal relevance — not too old")
        else:
            reasoning_parts.append("Low temporal relevance — memory is aging")

        # Relational reasoning
        r_score = scores.get("relational", 0)
        if r_score >= 1.0:
            reasoning_parts.append("Strongly related — same entity or direct link")
        elif r_score >= 0.6:
            reasoning_parts.append("Moderately related — same industry or category")
        else:
            reasoning_parts.append("Weakly related — indirect connection")

        # Semantic reasoning
        s_score = scores.get("semantic", 0)
        if s_score > 0.3:
            reasoning_parts.append("Strong keyword match with query terms")
        elif s_score > 0.1:
            reasoning_parts.append("Some keyword overlap with query")
        elif s_score > 0:
            reasoning_parts.append("Minimal keyword similarity")
        else:
            reasoning_parts.append("No direct keyword match")

        # Type-specific context
        if mem_type == "issue":
            severity = meta.get("severity", "unknown")
            reasoning_parts.append(f"Issue type with {severity} severity")
        elif mem_type == "invoice":
            status = meta.get("payment_status", "unknown")
            reasoning_parts.append(f"Invoice with payment status: {status}")
        elif mem_type == "supplier":
            rating = meta.get("reliability_rating", 0)
            reasoning_parts.append(f"Supplier reliability: {rating}")
        elif mem_type == "customer":
            tier = meta.get("tier", "unknown")
            reasoning_parts.append(f"Customer tier: {tier}")
        elif mem_type == "event":
            event_type = meta.get("event_type", "general")
            reasoning_parts.append(f"Event type: {event_type}")

        # Conflict adjustment
        adjustment = scores.get("conflict_adjustment", "")
        if adjustment:
            reasoning_parts.append(f"Conflict adjustment applied: {adjustment}")

        reasoning = " | ".join(reasoning_parts)

        return ExplanationEntry(
            memory_id=memory.get("id", ""),
            query=query,
            temporal_score=t_score,
            relational_score=r_score,
            semantic_score=s_score,
            final_score=scores.get("final_score", 0),
            reasoning=reasoning,
            conflict_adjustment=adjustment,
        )

    # -- Logging -------------------------------------------------------------

    def log_decision(self, explanation: ExplanationEntry) -> int:
        """
        Persist an ExplanationEntry to the explanation_log table.

        Returns:
            The auto-incremented row id.
        """
        cur = self.store.conn.execute("""
            INSERT INTO explanation_log
                (memory_id, query, temporal_score, relational_score,
                 semantic_score, final_score, reasoning,
                 conflict_adjustment, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            explanation.memory_id,
            explanation.query,
            explanation.temporal_score,
            explanation.relational_score,
            explanation.semantic_score,
            explanation.final_score,
            explanation.reasoning,
            explanation.conflict_adjustment,
            explanation.timestamp.isoformat(),
        ))
        self.store.conn.commit()
        return cur.lastrowid

    # -- Retrieval -----------------------------------------------------------

    def get_decision_history(self, memory_id: str,
                             limit: int = 20) -> List[Dict[str, Any]]:
        """
        Retrieve the explanation history for a specific memory.

        Returns:
            List of explanation dicts, ordered by most recent first.
        """
        cur = self.store.conn.execute("""
            SELECT * FROM explanation_log
            WHERE memory_id = ?
            ORDER BY timestamp DESC
            LIMIT ?
        """, (memory_id, limit))
        return [dict(row) for row in cur.fetchall()]

    def get_all_decisions(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Retrieve the most recent decision log entries."""
        cur = self.store.conn.execute("""
            SELECT * FROM explanation_log
            ORDER BY timestamp DESC
            LIMIT ?
        """, (limit,))
        return [dict(row) for row in cur.fetchall()]

    def get_decisions_for_query(self, query: str,
                                limit: int = 20) -> List[Dict[str, Any]]:
        """Retrieve explanations generated for a specific query."""
        cur = self.store.conn.execute("""
            SELECT * FROM explanation_log
            WHERE query = ?
            ORDER BY final_score DESC
            LIMIT ?
        """, (query, limit))
        return [dict(row) for row in cur.fetchall()]

    # -- Summary Report ------------------------------------------------------

    def generate_report(self, memory_id: str) -> str:
        """
        Generate a human-readable decision report for a memory.

        Returns:
            Formatted report string.
        """
        history = self.get_decision_history(memory_id, limit=10)
        if not history:
            return f"No decision history found for memory {memory_id}."

        lines = [
            f"Decision History Report — Memory: {memory_id}",
            f"{'='*50}",
            f"Total logged decisions: {len(history)}",
            "",
        ]

        for i, entry in enumerate(history, 1):
            lines.append(f"  Decision #{i} — {entry.get('timestamp', 'N/A')}")
            lines.append(f"    Query: {entry.get('query', 'N/A')}")
            lines.append(f"    Final Score: {entry.get('final_score', 0):.4f}")
            lines.append(f"      Temporal:   {entry.get('temporal_score', 0):.4f}")
            lines.append(f"      Relational: {entry.get('relational_score', 0):.4f}")
            lines.append(f"      Semantic:   {entry.get('semantic_score', 0):.4f}")
            lines.append(f"    Reasoning: {entry.get('reasoning', 'N/A')}")
            adjustment = entry.get("conflict_adjustment", "")
            if adjustment:
                lines.append(f"    Conflict Adj: {adjustment}")
            lines.append("")

        return "\n".join(lines)
