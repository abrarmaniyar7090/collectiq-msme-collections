# CollectIQ â€“ Local Deployment Guide

## 1. Project Overview

CollectIQ is an AI-assisted field collections management platform for MSME lending institutions.

It helps field officers manage assigned loans, prioritise collection activities, record customer interactions, track payment promises and generate payment reminders.

Branch managers can monitor collection performance, review field officer activities and manage payment promises.

This guide explains how to install, configure and run CollectIQ locally.

## 2. Prerequisites

Install the following software:

- Python 3.10 or later
- Node.js 20.19+ or 22.12+
- npm
- Git

Verify the installations:

```powershell
python --version
node --version
npm --version
git --version
```

## 3. Backend Setup

### Step 1: Navigate to the Backend Directory

Open PowerShell or the VS Code terminal in the main CollectIQ project directory.

Run:

```powershell
cd backend
```

### Step 2: Create a Virtual Environment

```powershell
python -m venv venv
```

### Step 3: Activate the Virtual Environment

```powershell
.\venv\Scripts\Activate.ps1
```

### Step 4: Install Backend Dependencies

```powershell
pip install -r requirements.txt
```

### Step 5: Create Demo User Accounts

Run the demo user creation script:

```powershell
python create_demo_users.py
```

This creates the following accounts:

- Field Officer: Rahul Chouhan
- Branch Manager: Branch Manager

The script checks for existing users before creating new accounts.

### Step 6: Start the Backend Server

```powershell
python -m uvicorn app.main:app --reload
```

Backend URL:

http://127.0.0.1:8000

API Documentation:

http://127.0.0.1:8000/docs

Health Check:

http://127.0.0.1:8000/health

Keep the backend terminal running.

## 4. Frontend Setup

### Step 1: Open a Second Terminal

Open another terminal in VS Code.

Navigate to the main CollectIQ project directory if necessary, then run:

```powershell
cd frontend
```

### Step 2: Install Frontend Dependencies

```powershell
npm install
```

### Step 3: Start the Frontend Development Server

```powershell
npm run dev -- --port 5174
```

Frontend URL:

http://localhost:5174

Keep the frontend terminal running.

Open the frontend URL in your browser to access CollectIQ.

## 5. Creating Demo Loan Data

The project includes a sample loan dataset:

`backend/sample_loans.csv`

This file contains five demonstration loan records.

### Step 1: Open API Documentation

Make sure the backend is running.

Open:

http://127.0.0.1:8000/docs

### Step 2: Authenticate as Branch Manager

1. Find POST `/api/v1/auth/login`.
2. Click Try it out.
3. Enter the branch manager credentials:

```json
{
  "email": "manager@collectiq.demo",
  "password": "Manager@123"
}
```

4. Click Execute.
5. Copy the returned access token.
6. Click Authorize and authenticate using the token.

### Step 3: Import Sample Loans

1. Find POST `/api/v1/loans/import-csv` under Loan Management.
2. Click Try it out.
3. Upload the file `backend/sample_loans.csv`.
4. Click Execute.

The application validates the CSV data and imports valid loan records.

### Step 4: Automatic Loan Assignment

The assignment service uses pincode mapping and officer workload to assign loans to available field officers.

Duplicate loan records are skipped during repeated imports.

For a fresh database, the expected import result is:

- Total processed: 5
- Imported: 5
- Skipped duplicates: 0
- Failed: 0

## 6. Environment Configuration

The current local prototype uses its existing development configuration.

No additional environment variables are required for the current local demonstration.

The JWT signing secret is currently configured in:

`backend/app/core/security.py`

The development placeholder secret must be replaced with a securely managed environment variable before production deployment.

Do not commit passwords, access tokens, API keys or production secrets to GitHub.

## 7. Demo Login Credentials

### Field Officer

Name: Rahul Chouhan

Email:

`officer@collectiq.demo`

Password:

`Officer@123`

### Branch Manager

Name: Branch Manager

Email:

`manager@collectiq.demo`

Password:

`Manager@123`

These credentials are provided for local demonstration purposes only.

## 8. Application Workflow

1. Open the frontend URL.
2. Sign in using either demo account.
3. Field officers can view assigned loans and AI-generated priority scores.
4. Record collection calls and visits.
5. Capture GPS coordinates during activity submission.
6. Record payment received, promise to pay, not reachable and dispute outcomes.
7. Generate English or Hindi payment reminders.
8. Review and approve reminder drafts.
9. Branch managers can monitor collection statistics and field officer performance.
10. Branch managers can review and update payment promise statuses.

## 9. Database

The application uses SQLite with SQLAlchemy.

Database tables are created automatically during backend application startup.

The local database file is:

`backend/collectiq.db`

The database is created locally when the application is first run.

Demo users are created using `create_demo_users.py`.

Loan records are populated using the sample CSV import workflow.

The prototype uses demonstration data.

## 10. Testing and Verification

### Backend Tests

Navigate to the backend directory and run:

```powershell
python -m pytest -v
```

### Frontend Production Build

Navigate to the frontend directory and run:

```powershell
npm run build
```

### Frontend Code Quality Checks

```powershell
npm run lint
```

These commands verify backend API tests, frontend TypeScript compilation, production build generation and ESLint rules.

## 11. Important Notes

- Reminder sending is simulated. No real SMS or WhatsApp messages are delivered.
- Offline activities are stored in browser Local Storage and synchronised when connectivity returns.
- The AI prioritisation score is advisory and explainable.
- Priority scoring uses DPD, outstanding amount, payment promise history and missing promise dates.
- The current prototype contains five sample loans and one demo field officer.
- The main application interface is in English. The reminder generator supports English and Hindi.
- Customer contact is restricted to permitted hours between 8:00 AM and 7:00 PM IST.
- Historical roll-rate calculation using monthly portfolio snapshots is not implemented in the current prototype.
- Production deployment requires additional security, monitoring, database and compliance configuration.
