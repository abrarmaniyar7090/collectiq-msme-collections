import csv
import io

from datetime import datetime

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
)
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.entities import Loan, User
from app.api.deps import require_role
from app.services.assignment import assign_loan


router = APIRouter(
    prefix="/api/v1/loans",
    tags=["Loan Management"]
)


REQUIRED_COLUMNS = {
    "loan_id",
    "borrower_name",
    "business_type",
    "phone_number",
    "pincode",
    "outstanding_amount",
    "dpd",
    "due_date",
    "promise_date",
}


def parse_date(value):
    if not value or not value.strip():
        return None

    return datetime.strptime(value.strip(), "%Y-%m-%d")


@router.post("/import-csv")
async def import_loans_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("branch_manager")),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a CSV file."
        )

    content = await file.read()

    if not content:
        raise HTTPException(
            status_code=400,
            detail="The uploaded CSV file is empty."
        )

    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="CSV file cannot exceed 5 MB."
        )

    try:
        text = content.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400,
            detail="CSV must use UTF-8 encoding."
        )

    if not reader.fieldnames:
        raise HTTPException(
            status_code=400,
            detail="CSV headers are missing."
        )

    headers = {header.strip() for header in reader.fieldnames if header}

    missing_columns = REQUIRED_COLUMNS - headers

    if missing_columns:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Required CSV columns are missing.",
                "missing_columns": sorted(missing_columns),
            }
        )

    imported = 0
    skipped = 0
    failed = 0

    errors = []
    imported_loans = []

    for row_number, original_row in enumerate(reader, start=2):

        try:
            row = {
                key.strip(): (value or "").strip()
                for key, value in original_row.items()
                if key
            }

            loan_id = row["loan_id"]

            if not loan_id:
                raise ValueError("Loan ID is required.")

            existing_loan = (
                db.query(Loan)
                .filter(Loan.loan_id == loan_id)
                .first()
            )

            if existing_loan:
                skipped += 1
                continue

            amount = float(row["outstanding_amount"])
            dpd = int(row["dpd"])

            if amount <= 0:
                raise ValueError("Outstanding amount must be positive.")

            if dpd < 0:
                raise ValueError("DPD cannot be negative.")

            if not row["borrower_name"]:
                raise ValueError("Borrower name is required.")

            if not row["pincode"].isdigit() or len(row["pincode"]) != 6:
                raise ValueError("Pincode must contain exactly 6 digits.")

            due_date = parse_date(row["due_date"])
            promise_date = parse_date(row["promise_date"])

            officer = assign_loan(
                db=db,
                pincode=row["pincode"],
                branch=current_user.branch,
            )

            loan = Loan(
                loan_id=loan_id,
                borrower_name=row["borrower_name"],
                business_type=row["business_type"],
                phone_number=row["phone_number"],
                pincode=row["pincode"],
                outstanding_amount=amount,
                dpd=dpd,
                due_date=due_date,
                promise_date=promise_date,
                status="overdue",
                priority_score=0,
                priority_reasons="Priority scoring pending.",
                assigned_officer_id=officer.id if officer else None,
            )

            db.add(loan)
            db.flush()

            imported += 1

            imported_loans.append({
                "loan_id": loan.loan_id,
                "borrower_name": loan.borrower_name,
                "assigned_officer": (
                    officer.full_name if officer else None
                ),
            })

        except (ValueError, KeyError, TypeError) as error:
            failed += 1
            errors.append({
                "row": row_number,
                "error": str(error),
            })

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="CSV import failed while saving records."
        )

    return {
        "message": "CSV import completed.",
        "summary": {
            "total_processed": imported + skipped + failed,
            "imported": imported,
            "skipped_duplicates": skipped,
            "failed": failed,
        },
        "imported_loans": imported_loans,
        "errors": errors,
    }