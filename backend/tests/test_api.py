from datetime import date, datetime, timedelta, timezone

from app.db import SessionLocal
from app.seed import seed


def test_health(client):
    assert client.get("/health").json() == {"status": "UP"}


def test_ready_checks_database(client):
    assert client.get("/ready").json() == {"status": "READY"}


def test_root_reports_service(client):
    body = client.get("/").json()
    assert body["service"] == "Fellow API"
    assert body["docs"] == "/docs"


def test_metrics_exposed_in_prometheus_format(client):
    client.get("/api/employees")
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "http_requests_total" in response.text


class TestDepartments:
    def test_create_and_list(self, client, department):
        rows = client.get("/api/departments").json()
        assert [d["code"] for d in rows] == ["ENG"]
        assert rows[0]["headcount"] == 0

    def test_duplicate_code_conflicts(self, client, department):
        response = client.post("/api/departments", json={"name": "Other", "code": "ENG"})
        assert response.status_code == 409

    def test_delete_blocked_while_it_has_members(self, client, department, make_employee):
        make_employee()
        response = client.delete(f"/api/departments/{department['id']}")
        assert response.status_code == 409
        assert "still has 1 employee" in response.json()["detail"]

    def test_head_name_and_headcount(self, client, department, make_employee):
        head = make_employee(role="MANAGER")
        make_employee()
        updated = client.put(f"/api/departments/{department['id']}", json={"head_id": head["id"]}).json()
        assert updated["head_name"] == head["first_name"] + " User"
        assert updated["headcount"] == 2


class TestPartialUpdates:
    def test_employee_rejects_null_for_required_fields(self, client, make_employee):
        emp = make_employee()
        response = client.put(f"/api/employees/{emp['id']}", json={"email": None, "salary": None})
        assert response.status_code == 422
        assert "email, salary cannot be null" in response.text

    def test_employee_allows_clearing_optional_fields(self, client, make_employee):
        boss = make_employee(role="MANAGER")
        emp = make_employee(manager_id=boss["id"])
        updated = client.put(f"/api/employees/{emp['id']}", json={"manager_id": None, "department_id": None})
        assert updated.status_code == 200
        assert updated.json()["manager_id"] is None and updated.json()["department_name"] is None

    def test_department_rejects_null_name(self, client, department):
        response = client.put(f"/api/departments/{department['id']}", json={"name": None})
        assert response.status_code == 422


class TestEmployees:
    def test_create_generates_code_and_department_name(self, make_employee):
        emp = make_employee()
        assert emp["employee_code"] == f"EMP-{emp['id']:04d}"
        assert emp["department_name"] == "Engineering"
        assert emp["status"] == "ACTIVE"

    def test_duplicate_email_conflicts(self, client, make_employee):
        make_employee(email="dup@company.com")
        response = client.post(
            "/api/employees",
            json={"first_name": "Again", "email": "dup@company.com", "date_of_joining": "2024-01-01"},
        )
        assert response.status_code == 409

    def test_invalid_email_rejected(self, client):
        response = client.post(
            "/api/employees", json={"first_name": "Bad", "email": "not-an-email", "date_of_joining": "2024-01-01"}
        )
        assert response.status_code == 422

    def test_get_missing_returns_404(self, client):
        assert client.get("/api/employees/999").status_code == 404

    def test_update_and_filter(self, client, make_employee):
        emp = make_employee()
        make_employee(first_name="Zoya")
        client.put(f"/api/employees/{emp['id']}", json={"designation": "SRE", "status": "ON_LEAVE"})
        on_leave = client.get("/api/employees", params={"status": "ON_LEAVE"}).json()
        assert [e["designation"] for e in on_leave] == ["SRE"]
        assert [e["first_name"] for e in client.get("/api/employees", params={"q": "zoy"}).json()] == ["Zoya"]

    def test_cannot_be_own_manager(self, client, make_employee):
        emp = make_employee()
        response = client.put(f"/api/employees/{emp['id']}", json={"manager_id": emp["id"]})
        assert response.status_code == 400

    def test_delete_clears_manager_of_reports(self, client, make_employee):
        boss = make_employee(role="MANAGER")
        report = make_employee(manager_id=boss["id"])
        assert [r["id"] for r in client.get(f"/api/employees/{boss['id']}/reports").json()] == [report["id"]]
        assert client.delete(f"/api/employees/{boss['id']}").status_code == 204
        assert client.get(f"/api/employees/{report['id']}").json()["manager_id"] is None


class TestLeave:
    def test_apply_counts_working_days_only(self, client, make_employee, leave_type, next_monday):
        emp = make_employee()
        friday = next_monday + timedelta(days=4)
        client.post("/api/holidays", json={"name": "Festival", "date": str(next_monday + timedelta(days=2))})
        response = client.post(
            "/api/leaves",
            json={
                "employee_id": emp["id"],
                "leave_type_id": leave_type["id"],
                "from_date": str(friday - timedelta(days=4)),
                "to_date": str(friday + timedelta(days=3)),
            },
        )
        assert response.status_code == 201, response.text
        assert response.json()["days"] == 5
        balance = client.get(f"/api/employees/{emp['id']}/leave-balance").json()[0]
        assert balance["pending"] == 5 and balance["available"] == 7

    def test_insufficient_balance_rejected(self, client, make_employee, leave_type, next_monday):
        emp = make_employee()
        response = client.post(
            "/api/leaves",
            json={
                "employee_id": emp["id"],
                "leave_type_id": leave_type["id"],
                "from_date": str(next_monday),
                "to_date": str(next_monday + timedelta(days=20)),
            },
        )
        assert response.status_code == 400
        assert "Not enough" in response.json()["detail"]

    def test_overlapping_request_conflicts(self, client, make_employee, leave_type, next_monday):
        emp = make_employee()
        body = {"employee_id": emp["id"], "leave_type_id": leave_type["id"], "from_date": str(next_monday),
                "to_date": str(next_monday)}
        assert client.post("/api/leaves", json=body).status_code == 201
        assert client.post("/api/leaves", json=body).status_code == 409

    def test_approval_rules(self, client, make_employee, leave_type, next_monday):
        manager = make_employee(role="MANAGER")
        employee = make_employee(manager_id=manager["id"])
        peer = make_employee()
        leave = client.post(
            "/api/leaves",
            json={"employee_id": employee["id"], "leave_type_id": leave_type["id"],
                  "from_date": str(next_monday), "to_date": str(next_monday), "half_day": True},
        ).json()
        assert leave["days"] == 0.5

        assert client.post(f"/api/leaves/{leave['id']}/approve", json={"approver_id": peer["id"]}).status_code == 403
        assert client.post(f"/api/leaves/{leave['id']}/approve", json={"approver_id": employee["id"]}).status_code == 403

        approved = client.post(
            f"/api/leaves/{leave['id']}/approve", json={"approver_id": manager["id"], "comment": "Enjoy"}
        ).json()
        assert approved["status"] == "APPROVED"
        assert approved["approver_name"] == manager["first_name"] + " User"

        assert client.post(f"/api/leaves/{leave['id']}/reject", json={"approver_id": manager["id"]}).status_code == 409
        assert client.post(f"/api/leaves/{leave['id']}/cancel").status_code == 409
        balance = client.get(f"/api/employees/{employee['id']}/leave-balance").json()[0]
        assert balance["used"] == 0.5 and balance["available"] == 11.5

    def test_half_day_on_weekend_rejected(self, client, make_employee, leave_type, next_monday):
        emp = make_employee()
        saturday = next_monday + timedelta(days=5)
        response = client.post(
            "/api/leaves",
            json={"employee_id": emp["id"], "leave_type_id": leave_type["id"],
                  "from_date": str(saturday), "to_date": str(saturday), "half_day": True},
        )
        assert response.status_code == 400
        assert "weekends or holidays" in response.json()["detail"]

    def test_cancel_pending(self, client, make_employee, leave_type, next_monday):
        emp = make_employee()
        leave = client.post(
            "/api/leaves",
            json={"employee_id": emp["id"], "leave_type_id": leave_type["id"],
                  "from_date": str(next_monday), "to_date": str(next_monday)},
        ).json()
        assert client.post(f"/api/leaves/{leave['id']}/cancel").json()["status"] == "CANCELLED"
        assert client.get("/api/leaves", params={"status": "PENDING"}).json() == []


class TestAttendance:
    WEDNESDAY = date(2026, 10, 14)

    def test_on_time_check_in_and_check_out(self, client, make_employee, clock):
        emp = make_employee()
        clock(self.WEDNESDAY, 9, 5)
        record = client.post("/api/attendance/check-in", json={"employee_id": emp["id"]})
        assert record.status_code == 201
        assert record.json()["status"] == "PRESENT"
        clock(self.WEDNESDAY, 18, 35)
        out = client.post("/api/attendance/check-out", json={"employee_id": emp["id"]})
        assert out.json()["hours_worked"] == 9.5

    def test_late_and_duplicate_check_in(self, client, make_employee, clock):
        emp = make_employee()
        clock(self.WEDNESDAY, 9, 45)
        body = {"employee_id": emp["id"]}
        assert client.post("/api/attendance/check-in", json=body).json()["status"] == "LATE"
        assert client.post("/api/attendance/check-in", json=body).status_code == 409

    def test_client_cannot_choose_check_in_time(self, client, make_employee, clock):
        emp = make_employee()
        clock(self.WEDNESDAY, 10, 15)
        forged = {"employee_id": emp["id"], "at": f"{self.WEDNESDAY}T09:00:00+05:30"}
        record = client.post("/api/attendance/check-in", json=forged).json()
        assert record["status"] == "LATE"
        assert record["check_in"].startswith(f"{self.WEDNESDAY}T10:15")

    def test_check_out_without_check_in(self, client, make_employee, clock):
        emp = make_employee()
        clock(self.WEDNESDAY, 18, 0)
        response = client.post("/api/attendance/check-out", json={"employee_id": emp["id"]})
        assert response.status_code == 409
        assert response.json()["detail"] == "You have not checked in today"

    def test_check_out_after_midnight_closes_previous_day(self, client, make_employee, clock):
        emp = make_employee()
        clock(self.WEDNESDAY, 21, 0)
        client.post("/api/attendance/check-in", json={"employee_id": emp["id"]})
        clock(self.WEDNESDAY + timedelta(days=1), 0, 30)
        out = client.post("/api/attendance/check-out", json={"employee_id": emp["id"]})
        assert out.status_code == 200, out.text
        assert out.json()["date"] == str(self.WEDNESDAY)
        assert out.json()["hours_worked"] == 3.5

    def test_daily_board_marks_absent(self, client, make_employee, clock):
        present = make_employee()
        absent = make_employee()
        clock(self.WEDNESDAY, 9, 0)
        client.post("/api/attendance/check-in", json={"employee_id": present["id"]})
        board = {r["employee_id"]: r["status"] for r in client.get("/api/attendance", params={"date": str(self.WEDNESDAY)}).json()}
        assert board == {present["id"]: "PRESENT", absent["id"]: "ABSENT"}

    def test_daily_board_has_no_absences_on_non_working_or_future_days(self, client, make_employee, clock):
        make_employee()
        clock(self.WEDNESDAY, 12, 0)
        client.post("/api/holidays", json={"name": "Festival", "date": str(self.WEDNESDAY - timedelta(days=1))})
        for day in (self.WEDNESDAY - timedelta(days=4), self.WEDNESDAY - timedelta(days=1), self.WEDNESDAY + timedelta(days=1)):
            assert client.get("/api/attendance", params={"date": str(day)}).json() == [], day


def test_dashboard_stats(client, make_employee):
    make_employee()
    make_employee(status="EXITED")
    make_employee(date_of_joining=str(date.today() + timedelta(days=40)))
    stats = client.get("/api/dashboard/stats").json()
    assert stats["total_employees"] == 1
    assert stats["headcount_by_department"] == [{"department": "Engineering", "count": 1}]
    assert stats["pending_leaves"] == 0
    assert stats["absent_today"] <= 1


def test_seed_is_idempotent(client):
    with SessionLocal() as db:
        assert seed(db) is True
        assert seed(db) is False
    employees = client.get("/api/employees").json()
    assert len(employees) == 25
    assert sum(e["status"] == "EXITED" for e in employees) == 1
    admin = client.get("/api/employees/1").json()
    assert (admin["first_name"], admin["last_name"], admin["role"]) == ("Manasvi", "Sabbarwal", "ADMIN")
    departments = {d["code"]: d for d in client.get("/api/departments").json()}
    assert set(departments) == {"ENG", "SLS", "DSN", "HR", "FIN"}
    assert departments["HR"]["name"] == "People Ops"
    assert departments["HR"]["head_id"] == 1
    assert [t["code"] for t in client.get("/api/leave-types").json()] == ["CL", "SL", "EL"]
    assert len(client.get("/api/holidays", params={"year": 2026}).json()) == 15
    stats = client.get("/api/dashboard/stats").json()
    assert stats["pending_leaves"] == 5
    holidays = {date.fromisoformat(h["date"]) for h in client.get("/api/holidays", params={"year": 2026}).json()}
    for leave in client.get("/api/leaves", params={"status": "PENDING"}).json():
        start = date.fromisoformat(leave["from_date"])
        assert start.weekday() < 5 and start not in holidays
        assert leave["days"] > 0


def test_list_endpoints_do_not_issue_a_query_per_row(client, make_employee, leave_type, next_monday):
    from sqlalchemy import event

    from app.db import engine

    boss = make_employee(role="MANAGER")
    for _ in range(6):
        emp = make_employee(manager_id=boss["id"])
        client.post("/api/leaves", json={"employee_id": emp["id"], "leave_type_id": leave_type["id"],
                                         "from_date": str(next_monday), "to_date": str(next_monday)})

    statements = []
    listener = lambda *args: statements.append(args[2])
    event.listen(engine, "before_cursor_execute", listener)
    try:
        for path in ("/api/employees", "/api/leaves", "/api/departments"):
            statements.clear()
            client.get(path)
            assert len(statements) <= 5, (path, len(statements))
    finally:
        event.remove(engine, "before_cursor_execute", listener)
