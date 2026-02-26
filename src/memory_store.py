"""
Persistent Memory Store — SQLite-backed storage for Business Memory System.

Provides CRUD operations, entity linking, and relationship traversal
using an embedded SQLite database.  Three core tables:

    memory_nodes  — All memory entries (serialized as JSON metadata).
    memory_links  — Directed edges between memories.
    entities      — Named-entity index for fast lookups.
"""

import json
import os
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from src.models import MemoryNode


# ---------------------------------------------------------------------------
# Database path
# ---------------------------------------------------------------------------

_DB_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
_DB_PATH = os.path.join(_DB_DIR, "memory.db")


def _ensure_db_dir():
    os.makedirs(_DB_DIR, exist_ok=True)


# ---------------------------------------------------------------------------
# MemoryStore
# ---------------------------------------------------------------------------

class MemoryStore:
    """
    SQLite-backed persistent store for MemoryNodes.

    Usage::

        store = MemoryStore()           # uses default data/memory.db
        store = MemoryStore(":memory:") # in-memory (testing)
    """

    def __init__(self, db_path: str = _DB_PATH):
        if db_path != ":memory:":
            _ensure_db_dir()
        self.db_path = db_path
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row
        self._create_tables()

    # -- Schema --------------------------------------------------------------

    def _create_tables(self):
        cur = self.conn.cursor()
        cur.executescript("""
            CREATE TABLE IF NOT EXISTS memory_nodes (
                id              TEXT PRIMARY KEY,
                type            TEXT NOT NULL,
                content         TEXT NOT NULL DEFAULT '',
                metadata_json   TEXT NOT NULL DEFAULT '{}',
                importance_score REAL NOT NULL DEFAULT 0.5,
                confidence      REAL NOT NULL DEFAULT 1.0,
                status          TEXT NOT NULL DEFAULT 'active',
                tags_json       TEXT NOT NULL DEFAULT '[]',
                related_ids_json TEXT NOT NULL DEFAULT '[]',
                created_at      TEXT NOT NULL,
                updated_at      TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS memory_links (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                source_id   TEXT NOT NULL,
                target_id   TEXT NOT NULL,
                link_type   TEXT NOT NULL DEFAULT 'related',
                strength    REAL NOT NULL DEFAULT 1.0,
                created_at  TEXT NOT NULL,
                FOREIGN KEY (source_id) REFERENCES memory_nodes(id),
                FOREIGN KEY (target_id) REFERENCES memory_nodes(id)
            );

            CREATE TABLE IF NOT EXISTS entities (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_name TEXT NOT NULL,
                entity_type TEXT NOT NULL DEFAULT 'unknown',
                memory_id   TEXT NOT NULL,
                FOREIGN KEY (memory_id) REFERENCES memory_nodes(id)
            );
        """)
        self.conn.commit()

    # -- Core CRUD -----------------------------------------------------------

    def add_memory(self, node: MemoryNode, content: str = "",
                   entity_names: Optional[List[Tuple[str, str]]] = None) -> str:
        """
        Insert a MemoryNode into the store.

        Parameters:
            node:          The MemoryNode (or subclass) to persist.
            content:       Searchable text content for the node.
            entity_names:  Optional list of (entity_name, entity_type) tuples
                           to index for fast entity-based lookups.

        Returns:
            The id of the inserted node.
        """
        cur = self.conn.cursor()
        now = datetime.now().isoformat()
        data = node.to_dict()

        cur.execute("""
            INSERT OR REPLACE INTO memory_nodes
                (id, type, content, metadata_json, importance_score,
                 confidence, status, tags_json, related_ids_json,
                 created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            node.id,
            node.type,
            content or data.get("description", "") or data.get("name", ""),
            json.dumps(data),
            node.importance_score,
            node.confidence,
            node.status,
            json.dumps(node.tags),
            json.dumps(node.related_ids),
            node.created_at.isoformat(),
            now,
        ))

        # Register entities
        if entity_names:
            for ename, etype in entity_names:
                cur.execute("""
                    INSERT INTO entities (entity_name, entity_type, memory_id)
                    VALUES (?, ?, ?)
                """, (ename.lower(), etype, node.id))

        self.conn.commit()
        return node.id

    def get_memory(self, memory_id: str) -> Optional[Dict[str, Any]]:
        """Fetch a single memory node by ID."""
        cur = self.conn.cursor()
        cur.execute("SELECT * FROM memory_nodes WHERE id = ?", (memory_id,))
        row = cur.fetchone()
        if row is None:
            return None
        return self._row_to_dict(row)

    def update_memory(self, memory_id: str, **fields) -> bool:
        """
        Partial update of a memory node.

        Supported fields: content, importance_score, confidence, status, tags_json, metadata_json.
        """
        if not fields:
            return False
        allowed = {"content", "importance_score", "confidence", "status",
                    "tags_json", "metadata_json", "updated_at"}
        parts = []
        values: list = []
        for k, v in fields.items():
            if k in allowed:
                parts.append(f"{k} = ?")
                values.append(v)
        if not parts:
            return False
        parts.append("updated_at = ?")
        values.append(datetime.now().isoformat())
        values.append(memory_id)
        self.conn.execute(
            f"UPDATE memory_nodes SET {', '.join(parts)} WHERE id = ?", values
        )
        self.conn.commit()
        return True

    def delete_memory(self, memory_id: str) -> bool:
        """Remove a memory node and its links/entities."""
        cur = self.conn.cursor()
        cur.execute("DELETE FROM memory_links WHERE source_id = ? OR target_id = ?",
                     (memory_id, memory_id))
        cur.execute("DELETE FROM entities WHERE memory_id = ?", (memory_id,))
        cur.execute("DELETE FROM memory_nodes WHERE id = ?", (memory_id,))
        self.conn.commit()
        return cur.rowcount > 0

    # -- Linking -------------------------------------------------------------

    def link_memory(self, source_id: str, target_id: str,
                    link_type: str = "related", strength: float = 1.0) -> int:
        """
        Create a directed relationship between two memory nodes.

        Returns:
            The auto-generated link row id.
        """
        cur = self.conn.cursor()
        cur.execute("""
            INSERT INTO memory_links (source_id, target_id, link_type, strength, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (source_id, target_id, link_type, strength, datetime.now().isoformat()))
        self.conn.commit()
        return cur.lastrowid

    def get_links(self, memory_id: str) -> List[Dict[str, Any]]:
        """Get all links where this memory is either source or target."""
        cur = self.conn.cursor()
        cur.execute("""
            SELECT * FROM memory_links
            WHERE source_id = ? OR target_id = ?
        """, (memory_id, memory_id))
        return [dict(r) for r in cur.fetchall()]

    # -- Entity Queries ------------------------------------------------------

    def get_memory_by_entity(self, entity_name: str) -> List[Dict[str, Any]]:
        """
        Retrieve all memories associated with a named entity.

        The search is case-insensitive.
        """
        cur = self.conn.cursor()
        cur.execute("""
            SELECT mn.* FROM memory_nodes mn
            JOIN entities e ON e.memory_id = mn.id
            WHERE e.entity_name = ?
        """, (entity_name.lower(),))
        return [self._row_to_dict(r) for r in cur.fetchall()]

    # -- Relationship Traversal ----------------------------------------------

    def get_related_memories(self, memory_id: str,
                             max_depth: int = 1) -> List[Dict[str, Any]]:
        """
        Traverse links from a given memory, up to *max_depth* hops.

        Returns a flat list of unique related memory dicts.
        """
        visited = set()
        frontier = {memory_id}
        results: List[Dict[str, Any]] = []

        for _ in range(max_depth):
            next_frontier: set = set()
            for mid in frontier:
                if mid in visited:
                    continue
                visited.add(mid)
                links = self.get_links(mid)
                for link in links:
                    other = link["target_id"] if link["source_id"] == mid else link["source_id"]
                    if other not in visited:
                        next_frontier.add(other)
                        mem = self.get_memory(other)
                        if mem:
                            results.append(mem)
            frontier = next_frontier
        return results

    # -- Search & Filter -----------------------------------------------------

    def search_memories(self, filters: Optional[Dict[str, Any]] = None,
                        limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """
        Search memory nodes with optional filters.

        Supported filters:
            type:   Filter by memory type.
            status: Filter by status ('active', 'archived').
            min_importance: Minimum importance score.
            keyword: Substring search in content.
            tags: List of tags (any match).
        """
        clauses = []
        params: list = []
        if filters:
            if "type" in filters:
                clauses.append("type = ?")
                params.append(filters["type"])
            if "status" in filters:
                clauses.append("status = ?")
                params.append(filters["status"])
            if "min_importance" in filters:
                clauses.append("importance_score >= ?")
                params.append(filters["min_importance"])
            if "keyword" in filters:
                clauses.append("content LIKE ?")
                params.append(f"%{filters['keyword']}%")

        where = ""
        if clauses:
            where = "WHERE " + " AND ".join(clauses)

        query = f"SELECT * FROM memory_nodes {where} ORDER BY updated_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        cur = self.conn.cursor()
        cur.execute(query, params)
        return [self._row_to_dict(r) for r in cur.fetchall()]

    def count_memories(self, filters: Optional[Dict[str, Any]] = None) -> int:
        """Count memories matching optional filters."""
        clauses = []
        params: list = []
        if filters:
            if "type" in filters:
                clauses.append("type = ?")
                params.append(filters["type"])
            if "status" in filters:
                clauses.append("status = ?")
                params.append(filters["status"])
        where = ""
        if clauses:
            where = "WHERE " + " AND ".join(clauses)
        cur = self.conn.cursor()
        cur.execute(f"SELECT COUNT(*) FROM memory_nodes {where}", params)
        return cur.fetchone()[0]

    # -- Helpers -------------------------------------------------------------

    def _row_to_dict(self, row: sqlite3.Row) -> Dict[str, Any]:
        """Convert a SQLite Row to a hydrated dictionary."""
        d = dict(row)
        d["metadata"] = json.loads(d.pop("metadata_json", "{}"))
        d["tags"] = json.loads(d.pop("tags_json", "[]"))
        d["related_ids"] = json.loads(d.pop("related_ids_json", "[]"))
        return d

    def close(self):
        """Close the database connection."""
        self.conn.close()

    def __del__(self):
        try:
            self.conn.close()
        except Exception:
            pass
