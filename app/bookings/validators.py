from datetime import date, datetime
from django.core.exceptions import ValidationError

VALID_DAYS = {"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"}

def validate_booking_time(start_dt: datetime, end_dt: datetime) -> None:
    """
    ตรวจสอบว่าเวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น และไม่อยู่ข้ามคืน
    """
    if start_dt >= end_dt:
        raise ValidationError("เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น")
    
    if start_dt.date() != end_dt.date():
        raise ValidationError("ไม่สามารถจองข้ามวันได้ (เวลาเริ่มต้นและสิ้นสุดต้องอยู่ในวันเดียวกัน)")

def validate_days_of_week(days: list[str]) -> None:
    """
    ตรวจสอบว่ามีการเลือกวันอย่างน้อย 1 วัน และเป็นวันที่ถูกต้อง
    """
    if not days:
        raise ValidationError("ต้องเลือกอย่างน้อย 1 วัน")
    
    for d in days:
        if d not in VALID_DAYS:
            raise ValidationError(
                f"'{d}' ไม่ใช่วันที่ถูกต้อง ต้องเป็น Mon/Tue/Wed/Thu/Fri/Sat/Sun"
            )

def validate_date_range(start_date: date, end_date: date) -> None:
    """
    ตรวจสอบว่าวันเริ่มต้นต้องไม่มากกว่าวันสิ้นสุด และไม่เกิน 150 วัน
    """
    if start_date > end_date:
        raise ValidationError("วันเริ่มต้นต้องไม่มากกว่าวันสิ้นสุด")
    
    if (end_date - start_date).days > 150:
        raise ValidationError("สามารถจองล่วงหน้าได้ไม่เกิน 150 วัน")
