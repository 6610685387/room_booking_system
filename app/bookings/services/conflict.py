from datetime import datetime
from django.utils.timezone import localtime
from bookings.models import Booking
from rooms.models import BlackoutPeriod

from typing import Optional, Dict

def check_conflict(
    room_id: int,
    start_dt: datetime,              # timezone-aware datetime (UTC)
    end_dt:   datetime,              # timezone-aware datetime (UTC)
    exclude_booking_id: Optional[int] = None
) -> bool:
    """
    ตรวจสอบว่ามีการจองทับซ้อนกันไหม
    คืนค่า True ถ้าทับ (มี Conflict) | False ถ้าไม่มี
    """
    # Layer 1: Booking Conflict
    # ตรวจสอบสถานะ Pending และ Approved เท่านั้น
    qs = Booking.objects.filter(
        room_id=room_id,
        status__in=["Pending", "Approved"],
        start_datetime__lt=end_dt,    # existing.start < new.end
        end_datetime__gt=start_dt,    # existing.end   > new.start
    )
    if exclude_booking_id is not None:
        qs = qs.exclude(booking_id=exclude_booking_id)
    
    if qs.exists():
        return True

    # Layer 2: Blackout Conflict
    # แปลงเป็น local date (Bangkok) เพื่อเช็คกับ BlackoutPeriod ที่เก็บเป็น DateField
    slot_date = localtime(start_dt).date()
    if BlackoutPeriod.objects.filter(
        room_id=room_id,
        start_date__lte=slot_date,
        end_date__gte=slot_date,
    ).exists():
        return True

    return False

def get_conflict_detail(
    room_id:  int,
    start_dt: datetime,    # timezone-aware (UTC)
    end_dt:   datetime,    # timezone-aware (UTC)
) -> Optional[Dict]:
    """
    ดึงรายละเอียดของ conflict (ถ้ามี)
    """
    slot_date = localtime(start_dt).date()

    # ตรวจ Booking conflict ก่อน (priority สูงกว่า Blackout)
    bc = Booking.objects.filter(
        room_id=room_id,
        status__in=["Pending", "Approved"],
        start_datetime__lt=end_dt,
        end_datetime__gt=start_dt,
    ).select_related("booker").first()

    if bc is not None:
        return {
            "conflict_type": "booking",
            "start_time":    localtime(bc.start_datetime).strftime("%H:%M"),
            "end_time":      localtime(bc.end_datetime).strftime("%H:%M"),
            "booker_name":   bc.booker.displayname_th or bc.booker.username,
            "status":        bc.status,
        }

    blackout = BlackoutPeriod.objects.filter(
        room_id=room_id, 
        start_date__lte=slot_date, 
        end_date__gte=slot_date
    ).first()

    if blackout is not None:
        return {
            "conflict_type": "blackout", 
            "reason": blackout.reason
        }

    return None
