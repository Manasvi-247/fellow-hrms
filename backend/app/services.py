from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from .config import settings
from .models import Attendance, Department, Employee, Holiday, LeaveRequest, LeaveType
from .schemas import AttendanceOut, DepartmentOut, EmployeeOut, LeaveBalanceOut, LeaveOut

TZ = ZoneInfo(settings.timezone)
ACTIVE_LEAVE_STATUSES = ("PENDING", "APPROVED")


def now_local() -> datetime:
    return datetime.now(TZ)


def today_local() -> date:
    return now_local().date()


def late_cutoff() -> time:
    hours, minutes = settings.late_after.split(":")
    return time(int(hours), int(minutes))


def to_local(value: datetime) -> datetime:
    if value.tzinfo is None:
        value = value.replace(tzinfo=ZoneInfo("UTC"))
    return value.astimezone(TZ)


def get_or_404(db: Session, model, obj_id: int, label: str):
    obj = db.get(model, obj_id)
    if obj is None:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    return obj


EMPLOYEE_LOAD = (selectinload(Employee.department), selectinload(Employee.manager))
LEAVE_LOAD = (
    selectinload(LeaveRequest.employee).selectinload(Employee.department),
    selectinload(LeaveRequest.leave_type),
    selectinload(LeaveRequest.approver),
)
ATTENDANCE_LOAD = (selectinload(Attendance.employee).selectinload(Employee.department),)


def commit_or_conflict(db: Session, message: str):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=message)


def employee_out(emp: Employee) -> EmployeeOut:
    return EmployeeOut.model_validate(emp)


def department_headcounts(db: Session) -> dict[int, int]:
    rows = db.execute(
        select(Employee.department_id, func.count(Employee.id))
        .where(Employee.status != "EXITED", Employee.department_id.is_not(None))
        .group_by(Employee.department_id)
    ).all()
    return dict(rows)


def department_out(dept: Department, headcount: int) -> DepartmentOut:
    return DepartmentOut(
        id=dept.id,
        name=dept.name,
        code=dept.code,
        description=dept.description,
        head_id=dept.head_id,
        head_name=dept.head.full_name if dept.head else None,
        headcount=headcount,
    )


def leave_out(leave: LeaveRequest) -> LeaveOut:
    emp = leave.employee
    return LeaveOut(
        id=leave.id,
        employee_id=leave.employee_id,
        employee_name=emp.full_name,
        department_name=emp.department_name,
        leave_type_id=leave.leave_type_id,
        leave_type_name=leave.leave_type.name,
        from_date=leave.from_date,
        to_date=leave.to_date,
        half_day=leave.half_day,
        days=leave.days,
        reason=leave.reason,
        status=leave.status,
        approver_id=leave.approver_id,
        approver_name=leave.approver.full_name if leave.approver else None,
        approver_comment=leave.approver_comment,
        applied_at=leave.applied_at,
        decided_at=leave.decided_at,
    )


def hours_between(check_in: datetime, check_out: datetime | None) -> float | None:
    if check_out is None:
        return None
    return round((to_local(check_out) - to_local(check_in)).total_seconds() / 3600, 2)


def attendance_out(record: Attendance) -> AttendanceOut:
    emp = record.employee
    return AttendanceOut(
        id=record.id,
        employee_id=record.employee_id,
        employee_name=emp.full_name,
        department_name=emp.department_name,
        date=record.date,
        check_in=to_local(record.check_in),
        check_out=to_local(record.check_out) if record.check_out else None,
        hours_worked=hours_between(record.check_in, record.check_out),
        status=record.status,
    )


def holiday_dates(db: Session, start: date, end: date) -> set[date]:
    return set(db.scalars(select(Holiday.date).where(Holiday.date.between(start, end))))


def working_days(db: Session, start: date, end: date) -> list[date]:
    holidays = holiday_dates(db, start, end)
    days = []
    current = start
    while current <= end:
        if current.weekday() < 5 and current not in holidays:
            days.append(current)
        current += timedelta(days=1)
    return days


def is_working_day(db: Session, day: date) -> bool:
    return bool(working_days(db, day, day))


def count_leave_days(db: Session, start: date, end: date, half_day: bool) -> float:
    days = len(working_days(db, start, end))
    if half_day and days:
        return 0.5
    return float(days)


def leave_balances(db: Session, employee_id: int, year: int | None = None) -> list[LeaveBalanceOut]:
    year = year or today_local().year
    start, end = date(year, 1, 1), date(year, 12, 31)
    rows = db.execute(
        select(LeaveRequest.leave_type_id, LeaveRequest.status, func.sum(LeaveRequest.days))
        .where(
            LeaveRequest.employee_id == employee_id,
            LeaveRequest.status.in_(ACTIVE_LEAVE_STATUSES),
            LeaveRequest.from_date.between(start, end),
        )
        .group_by(LeaveRequest.leave_type_id, LeaveRequest.status)
    ).all()
    totals = {(type_id, status): float(days or 0) for type_id, status, days in rows}
    balances = []
    for lt in db.scalars(select(LeaveType).order_by(LeaveType.id)):
        used = totals.get((lt.id, "APPROVED"), 0.0)
        pending = totals.get((lt.id, "PENDING"), 0.0)
        balances.append(
            LeaveBalanceOut(
                leave_type_id=lt.id,
                leave_type_name=lt.name,
                code=lt.code,
                total=lt.annual_quota,
                used=used,
                pending=pending,
                available=lt.annual_quota - used - pending,
            )
        )
    return balances


def approved_leaves_on(db: Session, day: date) -> list[LeaveRequest]:
    return list(
        db.scalars(
            select(LeaveRequest)
            .options(*LEAVE_LOAD)
            .where(
                LeaveRequest.status == "APPROVED",
                LeaveRequest.from_date <= day,
                LeaveRequest.to_date >= day,
            )
        )
    )
