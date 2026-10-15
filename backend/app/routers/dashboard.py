from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Attendance, Department, Employee, Holiday, LeaveRequest
from ..schemas import (
    DashboardStats,
    DepartmentCount,
    OnLeaveItem,
    UpcomingAnniversary,
    UpcomingBirthday,
    UpcomingHoliday,
)
from ..services import approved_leaves_on, is_working_day, today_local

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

UPCOMING_WINDOW_DAYS = 14


def next_occurrence(original: date, today: date) -> date:
    for year in (today.year, today.year + 1):
        try:
            candidate = original.replace(year=year)
        except ValueError:
            candidate = date(year, 3, 1)
        if candidate >= today:
            return candidate
    return candidate


@router.get("/stats", response_model=DashboardStats)
def stats(db: Session = Depends(get_db)):
    today = today_local()
    window_end = today + timedelta(days=UPCOMING_WINDOW_DAYS)
    not_exited = list(db.scalars(select(Employee).where(Employee.status != "EXITED")))
    active = [e for e in not_exited if e.date_of_joining <= today]
    active_ids = {e.id for e in active}

    attendance_today = list(db.scalars(select(Attendance).where(Attendance.date == today)))
    present = sum(1 for a in attendance_today if a.employee_id in active_ids)
    late = sum(1 for a in attendance_today if a.employee_id in active_ids and a.status == "LATE")
    checked_in = {a.employee_id for a in attendance_today}

    leaves_today = [l for l in approved_leaves_on(db, today) if l.employee_id in active_ids]
    on_leave_ids = {l.employee_id for l in leaves_today} - checked_in
    absent = len(active_ids - checked_in - on_leave_ids) if is_working_day(db, today) else 0

    headcount = db.execute(
        select(Department.name, func.count(Employee.id))
        .join(Employee, Employee.department_id == Department.id)
        .where(Employee.status != "EXITED", Employee.date_of_joining <= today)
        .group_by(Department.name)
        .order_by(func.count(Employee.id).desc())
    ).all()

    birthdays, anniversaries = [], []
    for emp in active:
        if emp.date_of_birth:
            upcoming = next_occurrence(emp.date_of_birth, today)
            if upcoming <= window_end:
                birthdays.append(UpcomingBirthday(employee_id=emp.id, employee_name=emp.full_name, date=upcoming))
        upcoming = next_occurrence(emp.date_of_joining, today)
        years = upcoming.year - emp.date_of_joining.year
        if years > 0 and upcoming <= window_end:
            anniversaries.append(
                UpcomingAnniversary(employee_id=emp.id, employee_name=emp.full_name, date=upcoming, years=years)
            )

    holidays = db.scalars(select(Holiday).where(Holiday.date >= today).order_by(Holiday.date).limit(3))

    return DashboardStats(
        total_employees=len(active),
        present_today=present,
        on_leave_today=len(on_leave_ids),
        absent_today=absent,
        late_today=late,
        pending_leaves=db.scalar(select(func.count(LeaveRequest.id)).where(LeaveRequest.status == "PENDING")) or 0,
        new_joiners_this_month=sum(
            1 for e in not_exited if e.date_of_joining.year == today.year and e.date_of_joining.month == today.month
        ),
        headcount_by_department=[DepartmentCount(department=name, count=count) for name, count in headcount],
        on_leave_today_list=[
            OnLeaveItem(
                employee_id=l.employee_id,
                employee_name=l.employee.full_name,
                leave_type_name=l.leave_type.name,
                to_date=l.to_date,
            )
            for l in leaves_today
            if l.employee_id in on_leave_ids
        ],
        upcoming_holidays=[UpcomingHoliday(name=h.name, date=h.date) for h in holidays],
        upcoming_birthdays=sorted(birthdays, key=lambda b: b.date),
        upcoming_anniversaries=sorted(anniversaries, key=lambda a: a.date),
    )
