"""
report_query_service.py
=======================
Business logic สำหรับ query และ aggregate ข้อมูล booking
แยกออกจาก view เพื่อให้ testable และ reusable (ทั้ง summary API และ export)
"""

from django.db.models import Count, Q, QuerySet
from django.utils.timezone import make_aware
from datetime import datetime, time

from bookings.models import Booking
from reports.filters import ReportFilterParams


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _apply_filters(qs: QuerySet, f: ReportFilterParams) -> QuerySet:
    """
    Apply ReportFilterParams กับ queryset ที่ส่งมา
    ใช้ start_datetime เป็น reference field สำหรับ date range
    """
    if f.date_from:
        qs = qs.filter(start_datetime__date__gte=f.date_from)
    if f.date_to:
        qs = qs.filter(start_datetime__date__lte=f.date_to)
    # 🌟 จุดที่มีการแก้ตอนสร้าง mock data คือตรง filter purpose_type
    if f.purpose_type and f.purpose_type != 'all':
        qs = qs.filter(purpose_type=f.purpose_type)
    if f.room_id:
        qs = qs.filter(room_id=f.room_id)
    if f.status:
        qs = qs.filter(status=f.status)
    return qs


def _base_qs(f: ReportFilterParams) -> QuerySet:
    """
    Base queryset พร้อม select_related เพื่อลด N+1 queries
    """
    qs = Booking.objects.select_related(
        "room",
        "booker",
        "teaching_info",
        "training_info",
    )
    return _apply_filters(qs, f)


# ---------------------------------------------------------------------------
# Summary statistics (FR-RPT-04)
# ---------------------------------------------------------------------------

def get_summary_statistics(f: ReportFilterParams) -> dict:
    """
    คืน dict สถิติรวม แยกตาม:
    - purpose_type (teaching / training)
    - program_type (เฉพาะ teaching)
    - room
    - status
    - รายเดือน (monthly trend)
    """
    qs = _base_qs(f)

    total = qs.count()

    # --- แยกตาม purpose_type ---
    by_purpose_raw = (
        qs.values("purpose_type")
        .annotate(count=Count("booking_id"))
        .order_by("purpose_type")
    )
    by_purpose = {row["purpose_type"]: row["count"] for row in by_purpose_raw}

    # --- แยกตาม program_type (teaching เท่านั้น) ---
    teaching_qs = qs.filter(purpose_type="teaching")
    if f.program_type:
        teaching_qs = teaching_qs.filter(teaching_info__program_type=f.program_type)

    by_program_raw = (
        teaching_qs.values("teaching_info__program_type")
        .annotate(count=Count("booking_id"))
        .order_by("teaching_info__program_type")
    )
    by_program = {
        (row["teaching_info__program_type"] or "ไม่ระบุ"): row["count"]
        for row in by_program_raw
    }

    # --- แยกตาม room ---
    by_room_raw = (
        qs.values("room__room_id", "room__room_code", "room__room_name")
        .annotate(count=Count("booking_id"))
        .order_by("-count")
    )
    by_room = [
        {
            "room_id": row["room__room_id"],
            "room_code": row["room__room_code"],
            "room_name": row["room__room_name"],
            "booking_count": row["count"],
        }
        for row in by_room_raw
    ]

    # --- แยกตาม status ---
    by_status_raw = (
        qs.values("status")
        .annotate(count=Count("booking_id"))
        .order_by("status")
    )
    by_status = {row["status"]: row["count"] for row in by_status_raw}

    # --- monthly trend (YYYY-MM) ---
    monthly: dict[str, int] = {}
    for bk in qs.values("start_datetime"):
        month_key = bk["start_datetime"].strftime("%Y-%m")
        monthly[month_key] = monthly.get(month_key, 0) + 1
    monthly_trend = [
        {"month": k, "count": v} for k, v in sorted(monthly.items())
    ]

    return {
        "total_bookings": total,
        "by_purpose": by_purpose,
        "by_program_type": by_program,
        "by_room": by_room,
        "by_status": by_status,
        "monthly_trend": monthly_trend,
    }


# ---------------------------------------------------------------------------
# Raw rows for export (FR-RPT-03) แบบ Dynamic Columns
# ---------------------------------------------------------------------------

def get_export_rows(f: ReportFilterParams) -> tuple[list[str], list[list]]:
    """
    คืน (headers, data_rows) สำหรับ export เป็น CSV / Excel
    รูปแบบ Dynamic: คอลัมน์จะเปลี่ยนไปตาม purpose_type ที่ Filter มา
    """
    qs = _base_qs(f).order_by("start_datetime")

    # 1. กำหนดหัวข้อคอลัมน์พื้นฐาน (Common Headers)
    headers = [
        "รหัสการจอง", 
        "รหัสห้อง", 
        "ชื่อห้อง", 
        "Username ผู้จอง", 
        "ชื่อผู้จอง", 
        "ภาควิชา", 
        "วันเวลาเริ่มต้น", 
        "วันเวลาสิ้นสุด", 
        "ชั่วโมงการใช้งาน", 
        "สถานะ", 
        "ประเภทการใช้งาน",
        "คำขอเพิ่มเติม",
        "วันที่จอง"
    ]

    # 2. เพิ่มคอลัมน์ Dynamic
    if f.purpose_type == 'teaching':
        headers.extend(["รหัสวิชา", "ชื่อวิชา", "หลักสูตร"])
    elif f.purpose_type == 'training':
        headers.extend(["หัวข้ออบรม"])
    else:
        headers.extend(["รหัสวิชา", "ชื่อวิชา", "หลักสูตร", "หัวข้ออบรม"])

    # 3. สร้างข้อมูลแต่ละแถว
    rows = []
    for bk in qs:
        row_dict = {
            "รหัสการจอง": bk.booking_id,
            "รหัสห้อง": bk.room.room_code,
            "ชื่อห้อง": bk.room.room_name,
            "Username ผู้จอง": bk.booker.username,
            "ชื่อผู้จอง": bk.booker.displayname_th or bk.booker.displayname_en,
            "ภาควิชา": bk.booker.department,
            "วันเวลาเริ่มต้น": bk.start_datetime.strftime("%Y-%m-%d %H:%M"),
            "วันเวลาสิ้นสุด": bk.end_datetime.strftime("%Y-%m-%d %H:%M"),
            "ชั่วโมงการใช้งาน": round((bk.end_datetime - bk.start_datetime).total_seconds() / 3600, 2),
            "สถานะ": bk.get_status_display(),
            "ประเภทการใช้งาน": bk.get_purpose_type_display(),
            "คำขอเพิ่มเติม": bk.additional_requests or "",
            "วันที่จอง": bk.created_at.strftime("%Y-%m-%d %H:%M"),
        }

        # เติมคอลัมน์เฉพาะทาง
        if f.purpose_type != 'training':
            if hasattr(bk, 'teaching_info') and bk.teaching_info:
                row_dict["รหัสวิชา"] = bk.teaching_info.subject_code
                row_dict["ชื่อวิชา"] = bk.teaching_info.subject_name
                row_dict["หลักสูตร"] = bk.teaching_info.get_program_type_display()
            else:
                row_dict["รหัสวิชา"] = "-"
                row_dict["ชื่อวิชา"] = "-"
                row_dict["หลักสูตร"] = "-"

        if f.purpose_type != 'teaching':
            if hasattr(bk, 'training_info') and bk.training_info:
                row_dict["หัวข้ออบรม"] = bk.training_info.topic
            else:
                row_dict["หัวข้ออบรม"] = "-"

        # แปลงเป็น list ตามลำดับหัวตารางเป๊ะๆ
        ordered_row = [row_dict[column] for column in headers]
        rows.append(ordered_row)

    return headers, rows