from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Holiday
from ..schemas import HolidayIn, HolidayOut
from ..services import get_or_404, today_local

router = APIRouter(prefix="/api/holidays", tags=["holidays"])


@router.get("", response_model=list[HolidayOut])
def list_holidays(year: int | None = None, db: Session = Depends(get_db)):
    year = year or today_local().year
    stmt = select(Holiday).where(Holiday.date.between(date(year, 1, 1), date(year, 12, 31))).order_by(Holiday.date)
    return list(db.scalars(stmt))


@router.post("", response_model=HolidayOut, status_code=status.HTTP_201_CREATED)
def create_holiday(payload: HolidayIn, db: Session = Depends(get_db)):
    holiday = Holiday(**payload.model_dump())
    db.add(holiday)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A holiday already exists on this date")
    db.refresh(holiday)
    return holiday


@router.delete("/{holiday_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_holiday(holiday_id: int, db: Session = Depends(get_db)):
    db.delete(get_or_404(db, Holiday, holiday_id, "Holiday"))
    db.commit()
