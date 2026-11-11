from datetime import date, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.entities import PromiseToPay, Loan, User


router = APIRouter(
    prefix="/api/v1/promises",
    tags=["Promise Tracker"]
)


class PromiseStatusUpdate(BaseModel):
    status: Literal["fulfilled", "broken"]


def get_promise_status(promise):
    """
    Calculate the display status of a payment promise.
    A pending promise with a past date is displayed as overdue.
    """

    status = (promise.status or "pending").lower()

    if status != "pending":
        return status

    promised_date = promise.promised_date

    if isinstance(promised_date, datetime):
        promised_date = promised_date.date()

    if promised_date and promised_date < date.today():
        return "overdue"

    return "pending"


def get_accessible_promises(db: Session, current_user: User):
    """
    Field officers see promises for their assigned loans.
    Branch managers see promises for loans in their branch.
    """

    if current_user.role not in ["field_officer", "branch_manager"]:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to view promises."
        )

    query = (
        db.query(PromiseToPay, Loan, User)
        .join(Loan, PromiseToPay.loan_id == Loan.id)
        .join(User, Loan.assigned_officer_id == User.id)
    )

    if current_user.role == "field_officer":
        query = query.filter(
            Loan.assigned_officer_id == current_user.id
        )

    elif current_user.role == "branch_manager":
        query = query.filter(
            User.branch == current_user.branch
        )

    return query.all()


@router.get("")
def get_all_promises(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    records = get_accessible_promises(db, current_user)

    promises = []

    for promise, loan, officer in records:
        promises.append({
            "promise_id": promise.id,
            "loan_id": loan.loan_id,
            "borrower_name": loan.borrower_name,
            "promised_amount": promise.promised_amount,
            "promised_date": (
                promise.promised_date.isoformat()
                if promise.promised_date else None
            ),
            "status": get_promise_status(promise),
            "original_status": promise.status,
            "reminder_sent": promise.reminder_sent,
            "officer_name": officer.full_name,
            "outstanding_amount": loan.outstanding_amount,
            "dpd": loan.dpd,
            "created_at": (
                promise.created_at.isoformat()
                if promise.created_at else None
            )
        })

    promises.sort(
        key=lambda item: item["promised_date"] or "9999-12-31"
    )

    return {
        "total_promises": len(promises),
        "promises": promises
    }


@router.get("/summary")
def get_promise_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    records = get_accessible_promises(db, current_user)

    summary = {
        "total_promises": len(records),
        "pending": 0,
        "overdue": 0,
        "fulfilled": 0,
        "broken": 0
    }

    for promise, loan, officer in records:
        status = get_promise_status(promise)

        if status in summary:
            summary[status] += 1

    return {
        "message": "Promise summary calculated successfully.",
        "summary": summary
    }


@router.patch("/{promise_id}/status")
def update_promise_status(
    promise_id: int,
    status_data: PromiseStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a payment promise to fulfilled or broken.
    Users can only update promises they are authorised to access.
    """

    records = get_accessible_promises(db, current_user)

    selected_record = next(
        (
            record for record in records
            if record[0].id == promise_id
        ),
        None
    )

    if not selected_record:
        raise HTTPException(
            status_code=404,
            detail="Promise not found or you do not have access."
        )

    promise, loan, officer = selected_record

    current_status = (promise.status or "pending").lower()

    if current_status in ["fulfilled", "broken"]:
        raise HTTPException(
            status_code=409,
            detail=f"This promise is already marked as {current_status}."
        )

    promise.status = status_data.status

    db.commit()
    db.refresh(promise)

    return {
        "message": "Promise status updated successfully.",
        "promise_id": promise.id,
        "loan_id": loan.loan_id,
        "borrower_name": loan.borrower_name,
        "previous_status": current_status,
        "updated_status": promise.status
    }