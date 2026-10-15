from datetime import date, datetime
from typing import ClassVar, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Role = Literal["ADMIN", "MANAGER", "EMPLOYEE"]
EmploymentType = Literal["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"]
EmployeeStatus = Literal["ACTIVE", "ON_LEAVE", "EXITED"]
Gender = Literal["MALE", "FEMALE", "OTHER"]
LeaveStatus = Literal["PENDING", "APPROVED", "REJECTED", "CANCELLED"]
AttendanceStatus = Literal["PRESENT", "LATE", "ABSENT", "ON_LEAVE"]
HolidayType = Literal["PUBLIC", "OPTIONAL"]

EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class PartialUpdate(BaseModel):
    """Omitted fields are left unchanged; null is only accepted for fields that may be cleared."""

    nullable_fields: ClassVar[frozenset[str]] = frozenset()

    @model_validator(mode="before")
    @classmethod
    def reject_nulls(cls, data):
        if isinstance(data, dict):
            invalid = sorted(
                k for k, v in data.items() if v is None and k in cls.model_fields and k not in cls.nullable_fields
            )
            if invalid:
                raise ValueError(f"{', '.join(invalid)} cannot be null")
        return data


class DepartmentIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    code: str = Field(min_length=1, max_length=20)
    description: str = ""
    head_id: int | None = None


class DepartmentUpdate(PartialUpdate):
    nullable_fields = frozenset({"head_id"})

    name: str | None = Field(default=None, min_length=1, max_length=100)
    code: str | None = Field(default=None, min_length=1, max_length=20)
    description: str | None = None
    head_id: int | None = None


class DepartmentOut(ORM):
    id: int
    name: str
    code: str
    description: str
    head_id: int | None
    head_name: str | None
    headcount: int


class EmployeeIn(BaseModel):
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(default="", max_length=80)
    email: str = Field(pattern=EMAIL_PATTERN, max_length=200)
    phone: str = ""
    designation: str = ""
    department_id: int | None = None
    manager_id: int | None = None
    role: Role = "EMPLOYEE"
    employment_type: EmploymentType = "FULL_TIME"
    status: EmployeeStatus = "ACTIVE"
    date_of_joining: date
    date_of_birth: date | None = None
    gender: Gender | None = None
    salary: float = Field(default=0, ge=0)
    address: str = ""


class EmployeeUpdate(PartialUpdate):
    nullable_fields = frozenset({"department_id", "manager_id", "date_of_birth", "gender"})

    first_name: str | None = Field(default=None, min_length=1, max_length=80)
    last_name: str | None = Field(default=None, max_length=80)
    email: str | None = Field(default=None, pattern=EMAIL_PATTERN, max_length=200)
    phone: str | None = None
    designation: str | None = None
    department_id: int | None = None
    manager_id: int | None = None
    role: Role | None = None
    employment_type: EmploymentType | None = None
    status: EmployeeStatus | None = None
    date_of_joining: date | None = None
    date_of_birth: date | None = None
    gender: Gender | None = None
    salary: float | None = Field(default=None, ge=0)
    address: str | None = None


class EmployeeOut(ORM):
    id: int
    employee_code: str | None
    first_name: str
    last_name: str
    email: str
    phone: str
    designation: str
    department_id: int | None
    department_name: str | None
    manager_id: int | None
    manager_name: str | None
    role: Role
    employment_type: EmploymentType
    status: EmployeeStatus
    date_of_joining: date
    date_of_birth: date | None
    gender: Gender | None
    salary: float
    address: str


class LeaveTypeOut(ORM):
    id: int
    name: str
    code: str
    annual_quota: int
    color: str


class LeaveBalanceOut(BaseModel):
    leave_type_id: int
    leave_type_name: str
    code: str
    total: float
    used: float
    pending: float
    available: float


class LeaveApply(BaseModel):
    employee_id: int
    leave_type_id: int
    from_date: date
    to_date: date
    half_day: bool = False
    reason: str = ""


class LeaveDecision(BaseModel):
    approver_id: int
    comment: str | None = None


class LeaveOut(BaseModel):
    id: int
    employee_id: int
    employee_name: str
    department_name: str | None
    leave_type_id: int
    leave_type_name: str
    from_date: date
    to_date: date
    half_day: bool
    days: float
    reason: str
    status: LeaveStatus
    approver_id: int | None
    approver_name: str | None
    approver_comment: str | None
    applied_at: datetime
    decided_at: datetime | None


class AttendanceAction(BaseModel):
    employee_id: int


class AttendanceOut(BaseModel):
    id: int | None
    employee_id: int
    employee_name: str
    department_name: str | None = None
    date: date
    check_in: datetime | None
    check_out: datetime | None
    hours_worked: float | None
    status: AttendanceStatus


class HolidayIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    date: date
    type: HolidayType = "PUBLIC"


class HolidayOut(ORM):
    id: int
    name: str
    date: date
    type: HolidayType


class DepartmentCount(BaseModel):
    department: str
    count: int


class OnLeaveItem(BaseModel):
    employee_id: int
    employee_name: str
    leave_type_name: str
    to_date: date


class UpcomingHoliday(BaseModel):
    name: str
    date: date


class UpcomingBirthday(BaseModel):
    employee_id: int
    employee_name: str
    date: date


class UpcomingAnniversary(UpcomingBirthday):
    years: int


class DashboardStats(BaseModel):
    total_employees: int
    present_today: int
    on_leave_today: int
    absent_today: int
    late_today: int
    pending_leaves: int
    new_joiners_this_month: int
    headcount_by_department: list[DepartmentCount]
    on_leave_today_list: list[OnLeaveItem]
    upcoming_holidays: list[UpcomingHoliday]
    upcoming_birthdays: list[UpcomingBirthday]
    upcoming_anniversaries: list[UpcomingAnniversary]
