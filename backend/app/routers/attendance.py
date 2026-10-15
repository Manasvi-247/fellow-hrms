import calendar
from datetime import date, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..db import get_db
from ..models import Attendance, Employee, LeaveRequest
from ..schemas import AttendanceAction, AttendanceOut
from ..services import (
    ATTENDANCE_LOAD,
    approved_leaves_on,
    attendance_out,
    get_or_404,
    is_working_day,
    late_cutoff,
    now_local,
    today_local,
    working_days,
)

router = APIRouter(prefix="/api/attendance", tags=["attendance"])


def placeholder(emp: Employee, day: date, status_value: str) -> AttendanceOut:
    return AttendanceOut(
        id=None,
        employee_id=emp.id,
        employee_name=emp.full_name,
        department_name=emp.department.name if emp.department else None,
        date=day,
        check_in=None,
        check_out=None,
        hours_worked=None,
        status=status_value,
    )


def daily_board(db: Session, day: date, department_id: int | None) -> list[AttendanceOut]:
    stmt = (
        select(Employee)
        .options(selectinload(Employee.department))
        .where(Employee.status != "EXITED", Employee.date_of_joining <= day)
    )
    if department_id is not None:
        stmt = stmt.where(Employee.department_id == department_id)
    employees = list(db.scalars(stmt.order_by(Employee.first_name)))
    records = {
        r.employee_id: r
        for r in db.scalars(select(Attendance).options(*ATTENDANCE_LOAD).where(Attendance.date == day))
    }
    working = is_working_day(db, day)
    on_leave = {l.employee_id for l in approved_leaves_on(db, day)} if working else set()
    can_be_absent = working and day <= today_local()
    rows = []
    for emp in employees:
        if emp.id in records:
            rows.append(attendance_out(records[emp.id]))
        elif emp.id in on_leave:
            rows.append(placeholder(emp, day, "ON_LEAVE"))
        elif can_be_absent:
            rows.append(placeholder(emp, day, "ABSENT"))
    return rows


def monthly_history(db: Session, emp: Employee, month: str) -> list[AttendanceOut]:
    try:
        year, mon = (int(part) for part in month.split("-"))
        start = date(year, mon, 1)
    except ValueError:
        raise HTTPException(status_code=400, detail="month must look like YYYY-MM")
    end = min(date(year, mon, calendar.monthrange(year, mon)[1]), today_local())
    start = max(start, emp.date_of_joining)
    if end < start:
        return []
    records = {
        r.date: r
        for r in db.scalars(
            select(Attendance)
            .options(*ATTENDANCE_LOAD)
            .where(Attendance.employee_id == emp.id, Attendance.date.between(start, end))
        )
    }
    leaves = list(
        db.scalars(
            select(LeaveRequest).where(
                LeaveRequest.employee_id == emp.id,
                LeaveRequest.status == "APPROVED",
                LeaveRequest.from_date <= end,
                LeaveRequest.to_date >= start,
            )
        )
    )
    rows = []
    for day in working_days(db, start, end):
        if day in records:
            rows.append(attendance_out(records[day]))
        elif any(l.from_date <= day <= l.to_date for l in leaves):
            rows.append(placeholder(emp, day, "ON_LEAVE"))
        else:
            rows.append(placeholder(emp, day, "ABSENT"))
    return rows


@router.get("", response_model=list[AttendanceOut])
def list_attendance(
    day: date | None = Query(default=None, alias="date"),
    employee_id: int | None = None,
    department_id: int | None = None,
    month: str | None = None,
    db: Session = Depends(get_db),
):
    if employee_id is not None and month:
        emp = get_or_404(db, Employee, employee_id, "Employee")
        return monthly_history(db, emp, month)
    rows = daily_board(db, day or today_local(), department_id)
    if employee_id is not None:
        rows = [r for r in rows if r.employee_id == employee_id]
    return rows


@router.post("/check-in", response_model=AttendanceOut, status_code=status.HTTP_201_CREATED)
def check_in(payload: AttendanceAction, db: Session = Depends(get_db)):
    emp = get_or_404(db, Employee, payload.employee_id, "Employee")
    if emp.status == "EXITED":
        raise HTTPException(status_code=400, detail="Exited employees cannot check in")
    moment = now_local()
    existing = db.scalar(
        select(Attendance).where(Attendance.employee_id == emp.id, Attendance.date == moment.date())
    )
    if existing:
        raise HTTPException(status_code=409, detail="Already checked in today")
    record = Attendance(
        employee_id=emp.id,
        date=moment.date(),
        check_in=moment.astimezone(timezone.utc),
        status="LATE" if moment.time() > late_cutoff() else "PRESENT",
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return attendance_out(record)


@router.post("/check-out", response_model=AttendanceOut)
def check_out(payload: AttendanceAction, db: Session = Depends(get_db)):
    emp = get_or_404(db, Employee, payload.employee_id, "Employee")
    moment = now_local()
    # Look back one day so a shift that crosses midnight can still be closed.
    recent = list(
        db.scalars(
            select(Attendance)
            .where(Attendance.employee_id == emp.id, Attendance.date >= moment.date() - timedelta(days=1))
            .order_by(Attendance.date.desc())
        )
    )
    record = next((r for r in recent if r.check_out is None), None)
    if record is None:
        if any(r.date == moment.date() for r in recent):
            raise HTTPException(status_code=409, detail="Already checked out today")
        raise HTTPException(status_code=409, detail="You have not checked in today")
    record.check_out = moment.astimezone(timezone.utc)
    db.commit()
    db.refresh(record)
    return attendance_out(record)
