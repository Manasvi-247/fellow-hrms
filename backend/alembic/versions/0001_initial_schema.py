"""initial schema: departments, employees, leave, attendance, holidays"""

import sqlalchemy as sa
from alembic import op

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "departments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("code", sa.String(20), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("head_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "employees",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("employee_code", sa.String(20), nullable=True, unique=True),
        sa.Column("first_name", sa.String(80), nullable=False),
        sa.Column("last_name", sa.String(80), nullable=False, server_default=""),
        sa.Column("email", sa.String(200), nullable=False, unique=True),
        sa.Column("phone", sa.String(30), nullable=False, server_default=""),
        sa.Column("designation", sa.String(120), nullable=False, server_default=""),
        sa.Column("department_id", sa.Integer(), sa.ForeignKey("departments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("manager_id", sa.Integer(), sa.ForeignKey("employees.id", ondelete="SET NULL"), nullable=True),
        sa.Column("role", sa.String(20), nullable=False, server_default="EMPLOYEE"),
        sa.Column("employment_type", sa.String(20), nullable=False, server_default="FULL_TIME"),
        sa.Column("status", sa.String(20), nullable=False, server_default="ACTIVE"),
        sa.Column("date_of_joining", sa.Date(), nullable=False),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("gender", sa.String(20), nullable=True),
        sa.Column("salary", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("address", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_foreign_key(
        "fk_departments_head_id", "departments", "employees", ["head_id"], ["id"], ondelete="SET NULL"
    )
    op.create_table(
        "leave_types",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(80), nullable=False, unique=True),
        sa.Column("code", sa.String(10), nullable=False, unique=True),
        sa.Column("annual_quota", sa.Integer(), nullable=False),
        sa.Column("color", sa.String(20), nullable=False, server_default="#4C9DB0"),
    )
    op.create_table(
        "leave_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("employee_id", sa.Integer(), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("leave_type_id", sa.Integer(), sa.ForeignKey("leave_types.id"), nullable=False),
        sa.Column("from_date", sa.Date(), nullable=False),
        sa.Column("to_date", sa.Date(), nullable=False),
        sa.Column("half_day", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("days", sa.Float(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(20), nullable=False, server_default="PENDING"),
        sa.Column("approver_id", sa.Integer(), sa.ForeignKey("employees.id", ondelete="SET NULL"), nullable=True),
        sa.Column("approver_comment", sa.Text(), nullable=True),
        sa.Column("applied_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_leave_requests_employee_id", "leave_requests", ["employee_id"])
    op.create_index("ix_leave_requests_status", "leave_requests", ["status"])
    op.create_table(
        "attendance",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("employee_id", sa.Integer(), sa.ForeignKey("employees.id", ondelete="CASCADE"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("check_in", sa.DateTime(timezone=True), nullable=False),
        sa.Column("check_out", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="PRESENT"),
        sa.UniqueConstraint("employee_id", "date", name="uq_attendance_employee_date"),
    )
    op.create_index("ix_attendance_employee_id", "attendance", ["employee_id"])
    op.create_index("ix_attendance_date", "attendance", ["date"])
    op.create_table(
        "holidays",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("date", sa.Date(), nullable=False, unique=True),
        sa.Column("type", sa.String(20), nullable=False, server_default="PUBLIC"),
    )


def downgrade():
    op.drop_table("holidays")
    op.drop_table("attendance")
    op.drop_table("leave_requests")
    op.drop_table("leave_types")
    op.drop_constraint("fk_departments_head_id", "departments", type_="foreignkey")
    op.drop_table("employees")
    op.drop_table("departments")
