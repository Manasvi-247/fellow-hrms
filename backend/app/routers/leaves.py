from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Employee, LeaveRequest, LeaveType
from ..schemas import LeaveApply, LeaveDecision, LeaveOut, LeaveTypeOut
from ..services import ACTIVE_LEAVE_STATUSES, count_leave_days, get_or_404, leave_balances, leave_out

router = APIRouter(prefix="/api", tags=["leave"])


@router.get("/leave-types", response_model=list[LeaveTypeOut])
def list_leave_types(db: Session = Depends(get_db)):
    return list(db.scalars(select(LeaveType).order_by(LeaveType.id)))


@router.get("/leaves", response_model=list[LeaveOut])
def list_leaves(
    employee_id: int | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    leave_type_id: int | None = None,
    department_id: int | None = None,
    from_: date | None = Query(default=None, alias="from"),
    to: date | None = None,
    db: Session = Depends(get_db),
):
    stmt = select(LeaveRequest).join(LeaveRequest.employee).order_by(LeaveRequest.applied_at.desc())
    if employee_id is not None:
        stmt = stmt.where(LeaveRequest.employee_id == employee_id)
    if status_filter:
        stmt = stmt.where(LeaveRequest.status == status_filter)
    if leave_type_id is not None:
        stmt = stmt.where(LeaveRequest.leave_type_id == leave_type_id)
    if department_id is not None:
        stmt = stmt.where(Employee.department_id == department_id)
    if from_ is not None:
        stmt = stmt.where(LeaveRequest.to_date >= from_)
    if to is not None:
        stmt = stmt.where(LeaveRequest.from_date <= to)
    return [leave_out(l) for l in db.scalars(stmt)]


@router.get("/leaves/{leave_id}", response_model=LeaveOut)
def get_leave(leave_id: int, db: Session = Depends(get_db)):
    return leave_out(get_or_404(db, LeaveRequest, leave_id, "Leave request"))


@router.post("/leaves", response_model=LeaveOut, status_code=status.HTTP_201_CREATED)
def apply_leave(payload: LeaveApply, db: Session = Depends(get_db)):
    emp = get_or_404(db, Employee, payload.employee_id, "Employee")
    leave_type = get_or_404(db, LeaveType, payload.leave_type_id, "Leave type")
    if emp.status == "EXITED":
        raise HTTPException(status_code=400, detail="Exited employees cannot apply for leave")
    if payload.to_date < payload.from_date:
        raise HTTPException(status_code=400, detail="End date must be on or after the start date")
    if payload.half_day and payload.from_date != payload.to_date:
        raise HTTPException(status_code=400, detail="A half day leave must start and end on the same date")

    overlap = db.scalar(
        select(LeaveRequest.id).where(
            LeaveRequest.employee_id == emp.id,
            LeaveRequest.status.in_(ACTIVE_LEAVE_STATUSES),
            LeaveRequest.from_date <= payload.to_date,
            LeaveRequest.to_date >= payload.from_date,
        )
    )
    if overlap:
        raise HTTPException(status_code=409, detail="This overlaps with another pending or approved leave")

    days = count_leave_days(db, payload.from_date, payload.to_date, payload.half_day)
    if days == 0:
        raise HTTPException(status_code=400, detail="The selected dates are all weekends or holidays")

    balance = next(b for b in leave_balances(db, emp.id, payload.from_date.year) if b.leave_type_id == leave_type.id)
    if days > balance.available:
        raise HTTPException(
            status_code=400,
            detail=f"Not enough {leave_type.name} balance: requested {days:g}, available {balance.available:g}",
        )

    leave = LeaveRequest(**payload.model_dump(), days=days, status="PENDING")
    db.add(leave)
    db.commit()
    db.refresh(leave)
    return leave_out(leave)


def decide(db: Session, leave_id: int, payload: LeaveDecision, new_status: str) -> LeaveOut:
    leave = get_or_404(db, LeaveRequest, leave_id, "Leave request")
    approver = get_or_404(db, Employee, payload.approver_id, "Approver")
    if approver.role not in ("ADMIN", "MANAGER"):
        raise HTTPException(status_code=403, detail="Only admins and managers can approve or reject leave")
    if approver.id == leave.employee_id:
        raise HTTPException(status_code=403, detail="You cannot approve or reject your own leave")
    if leave.status != "PENDING":
        raise HTTPException(status_code=409, detail=f"This request is already {leave.status.lower()}")
    leave.status = new_status
    leave.approver_id = approver.id
    leave.approver_comment = payload.comment
    leave.decided_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(leave)
    return leave_out(leave)


@router.post("/leaves/{leave_id}/approve", response_model=LeaveOut)
def approve_leave(leave_id: int, payload: LeaveDecision, db: Session = Depends(get_db)):
    return decide(db, leave_id, payload, "APPROVED")


@router.post("/leaves/{leave_id}/reject", response_model=LeaveOut)
def reject_leave(leave_id: int, payload: LeaveDecision, db: Session = Depends(get_db)):
    return decide(db, leave_id, payload, "REJECTED")


@router.post("/leaves/{leave_id}/cancel", response_model=LeaveOut)
def cancel_leave(leave_id: int, db: Session = Depends(get_db)):
    leave = get_or_404(db, LeaveRequest, leave_id, "Leave request")
    if leave.status != "PENDING":
        raise HTTPException(status_code=409, detail="Only pending requests can be cancelled")
    leave.status = "CANCELLED"
    leave.decided_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(leave)
    return leave_out(leave)
