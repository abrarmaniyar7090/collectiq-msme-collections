from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.entities import (
    Loan,
    User,
    PromiseToPay,
    CollectionActivity,
)


router = APIRouter(
    prefix="/api/v1/dashboard",
    tags=["Manager Dashboard"]
)


def verify_branch_manager(current_user: User):
    """Allow access only to branch managers."""

    if current_user.role != "branch_manager":
        raise HTTPException(
            status_code=403,
            detail="Only branch managers can access this dashboard."
        )


# ---------------------------------------------------------
# 1. MANAGER DASHBOARD
# ---------------------------------------------------------

@router.get("/manager")
def get_manager_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Manager dashboard showing loan, collection and promise statistics.
    """

    verify_branch_manager(current_user)

    # Get loans assigned to officers in the manager's branch
    loans = (
        db.query(Loan)
        .join(User, Loan.assigned_officer_id == User.id)
        .filter(User.branch == current_user.branch)
        .all()
    )

    loan_ids = [loan.id for loan in loans]

    # Loan statistics
    total_loans = len(loans)

    total_outstanding = sum(
        loan.outstanding_amount or 0
        for loan in loans
    )

    dpd_distribution = {
        "current": 0,
        "1_30_dpd": 0,
        "31_60_dpd": 0,
        "61_plus_dpd": 0
    }

    for loan in loans:
        dpd = loan.dpd or 0

        if dpd <= 0:
            dpd_distribution["current"] += 1
        elif dpd <= 30:
            dpd_distribution["1_30_dpd"] += 1
        elif dpd <= 60:
            dpd_distribution["31_60_dpd"] += 1
        else:
            dpd_distribution["61_plus_dpd"] += 1

    # Promise statistics
    promises = (
        db.query(PromiseToPay)
        .filter(PromiseToPay.loan_id.in_(loan_ids))
        .all()
        if loan_ids else []
    )

    promise_summary = {
        "total": len(promises),
        "pending": 0,
        "overdue": 0,
        "fulfilled": 0,
        "broken": 0
    }

    for promise in promises:
        status = (promise.status or "pending").lower()

        promised_date = promise.promised_date

        if isinstance(promised_date, datetime):
            promised_date = promised_date.date()

        if (
            status == "pending"
            and promised_date
            and promised_date < date.today()
        ):
            status = "overdue"

        if status in promise_summary:
            promise_summary[status] += 1

    # Collection activity statistics
    activities = (
        db.query(CollectionActivity)
        .filter(CollectionActivity.loan_id.in_(loan_ids))
        .all()
        if loan_ids else []
    )

    activity_summary = {
        "total": len(activities),
        "paid": 0,
        "promise": 0,
        "not_reachable": 0,
        "dispute": 0,
        "contact_blocked": 0,
        "other": 0
    }

    for activity in activities:
        outcome = (activity.outcome or "").lower()

        if outcome in activity_summary:
            activity_summary[outcome] += 1
        else:
            activity_summary["other"] += 1

    # Roll-rate tracking
    roll_rate_tracking = {
        "current_1_30_dpd_loans": dpd_distribution["1_30_dpd"],
        "current_31_60_dpd_loans": dpd_distribution["31_60_dpd"],
        "historical_roll_rate_available": False,
        "baseline_roll_rate_percent": 22,
        "target_roll_rate_percent": 16,
        "note": (
            "Actual roll rate requires monthly DPD cohort snapshots. "
            "Current DPD distribution is not a historical roll-rate calculation."
        )
    }

    return {
        "message": "Manager dashboard loaded successfully.",
        "branch": current_user.branch,

        "loan_overview": {
            "total_loans": total_loans,
            "total_outstanding_amount": round(total_outstanding, 2),
            "dpd_distribution": dpd_distribution
        },

        "promise_overview": promise_summary,

        "collection_activity_overview": activity_summary,

        "roll_rate_tracking": roll_rate_tracking
    }


# ---------------------------------------------------------
# 2. FIELD OFFICER PERFORMANCE
# ---------------------------------------------------------

@router.get("/manager/officer-performance")
def get_officer_performance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Officer-wise collection performance.
    Only branch managers can access this endpoint.
    """

    verify_branch_manager(current_user)

    # Get active field officers in the manager's branch
    officers = (
        db.query(User)
        .filter(
            User.branch == current_user.branch,
            User.role == "field_officer",
            User.is_active == True
        )
        .all()
    )

    performance = []

    for officer in officers:

        # Loans assigned to this officer
        loans = (
            db.query(Loan)
            .filter(
                Loan.assigned_officer_id == officer.id
            )
            .all()
        )

        loan_ids = [loan.id for loan in loans]

        total_loans = len(loans)

        total_outstanding = sum(
            loan.outstanding_amount or 0
            for loan in loans
        )

        overdue_loans = sum(
            1 for loan in loans
            if (loan.dpd or 0) > 0
        )

        # Activities recorded by this officer
        activities = (
            db.query(CollectionActivity)
            .filter(
                CollectionActivity.officer_id == officer.id
            )
            .all()
        )

        payments_received = sum(
            1 for activity in activities
            if activity.outcome == "paid"
        )

        collection_activities = len(activities)

        # Promises associated with the officer's assigned loans
        promises = (
            db.query(PromiseToPay)
            .filter(
                PromiseToPay.loan_id.in_(loan_ids)
            )
            .all()
            if loan_ids else []
        )

        promises_obtained = len(promises)

        performance.append({
            "officer_id": officer.id,
            "officer_name": officer.full_name,
            "branch": officer.branch,
            "assigned_loans": total_loans,
            "total_outstanding_amount": round(
                total_outstanding, 2
            ),
            "overdue_loans": overdue_loans,
            "collection_activities": collection_activities,
            "payments_received": payments_received,
            "promises_obtained": promises_obtained
        })

    return {
        "message": "Officer performance loaded successfully.",
        "branch": current_user.branch,
        "total_officers": len(performance),
        "officers": performance
    }