"""Seed the database with demo user and activity templates."""

from datetime import datetime, timezone

from app.core.config import settings
from app.core.security import get_password_hash
from app.db.base import SessionLocal
from app.models.activity_template import ActivityTemplate
from app.models.user import User

SEED_TEMPLATES = [
    {"name": "Nauka", "color": "#6366f1", "icon": "📚", "default_duration": 60},
    {"name": "Praca", "color": "#0ea5e9", "icon": "💼", "default_duration": 90},
    {"name": "Sport", "color": "#22c55e", "icon": "🏃", "default_duration": 60},
    {"name": "Spotkanie", "color": "#f59e0b", "icon": "🤝", "default_duration": 30},
    {"name": "Projekt", "color": "#ec4899", "icon": "🚀", "default_duration": 120},
    {"name": "Odpoczynek", "color": "#14b8a6", "icon": "😴", "default_duration": 30},
]


def seed():
    db = SessionLocal()
    try:
        # Create admin user if not exists
        admin = db.query(User).filter(User.email == settings.ADMIN_EMAIL).first()
        if not admin:
            print(f"Creating admin user: {settings.ADMIN_EMAIL}")
            admin = User(
                email=settings.ADMIN_EMAIL,
                hashed_password=get_password_hash(settings.ADMIN_PASSWORD),
                is_admin=True,
                preferences={},
                created_at=datetime.now(timezone.utc),
            )
            db.add(admin)
            db.commit()
            print("Admin user created.")
        else:
            print("Admin user already exists — skipping.")

        # Create demo user if not exists
        user = db.query(User).filter(User.email == settings.DEMO_USER_EMAIL).first()
        if not user:
            print(f"Creating demo user: {settings.DEMO_USER_EMAIL}")
            user = User(
                email=settings.DEMO_USER_EMAIL,
                hashed_password=get_password_hash(settings.DEMO_USER_PASSWORD),
                preferences={},
                created_at=datetime.now(timezone.utc),
            )
            db.add(user)
            db.flush()

            # Add activity templates
            for tmpl in SEED_TEMPLATES:
                db.add(
                    ActivityTemplate(
                        **tmpl,
                        user_id=user.id,
                        created_at=datetime.now(timezone.utc),
                    )
                )
            db.commit()
            print("Seed completed.")
        else:
            print("Demo user already exists — skipping seed.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
