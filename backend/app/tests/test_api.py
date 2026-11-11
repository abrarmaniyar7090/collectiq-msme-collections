import pytest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import Base, get_db
from app.core.security import hash_password
from app.models.entities import User, Loan


@pytest.fixture
def test_context():

    # Create a separate in-memory SQLite database.
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )

    TestingSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=test_engine,
        expire_on_commit=False
    )

    Base.metadata.create_all(bind=test_engine)

    # Override the application's database dependency.
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    # Create sample users and loans for testing.
    with TestingSessionLocal() as db:

        manager = User(
            full_name="Test Manager",
            email="manager@test.com",
            hashed_password=hash_password("ManagerTest123!"),
            role="branch_manager",
            branch="Indore",
            is_active=True
        )

        officer_one = User(
            full_name="Test Officer One",
            email="officer1@test.com",
            hashed_password=hash_password("OfficerTest123!"),
            role="field_officer",
            branch="Indore",
            is_active=True
        )

        officer_two = User(
            full_name="Test Officer Two",
            email="officer2@test.com",
            hashed_password=hash_password("OfficerTest123!"),
            role="field_officer",
            branch="Indore",
            is_active=True
        )

        other_branch_officer = User(
            full_name="Other Branch Officer",
            email="officer3@test.com",
            hashed_password=hash_password("OfficerTest123!"),
            role="field_officer",
            branch="Bhopal",
            is_active=True
        )

        db.add_all([
            manager,
            officer_one,
            officer_two,
            other_branch_officer
        ])

        db.flush()

        loan_one = Loan(
            loan_id="LN-TEST-001",
            borrower_name="Test Borrower One",
            outstanding_amount=100000,
            dpd=12,
            assigned_officer_id=officer_one.id
        )

        loan_two = Loan(
            loan_id="LN-TEST-002",
            borrower_name="Test Borrower Two",
            outstanding_amount=80000,
            dpd=20,
            assigned_officer_id=officer_two.id
        )

        loan_three = Loan(
            loan_id="LN-TEST-003",
            borrower_name="Test Borrower Three",
            outstanding_amount=50000,
            dpd=9,
            assigned_officer_id=other_branch_officer.id
        )

        db.add_all([
            loan_one,
            loan_two,
            loan_three
        ])

        db.commit()

        ids = {
            "loan_one": loan_one.id,
            "loan_two": loan_two.id,
            "loan_three": loan_three.id
        }

    # Provide a fresh API client for each test.
    with TestClient(app) as client:
        yield {
            "client": client,
            "ids": ids
        }

    # Clean up test database and dependency overrides.
    app.dependency_overrides.pop(get_db, None)

    Base.metadata.drop_all(bind=test_engine)
    test_engine.dispose()


def get_token(client, email, password):

    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": email,
            "password": password
        }
    )

    assert response.status_code == 200

    return response.json()["access_token"]


def test_successful_login(test_context):

    client = test_context["client"]

    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "officer1@test.com",
            "password": "OfficerTest123!"
        }
    )

    assert response.status_code == 200

    data = response.json()

    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_invalid_password_rejected(test_context):

    client = test_context["client"]

    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "officer1@test.com",
            "password": "WrongPassword123!"
        }
    )

    assert response.status_code == 401


def test_authenticated_user_profile(test_context):

    client = test_context["client"]

    token = get_token(
        client,
        "officer1@test.com",
        "OfficerTest123!"
    )

    response = client.get(
        "/api/v1/auth/me",
        headers={
            "Authorization": f"Bearer {token}"
        }
    )

    assert response.status_code == 200
    assert response.json()["email"] == "officer1@test.com"
    assert response.json()["role"] == "field_officer"


def test_unauthenticated_request_rejected(test_context):

    client = test_context["client"]

    response = client.get(
        "/api/v1/loans/priority"
    )

    assert response.status_code == 401


def test_field_officer_cannot_access_manager_dashboard(test_context):

    client = test_context["client"]

    token = get_token(
        client,
        "officer1@test.com",
        "OfficerTest123!"
    )

    response = client.get(
        "/api/v1/dashboard/manager",
        headers={
            "Authorization": f"Bearer {token}"
        }
    )

    assert response.status_code == 403


def test_manager_cannot_record_collection_activity(test_context):

    client = test_context["client"]

    token = get_token(
        client,
        "manager@test.com",
        "ManagerTest123!"
    )

    response = client.post(
        f"/api/v1/loans/{test_context['ids']['loan_one']}/activities",
        headers={
            "Authorization": f"Bearer {token}"
        },
        json={
            "client_event_id": "manager-rbac-test",
            "activity_type": "visit",
            "outcome": "paid",
            "notes": "Testing role restriction"
        }
    )

    assert response.status_code == 403


def test_officer_sees_only_assigned_loans(test_context):

    client = test_context["client"]

    token = get_token(
        client,
        "officer1@test.com",
        "OfficerTest123!"
    )

    response = client.get(
        "/api/v1/loans/priority",
        headers={
            "Authorization": f"Bearer {token}"
        }
    )

    assert response.status_code == 200

    data = response.json()

    assert data["total_loans"] == 1
    assert data["loans"][0]["loan_id"] == "LN-TEST-001"


def test_second_officer_sees_only_own_loans(test_context):

    client = test_context["client"]

    token = get_token(
        client,
        "officer2@test.com",
        "OfficerTest123!"
    )

    response = client.get(
        "/api/v1/loans/priority",
        headers={
            "Authorization": f"Bearer {token}"
        }
    )

    assert response.status_code == 200

    data = response.json()

    assert data["total_loans"] == 1
    assert data["loans"][0]["loan_id"] == "LN-TEST-002"


def test_manager_dashboard_shows_branch_loans(test_context):

    client = test_context["client"]

    token = get_token(
        client,
        "manager@test.com",
        "ManagerTest123!"
    )

    response = client.get(
        "/api/v1/dashboard/manager",
        headers={
            "Authorization": f"Bearer {token}"
        }
    )

    assert response.status_code == 200

    data = response.json()

    assert data["loan_overview"]["total_loans"] == 2
    assert data["loan_overview"]["total_outstanding_amount"] == 180000


def test_officer_can_record_collection_activity(test_context):

    client = test_context["client"]

    token = get_token(
        client,
        "officer1@test.com",
        "OfficerTest123!"
    )

    response = client.post(
        f"/api/v1/loans/{test_context['ids']['loan_one']}/activities",
        headers={
            "Authorization": f"Bearer {token}"
        },
        json={
            "client_event_id": "officer-activity-test-001",
            "activity_type": "visit",
            "outcome": "paid",
            "notes": "Automated collection activity test"
        }
    )

    assert response.status_code == 200

    data = response.json()

    assert data["duplicate"] is False
    assert data["outcome"] == "paid"


def test_duplicate_activity_is_not_recorded_twice(test_context):

    client = test_context["client"]

    token = get_token(
        client,
        "officer1@test.com",
        "OfficerTest123!"
    )

    loan_id = test_context["ids"]["loan_one"]

    payload = {
        "client_event_id": "duplicate-activity-test-001",
        "activity_type": "visit",
        "outcome": "not_reachable",
        "notes": "Duplicate activity test"
    }

    headers = {
        "Authorization": f"Bearer {token}"
    }

    first_response = client.post(
        f"/api/v1/loans/{loan_id}/activities",
        headers=headers,
        json=payload
    )

    second_response = client.post(
        f"/api/v1/loans/{loan_id}/activities",
        headers=headers,
        json=payload
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 200

    assert first_response.json()["duplicate"] is False
    assert second_response.json()["duplicate"] is True