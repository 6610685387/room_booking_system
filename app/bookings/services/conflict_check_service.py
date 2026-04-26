from datetime import date
from django.utils.timezone import localtime
from bookings.services.recurring import generate_recurring_slots
from bookings.services.conflict import get_conflict_detail

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
    """
    # Step 1: Generate all slots
    all_slots = generate_recurring_slots(
        date_start, date_end, days_of_week, time_start, time_end
    )

    # Step 2: Classify each slot
    available_dates = []
    conflicts       = []
    blackouts       = []

    for (s_dt, e_dt) in all_slots:
        date_str = localtime(s_dt).strftime("%Y-%m-%d")
        detail   = get_conflict_detail(room_id, s_dt, e_dt)

        if detail is None:
            available_dates.append(date_str)
        elif detail["conflict_type"] == "booking":
            conflicts.append({
                "date":         date_str,
                "conflict_type":"booking",
                "start_time":   detail["start_time"],
                "end_time":     detail["end_time"],
                "booker_name":  detail["booker_name"],
                "status":       detail["status"],
            })
        elif detail["conflict_type"] == "blackout":
            blackouts.append({
                "date":         date_str,
                "conflict_type":"blackout",
                "reason":       detail["reason"],
            })

    # Step 3: Assemble response
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
