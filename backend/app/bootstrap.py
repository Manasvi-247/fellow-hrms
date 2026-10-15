"""Runs migrations and optional demo seeding once, even when several replicas start together."""

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import text

from .config import settings
from .db import SessionLocal, engine
from .seed import seed

LOCK_ID = 7342001
ALEMBIC_INI = Path(__file__).resolve().parent.parent / "alembic.ini"


def main():
    with engine.connect() as conn:
        use_lock = conn.dialect.name == "postgresql"
        if use_lock:
            print("Waiting for bootstrap lock")
            conn.execute(text("SELECT pg_advisory_lock(:id)"), {"id": LOCK_ID})
        try:
            command.upgrade(Config(str(ALEMBIC_INI)), "head")
            if settings.seed_demo_data:
                with SessionLocal() as db:
                    print("Seeded demo data" if seed(db) else "Demo data already present, skipping seed")
        finally:
            if use_lock:
                conn.execute(text("SELECT pg_advisory_unlock(:id)"), {"id": LOCK_ID})


if __name__ == "__main__":
    main()
