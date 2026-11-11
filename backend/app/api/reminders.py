from datetime import datetime
from zoneinfo import ZoneInfo
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.entities import Loan, User
from app.models.reminder import Reminder


router = APIRouter(
    prefix="/api/v1/reminders",
    tags=["AI Reminder Generator"]
)

IST = ZoneInfo("Asia/Kolkata")


class ReminderRequest(BaseModel):
    loan_id: int
    language: Literal["english", "hindi"]
    template_type: Literal[
        "payment_due",
        "payment_overdue",
        "promise_reminder"
    ]


# Approved reminder templates
APPROVED_TEMPLATES = {
    "english": {
        "payment_due": (
            "Dear {borrower}, this is a friendly reminder regarding "
            "your loan payment of Rs. {amount:,.0f}, due on {date}. "
            "Please contact our collection team if you need assistance. "
            "Thank you."
        ),

        "payment_overdue": (
            "Dear {borrower}, our records indicate that your loan "
            "payment of Rs. {amount:,.0f} is overdue. "
            "Please arrange the payment at your earliest convenience. "
            "Contact our team if you need assistance."
        ),

        "promise_reminder": (
            "Dear {borrower}, this is a reminder of your payment "
            "commitment of Rs. {amount:,.0f} scheduled for {date}. "
            "Please contact our team if you have any questions. Thank you."
        )
    },

    "hindi": {
        "payment_due": (
            "नमस्ते {borrower} जी,\n\n"
            "यह आपके लोन की ₹{amount:,.0f} की किस्त के संबंध में "
            "एक विनम्र अनुस्मारक है। आपकी भुगतान की निर्धारित तारीख "
            "{date} है। कृपया समय पर भुगतान करने की व्यवस्था करें।\n\n"
            "यदि आपको किसी सहायता की आवश्यकता है, तो कृपया हमारी "
            "कलेक्शन टीम से संपर्क करें।\n\n"
            "धन्यवाद।"
        ),

        "payment_overdue": (
            "नमस्ते {borrower} जी,\n\n"
            "हमारे रिकॉर्ड के अनुसार आपके लोन की ₹{amount:,.0f} की "
            "किस्त बकाया है। कृपया जल्द से जल्द भुगतान करने की "
            "व्यवस्था करें।\n\n"
            "यदि आपको किसी सहायता की आवश्यकता है, तो कृपया हमारी "
            "कलेक्शन टीम से संपर्क करें।\n\n"
            "धन्यवाद।"
        ),

        "promise_reminder": (
            "नमस्ते {borrower} जी,\n\n"
            "यह आपको याद दिलाने के लिए एक विनम्र संदेश है कि आपने "
            "₹{amount:,.0f} का भुगतान {date} को करने का वादा किया था। "
            "कृपया निर्धारित तारीख पर भुगतान करने की व्यवस्था करें।\n\n"
            "यदि आपको किसी सहायता की आवश्यकता है, तो कृपया हमारी "
            "कलेक्शन टीम से संपर्क करें।\n\n"
            "धन्यवाद।"
        )
    }
}


# Words and phrases that must not appear in reminder messages
BLOCKED_WORDS = [
    "threaten",
    "arrest",
    "jail",
    "harass",
    "abuse",
    "धमकी",
    "धमकाना",
    "गिरफ्तार",
    "जेल",
    "परेशान करना",
    "अपमान"
]


def check_message_safety(message: str) -> bool:
    message_lower = message.lower()

    return not any(
        word.lower() in message_lower
        for word in BLOCKED_WORDS
    )


def contact_allowed_now() -> bool:
    current_time = datetime.now(IST)

    return (
        current_time.hour >= 8
        and current_time.hour < 19
    )


def check_loan_access(
    db: Session,
    loan: Loan,
    current_user: User
):
    if current_user.role == "field_officer":

        if loan.assigned_officer_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You can only access your assigned loans."
            )

    elif current_user.role == "branch_manager":

        officer = db.query(User).filter(
            User.id == loan.assigned_officer_id
        ).first()

        if not officer or officer.branch != current_user.branch:
            raise HTTPException(
                status_code=403,
                detail="Loan does not belong to your branch."
            )

    else:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission."
        )


def get_accessible_reminder(
    db: Session,
    reminder_id: int,
    current_user: User
):
    reminder = db.query(Reminder).filter(
        Reminder.id == reminder_id
    ).first()

    if not reminder:
        raise HTTPException(
            status_code=404,
            detail="Reminder not found."
        )

    loan = db.query(Loan).filter(
        Loan.id == reminder.loan_id
    ).first()

    if not loan:
        raise HTTPException(
            status_code=404,
            detail="Associated loan not found."
        )

    check_loan_access(db, loan, current_user)

    return reminder


# 1. Generate and save reminder draft
@router.post("/draft")
def generate_reminder(
    request: ReminderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    loan = db.query(Loan).filter(
        Loan.id == request.loan_id
    ).first()

    if not loan:
        raise HTTPException(
            status_code=404,
            detail="Loan not found."
        )

    check_loan_access(db, loan, current_user)

    # Select the appropriate date for the reminder
    if request.template_type == "promise_reminder":

        if not loan.promise_date:
            raise HTTPException(
                status_code=400,
                detail="No payment promise date is recorded."
            )

        selected_date = loan.promise_date

    else:
        selected_date = loan.due_date

    formatted_date = (
        selected_date.strftime("%d-%m-%Y")
        if selected_date
        else "the scheduled date"
    )

    # Select approved template
    template = APPROVED_TEMPLATES[
        request.language
    ][request.template_type]

    # Generate message
    message = template.format(
        borrower=loan.borrower_name,
        amount=loan.outstanding_amount or 0,
        date=formatted_date
    )

    # Safety validation
    if not check_message_safety(message):
        raise HTTPException(
            status_code=400,
            detail="Reminder failed the safety check."
        )

    # Save draft
    reminder = Reminder(
        loan_id=loan.id,
        created_by=current_user.id,
        language=request.language,
        template_type=request.template_type,
        message=message,
        status="draft",
        safety_check_passed=True
    )

    db.add(reminder)
    db.commit()
    db.refresh(reminder)

    return {
        "message": "Reminder draft generated successfully.",
        "reminder_id": reminder.id,
        "loan_id": loan.loan_id,
        "borrower_name": loan.borrower_name,
        "phone_number": loan.phone_number,
        "language": reminder.language,
        "draft": reminder.message,
        "safety_check": "passed",
        "status": reminder.status,
        "officer_approval_required": True,
        "contact_allowed_now": contact_allowed_now(),
        "sending_status": "not_sent"
    }


# 2. Officer approves reminder
@router.post("/{reminder_id}/approve")
def approve_reminder(
    reminder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    reminder = get_accessible_reminder(
        db,
        reminder_id,
        current_user
    )

    if reminder.status != "draft":
        raise HTTPException(
            status_code=409,
            detail="Only draft reminders can be approved."
        )

    reminder.status = "approved"
    reminder.approved_by = current_user.id
    reminder.approved_at = datetime.now(IST).replace(tzinfo=None)

    db.commit()
    db.refresh(reminder)

    return {
        "message": "Reminder approved successfully.",
        "reminder_id": reminder.id,
        "status": reminder.status,
        "approved_by": current_user.full_name,
        "approved_at": reminder.approved_at
    }


# 3. Send approved reminder through mock messaging
@router.post("/{reminder_id}/send")
def send_reminder(
    reminder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    reminder = get_accessible_reminder(
        db,
        reminder_id,
        current_user
    )

    if reminder.status != "approved":
        raise HTTPException(
            status_code=409,
            detail="Reminder must be approved before sending."
        )

    if not contact_allowed_now():
        raise HTTPException(
            status_code=403,
            detail="Messages can only be sent between 8 AM and 7 PM IST."
        )

    if not reminder.safety_check_passed:
        raise HTTPException(
            status_code=400,
            detail="Reminder failed the safety check."
        )

    loan = db.query(Loan).filter(
        Loan.id == reminder.loan_id
    ).first()

    if not loan or not loan.phone_number:
        raise HTTPException(
            status_code=400,
            detail="Borrower phone number is unavailable."
        )

    # Mock messaging service.
    # No real SMS or WhatsApp message is sent.
    reminder.status = "sent"
    reminder.sent_at = datetime.now(IST).replace(tzinfo=None)

    db.commit()
    db.refresh(reminder)

    return {
        "message": "Reminder sent successfully through mock messaging service.",
        "reminder_id": reminder.id,
        "loan_id": loan.loan_id,
        "recipient": loan.phone_number,
        "status": reminder.status,
        "sent_at": reminder.sent_at,
        "delivery_mode": "mock",
        "actual_message_sent": False
    }


# 4. View reminder history
@router.get("/history")
def get_reminder_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Reminder).join(
        Loan,
        Reminder.loan_id == Loan.id
    )

    if current_user.role == "field_officer":

        query = query.filter(
            Loan.assigned_officer_id == current_user.id
        )

    elif current_user.role == "branch_manager":

        query = query.join(
            User,
            Loan.assigned_officer_id == User.id
        ).filter(
            User.branch == current_user.branch
        )

    else:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission."
        )

    records = query.order_by(
        Reminder.created_at.desc()
    ).all()

    return {
        "total_reminders": len(records),
        "reminders": [
            {
                "reminder_id": item.id,
                "loan_id": item.loan_id,
                "language": item.language,
                "template_type": item.template_type,
                "message": item.message,
                "status": item.status,
                "created_at": item.created_at,
                "approved_at": item.approved_at,
                "sent_at": item.sent_at
            }
            for item in records
        ]
    }