# CollectIQ

**AI-assisted field collections management for MSME lending teams.**

CollectIQ is a web application prototype for organising overdue loan follow-ups. Field officers can review assigned accounts, record calls and visits, track promises to pay, and work with a local offline activity queue. Branch managers can review branch activity, monitor promises, and import loan records.

This project is a demonstration prototype. It uses sample data and a local SQLite database; it is not connected to a lender’s production systems.

## Run locally

### Prerequisites

- Python 3.10 or later
- Node.js 20.19+ or 22.12+
- npm and Git

### 1. Clone the repository

~~~powershell
git clone https://github.com/abrarmaniyar7090/collectiq-msme-collections.git
cd collectiq-msme-collections
~~~

### 2. Start the backend

~~~powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python create_demo_users.py
python -m uvicorn app.main:app --reload
~~~

The API is at http://127.0.0.1:8000. Its interactive documentation is at http://127.0.0.1:8000/docs.

### 3. Start the frontend

In a second terminal, from the repository root:

~~~powershell
cd frontend
npm install
npm run dev -- --port 5174
~~~

Open http://localhost:5174. If port 5174 is busy, run the frontend on port 5173 instead.

### 4. Load the sample loans

Sign in to Swagger UI as the branch manager, then upload backend/sample_loans.csv using POST /api/v1/loans/import-csv. The sample file contains five demonstration records. See the [local deployment guide](deployment.md) for the full import walkthrough.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Field Officer | officer@collectiq.demo | Officer@123 |
| Branch Manager | manager@collectiq.demo | Manager@123 |

These accounts are for local evaluation only. Do not reuse the demo passwords in a shared or production environment.

## What’s included

- Field officer loan lists with explainable, rule-based priority scores.
- Collection call and visit records with outcomes, notes, and optional browser location.
- A browser Local Storage queue for activity submitted while offline, with sync when connectivity returns.
- Branch dashboards, officer activity views, promise-to-pay tracking, and CSV loan import.
- English and Hindi reminder drafts with safety checks and an approval workflow.

The priority score is an advisory signal, not a recovery prediction or an automated decision. Reminder delivery is simulated; the app does not send real SMS or WhatsApp messages. Customer contact is limited to 8:00 AM–7:00 PM IST.

## Technology

| Area | Stack |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend | Python, FastAPI |
| Data | SQLAlchemy and SQLite |
| Authentication | JWT |
| API docs | OpenAPI / Swagger UI |

## Run checks

From the repository root:

~~~powershell
python -m pytest backend/app/tests/test_api.py -v
cd frontend
npm run build
npm run lint
~~~

## Documentation

- [Local deployment guide](deployment.md) — setup, demo accounts, and sample data.
- [Technical design document](TDD.md) — architecture, workflows, and design decisions.
- [Frontend notes](frontend/README.md) — frontend setup and scripts.

## Current limitations

CollectIQ is not a production collections platform. It has no live loan-system or messaging-provider integration, uses a local SQLite database and demonstration records, and does not implement advanced multi-device offline conflict resolution or historical roll-rate analysis. Production use would require deployment hardening, managed secrets, operational monitoring, and a security and compliance review.
