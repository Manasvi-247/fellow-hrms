from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Department, Employee
from ..schemas import DepartmentIn, DepartmentOut, DepartmentUpdate
from ..services import department_out, get_or_404

router = APIRouter(prefix="/api/departments", tags=["departments"])


def commit_or_conflict(db: Session):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A department with this name or code already exists")


@router.get("", response_model=list[DepartmentOut])
def list_departments(db: Session = Depends(get_db)):
    return [department_out(db, d) for d in db.scalars(select(Department).order_by(Department.name))]


@router.get("/{department_id}", response_model=DepartmentOut)
def get_department(department_id: int, db: Session = Depends(get_db)):
    return department_out(db, get_or_404(db, Department, department_id, "Department"))


@router.post("", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
def create_department(payload: DepartmentIn, db: Session = Depends(get_db)):
    if payload.head_id is not None:
        get_or_404(db, Employee, payload.head_id, "Head of department")
    dept = Department(**payload.model_dump())
    db.add(dept)
    commit_or_conflict(db)
    db.refresh(dept)
    return department_out(db, dept)


@router.put("/{department_id}", response_model=DepartmentOut)
def update_department(department_id: int, payload: DepartmentUpdate, db: Session = Depends(get_db)):
    dept = get_or_404(db, Department, department_id, "Department")
    data = payload.model_dump(exclude_unset=True)
    if data.get("head_id") is not None:
        get_or_404(db, Employee, data["head_id"], "Head of department")
    for key, value in data.items():
        setattr(dept, key, value)
    commit_or_conflict(db)
    db.refresh(dept)
    return department_out(db, dept)


@router.delete("/{department_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_department(department_id: int, db: Session = Depends(get_db)):
    dept = get_or_404(db, Department, department_id, "Department")
    members = db.scalar(select(func.count(Employee.id)).where(Employee.department_id == department_id))
    if members:
        raise HTTPException(
            status_code=409,
            detail=f"{dept.name} still has {members} employee(s). Move them to another department first.",
        )
    db.delete(dept)
    db.commit()
