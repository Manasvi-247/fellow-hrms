from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Department, Employee
from ..schemas import EmployeeIn, EmployeeOut, EmployeeUpdate, LeaveBalanceOut
from ..services import employee_out, get_or_404, leave_balances

router = APIRouter(prefix="/api/employees", tags=["employees"])


def validate_refs(db: Session, data: dict, employee_id: int | None = None):
    if data.get("department_id") is not None:
        get_or_404(db, Department, data["department_id"], "Department")
    manager_id = data.get("manager_id")
    if manager_id is not None:
        if employee_id is not None and manager_id == employee_id:
            raise HTTPException(status_code=400, detail="An employee cannot be their own manager")
        get_or_404(db, Employee, manager_id, "Manager")


def commit_or_conflict(db: Session):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="An employee with this email already exists")


@router.get("", response_model=list[EmployeeOut])
def list_employees(
    q: str | None = None,
    department_id: int | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    role: str | None = None,
    db: Session = Depends(get_db),
):
    stmt = select(Employee).order_by(Employee.first_name, Employee.last_name)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(
                Employee.first_name.ilike(like),
                Employee.last_name.ilike(like),
                Employee.email.ilike(like),
                Employee.employee_code.ilike(like),
            )
        )
    if department_id is not None:
        stmt = stmt.where(Employee.department_id == department_id)
    if status_filter:
        stmt = stmt.where(Employee.status == status_filter)
    if role:
        stmt = stmt.where(Employee.role == role)
    return [employee_out(e) for e in db.scalars(stmt)]


@router.get("/{employee_id}", response_model=EmployeeOut)
def get_employee(employee_id: int, db: Session = Depends(get_db)):
    return employee_out(get_or_404(db, Employee, employee_id, "Employee"))


@router.post("", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED)
def create_employee(payload: EmployeeIn, db: Session = Depends(get_db)):
    data = payload.model_dump()
    validate_refs(db, data)
    emp = Employee(**data)
    db.add(emp)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="An employee with this email already exists")
    emp.employee_code = f"EMP-{emp.id:04d}"
    commit_or_conflict(db)
    db.refresh(emp)
    return employee_out(emp)


@router.put("/{employee_id}", response_model=EmployeeOut)
def update_employee(employee_id: int, payload: EmployeeUpdate, db: Session = Depends(get_db)):
    emp = get_or_404(db, Employee, employee_id, "Employee")
    data = payload.model_dump(exclude_unset=True)
    validate_refs(db, data, employee_id)
    for key, value in data.items():
        setattr(emp, key, value)
    commit_or_conflict(db)
    db.refresh(emp)
    return employee_out(emp)


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_employee(employee_id: int, db: Session = Depends(get_db)):
    emp = get_or_404(db, Employee, employee_id, "Employee")
    # SQLite in tests does not enforce ON DELETE SET NULL, so clear references explicitly.
    db.execute(update(Employee).where(Employee.manager_id == employee_id).values(manager_id=None))
    db.execute(update(Department).where(Department.head_id == employee_id).values(head_id=None))
    db.delete(emp)
    db.commit()


@router.get("/{employee_id}/reports", response_model=list[EmployeeOut])
def direct_reports(employee_id: int, db: Session = Depends(get_db)):
    get_or_404(db, Employee, employee_id, "Employee")
    stmt = select(Employee).where(Employee.manager_id == employee_id).order_by(Employee.first_name)
    return [employee_out(e) for e in db.scalars(stmt)]


@router.get("/{employee_id}/leave-balance", response_model=list[LeaveBalanceOut])
def leave_balance(employee_id: int, year: int | None = None, db: Session = Depends(get_db)):
    get_or_404(db, Employee, employee_id, "Employee")
    return leave_balances(db, employee_id, year)
