"""
Memory Lifecycle Manager — Time decay, age-based archiving, and maintenance.

Implements exponential decay scoring and automatic archival of stale memories
based on configurable age thresholds.

Decay formula:  decay_score = e^(-λ × age_in_days)

Age-based rules:
    < 6 months   → High priority  (weight 1.0)
    6–24 months  → Downweight     (weight 0.5)
    > 24 months  → Auto-archive
"""

import math
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from src.memory_store import MemoryStore


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_LAMBDA = 0.005          # Decay rate (gentle default)
ARCHIVE_AGE_DAYS = 730          # 2 years → auto-archive
DOWNWEIGHT_AGE_DAYS = 180       # 6 months → start down-weighting
HIGH_PRIORITY_DAYS = 180        # Under 6 months → full weight


# ---------------------------------------------------------------------------
# Lifecycle Manager
# ---------------------------------------------------------------------------

class LifecycleManager:
    """
    Manages the lifecycle of memories: decay scoring, age weighting,
    and automatic archival of stale entries.

    Parameters:
        store:       The MemoryStore instance to operate on.
        lambda_val:  Exponential decay rate (higher = faster decay).
    """

    def __init__(self, store: MemoryStore, lambda_val: float = DEFAULT_LAMBDA):
        self.store = store
        self.lambda_val = lambda_val

    # -- Decay Calculation ---------------------------------------------------

    def calculate_decay(self, created_at: str, lambda_val: Optional[float] = None) -> float:
        """
        Compute exponential decay score for a memory.

            decay_score = e^(-λ × age_in_days)

        Parameters:
            created_at:  ISO-format timestamp string.
            lambda_val:  Override decay rate (uses instance default if None).

        Returns:
            Decay score in the range (0.0, 1.0].
        """
        lam = lambda_val or self.lambda_val
        try:
            created = datetime.fromisoformat(created_at)
        except (ValueError, TypeError):
            return 1.0  # Can't parse → treat as fresh

        age_days = (datetime.now() - created).total_seconds() / 86400.0
        if age_days < 0:
            age_days = 0
        return math.exp(-lam * age_days)

    # -- Age Bracket Weight --------------------------------------------------

    def get_age_weight(self, created_at: str) -> float:
        """
        Return an age-bracket multiplier:

            < 6 months  → 1.0 (high priority)
            6–24 months → 0.5 (down-weighted)
            > 24 months → 0.0 (should be archived)
        """
        try:
            created = datetime.fromisoformat(created_at)
        except (ValueError, TypeError):
            return 1.0

        age_days = (datetime.now() - created).total_seconds() / 86400.0

        if age_days < HIGH_PRIORITY_DAYS:
            return 1.0
        elif age_days < ARCHIVE_AGE_DAYS:
            return 0.5
        else:
            return 0.0

    # -- Combined Lifecycle Score --------------------------------------------

    def lifecycle_score(self, memory: Dict[str, Any]) -> float:
        """
        Compute overall lifecycle score combining decay and age weight.

            score = decay_score × age_weight × importance
        """
        decay = self.calculate_decay(memory.get("created_at", ""))
        age_w = self.get_age_weight(memory.get("created_at", ""))
        importance = memory.get("importance_score", 0.5)
        return decay * age_w * importance

    # -- Archival Operations -------------------------------------------------

    def mark_as_archived(self, memory_id: str) -> bool:
        """Set a memory's status to 'archived'."""
        return self.store.update_memory(memory_id, status="archived")

    def mark_as_active(self, memory_id: str) -> bool:
        """Restore an archived memory back to 'active'."""
        return self.store.update_memory(memory_id, status="active")

    def auto_archive_stale(self, dry_run: bool = False) -> List[Dict[str, Any]]:
        """
        Scan all active memories and archive those that exceed the age
        threshold (> 2 years) or whose lifecycle score has dropped to zero.

        Parameters:
            dry_run: If True, return candidates without actually archiving.

        Returns:
            List of memory dicts that were (or would be) archived.
        """
        candidates = self.store.search_memories(
            filters={"status": "active"}, limit=10000
        )
        archived: List[Dict[str, Any]] = []

        for mem in candidates:
            created_at = mem.get("created_at", "")
            score = self.lifecycle_score(mem)

            # Archive if age weight is zero (> 2 years) or score collapsed
            if self.get_age_weight(created_at) == 0.0 or score < 0.01:
                if not dry_run:
                    self.mark_as_archived(mem["id"])
                archived.append(mem)

        return archived

    # -- Maintenance ---------------------------------------------------------

    def run_maintenance(self, verbose: bool = True) -> Dict[str, Any]:
        """
        Full maintenance cycle: archive stale memories and report stats.

        Returns:
            Summary dict with counts and details.
        """
        if verbose:
            print("\n[Lifecycle Manager] Running maintenance cycle...")

        # Count before
        total_active = self.store.count_memories({"status": "active"})
        total_archived_before = self.store.count_memories({"status": "archived"})

        # Auto-archive
        newly_archived = self.auto_archive_stale()

        if verbose:
            for mem in newly_archived:
                score = self.lifecycle_score(mem)
                print(f"  → Archived: {mem['id'][:20]}... "
                      f"(type={mem['type']}, score={score:.4f})")

        total_archived_after = self.store.count_memories({"status": "archived"})

        summary = {
            "total_active_before": total_active,
            "total_archived_before": total_archived_before,
            "newly_archived": len(newly_archived),
            "total_archived_after": total_archived_after,
            "total_remaining_active": total_active - len(newly_archived),
        }

        if verbose:
            print(f"  → Summary: {len(newly_archived)} memories archived, "
                  f"{summary['total_remaining_active']} still active.")
            print("[Lifecycle Manager] Maintenance complete.\n")

        return summary

    # -- Utility -------------------------------------------------------------

    def score_all_memories(self) -> List[Dict[str, Any]]:
        """
        Return all active memories with their current lifecycle scores,
        sorted from lowest (stalest) to highest (freshest).
        """
        memories = self.store.search_memories(
            filters={"status": "active"}, limit=10000
        )
        scored = []
        for mem in memories:
            mem["lifecycle_score"] = self.lifecycle_score(mem)
            scored.append(mem)
        scored.sort(key=lambda m: m["lifecycle_score"])
        return scored
