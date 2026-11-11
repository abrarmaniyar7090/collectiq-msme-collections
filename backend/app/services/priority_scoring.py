from datetime import date

from app.models.entities import Loan, PromiseToPay


def calculate_priority_score(loan: Loan, db) -> dict:
    """
    Calculate an explainable loan priority score.

    Maximum score: 100

    Factors:
    - Days past due: 40 points
    - Outstanding amount: 25 points
    - Broken payment promises: 25 points
    - Missing future payment commitment: 10 points
    """

    score = 0
    reasons = []

    # --------------------------------
    # 1. Days Past Due (Maximum 40)
    # --------------------------------

    dpd = loan.dpd or 0

    if dpd >= 30:
        dpd_score = 40
    elif dpd >= 20:
        dpd_score = 30
    elif dpd >= 10:
        dpd_score = 20
    elif dpd > 0:
        dpd_score = 10
    else:
        dpd_score = 0

    score += dpd_score

    if dpd >= 20:
        reasons.append(f"Loan is seriously overdue by {dpd} days.")
    elif dpd > 0:
        reasons.append(f"Loan is overdue by {dpd} days.")

    # --------------------------------
    # 2. Outstanding Amount (Maximum 25)
    # --------------------------------

    amount = loan.outstanding_amount or 0

    if amount >= 500000:
        amount_score = 25
    elif amount >= 300000:
        amount_score = 20
    elif amount >= 100000:
        amount_score = 15
    elif amount > 0:
        amount_score = 10
    else:
        amount_score = 0

    score += amount_score

    if amount >= 300000:
        reasons.append(
            f"High outstanding amount of ₹{amount:,.0f}."
        )
    elif amount > 0:
        reasons.append(
            f"Outstanding amount: ₹{amount:,.0f}."
        )

    # --------------------------------
    # 3. Broken Payment Promises (Maximum 25)
    # --------------------------------

    promises = (
        db.query(PromiseToPay)
        .filter(PromiseToPay.loan_id == loan.id)
        .all()
    )

    broken_promises = sum(
        1 for promise in promises
        if promise.status and promise.status.lower() in {
            "broken",
            "missed",
            "failed",
        }
    )

    # Also consider an expired loan-level promise date.
    if loan.promise_date and loan.promise_date.date() < date.today():
        broken_promises = max(broken_promises, 1)

    promise_score = min(broken_promises * 15, 25)

    score += promise_score

    if broken_promises:
        reasons.append(
            f"{broken_promises} broken payment promise(s) recorded."
        )

    # --------------------------------
    # 4. Missing Payment Commitment (Maximum 10)
    # --------------------------------

    if not loan.promise_date:
        score += 10
        reasons.append("No payment promise date is recorded.")

    # --------------------------------
    # Final Score and Priority Category
    # --------------------------------

    score = min(score, 100)

    if score >= 70:
        category = "High"
    elif score >= 40:
        category = "Medium"
    else:
        category = "Low"

    # Ensure the response contains up to three reasons.
    if not reasons:
        reasons.append("No major collection risk indicators detected.")

    return {
        "loan_id": loan.loan_id,
        "priority_score": score,
        "priority_category": category,
        "priority_reasons": reasons[:3],
    }