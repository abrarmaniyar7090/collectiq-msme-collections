# CollectIQ – Technical Design Document

## 1. Project Overview

CollectIQ is an AI-assisted field collections management prototype for MSME lending institutions. It supports field officers handling assigned overdue loans and branch managers monitoring collection operations.

The system focuses on the field collection workflow: loan prioritisation, customer interaction recording, promise-to-pay tracking, reminder drafting and manager visibility.

The current implementation is a demonstration prototype using sample data. It is not connected to a live loan-management system, payment gateway, SMS provider or WhatsApp provider.

## 2. Problem and Goals

Field collection teams need a consistent way to decide which accounts to follow up, record what happened during customer contact and keep promises visible to the branch.

CollectIQ aims to:
- Give field officers a prioritised view of their assigned accounts.
- Make collection activity records consistent and traceable.
- Capture visit location when device/browser permission is granted.
- Track promises to pay and their outcomes.
- Help managers review branch and officer-level activity.
- Provide controlled, bilingual reminder drafts while respecting permitted contact hours.

The priority score is advisory. Final collection decisions remain with the authorised staff.

## 3. User Roles and Access

### Field Officer
- Signs in and accesses assigned loans.
- Views loan details and priority information.
- Records collection calls and visits.
- Submits activity outcomes and notes.
- Captures GPS coordinates where available.
- Generates and reviews reminder drafts through the supported workflow.
- Views relevant promise and activity information.

### Branch Manager
- Signs in with manager permissions.
- Views branch-level dashboard information.
- Reviews officer performance and collection activity.
- Imports loan data using the CSV import workflow.
- Reviews and manages promise-to-pay records.

The backend enforces role-based access on protected API operations. The frontend role-specific screens are not treated as the security boundary; authorisation is checked by the backend.

## 4. High-Level Architecture

The application uses a client-server architecture.

```text
Browser
  |
  v
React + TypeScript frontend
  |
  | HTTP / JSON (REST)
  v
FastAPI application
  |
  +-- Authentication and authorisation
  +-- Loan and CSV import APIs
  +-- Priority scoring service
  +-- Assignment service
  +-- Collection activity APIs
  +-- Promise management APIs
  +-- Reminder generation and approval APIs
  +-- Manager dashboard APIs
  |
  v
SQLAlchemy
  |
  v
SQLite database
```

### Frontend
The frontend is a React 19 and TypeScript application built with Vite. It provides sign-in, field officer workflows, manager dashboards, reminder management and API communication. Axios is used for HTTP requests; React Router handles navigation.

The offline activity queue uses browser Local Storage to retain pending activity submissions when the network is unavailable. Pending records can be synchronised when connectivity returns.

### Backend
The backend is implemented with Python and FastAPI. API routes handle incoming requests, authentication dependencies protect restricted operations, services contain reusable business logic, and SQLAlchemy provides database access.

### Database
The local prototype uses SQLite with SQLAlchemy. The database file is created locally when the backend starts. Demo accounts are created by the provided demo-user script; loan records can be loaded from the sample CSV.

## 5. Main Backend Modules

The backend is organised into API, core, model, schema, service and test modules.

| Area | Responsibility |
|---|---|
| Authentication | Login, JWT creation/validation and current-user access |
| Loan management / CSV import | Loan data access and manager-initiated CSV import |
| Priority scoring | Explainable rule-based loan prioritisation |
| Assignment | Loan assignment using pincode mapping and officer workload |
| Collection activities | Recording calls/visits, outcomes, notes and location data |
| Promise management | Tracking promise-to-pay records and their statuses |
| Reminder management | Generating reminder drafts, safety checks, approval and history |
| Manager dashboard | Branch summaries and officer performance views |

Important source areas include:
- `backend/app/api/` – API route modules.
- `backend/app/core/` – database and security configuration.
- `backend/app/models/` – SQLAlchemy entities.
- `backend/app/schemas/` – request and response schemas.
- `backend/app/services/` – priority scoring and assignment logic.
- `backend/app/tests/` – backend API tests.
- `frontend/src/pages/` – application screens.
- `frontend/src/services/` – API client and offline queue.

## 6. Key Workflows

### 6.1 Sign-in and authenticated requests
1. A user submits login credentials.
2. The backend verifies the credentials.
3. The backend returns a signed JWT access token.
4. The frontend uses the token for protected API requests.
5. Backend dependencies validate the token and identify the current user.
6. Role checks restrict manager-only and officer-only operations.

### 6.2 Loan import and assignment
1. A branch manager authenticates.
2. The manager submits a CSV file through the loan import endpoint.
3. The backend validates required fields and individual records.
4. Duplicate records are skipped; invalid records are reported.
5. Valid records are stored.
6. The assignment service uses pincode mapping and officer workload to assign loans.

The supplied sample file contains five demonstration loan records. The expected result for a fresh database is five imported records, with no duplicates or failures.

### 6.3 Loan prioritisation
The priority service calculates an explainable advisory score. The factors include:
- Days past due (DPD).
- Outstanding amount.
- Promise-to-pay history.
- Missing or overdue promise dates.

The score helps order follow-up work. It should not be interpreted as a probability of recovery or as an automated decision.

### 6.4 Recording a collection activity
1. The officer opens an assigned loan.
2. The officer selects a call or visit activity.
3. The officer selects an outcome, such as payment received, promise to pay, not reachable or dispute.
4. The officer enters notes.
5. The browser attempts to capture GPS coordinates if location permission is available.
6. The activity is submitted to the backend.
7. If connectivity is unavailable, the frontend offline queue retains the pending activity for later synchronisation.

### 6.5 Reminder generation and approval
1. An authorised user selects the relevant loan/customer context.
2. The application generates a supported English or Hindi reminder draft.
3. Safety checks are applied to the draft.
4. The reminder follows the approval workflow.
5. Contact is restricted to the permitted window of 8:00 AM to 7:00 PM IST.

Reminder delivery is simulated. There is no live SMS or WhatsApp provider integration, so approval does not mean that a real message was delivered.

### 6.6 Manager monitoring
The manager dashboard presents available branch-level loan, outstanding, promise and collection-activity summaries, along with officer performance information. Historical roll-rate computation from monthly portfolio snapshots is not implemented in this prototype.

## 7. API Design

The backend exposes REST APIs and publishes an OpenAPI specification through FastAPI Swagger UI.

The main API areas include:
- Authentication: `/api/v1/auth`
- Loan management and CSV import: `/api/v1/loans`
- Loan priority: `/api/v1/loans/priority`
- Collection activities: `/api/v1/loans/{loan_id}/activities`
- Promise management: `/api/v1/promises`
- Reminder generation and history: `/api/v1/reminders`
- Manager dashboard: `/api/v1/dashboard/manager`

The interactive API reference is available locally at `http://127.0.0.1:8000/docs` after starting the backend.

## 8. Security and Data Handling

- Passwords are stored as password hashes, not as plain text.
- JWT access tokens are used to authenticate protected API requests.
- Backend role checks protect manager-only and officer-specific operations.
- The local demo uses demonstration accounts and sample borrower records.
- The JWT signing key supports environment-based configuration; the development fallback is for local use only.
- Production deployments must set a strong secret through the hosting environment and must not commit secrets to source control.
- GPS capture depends on browser permission and device availability.
- The prototype does not provide production-grade privacy, retention, audit, monitoring or regulatory controls.

## 9. Technology Stack

| Component | Technology |
|---|---|
| Frontend framework | React 19 |
| Frontend language | TypeScript |
| Build tooling | Vite |
| Styling | Tailwind CSS |
| Routing | React Router |
| HTTP client | Axios |
| Charts / icons | Recharts, Lucide |
| Backend framework | FastAPI |
| Backend language | Python |
| ORM | SQLAlchemy |
| Database | SQLite |
| Authentication | JWT |
| API specification | OpenAPI / Swagger UI |

## 10. Testing and Verification

The backend test suite covers authentication, protected access, role restrictions, officer loan visibility, manager dashboard access and collection activity submission, including duplicate activity protection.

Development verification recorded:
- Backend: 11 tests passed.
- Frontend production build: passed.
- Frontend lint: passed.

Run the checks using the commands in `deployment.md`.

## 11. Known Limitations and Future Work

Current prototype limitations:
- No live SMS or WhatsApp delivery integration.
- No connection to an external core lending or loan-management platform.
- Rule-based priority scoring; no trained predictive model or calibrated recovery prediction.
- SQLite and seeded demonstration data are intended for local evaluation.
- Browser Local Storage offline queue does not provide advanced multi-device conflict resolution.
- Historical roll-rate analysis requiring monthly portfolio snapshots is not implemented.
- Production hosting, monitoring, managed database operations, full audit controls and formal security/compliance validation remain outside the current implementation.

Potential future improvements include integration with lender systems, a production database, managed identity and secrets, reliable background synchronisation, delivery-provider integration, audit reporting and historical portfolio analytics.

## 12. Related Documentation

- [README](README.md) – project overview and quick start.
- [Local Deployment Guide](deployment.md) – prerequisites, setup, sample data and demo workflow.
