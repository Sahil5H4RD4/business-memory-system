"""
Core Memory Models for Business Memory System.

Defines the fundamental data structures for representing business memories:
MemoryNode (base), Supplier, Invoice, Issue, Customer, and EventMemory.
Each model includes ID, type, timestamps, relationships, confidence scoring,
and lifecycle status tracking.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional
import uuid
import json


# ---------------------------------------------------------------------------
# Base Memory Node
# ---------------------------------------------------------------------------

@dataclass
class MemoryNode:
    """
    Base class for all memory entries in the system.

    Every piece of stored knowledge — whether it's a supplier profile, an
    invoice record, or an event log — is represented as a MemoryNode.

    Attributes:
        id:               Unique identifier (auto-generated UUID if not given).
        type:             Memory type label (e.g. 'supplier', 'invoice').
        created_at:       Timestamp when the memory was first created.
        updated_at:       Timestamp of the most recent update.
        related_ids:      List of IDs this memory is linked to.
        importance_score: How important (0.0–1.0) this memory is.
        confidence:       Confidence in the data accuracy (0.0–1.0).
        status:           Lifecycle status — 'active' or 'archived'.
        metadata:         Arbitrary key-value metadata.
        tags:             Searchable keyword tags.
    """

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    type: str = "generic"
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    related_ids: List[str] = field(default_factory=list)
    importance_score: float = 0.5
    confidence: float = 1.0
    status: str = "active"
    metadata: Dict[str, Any] = field(default_factory=dict)
    tags: List[str] = field(default_factory=list)

    # -- Serialization -------------------------------------------------------

    def to_dict(self) -> Dict[str, Any]:
        """Serialize the node to a plain dictionary."""
        return {
            "id": self.id,
            "type": self.type,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "related_ids": self.related_ids,
            "importance_score": self.importance_score,
            "confidence": self.confidence,
            "status": self.status,
            "metadata": self.metadata,
            "tags": self.tags,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "MemoryNode":
        """Reconstruct a MemoryNode from a dictionary."""
        return cls(
            id=data.get("id", str(uuid.uuid4())),
            type=data.get("type", "generic"),
            created_at=datetime.fromisoformat(data["created_at"]) if "created_at" in data else datetime.now(),
            updated_at=datetime.fromisoformat(data["updated_at"]) if "updated_at" in data else datetime.now(),
            related_ids=data.get("related_ids", []),
            importance_score=data.get("importance_score", 0.5),
            confidence=data.get("confidence", 1.0),
            status=data.get("status", "active"),
            metadata=data.get("metadata", {}),
            tags=data.get("tags", []),
        )

    def to_json(self) -> str:
        """Serialize to a JSON string."""
        return json.dumps(self.to_dict(), indent=2)

    def __repr__(self) -> str:
        return (
            f"MemoryNode(id={self.id!r}, type={self.type!r}, "
            f"importance={self.importance_score}, status={self.status!r})"
        )


# ---------------------------------------------------------------------------
# Domain-Specific Memory Types
# ---------------------------------------------------------------------------

@dataclass
class Supplier(MemoryNode):
    """
    Represents a supplier profile in business memory.

    Attributes:
        name:              Supplier company name.
        category:          Product/service category.
        reliability_rating: Historical reliability (0.0–1.0).
        contact_info:      Contact details dict.
        performance_history: List of past performance notes.
    """

    name: str = ""
    category: str = ""
    reliability_rating: float = 0.5
    contact_info: Dict[str, str] = field(default_factory=dict)
    performance_history: List[str] = field(default_factory=list)

    def __post_init__(self):
        self.type = "supplier"

    def to_dict(self) -> Dict[str, Any]:
        base = super().to_dict()
        base.update({
            "name": self.name,
            "category": self.category,
            "reliability_rating": self.reliability_rating,
            "contact_info": self.contact_info,
            "performance_history": self.performance_history,
        })
        return base

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Supplier":
        node = MemoryNode.from_dict(data)
        return cls(
            **{k: v for k, v in node.__dict__.items()},
            name=data.get("name", ""),
            category=data.get("category", ""),
            reliability_rating=data.get("reliability_rating", 0.5),
            contact_info=data.get("contact_info", {}),
            performance_history=data.get("performance_history", []),
        )


@dataclass
class Invoice(MemoryNode):
    """
    Represents an invoice record.

    Attributes:
        invoice_number: Unique invoice identifier.
        amount:         Total invoice amount.
        supplier_id:    ID of the related supplier.
        due_date:       Payment due date.
        payment_status: 'pending', 'paid', 'overdue', 'disputed'.
        line_items:     Breakdown of invoice items.
    """

    invoice_number: str = ""
    amount: float = 0.0
    supplier_id: str = ""
    due_date: Optional[datetime] = None
    payment_status: str = "pending"
    line_items: List[Dict[str, Any]] = field(default_factory=list)

    def __post_init__(self):
        self.type = "invoice"

    def to_dict(self) -> Dict[str, Any]:
        base = super().to_dict()
        base.update({
            "invoice_number": self.invoice_number,
            "amount": self.amount,
            "supplier_id": self.supplier_id,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "payment_status": self.payment_status,
            "line_items": self.line_items,
        })
        return base

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Invoice":
        node = MemoryNode.from_dict(data)
        due = data.get("due_date")
        return cls(
            **{k: v for k, v in node.__dict__.items()},
            invoice_number=data.get("invoice_number", ""),
            amount=data.get("amount", 0.0),
            supplier_id=data.get("supplier_id", ""),
            due_date=datetime.fromisoformat(due) if due else None,
            payment_status=data.get("payment_status", "pending"),
            line_items=data.get("line_items", []),
        )


@dataclass
class Issue(MemoryNode):
    """
    Represents a quality or delivery issue.

    Attributes:
        title:             Short issue title.
        description:       Detailed description.
        severity:          'low', 'medium', 'high', 'critical'.
        resolution_status: 'open', 'investigating', 'resolved', 'closed'.
        supplier_id:       Related supplier ID.
        resolution_notes:  Notes on how the issue was resolved.
    """

    title: str = ""
    description: str = ""
    severity: str = "medium"
    resolution_status: str = "open"
    supplier_id: str = ""
    resolution_notes: str = ""

    def __post_init__(self):
        self.type = "issue"

    def to_dict(self) -> Dict[str, Any]:
        base = super().to_dict()
        base.update({
            "title": self.title,
            "description": self.description,
            "severity": self.severity,
            "resolution_status": self.resolution_status,
            "supplier_id": self.supplier_id,
            "resolution_notes": self.resolution_notes,
        })
        return base

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Issue":
        node = MemoryNode.from_dict(data)
        return cls(
            **{k: v for k, v in node.__dict__.items()},
            title=data.get("title", ""),
            description=data.get("description", ""),
            severity=data.get("severity", "medium"),
            resolution_status=data.get("resolution_status", "open"),
            supplier_id=data.get("supplier_id", ""),
            resolution_notes=data.get("resolution_notes", ""),
        )


@dataclass
class Customer(MemoryNode):
    """
    Represents a customer profile.

    Attributes:
        name:               Customer name.
        tier:               'bronze', 'silver', 'gold', 'platinum'.
        lifetime_value:     Total revenue from this customer.
        satisfaction_score: Satisfaction rating (0.0–1.0).
        interaction_count:  Number of past interactions.
        notes:              Free-form notes.
    """

    name: str = ""
    tier: str = "bronze"
    lifetime_value: float = 0.0
    satisfaction_score: float = 0.5
    interaction_count: int = 0
    notes: str = ""

    def __post_init__(self):
        self.type = "customer"

    def to_dict(self) -> Dict[str, Any]:
        base = super().to_dict()
        base.update({
            "name": self.name,
            "tier": self.tier,
            "lifetime_value": self.lifetime_value,
            "satisfaction_score": self.satisfaction_score,
            "interaction_count": self.interaction_count,
            "notes": self.notes,
        })
        return base

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Customer":
        node = MemoryNode.from_dict(data)
        return cls(
            **{k: v for k, v in node.__dict__.items()},
            name=data.get("name", ""),
            tier=data.get("tier", "bronze"),
            lifetime_value=data.get("lifetime_value", 0.0),
            satisfaction_score=data.get("satisfaction_score", 0.5),
            interaction_count=data.get("interaction_count", 0),
            notes=data.get("notes", ""),
        )


@dataclass
class EventMemory(MemoryNode):
    """
    Represents an event or interaction that occurred in the business.

    Attributes:
        event_type:     Category of event ('payment', 'complaint', 'delivery', etc.).
        source_entity:  ID of the entity that triggered the event.
        target_entity:  ID of the entity affected by the event.
        description:    Human-readable event description.
        impact_score:   How impactful the event was (0.0–1.0).
        resolved:       Whether the event has been resolved.
    """

    event_type: str = ""
    source_entity: str = ""
    target_entity: str = ""
    description: str = ""
    impact_score: float = 0.5
    resolved: bool = False

    def __post_init__(self):
        self.type = "event"

    def to_dict(self) -> Dict[str, Any]:
        base = super().to_dict()
        base.update({
            "event_type": self.event_type,
            "source_entity": self.source_entity,
            "target_entity": self.target_entity,
            "description": self.description,
            "impact_score": self.impact_score,
            "resolved": self.resolved,
        })
        return base

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "EventMemory":
        node = MemoryNode.from_dict(data)
        return cls(
            **{k: v for k, v in node.__dict__.items()},
            event_type=data.get("event_type", ""),
            source_entity=data.get("source_entity", ""),
            target_entity=data.get("target_entity", ""),
            description=data.get("description", ""),
            impact_score=data.get("impact_score", 0.5),
            resolved=data.get("resolved", False),
        )
