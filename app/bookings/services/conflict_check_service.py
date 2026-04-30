from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo
from django.utils.timezone import localtime, make_aware
from bookings.models import Booking
from rooms.models import BlackoutPeriod, Room, FavouriteRoom
from bookings.services.recurring import generate_recurring_slots

def build_conflict_report(
    room_id:      int,
    date_start:   date,          # datetime.date
    date_end:     date,          # datetime.date
    days_of_week: list[str],     # ["Mon", "Wed"]
    time_start:   str,           # "HH:MM"
    time_end:     str,           # "HH:MM"
) -> dict:
    """
    สร้างรายงาน Conflict สำหรับช่วงเวลาที่ต้องการจองแบบ Recurring
    แก้ปัญหา N+1 โดยการ Bulk Fetch ข้อมูลมาตรวจสอบใน Memory
    """
    BKK_TZ = ZoneInfo("Asia/Bangkok")

    # Step 1: Generate all slots
    all_slots = generate_recurring_slots(
        date_start, date_end, days_of_week, time_start, time_end
    )

    if not all_slots:
        return {
            "has_conflict": False,
            "summary": {
                "total_dates":     0,
                "available_count": 0,
                "conflict_count":  0,
                "blackout_count":  0,
            },
            "available_dates": [],
            "conflicts":       [],
            "blackouts":       [],
        }

    # Step 2: Bulk fetch existing bookings and blackouts
    # หาช่วงเวลาครอบคลุมทั้งหมด
    min_start_dt = all_slots[0][0]
    max_end_dt = all_slots[-1][1]

    existing_bookings = list(Booking.objects.filter(
        room_id=room_id,
        status__in=["Pending", "Approved"],
        start_datetime__lt=max_end_dt,
        end_datetime__gt=min_start_dt,
    ).select_related("booker"))

    # Optimized Query: Use direct DateTime comparison for better indexing performance
    dt_start = make_aware(datetime.combine(date_start, time(0, 0, 0)), BKK_TZ)
    dt_next_end = make_aware(datetime.combine(date_end + timedelta(days=1), time(0, 0, 0)), BKK_TZ)

    existing_blackouts = list(BlackoutPeriod.objects.filter(
        room_id=room_id,
        start_datetime__lt=dt_next_end,
        end_datetime__gte=dt_start,
    ))

    # Step 3: Classify each slot in memory
    available_dates = []
    conflicts       = []
    blackouts       = []

    for (s_dt, e_dt) in all_slots:
        date_str = localtime(s_dt).strftime("%Y-%m-%d")
        
        conflict_detail = None
        
        # Check Booking conflict first (Priority)
        for b in existing_bookings:
            if b.start_datetime < e_dt and b.end_datetime > s_dt:
                conflict_detail = {
                    "conflict_type": "booking",
                    "start_time":    localtime(b.start_datetime).strftime("%H:%M"),
                    "end_time":      localtime(b.end_datetime).strftime("%H:%M"),
                    "booker_name":   b.booker.displayname_th or b.booker.username,
                    "status":        b.status,
                }
                break
        
        # Check Blackout conflict if no booking conflict
        if not conflict_detail:
            for bl in existing_blackouts:
                # Overlap check for DateTime blackouts
                if bl.start_datetime < e_dt and bl.end_datetime > s_dt:
                    conflict_detail = {
                        "conflict_type": "blackout",
                        "reason":        bl.reason,
                    }
                    break

        if conflict_detail is None:
            available_dates.append(date_str)
        elif conflict_detail["conflict_type"] == "booking":
            conflicts.append({
                "date":         date_str,
                **conflict_detail
            })
        elif conflict_detail["conflict_type"] == "blackout":
            blackouts.append({
                "date":         date_str,
                **conflict_detail
            })

    # Step 4: Assemble response
    return {
        "has_conflict": len(conflicts) + len(blackouts) > 0,
        "summary": {
            "total_dates":     len(all_slots),
            "available_count": len(available_dates),
            "conflict_count":  len(conflicts),
            "blackout_count":  len(blackouts),
        },
        "available_dates": available_dates,
        "conflicts":       conflicts,
        "blackouts":       blackouts,
    }

def find_alternative_rooms(
    original_room_id: int,
    date_start: date,
    date_end: date,
    days_of_week: list[str],
    time_start: str,
    time_end: str,
    user_id: int,
) -> list[dict]:
    """
    หาห้องอื่นที่ว่างครบทุกวันในช่วงเวลาเดียวกัน (ท่าที่ 1: Perfect Match)
    Returns list of room dicts ที่ available_count == total_dates (ว่างทุกวัน)
    เรียงลำดับตาม capacity และบอกสถานะ Favourite
    """
    try:
        original_room = Room.objects.get(pk=original_room_id)
        min_capacity = original_room.capacity
    except Room.DoesNotExist:
        return []

    candidate_rooms = Room.objects.filter(
        is_active=True,
        capacity__gte=min_capacity,
    ).exclude(pk=original_room_id).order_by("capacity")

    # ดึงห้องโปรดของผู้ใช้เก็บไว้เป็น set เพื่อค้นหาอย่างรวดเร็ว (O(1))
    favourite_room_ids = set(FavouriteRoom.objects.filter(user=user_id).values_list('room_id', flat=True))

    suggestions = []
    for room in candidate_rooms:
        report = build_conflict_report(
            room.room_id, date_start, date_end, days_of_week, time_start, time_end
        )
        # ว่างตลอด = ไม่มี conflict และ available_count == total_dates
        if (not report["has_conflict"] and
                report["summary"]["available_count"] == report["summary"]["total_dates"]):
            suggestions.append({
                "room_id": room.room_id,
                "room_code": room.room_code,
                "room_name": room.room_name,
                "capacity": room.capacity,
                "room_type": room.room_type,
                "is_favourite": room.room_id in favourite_room_ids,
            })

    return suggestions
