from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import Base, engine

# Import models so SQLAlchemy registers all database tables
from app.models import entities, reminder

# Import API routers
from app.api import (
    auth,
    csv_import,
    priority,
    activities,
    promises,
    dashboard,
    reminders,
)

# Create database tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI
app = FastAPI(
    title="CollectIQ API",
    description="AI-powered field collections management platform for MSME lending institutions.",
    version="1.0.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(auth.router)
app.include_router(csv_import.router)
app.include_router(priority.router)
app.include_router(activities.router)
app.include_router(promises.router)
app.include_router(dashboard.router)
app.include_router(reminders.router)


# Root endpoint
@app.get("/")
def root():
    return {
        "application": "CollectIQ",
        "message": "CollectIQ API is running",
        "docs": "/docs",
    }


# Health check
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "application": "CollectIQ",
    }


# System models endpoint
@app.get("/api/v1/system/models")
def get_system_models():
    return {
        "models": [
            "User",
            "Loan",
            "PromiseToPay",
            "CollectionActivity",
            "Reminder",
        ]
    }