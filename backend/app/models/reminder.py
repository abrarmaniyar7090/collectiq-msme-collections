from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    Boolean
)

from app.core.database import Base


class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, index=True)

    loan_id = Column(
        Integer,
        ForeignKey("loans.id"),
        nullable=False
    )

    created_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    approved_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True
    )

    language = Column(String(20), nullable=False)
    template_type = Column(String(50), nullable=False)
    message = Column(Text, nullable=False)

    status = Column(
        String(20),
        default="draft",
        nullable=False
    )

    safety_check_passed = Column(Boolean, default=True)

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    approved_at = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)