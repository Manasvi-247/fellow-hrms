import os
from datetime import date, datetime, timedelta

os.environ["DATABASE_URL"] = "sqlite:///./test.db"

import pytest
from fastapi.testclient import TestClient

from app import models  # noqa: F401
from app.db import Base, engine
from app.main import app


@pytest.fixture(autouse=True)
def fresh_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="session", autouse=True)
def remove_test_db():
    yield
    engine.dispose()
    if os.path.exists("test.db"):
        os.remove("test.db")


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def department(client):
    return client.post("/api/departments", json={"name": "Engineering", "code": "ENG"}).json()


@pytest.fixture
def make_employee(client, department):
    counter = {"n": 0}

    def _make(**overrides):
        counter["n"] += 1
        payload = {
            "first_name": f"Test{counter['n']}",
            "last_name": "User",
            "email": f"test{counter['n']}@company.com",
            "department_id": department["id"],
            "date_of_joining": "2024-01-15",
        }
        payload.update(overrides)
        response = client.post("/api/employees", json=payload)
        assert response.status_code == 201, response.text
        return response.json()

    return _make


@pytest.fixture
def leave_type():
    from app.db import SessionLocal
    from app.models import LeaveType

    with SessionLocal() as db:
        lt = LeaveType(name="Casual Leave", code="CL", annual_quota=12, color="#4C9DB0")
        db.add(lt)
        db.commit()
        return {"id": lt.id, "name": lt.name}


@pytest.fixture
def next_monday():
    today = date.today()
    return today + timedelta(days=(7 - today.weekday()) % 7 or 7) + timedelta(days=7)


@pytest.fixture
def clock(monkeypatch):
    from app.routers import attendance
    from app.services import TZ

    def _set(day: date, hour: int, minute: int):
        moment = datetime(day.year, day.month, day.day, hour, minute, tzinfo=TZ)
        monkeypatch.setattr(attendance, "now_local", lambda: moment)
        monkeypatch.setattr(attendance, "today_local", lambda: moment.date())

    return _set
