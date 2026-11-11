from app.core.database import Base, engine, SessionLocal
from app.models.entities import User
from app.core.security import hash_password

Base.metadata.create_all(bind=engine)

db = SessionLocal()

demo_users = [
    {
        "full_name": "Rahul Chouhan",
        "email": "officer@collectiq.demo",
        "password": "Officer@123",
        "role": "field_officer",
        "branch": "Indore",
    },
    {
        "full_name": "Branch Manager",
        "email": "manager@collectiq.demo",
        "password": "Manager@123",
        "role": "branch_manager",
        "branch": "Indore",
    },
]

try:
    for user_data in demo_users:
        existing_user = db.query(User).filter(
            User.email == user_data["email"]
        ).first()

        if existing_user:
            print(f"User already exists: {user_data['email']}")
            continue

        user = User(
            full_name=user_data["full_name"],
            email=user_data["email"],
            hashed_password=hash_password(user_data["password"]),
            role=user_data["role"],
            branch=user_data["branch"],
            is_active=True,
        )

        db.add(user)
        print(f"Created: {user_data['email']}")

    db.commit()
    print("\nDemo users are ready!")

finally:
    db.close()