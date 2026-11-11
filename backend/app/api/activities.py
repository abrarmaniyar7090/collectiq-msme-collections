from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user

from app.models.entities import (
    User,
    Loan,
    CollectionActivity,
    PromiseToPay
)

from app.schemas.activity import (
    ActivityCreate,
    ActivityResponse
)


router = APIRouter(
    prefix="/api/v1/loans",
    tags=["Collection Activities"]
)

INDIA_TZ = ZoneInfo("Asia/Kolkata")


# --------------------------------------------------
# CREATE COLLECTION ACTIVITY
# --------------------------------------------------

@router.post("/{loan_id}/activities")
def create_collection_activity(
    loan_id: int,
    activity_data: ActivityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    # Only field officers can record activities.
    if current_user.role != "field_officer":
        raise HTTPException(
            status_code=403,
            detail="Only field officers can record collection activities."
        )

    # Find loan.
    loan = db.query(Loan).filter(
        Loan.id == loan_id
    ).first()

    if not loan:
        raise HTTPException(
            status_code=404,
            detail="Loan not found."
        )

    # Verify loan assignment.
    if loan.assigned_officer_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="This loan is not assigned to you."
        )

    # Prevent duplicate offline submissions.
    existing_activity = db.query(CollectionActivity).filter(
        CollectionActivity.client_event_id
        == activity_data.client_event_id
    ).first()

    if existing_activity:
        return {
            "message": "Activity was already recorded.",
            "duplicate": True,
            "activity_id": existing_activity.id
        }

    # Check permitted contact hours (8 AM–7 PM IST).
    now_ist = datetime.now(INDIA_TZ)

    blocked_contact = (
        activity_data.activity_type == "call"
        and not (
            time(8, 0)
            <= now_ist.time().replace(tzinfo=None)
            <= time(19, 0)
        )
    )

    outcome = activity_data.outcome

    if blocked_contact:
        outcome = "contact_blocked"

    # Validate Promise-to-Pay details.
    if outcome == "promise":

        if activity_data.promised_amount is None:
            raise HTTPException(
                status_code=422,
                detail="Promised amount is required."
            )

        if activity_data.promised_date is None:
            raise HTTPException(
                status_code=422,
                detail="Promised payment date is required."
            )

        if activity_data.promised_amount <= 0:
            raise HTTPException(
                status_code=422,
                detail="Promised amount must be greater than zero."
            )

    # Activity timestamp.
    occurred_at = (
        activity_data.occurred_at
        or datetime.now(timezone.utc)
    )

    # Create activity record.
    activity = CollectionActivity(
        client_event_id=activity_data.client_event_id,
        loan_id=loan.id,
        officer_id=current_user.id,
        activity_type=activity_data.activity_type,
        outcome=outcome,
        notes=activity_data.notes,
        latitude=activity_data.latitude,
        longitude=activity_data.longitude,
        occurred_at=occurred_at,
        synced=True
    )

    db.add(activity)

    # Create Promise-to-Pay record.
    if outcome == "promise":

        promise = PromiseToPay(
            loan_id=loan.id,
            promised_amount=activity_data.promised_amount,
            promised_date=activity_data.promised_date,
            status="pending",
            reminder_sent=False
        )

        db.add(promise)

        # Update loan-level promise date.
        loan.promise_date = datetime.combine(
            activity_data.promised_date,
            time.min
        )

    # Save database changes.
    db.commit()
    db.refresh(activity)

    # Response for blocked calls.
    if blocked_contact:
        return {
            "message": (
                "Call blocked because contact is permitted "
                "only between 8 AM and 7 PM IST. "
                "The attempt has been logged."
            ),
            "blocked": True,
            "activity_id": activity.id,
            "outcome": activity.outcome
        }

    return {
        "message": "Collection activity recorded successfully.",
        "duplicate": False,
        "activity_id": activity.id,
        "loan_id": loan.loan_id,
        "outcome": activity.outcome
    }


# --------------------------------------------------
# GET COLLECTION ACTIVITY HISTORY
# --------------------------------------------------

@router.get(
    "/{loan_id}/activities",
    response_model=list[ActivityResponse]
)
def get_loan_activities(
    loan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    # Find loan.
    loan = db.query(Loan).filter(
        Loan.id == loan_id
    ).first()

    if not loan:
        raise HTTPException(
            status_code=404,
            detail="Loan not found."
        )

    # Verify user role.
    if current_user.role not in {
        "field_officer",
        "branch_manager"
    }:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission."
        )

    # Field officers can only view their assigned loans.
    if (
        current_user.role == "field_officer"
        and loan.assigned_officer_id != current_user.id
    ):
        raise HTTPException(
            status_code=403,
            detail="You cannot view activities for this loan."
        )

    # Retrieve activity history.
    activities = db.query(CollectionActivity).filter(
        CollectionActivity.loan_id == loan_id
    ).order_by(
        CollectionActivity.occurred_at.desc()
    ).all()

    return activities