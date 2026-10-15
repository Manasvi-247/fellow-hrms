from datetime import date, datetime, timedelta, timezone

from app.db import SessionLocal
from app.seed import seed


def test_health(client):
    assert client.get("/health").json() == {"status": "UP"}


def test_ready_checks_database(client):
    assert client.get("/ready").json() == {"status": "READY"}


def test_root_reports_service(client):
    body = client.get("/").json()
    assert body["service"] == "HRMS API"
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
    def at(self, day: date, hh: int, mm: int) -> str:
        return datetime(day.year, day.month, day.day, hh, mm, tzinfo=timezone(timedelta(hours=5, minutes=30))).isoformat()

    def test_on_time_check_in_and_check_out(self, client, make_employee):
        emp = make_employee()
        day = date(2026, 10, 14)
        record = client.post("/api/attendance/check-in", json={"employee_id": emp["id"], "at": self.at(day, 9, 5)})
        assert record.status_code == 201
        assert record.json()["status"] == "PRESENT"
        out = client.post("/api/attendance/check-out", json={"employee_id": emp["id"], "at": self.at(day, 18, 35)})
        assert out.json()["hours_worked"] == 9.5

    def test_late_and_duplicate_check_in(self, client, make_employee):
        emp = make_employee()
        day = date(2026, 10, 14)
        body = {"employee_id": emp["id"], "at": self.at(day, 9, 45)}
        assert client.post("/api/attendance/check-in", json=body).json()["status"] == "LATE"
        assert client.post("/api/attendance/check-in", json=body).status_code == 409

    def test_check_out_without_check_in(self, client, make_employee):
        emp = make_employee()
        response = client.post("/api/attendance/check-out", json={"employee_id": emp["id"], "at": self.at(date(2026, 10, 14), 18, 0)})
        assert response.status_code == 409

    def test_daily_board_marks_absent(self, client, make_employee):
        present = make_employee()
        absent = make_employee()
        day = date(2026, 10, 14)
        client.post("/api/attendance/check-in", json={"employee_id": present["id"], "at": self.at(day, 9, 0)})
        board = {r["employee_id"]: r["status"] for r in client.get("/api/attendance", params={"date": str(day)}).json()}
        assert board == {present["id"]: "PRESENT", absent["id"]: "ABSENT"}


def test_dashboard_stats(client, make_employee):
    make_employee()
    make_employee(status="EXITED")
    stats = client.get("/api/dashboard/stats").json()
    assert stats["total_employees"] == 1
    assert stats["headcount_by_department"] == [{"department": "Engineering", "count": 1}]
    assert stats["pending_leaves"] == 0


def test_seed_is_idempotent(client):
    with SessionLocal() as db:
        assert seed(db) is True
        assert seed(db) is False
    employees = client.get("/api/employees").json()
    assert len(employees) == 25
    assert len(client.get("/api/departments").json()) == 5
    stats = client.get("/api/dashboard/stats").json()
    assert stats["pending_leaves"] >= 4
