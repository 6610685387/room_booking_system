from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional

from rest_framework.exceptions import ValidationError

# ค่าที่ valid สำหรับแต่ละ field
VALID_PURPOSE_TYPES = {"teaching", "training"}
VALID_STATUSES = {"Pending", "Approved", "Rejected", "Cancelled"}
VALID_PROGRAM_TYPES = {"Bachelor", "Master", "TEP-TEPE", "TU-PINE"}


@dataclass
class ReportFilterParams:
    """
    Validated filter parameters สำหรับ report endpoints ทั้งหมด
    ใช้ dataclass เพื่อให้ type-safe และ reusable
    """

    date_from: Optional[date] = None
    date_to: Optional[date] = None
    purpose_type: Optional[str] = None       # "teaching" | "training" | None (= ทั้งหมด)
    program_type: Optional[str] = None       # เฉพาะ teaching: "Bachelor" | "Master" | ...
    room_id: Optional[int] = None
    status: Optional[str] = None             # None = ดึงทุก status (รวม Approved เป็นหลัก)

    @classmethod
    def from_query_params(cls, params: dict) -> "ReportFilterParams":
        """
        Parse และ validate query params จาก request.query_params
        Raise ValidationError พร้อม message ภาษาไทยถ้า invalid
        """
        errors = {}

        # --- date_from ---
        date_from = None
        if raw := params.get("date_from"):
            try:
                date_from = datetime.strptime(raw, "%Y-%m-%d").date()
            except ValueError:
                errors["date_from"] = "รูปแบบวันที่ไม่ถูกต้อง ใช้ YYYY-MM-DD"

        # --- date_to ---
        date_to = None
        if raw := params.get("date_to"):
            try:
                date_to = datetime.strptime(raw, "%Y-%m-%d").date()
            except ValueError:
                errors["date_to"] = "รูปแบบวันที่ไม่ถูกต้อง ใช้ YYYY-MM-DD"

        # --- date range logic ---
        if date_from and date_to and date_from > date_to:
            errors["date_range"] = "date_from ต้องไม่เกิน date_to"

        # --- purpose_type ---
        purpose_type = None
        if raw := params.get("purpose_type"):
            if raw not in VALID_PURPOSE_TYPES:
                errors["purpose_type"] = f"ค่าที่ยอมรับได้: {sorted(VALID_PURPOSE_TYPES)}"
            else:
                purpose_type = raw

        # --- program_type ---
        program_type = None
        if raw := params.get("program_type"):
            if raw not in VALID_PROGRAM_TYPES:
                errors["program_type"] = f"ค่าที่ยอมรับได้: {sorted(VALID_PROGRAM_TYPES)}"
            else:
                program_type = raw

        # program_type ใช้ได้เฉพาะเมื่อ purpose_type == "teaching"
        if program_type and purpose_type and purpose_type != "teaching":
            errors["program_type"] = "program_type ใช้ได้เฉพาะเมื่อ purpose_type=teaching"

        # --- room_id ---
        room_id = None
        if raw := params.get("room_id"):
            try:
                room_id = int(raw)
                if room_id <= 0:
                    raise ValueError
            except ValueError:
                errors["room_id"] = "room_id ต้องเป็นจำนวนเต็มบวก"

        # --- status ---
        status = None
        if raw := params.get("status"):
            if raw not in VALID_STATUSES:
                errors["status"] = f"ค่าที่ยอมรับได้: {sorted(VALID_STATUSES)}"
            else:
                status = raw

        if errors:
            raise ValidationError(errors)

        return cls(
            date_from=date_from,
            date_to=date_to,
            purpose_type=purpose_type,
            program_type=program_type,
            room_id=room_id,
            status=status,
        )
