from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.entities import User, Loan


# Demo pincode-to-officer mapping.
# Update these mappings when additional officers are added.
PINCODE_OFFICER_MAP = {
    "452001": "officer@collectiq.demo",
    "452010": "officer@collectiq.demo",
    "452016": "officer@collectiq.demo",
}


def get_officer_workload(db: Session, officer_id: int) -> int:
    return (
        db.query(func.count(Loan.id))
        .filter(Loan.assigned_officer_id == officer_id)
        .scalar()
        or 0
    )


def assign_loan(db: Session, pincode: str, branch: str):
    officers = (
        db.query(User)
        .filter(
            User.role == "field_officer",
            User.is_active == True,
            User.branch == branch,
        )
        .all()
    )

    if not officers:
        return None

    # First preference: configured pincode mapping.
    mapped_email = PINCODE_OFFICER_MAP.get(str(pincode))

    if mapped_email:
        for officer in officers:
            if officer.email == mapped_email:
                return officer

    # Fallback: officer with the lowest current workload.
    return min(
        officers,
        key=lambda officer: get_officer_workload(db, officer.id)
    )