"""Loads realistic demo data. Safe to run repeatedly: does nothing if employees already exist."""

import random
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .db import SessionLocal
from .models import Attendance, Department, Employee, Holiday, LeaveRequest, LeaveType
from .services import TZ, count_leave_days, late_cutoff, today_local, working_days

DEPARTMENTS = [
    ("Engineering", "ENG", "Builds and runs the product"),
    ("Product", "PRD", "Owns the roadmap and user research"),
    ("Sales", "SAL", "Brings in and grows customers"),
    ("Human Resources", "HR", "Hiring, culture, and people operations"),
    ("Finance", "FIN", "Payroll, accounts, and compliance"),
]

# first, last, gender, department code, designation, role, years ago joined, salary (INR per year)
PEOPLE = [
    ("Rohit", "Mehra", "MALE", "HR", "Head of People", "ADMIN", 6, 3200000),
    ("Ananya", "Rao", "FEMALE", "ENG", "Engineering Manager", "MANAGER", 4, 2800000),
    ("Vikram", "Iyer", "MALE", "PRD", "Product Lead", "MANAGER", 3, 2600000),
    ("Sneha", "Kapoor", "FEMALE", "SAL", "Sales Manager", "MANAGER", 5, 2200000),
    ("Arjun", "Das", "MALE", "FIN", "Finance Manager", "MANAGER", 3, 2300000),
    ("Karan", "Shah", "MALE", "ENG", "Senior Backend Engineer", "EMPLOYEE", 3, 2100000),
    ("Priya", "Nair", "FEMALE", "ENG", "Frontend Engineer", "EMPLOYEE", 2, 1600000),
    ("Aditya", "Verma", "MALE", "ENG", "DevOps Engineer", "EMPLOYEE", 2, 1800000),
    ("Neha", "Gupta", "FEMALE", "ENG", "QA Engineer", "EMPLOYEE", 1, 1200000),
    ("Rahul", "Joshi", "MALE", "ENG", "Backend Engineer", "EMPLOYEE", 1, 1400000),
    ("Ishita", "Banerjee", "FEMALE", "ENG", "Data Engineer", "EMPLOYEE", 2, 1700000),
    ("Siddharth", "Menon", "MALE", "ENG", "Software Engineer Intern", "EMPLOYEE", 0, 480000),
    ("Kavya", "Reddy", "FEMALE", "ENG", "Mobile Engineer", "EMPLOYEE", 1, 1500000),
    ("Meera", "Pillai", "FEMALE", "PRD", "Product Designer", "EMPLOYEE", 2, 1500000),
    ("Aman", "Malhotra", "MALE", "PRD", "Product Manager", "EMPLOYEE", 1, 1900000),
    ("Tanvi", "Kulkarni", "FEMALE", "PRD", "UX Researcher", "EMPLOYEE", 0, 1100000),
    ("Harsh", "Agarwal", "MALE", "SAL", "Account Executive", "EMPLOYEE", 2, 1000000),
    ("Pooja", "Singh", "FEMALE", "SAL", "Sales Development Rep", "EMPLOYEE", 1, 700000),
    ("Nikhil", "Chopra", "MALE", "SAL", "Account Executive", "EMPLOYEE", 3, 1100000),
    ("Divya", "Bhat", "FEMALE", "SAL", "Customer Success Manager", "EMPLOYEE", 0, 900000),
    ("Riya", "Sen", "FEMALE", "HR", "HR Generalist", "EMPLOYEE", 2, 800000),
    ("Kunal", "Desai", "MALE", "HR", "Talent Acquisition Partner", "EMPLOYEE", 1, 850000),
    ("Shreya", "Patel", "FEMALE", "FIN", "Accountant", "EMPLOYEE", 2, 750000),
    ("Manish", "Tiwari", "MALE", "FIN", "Payroll Specialist", "EMPLOYEE", 4, 820000),
    ("Aisha", "Khan", "FEMALE", "FIN", "Financial Analyst", "EMPLOYEE", 0, 950000),
]

CITIES = ["Koramangala, Bengaluru", "Powai, Mumbai", "Gachibowli, Hyderabad", "Baner, Pune", "Saket, New Delhi",
          "Velachery, Chennai", "Salt Lake, Kolkata", "Indiranagar, Bengaluru"]

LEAVE_TYPES = [
    ("Casual Leave", "CL", 12, "#4C9DB0"),
    ("Sick Leave", "SL", 10, "#FFBDC5"),
    ("Earned Leave", "EL", 18, "#C69FD5"),
]

HOLIDAYS_2026 = [
    ("Republic Day", date(2026, 1, 26), "PUBLIC"),
    ("Holi", date(2026, 3, 4), "PUBLIC"),
    ("Eid al-Fitr", date(2026, 3, 20), "OPTIONAL"),
    ("Labour Day", date(2026, 5, 1), "OPTIONAL"),
    ("Independence Day", date(2026, 8, 15), "PUBLIC"),
    ("Gandhi Jayanti", date(2026, 10, 2), "PUBLIC"),
    ("Dussehra", date(2026, 10, 20), "PUBLIC"),
    ("Diwali", date(2026, 11, 8), "PUBLIC"),
    ("Guru Nanak Jayanti", date(2026, 11, 24), "OPTIONAL"),
    ("Christmas", date(2026, 12, 25), "PUBLIC"),
]


def seed(db: Session) -> bool:
    if db.scalar(select(func.count(Employee.id))):
        return False

    rng = random.Random(42)
    today = today_local()

    for name, code, quota, color in LEAVE_TYPES:
        db.add(LeaveType(name=name, code=code, annual_quota=quota, color=color))
    for name, day, kind in HOLIDAYS_2026:
        db.add(Holiday(name=name, date=day, type=kind))

    departments = {}
    for name, code, description in DEPARTMENTS:
        departments[code] = Department(name=name, code=code, description=description)
        db.add(departments[code])
    db.flush()

    employees = []
    for idx, (first, last, gender, dept, title, role, years, salary) in enumerate(PEOPLE):
        joined = today - timedelta(days=365 * years + rng.randint(5, 300))
        if idx in (11, 15):
            joined = today.replace(day=1) + timedelta(days=rng.randint(0, max(0, today.day - 2)))
        born = date(rng.randint(1985, 2002), rng.randint(1, 12), rng.randint(1, 28))
        if idx in (8, 13):
            soon = today + timedelta(days=rng.randint(2, 12))
            born = born.replace(month=soon.month, day=min(soon.day, 28))
        emp = Employee(
            first_name=first,
            last_name=last,
            email=f"{first.lower()}.{last.lower()}@company.com",
            phone=f"+91 9{rng.randint(100000000, 999999999)}",
            designation=title,
            department_id=departments[dept].id,
            role=role,
            employment_type="INTERN" if "Intern" in title else "FULL_TIME",
            status="ACTIVE",
            date_of_joining=joined,
            date_of_birth=born,
            gender=gender,
            salary=salary,
            address=rng.choice(CITIES),
        )
        db.add(emp)
        employees.append(emp)
    db.flush()

    for emp in employees:
        emp.employee_code = f"EMP-{emp.id:04d}"

    heads = {"HR": employees[0], "ENG": employees[1], "PRD": employees[2], "SAL": employees[3], "FIN": employees[4]}
    for code, head in heads.items():
        departments[code].head_id = head.id
    for emp, (_, _, _, dept, _, role, _, _) in zip(employees, PEOPLE):
        if emp is heads[dept]:
            emp.manager_id = None if role == "ADMIN" else employees[0].id
        else:
            emp.manager_id = heads[dept].id

    leave_types = {lt.code: lt for lt in db.scalars(select(LeaveType))}
    db.flush()

    def add_leave(emp, code, start, end, status, reason, half_day=False):
        days = count_leave_days(db, start, end, half_day)
        if days == 0:
            return None
        leave = LeaveRequest(
            employee_id=emp.id,
            leave_type_id=leave_types[code].id,
            from_date=start,
            to_date=end,
            half_day=half_day,
            days=days,
            reason=reason,
            status=status,
        )
        if status in ("APPROVED", "REJECTED"):
            leave.approver_id = (emp.manager_id or employees[0].id)
            leave.decided_at = datetime.now(TZ) - timedelta(days=rng.randint(1, 20))
        db.add(leave)
        return leave

    past = working_days(db, today - timedelta(days=60), today - timedelta(days=1))
    add_leave(employees[6], "CL", today, today + timedelta(days=1), "APPROVED", "Family function in Kochi")
    add_leave(employees[16], "SL", today, today, "APPROVED", "Fever")
    add_leave(employees[13], "EL", today - timedelta(days=1), today + timedelta(days=2), "APPROVED", "Trip to Goa")
    add_leave(employees[5], "SL", today + timedelta(days=5), today + timedelta(days=6), "PENDING", "Dental surgery")
    add_leave(employees[9], "CL", today + timedelta(days=8), today + timedelta(days=8), "PENDING", "Bank work")
    add_leave(employees[17], "EL", today + timedelta(days=14), today + timedelta(days=18), "PENDING", "Sister's wedding")
    add_leave(employees[22], "CL", today + timedelta(days=3), today + timedelta(days=3), "PENDING", "Personal errand", True)
    add_leave(employees[19], "CL", today + timedelta(days=10), today + timedelta(days=10), "PENDING", "Moving house")
    add_leave(employees[10], "CL", past[5], past[6], "REJECTED", "Short trip")
    for emp in rng.sample(employees, 8):
        day = rng.choice(past[10:])
        add_leave(emp, rng.choice(["CL", "SL"]), day, day, "APPROVED", "Personal")
    db.flush()

    approved = list(db.scalars(select(LeaveRequest).where(LeaveRequest.status == "APPROVED")))

    def on_leave(emp_id, day):
        return any(l.employee_id == emp_id and l.from_date <= day <= l.to_date for l in approved)

    recent = working_days(db, today - timedelta(days=30), today)
    now = datetime.now(TZ)
    cutoff = late_cutoff()
    for day in recent:
        for emp in employees:
            if emp.date_of_joining > day or on_leave(emp.id, day):
                continue
            is_today = day == today
            if rng.random() < (0.12 if is_today else 0.05):
                continue
            minute = rng.randint(8 * 60 + 40, 10 * 60 + 5)
            check_in = datetime.combine(day, time(minute // 60, minute % 60), TZ)
            if is_today and check_in > now:
                continue
            check_out = None
            if not is_today:
                check_out = check_in + timedelta(hours=rng.uniform(7.5, 9.5))
            db.add(
                Attendance(
                    employee_id=emp.id,
                    date=day,
                    check_in=check_in.astimezone(timezone.utc),
                    check_out=check_out.astimezone(timezone.utc) if check_out else None,
                    status="LATE" if check_in.time() > cutoff else "PRESENT",
                )
            )

    db.commit()
    return True


def main():
    with SessionLocal() as db:
        created = seed(db)
    print("Seeded demo data" if created else "Demo data already present, skipping seed")


if __name__ == "__main__":
    main()
