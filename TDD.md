# CollectIQ – Technical Design Document

**GitHub Repository:** https://github.com/abrarmaniyar7090/collectiq-msme-collections
**Project:** AI-Assisted Field Collections Management Platform
**Selected Problem:** MSME Lender's Field Collections App with AI Prioritisation
**Status:** Working prototype

## 1. Project Overview

CollectIQ is a field collections management platform designed for MSME lending institutions. It helps field officers manage assigned loans, prioritise collection activities, record customer interactions, track payment promises and generate customer payment reminders.

The platform provides separate interfaces for field officers and branch managers. It uses explainable, rule-based AI prioritisation to help officers identify loans that may require earlier attention.

The solution also supports offline activity capture with automatic synchronisation when connectivity returns.

## 2. Problem Statement

MSME lending institutions often manage large loan portfolios through manual processes. Field officers may struggle to identify which borrowers need immediate attention, while branch managers have limited visibility into collection activities and payment promises.

CollectIQ addresses these challenges through:

- Centralised loan and collection activity management.
- Automatic loan assignment.
- Explainable loan prioritisation.
- Payment promise tracking.
- Customer reminder generation in English and Hindi.
- Offline activity capture and synchronisation.
- Role-based dashboards and access control.

## 3. Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| Backend | Python, FastAPI |
| Database | SQLite |
| ORM | SQLAlchemy |
| Authentication | JWT |
| Password Security | bcrypt |
| API Documentation | Swagger / OpenAPI |
| Offline Storage | Browser Local Storage |
| AI Prioritisation | Explainable rule-based scoring |
| Testing | Pytest |

## 4. System Architecture

The application follows a frontend-backend architecture.

**Frontend**
- Provides login and role-specific dashboards.
- Displays assigned loans and priority scores.
- Supports collection activity recording.
- Provides reminder generation and promise tracking.
- Stores pending activities locally when offline.

**Backend**
- Exposes REST APIs through FastAPI.
- Handles authentication and role-based permissions.
- Manages loan records and assignments.
- Calculates priority scores.
- Stores collection activities and payment promises.
- Generates and manages reminder drafts.

**Database**
- SQLite stores users, loans, promises, collection activities and reminder records.
- SQLAlchemy manages database interactions and relationships.

## 5. User Roles and Permissions

### Field Officer
- View assigned loans.
- View AI-generated priority scores and explanations.
- Record calls and visits.
- Capture GPS coordinates during activity submission.
- Record payment received, promise to pay, not reachable and dispute outcomes.
- View activity history.
- Generate English and Hindi payment reminders.
- Queue activities offline and synchronise them when online.

### Branch Manager
- View loan and collection dashboard statistics.
- View loan priority information.
- Monitor field officer performance.
- View and manage payment promise statuses.
- Review collection activity summaries.
- Monitor overdue loan distribution and collection metrics.

Backend role restrictions are enforced through authenticated API dependencies.

## 6. Core Functional Modules

### 6.1 Authentication and Access Control

JWT-based authentication protects application APIs.

Demo accounts:

| Role | Email |
|---|---|
| Field Officer | officer@collectiq.demo |
| Branch Manager | manager@collectiq.demo |

Passwords are provided separately in the deployment instructions.

The backend validates the authenticated user's role before allowing access to restricted endpoints.

### 6.2 Loan Import and Assignment

The application supports CSV-based loan import.

The assignment service uses pincode mapping and officer workload to determine loan assignments.

Duplicate loan records are skipped during repeated imports.

### 6.3 AI Loan Prioritisation

CollectIQ calculates a priority score from 0 to 100 using:

- Days past due (DPD).
- Outstanding loan amount.
- Broken payment promises.
- Missing payment promise dates.

The scoring system produces a priority category:

| Score | Category |
|---|---|
| 70–100 | High |
| 40–69 | Medium |
| 0–39 | Low |

Each loan includes up to three explanatory reasons for its score.

The scoring system is deterministic and explainable. It is designed as decision support for field officers, not as an automated loan approval or recovery decision system.

### 6.4 Collection Activity Management

Field officers can record:

- Call activities.
- Visit activities.
- Payment received.
- Promise to pay.
- Not reachable.
- Dispute.

Activity records can include notes, GPS coordinates and timestamps.

The backend uses client event IDs to prevent duplicate activity creation during synchronisation.

### 6.5 Promise-to-Pay Tracking

When a borrower commits to a payment, the officer can record the promised amount and payment date.

The system maintains promise records and supports status updates:

- Pending
- Fulfilled
- Broken
- Overdue (calculated for pending promises past their due date)

Branch managers can monitor promise performance through the manager dashboard.

### 6.6 AI Reminder Generator

The reminder module provides approved templates for:

- Payment Due.
- Payment Overdue.
- Promise Reminder.

Both English and Hindi are supported.

The reminder workflow is:

1. Select a loan.
2. Select the language.
3. Select the reminder type.
4. Generate a draft.
5. Review the message.
6. Approve the draft.
7. Trigger the mock sending workflow.

The system includes safety checks to block threatening or inappropriate language.

Officer approval is required before sending. The current implementation uses mock sending only; no real SMS or WhatsApp message is delivered.

### 6.7 Offline Activity Capture

When internet connectivity is unavailable, collection activities are stored in browser Local Storage.

When connectivity returns, the application attempts to synchronise queued activities with the backend.

Client event IDs support duplicate protection during synchronisation.

### 6.8 Manager Dashboard

The manager dashboard provides:

- Total loan count.
- Total outstanding amount.
- Pending payment promises.
- Collection activity statistics.
- Field officer performance.
- DPD distribution.
- Promise tracking.
- Roll-rate baseline and target indicators.

Historical roll-rate calculation using periodic portfolio snapshots is not implemented in the current prototype. The dashboard displays the supplied baseline and target alongside current portfolio information.

## 7. Database Design

The main database entities are:

| Entity | Purpose |
|---|---|
| User | Stores user credentials, roles and branch information |
| Loan | Stores borrower, loan, outstanding amount, DPD and assignment information |
| PromiseToPay | Stores promised amounts, dates and payment promise statuses |
| CollectionActivity | Stores calls, visits, outcomes, notes, GPS coordinates and timestamps |
| Reminder | Stores reminder drafts, approval and mock sending status |

Relationships:

- One field officer can have multiple assigned loans.
- One loan can have multiple collection activities.
- One loan can have multiple payment promises.
- Reminder records are associated with the relevant loan and workflow.

## 8. Security and Compliance Considerations

The prototype includes:

- JWT-based authentication.
- Password hashing.
- Role-based API access restrictions.
- Authenticated loan and collection operations.
- Contact-hour restrictions between 8:00 AM and 7:00 PM IST.
- Reminder template safety checks.
- Officer approval before reminder sending.
- GPS capture associated with collection activities.

The implementation uses demonstration data and should be extended with production-grade encryption, audit controls, consent management, retention policies and comprehensive DPDP compliance measures before real-world deployment.

## 9. Testing and Validation

The following workflows were manually verified:

| Test | Result |
|---|---|
| Field officer login | Passed |
| Branch manager login | Passed |
| Field officer blocked from manager dashboard | Passed – 403 |
| Branch manager blocked from creating collection activities | Passed – 403 |
| Manager loan priority access | Passed – 200 |
| Manager promise access | Passed – 200 |
| Field officer loan priority access | Passed – 200 |
| Unauthenticated loan priority request | Passed – 401 |
| CSV import and duplicate handling | Verified |
| Priority scoring and explanations | Verified |
| Collection activity recording | Verified |
| Promise creation and status updates | Verified |
| Offline activity synchronisation | Verified |
| English and Hindi reminder templates | Verified |
| Reminder approval and mock sending | Verified |
| Contact-hour restrictions | Verified |

The current demo includes five sample loans and one field officer. Multi-officer data isolation requires additional testing.

## 10. Scope Limitations

The current submission is a working prototype. The following capabilities require further development:

- Historical roll-rate calculation using scheduled portfolio snapshots.
- Multi-officer and multi-branch production testing.
- Real SMS and WhatsApp integrations.
- Production deployment and database migration.
- Expanded DPDP consent and data-retention workflows.
- Production-grade monitoring, audit logging and security hardening.
- Full bilingual application interface; currently, the reminder generator supports English and Hindi while the main interface is in English.

## 11. Future Enhancements

- Support multiple branches and larger field teams.
- Introduce historical collection trend analysis.
- Integrate approved SMS and WhatsApp providers.
- Improve offline conflict handling and synchronisation visibility.
- Add multilingual application navigation.
- Add more comprehensive automated API and frontend tests.
- Deploy using a production database and secure cloud infrastructure.

## 12. Conclusion

CollectIQ demonstrates an integrated approach to MSME field collections management through loan prioritisation, collection activity tracking, payment promise management, reminder generation and offline synchronisation.

The prototype focuses on explainability, role-based access and practical workflows that can help field officers organise collection activities and give branch managers better operational visibility.
