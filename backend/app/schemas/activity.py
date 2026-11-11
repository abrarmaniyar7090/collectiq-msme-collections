from datetime import datetime, date
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class ActivityCreate(BaseModel):
    client_event_id: str = Field(
        min_length=1,
        max_length=100
    )

    activity_type: Literal["call", "visit"]

    outcome: Literal[
        "paid",
        "promise",
        "not_reachable",
        "dispute"
    ]

    notes: Optional[str] = Field(
        default=None,
        max_length=1000
    )

    latitude: Optional[float] = Field(
        default=None,
        ge=-90,
        le=90
    )

    longitude: Optional[float] = Field(
        default=None,
        ge=-180,
        le=180
    )

    occurred_at: Optional[datetime] = None

    # Required when outcome is "promise"
    promised_amount: Optional[float] = Field(
        default=None,
        gt=0
    )

    promised_date: Optional[date] = None


class ActivityResponse(BaseModel):
    id: int
    client_event_id: str
    loan_id: int
    officer_id: int
    activity_type: str
    outcome: str
    notes: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    occurred_at: datetime

    model_config = ConfigDict(from_attributes=True)