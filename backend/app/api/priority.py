from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.entities import Loan, User
from app.api.deps import get_current_user
from app.services.priority_scoring import calculate_priority_score


router = APIRouter(
    prefix="/api/v1/loans",
    tags=["AI Loan Prioritisation"]
)


@router.get("/priority")
def get_loan_priorities(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Get loans visible to the logged-in user.
    query = db.query(Loan)

    # Field officers can see only their assigned loans.
    if current_user.role == "field_officer":
        query = query.filter(
            Loan.assigned_officer_id == current_user.id
        )

    loans = query.all()

    results = []

    for loan in loans:
        priority = calculate_priority_score(loan, db)

        # Save calculated score and reasons.
        loan.priority_score = priority["priority_score"]
        loan.priority_reasons = " | ".join(
            priority["priority_reasons"]
        )

        results.append({
            **priority,
            "borrower_name": loan.borrower_name,
            "outstanding_amount": loan.outstanding_amount,
            "dpd": loan.dpd,
            "assigned_officer_id": loan.assigned_officer_id
        })

    db.commit()

    # Rank loans using multiple criteria:
    # 1. Highest AI score
    # 2. Highest days past due
    # 3. Highest outstanding amount
    # 4. Loan ID for deterministic final ordering
    results.sort(
        key=lambda item: (
            item["priority_score"] or 0,
            item["dpd"] or 0,
            item["outstanding_amount"] or 0,
            item["loan_id"]
        ),
        reverse=True
    )

    return {
        "total_loans": len(results),
        "message": "Loan priority scores calculated successfully.",
        "loans": results
    }