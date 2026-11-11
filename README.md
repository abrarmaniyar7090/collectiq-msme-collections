# CollectIQ

**AI-assisted field collections management for MSME lending institutions.**

CollectIQ is a web application that helps field collection teams organise overdue loan follow-ups, record customer interactions, track promises to pay and give branch managers visibility into collection activity.

The project is built as a working prototype with separate Field Officer and Branch Manager experiences.

## What it does

### Field Officer
- View loans assigned to the signed-in officer.
- Review overdue accounts and their explainable priority scores.
- Record collection calls and visits with an outcome and notes.
- Capture GPS coordinates when browser location permission is available.
- Record outcomes such as Payment Received, Promise to Pay, Not Reachable and Dispute.
- Continue recording activities during connectivity interruptions using a browser-side offline queue, then synchronise when connectivity returns.

### Branch Manager
- View branch-level collection and outstanding-loan summaries.
- Review officer activity and performance.
- Monitor promises to pay and update their status.
- Import loan records from CSV.

### AI-assisted collection support
- Calculate advisory loan-priority scores using factors including days past due (DPD), outstanding amount and promise history.
- Generate English and Hindi reminder drafts.
- Apply reminder safety checks and an approval workflow.
- Enforce the permitted customer-contact window of 8:00 AM to 7:00 PM IST.

Priority scores are decision-support signals, not guarantees or automated lending decisions.

## Technology

| Layer | Technologies |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend | Python, FastAPI |
| Database / ORM | SQLite, SQLAlchemy |
| Authentication | JWT-based authentication |
| API documentation | OpenAPI / Swagger UI |
| Frontend libraries | Axios, React Router, Recharts, Lucide |

## Architecture

The React frontend communicates with the FastAPI backend through REST endpoints. The backend applies authentication and role-based access checks, runs application services for loan prioritisation and assignment, and persists application data through SQLAlchemy to a local SQLite database.

The browser-side offline activity queue stores pending activity submissions locally and synchronises them when connectivity is restored.

```text
Field Officer / Branch Manager
             |
             v
     React + TypeScript UI
             |
          REST API
             |
             v
       FastAPI backend
       |      |       |
     Auth  Services  API routes
       |  Priority   Loans / Activities
       |  Assignment Reminders / Promises
             |
             v
       SQLAlchemy ORM
             |
             v
          SQLite
```

## Run locally

### Prerequisites
- Python 3.10 or later
- Node.js 20.19+ or 22.12+
- npm
- Git

### 1. Clone the repository

```powershell
git clone https://github.com/abrarmaniyar7090/collectiq-msme-collections.git
cd collectiq-msme-collections
```

### 2. Start the backend

Open a terminal in the project directory:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python create_demo_users.py
python -m uvicorn app.main:app --reload
```

The backend will be available at:
- API: http://127.0.0.1:8000
- Swagger documentation: http://127.0.0.1:8000/docs
- Health check: http://127.0.0.1:8000/health

### 3. Start the frontend

Open a **second terminal** in the project root:

```powershell
cd frontend
npm install
npm run dev -- --port 5174
```

Open http://localhost:5174 in your browser. If Vite reports a different port, use the URL shown in the terminal.

### 4. Load sample loans

The sample dataset is available at `backend/sample_loans.csv`. Sign in as the Branch Manager, open the backend Swagger page, authenticate, and use `POST /api/v1/loans/import-csv` to import it. On a fresh database, the file contains five demonstration loan records.

For the full setup and sample-data walkthrough, see [deployment.md](deployment.md).

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Field Officer | `officer@collectiq.demo` | `Officer@123` |
| Branch Manager | `manager@collectiq.demo` | `Manager@123` |

These credentials are for the local demonstration only. Do not reuse them in a shared or production environment.

## Run checks

From the project root:

**Backend tests**
```powershell
python -m pytest backend/app/tests/test_api.py -v
```

**Frontend production build**
```powershell
cd frontend
npm run build
```

**Frontend lint**
```powershell
npm run lint
```

During development, the backend test suite completed with **11 passing tests**. The frontend production build and lint checks also completed successfully.

## Project documentation

- [Technical Design Document](TDD.md) – architecture, modules, data flow, access control and design decisions.
- [Local Deployment Guide](deployment.md) – prerequisites, setup, demo data and local run instructions.

## Current scope and limitations

CollectIQ is a demonstration prototype, not a production collections platform.

- Reminder delivery is simulated. The application does not send real SMS or WhatsApp messages.
- Reminder drafts use supported application templates and safety checks; no external messaging provider is connected.
- The priority score is rule-based and advisory. It is not a trained predictive model.
- The local demo uses SQLite and sample data.
- Offline activity support uses browser Local Storage; advanced multi-device conflict resolution is outside the current scope.
- Historical roll-rate calculations based on monthly portfolio snapshots are not implemented.
- Production use would require deployment configuration, a production-grade database, managed secrets, monitoring, stronger operational controls and a full security/compliance review.

## Repository

Source code and project updates: https://github.com/abrarmaniyar7090/collectiq-msme-collections
