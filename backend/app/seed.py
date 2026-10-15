"""Loads the Fellow demo data. Safe to run repeatedly: does nothing if employees already exist."""

import random
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .db import SessionLocal
from .models import Attendance, Department, Employee, Holiday, LeaveRequest, LeaveType
from .services import TZ, count_leave_days, late_cutoff, today_local, working_days

DEPARTMENTS = [
    ("Engineering", "ENG", "Builds and runs the product, from APIs to the mobile app."),
    ("Sales", "SLS", "Finds new customers and grows existing accounts."),
    ("Design", "DSN", "Shapes how the product looks, feels and reads."),
    ("People Ops", "HR", "Hiring, onboarding, culture and everyday employee care."),
    ("Finance", "FIN", "Payroll, budgets, invoicing and compliance."),
]

HEADS = {"ENG": 4, "SLS": 2, "DSN": 3, "HR": 1, "FIN": 5}

# Joining dates of None are filled in relative to today so the demo always has new joiners this month.
# id, first, last, designation, department, manager id, role, employment type, status, joined, born, gender,
# salary (INR per year), address
PEOPLE = [
    (1, "Manasvi", "Sabbarwal", "Head of People Operations", "HR", None, "ADMIN", "FULL_TIME", "ACTIVE",
     date(2019, 4, 1), date(1990, 6, 14), "FEMALE", 4200000, "Indiranagar, Bengaluru"),
    (2, "Meera", "Iyer", "Sales Director", "SLS", 1, "MANAGER", "FULL_TIME", "ACTIVE",
     date(2020, 2, 17), date(1987, 11, 3), "FEMALE", 3600000, "Bandra West, Mumbai"),
    (3, "Arjun", "Das", "Design Lead", "DSN", 1, "MANAGER", "FULL_TIME", "ACTIVE",
     date(2023, 10, 25), date(1990, 8, 19), "MALE", 2800000, "Salt Lake, Kolkata"),
    (4, "Ananya", "Rao", "Engineering Manager", "ENG", 1, "MANAGER", "FULL_TIME", "ACTIVE",
     date(2022, 7, 11), date(1991, 3, 2), "FEMALE", 2400000, "Koramangala, Bengaluru"),
    (5, "Vikram", "Singh", "Finance Controller", "FIN", 1, "MANAGER", "FULL_TIME", "ACTIVE",
     date(2021, 1, 4), date(1985, 12, 9), "MALE", 2600000, "Vasant Kunj, New Delhi"),
    (6, "Siddharth", "Kulkarni", "Senior Backend Engineer", "ENG", 4, "EMPLOYEE", "FULL_TIME", "ACTIVE",
     date(2021, 9, 13), date(1992, 5, 27), "MALE", 2200000, "Baner, Pune"),
    (7, "Priya", "Nair", "Frontend Engineer", "ENG", 4, "EMPLOYEE", "FULL_TIME", "ON_LEAVE",
     date(2023, 3, 6), date(1995, 1, 15), "FEMALE", 1500000, "HSR Layout, Bengaluru"),
    (8, "Aditya", "Joshi", "DevOps Engineer", "ENG", 4, "EMPLOYEE", "FULL_TIME", "ACTIVE",
     date(2022, 11, 21), date(1993, 7, 8), "MALE", 1800000, "Whitefield, Bengaluru"),
    (9, "Neha", "Gupta", "QA Engineer", "ENG", 4, "EMPLOYEE", "FULL_TIME", "ACTIVE",
     date(2024, 2, 12), date(1994, 10, 22), "FEMALE", 1100000, "Sector 62, Noida"),
    (10, "Rahul", "Verma", "Backend Engineer", "ENG", 4, "EMPLOYEE", "FULL_TIME", "ACTIVE",
     date(2024, 6, 3), date(1996, 4, 11), "MALE", 1400000, "Gachibowli, Hyderabad"),
    (11, "Kavya", "Reddy", "Mobile Engineer", "ENG", 4, "EMPLOYEE", "FULL_TIME", "ON_LEAVE",
     date(2023, 8, 28), date(1995, 9, 30), "FEMALE", 1450000, "Madhapur, Hyderabad"),
    (12, "Karan", "Shah", "Account Executive", "SLS", 2, "EMPLOYEE", "FULL_TIME", "ACTIVE",
     date(2022, 10, 17), date(1993, 2, 19), "MALE", 1200000, "Navrangpura, Ahmedabad"),
    (13, "Ishita", "Banerjee", "Product Designer", "DSN", 3, "EMPLOYEE", "FULL_TIME", "ACTIVE",
     date(2023, 5, 15), date(1996, 10, 27), "FEMALE", 1600000, "Ballygunge, Kolkata"),
    (14, "Farhan", "Qureshi", "Data Engineer", "ENG", 4, "EMPLOYEE", "FULL_TIME", "ACTIVE",
     date(2022, 4, 25), date(1992, 12, 5), "MALE", 1900000, "Jayanagar, Bengaluru"),
    (15, "Sneha", "Pillai", "HR Generalist", "HR", 1, "EMPLOYEE", "FULL_TIME", "ACTIVE",
     date(2021, 6, 7), date(1993, 8, 23), "FEMALE", 1000000, "Kakkanad, Kochi"),
    (16, "Aman", "Choudhary", "Sales Development Rep", "SLS", 2, "EMPLOYEE", "FULL_TIME", "ACTIVE",
     date(2025, 1, 20), date(1998, 3, 14), "MALE", 700000, "Malviya Nagar, Jaipur"),
    (17, "Divya", "Menon", "UX Researcher", "DSN", 3, "EMPLOYEE", "PART_TIME", "ACTIVE",
     date(2024, 9, 9), date(1994, 6, 2), "FEMALE", 900000, "Adyar, Chennai"),
    (18, "Harsh", "Agarwal", "Accountant", "FIN", 5, "EMPLOYEE", "FULL_TIME", "ACTIVE",
     date(2023, 1, 16), date(1995, 11, 18), "MALE", 850000, "Civil Lines, Lucknow"),
    (19, "Pooja", "Desai", "Talent Acquisition Specialist", "HR", 1, "EMPLOYEE", "FULL_TIME", "ON_LEAVE",
     date(2024, 4, 1), date(1997, 7, 21), "FEMALE", 950000, "Andheri East, Mumbai"),
    (20, "Nikhil", "Bhatt", "Account Manager", "SLS", 2, "EMPLOYEE", "FULL_TIME", "ACTIVE",
     date(2021, 10, 28), date(1990, 1, 29), "MALE", 1700000, "Koregaon Park, Pune"),
    (21, "Tanvi", "Kapoor", "Visual Design Intern", "DSN", 3, "EMPLOYEE", "INTERN", "ACTIVE",
     date(2026, 7, 1), date(2003, 5, 9), "FEMALE", 360000, "Hauz Khas, New Delhi"),
    (22, "Manish", "Yadav", "Payroll Specialist", "FIN", 5, "EMPLOYEE", "CONTRACT", "ACTIVE",
     date(2025, 3, 10), date(1991, 10, 19), "MALE", 800000, "Gomti Nagar, Lucknow"),
    (23, "Riya", "Sethi", "Engineering Intern", "ENG", 4, "EMPLOYEE", "INTERN", "ACTIVE",
     None, date(2004, 2, 26), "FEMALE", 420000, "Sector 17, Chandigarh"),
    (24, "Yash", "Malhotra", "Sales Associate", "SLS", 2, "EMPLOYEE", "FULL_TIME", "ACTIVE",
     None, date(1999, 9, 4), "MALE", 650000, "Model Town, Ludhiana"),
    (25, "Gaurav", "Tiwari", "Financial Analyst", "FIN", 5, "EMPLOYEE", "FULL_TIME", "EXITED",
     date(2022, 8, 8), date(1993, 4, 16), "MALE", 1150000, "Arera Colony, Bhopal"),
]

RECENT_JOINERS = {23: 10, 24: 3}

LEAVE_TYPES = [
    ("Casual Leave", "CL", 12, "#4C9DB0"),
    ("Sick Leave", "SL", 10, "#FFBDC5"),
    ("Earned Leave", "EL", 18, "#A58FD0"),
]

HOLIDAYS_2026 = [
    ("New Year's Day", date(2026, 1, 1), "OPTIONAL"),
    ("Republic Day", date(2026, 1, 26), "PUBLIC"),
    ("Holi", date(2026, 3, 4), "PUBLIC"),
    ("Eid ul-Fitr", date(2026, 3, 20), "OPTIONAL"),
    ("Good Friday", date(2026, 4, 3), "OPTIONAL"),
    ("Labour Day", date(2026, 5, 1), "PUBLIC"),
    ("Independence Day", date(2026, 8, 15), "PUBLIC"),
    ("Raksha Bandhan", date(2026, 8, 28), "OPTIONAL"),
    ("Ganesh Chaturthi", date(2026, 9, 14), "PUBLIC"),
    ("Gandhi Jayanti", date(2026, 10, 2), "PUBLIC"),
    ("Dussehra", date(2026, 10, 20), "PUBLIC"),
    ("Diwali", date(2026, 11, 8), "PUBLIC"),
    ("Bhai Dooj", date(2026, 11, 11), "OPTIONAL"),
    ("Guru Nanak Jayanti", date(2026, 11, 24), "OPTIONAL"),
    ("Christmas", date(2026, 12, 25), "PUBLIC"),
]

# employee id, type, start (calendar days from today, moved to the next working day), working days,
# half day, reason, status, approver id, approver comment, applied (days before today)
LEAVES = [
    (12, "SL", 6, 2, False, "Fever and body ache, doctor advised rest", "PENDING", None, None, 0),
    (9, "CL", 8, 1, False, "Sister's engagement ceremony", "PENDING", None, None, 1),
    (13, "EL", 18, 5, False, "Family trip to Coorg", "PENDING", None, None, 2),
    (8, "CL", 4, 1, True, "Bank appointment in the morning", "PENDING", None, None, 0),
    (16, "EL", 11, 3, False, "Visiting family in Jaipur", "PENDING", None, None, 3),
    (7, "CL", -1, 3, False, "Personal work", "APPROVED", 4, None, 7),
    (19, "EL", -3, 5, False, "Wedding in the family", "APPROVED", 1, "Congratulations! Enjoy the week.", 20),
    (11, "SL", 0, 1, False, "Migraine", "APPROVED", 4, "Get well soon", 0),
    (12, "CL", -37, 2, False, "Moving to a new flat", "APPROVED", 2, None, 44),
    (12, "CL", -86, 1, False, "Personal errand", "REJECTED", 2, "Quarter close week, could you pick another day?", 92),
    (12, "EL", -157, 5, False, "Vacation in Goa", "APPROVED", 2, None, 178),
    (9, "SL", -72, 2, False, "Viral fever", "APPROVED", 4, None, 72),
    (9, "CL", -118, 1, False, "Personal", "CANCELLED", None, None, 127),
    (10, "CL", -16, 1, False, "Family function", "APPROVED", 4, None, 23),
    (6, "EL", 67, 8, False, "Year end travel", "APPROVED", 4, None, 14),
    (4, "CL", -27, 1, False, "Personal", "APPROVED", 1, None, 35),
    (2, "EL", -136, 5, False, "Family holiday", "APPROVED", 1, None, 158),
    (15, "SL", -9, 1, False, "Dental procedure", "APPROVED", 1, None, 10),
]

# Today: these people are absent, and these checked in late at the given local time.
ABSENT_TODAY = {9, 10, 16}
LATE_TODAY = {12: time(9, 42), 14: time(9, 51)}


def phone_for(emp_id: int) -> str:
    return f"+91 9{8000 + (emp_id * 1373) % 2000} {10000 + (emp_id * 48271) % 90000}"


def seed(db: Session) -> bool:
    if db.scalar(select(func.count(Employee.id))):
        return False

    rng = random.Random(42)
    today = today_local()
    now = datetime.now(TZ)

    for name, code, quota, color in LEAVE_TYPES:
        db.add(LeaveType(name=name, code=code, annual_quota=quota, color=color))
    for name, day, kind in HOLIDAYS_2026:
        db.add(Holiday(name=name, date=day, type=kind))

    departments = {}
    for name, code, description in DEPARTMENTS:
        departments[code] = Department(name=name, code=code, description=description)
        db.add(departments[code])
        db.flush()

    employees = {}
    for (key, first, last, title, dept, _, role, kind, status, joined, born, gender, salary,
         address) in PEOPLE:
        if joined is None:
            joined = max(today.replace(day=1), today - timedelta(days=RECENT_JOINERS[key]))
        emp = Employee(
            first_name=first,
            last_name=last,
            email=f"{first.lower()}.{last.lower()}@company.com",
            phone=phone_for(key),
            designation=title,
            department_id=departments[dept].id,
            role=role,
            employment_type=kind,
            status=status,
            date_of_joining=joined,
            date_of_birth=born,
            gender=gender,
            salary=salary,
            address=address,
        )
        db.add(emp)
        db.flush()
        employees[key] = emp

    for emp in employees.values():
        emp.employee_code = f"EMP-{emp.id:04d}"
    for row in PEOPLE:
        if row[5] is not None:
            employees[row[0]].manager_id = employees[row[5]].id
    for code, head in HEADS.items():
        departments[code].head_id = employees[head].id

    leave_types = {lt.code: lt for lt in db.scalars(select(LeaveType))}
    db.flush()

    def span(offset: int, length: int) -> tuple[date, date]:
        ahead = working_days(db, today + timedelta(days=offset), today + timedelta(days=offset + length * 3 + 14))
        return ahead[0], ahead[length - 1]

    approved = []
    for emp_key, code, offset, length, half, reason, status, approver, comment, applied in LEAVES:
        start, end = span(offset, length)
        applied_at = now - timedelta(days=applied, hours=rng.randint(0, 3), minutes=rng.randint(0, 59))
        leave = LeaveRequest(
            employee_id=employees[emp_key].id,
            leave_type_id=leave_types[code].id,
            from_date=start,
            to_date=end,
            half_day=half,
            days=count_leave_days(db, start, end, half),
            reason=reason,
            status=status,
            approver_id=employees[approver].id if approver else None,
            approver_comment=comment,
            applied_at=applied_at.astimezone(timezone.utc),
        )
        if status != "PENDING":
            leave.decided_at = (applied_at + timedelta(hours=rng.randint(1, 6))).astimezone(timezone.utc)
        if status == "APPROVED" and not half:
            approved.append(leave)
        db.add(leave)

    def on_leave(emp_id: int, day: date) -> bool:
        return any(l.employee_id == emp_id and l.from_date <= day <= l.to_date for l in approved)

    cutoff = late_cutoff()
    for day in working_days(db, today - timedelta(days=45), today):
        is_today = day == today
        for key, emp in employees.items():
            if emp.status == "EXITED" or emp.date_of_joining > day or on_leave(emp.id, day):
                continue
            if is_today:
                if key in ABSENT_TODAY:
                    continue
                minute = rng.randint(8 * 60 + 40, 9 * 60 + 28)
            elif rng.random() < 0.05:
                continue
            elif rng.random() < 0.15:
                minute = rng.randint(9 * 60 + 31, 10 * 60 + 5)
            else:
                minute = rng.randint(8 * 60 + 40, 9 * 60 + 28)
            at = LATE_TODAY.get(key) if is_today and key in LATE_TODAY else time(minute // 60, minute % 60)
            check_in = datetime.combine(day, at, TZ)
            if is_today and check_in > now:
                continue
            check_out = None if is_today else check_in + timedelta(hours=rng.uniform(7.5, 9.5))
            db.add(
                Attendance(
                    employee_id=emp.id,
                    date=day,
                    check_in=check_in.astimezone(timezone.utc),
                    check_out=check_out.astimezone(timezone.utc) if check_out else None,
                    status="LATE" if at > cutoff else "PRESENT",
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
