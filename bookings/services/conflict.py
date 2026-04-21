from datetime import datetime
from django.db.models import Q

def check_conflict(room_id, start_dt, end_dt, exclude_booking_id=None) -> bool:
    """
    ตรวจสอบว่ามีการจองทับซ้อนกันไหม
    คืนค่า True ถ้าทับ (มี Conflict)

    Logic: existing.start < new.end AND existing.end > new.start
    """
    # implementation will be completed in Phase 3
    pass
