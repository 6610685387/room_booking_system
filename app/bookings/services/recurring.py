from datetime import datetime, timedelta, date
from zoneinfo import ZoneInfo
from django.utils.timezone import make_aware

DAY_MAP = {"Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5, "Sun": 6}
BKK_TZ = ZoneInfo("Asia/Bangkok")

def generate_recurring_slots(
    start_date:     date,           # datetime.date — inclusive
    end_date:       date,           # datetime.date — inclusive
    recurring_days: list[str],      # ["Mon", "Wed"]
    time_start:     str,            # "HH:MM"
    time_end:       str,            # "HH:MM"
) -> list[tuple[datetime, datetime]]:
    """
    สร้าง list ของ (start_datetime, end_datetime) แบบ timezone-aware (UTC)
    """
    if start_date > end_date:
        return []

    target_weekdays = {DAY_MAP[d] for d in recurring_days if d in DAY_MAP}
    t_start = datetime.strptime(time_start, "%H:%M").time()
    t_end = datetime.strptime(time_end, "%H:%M").time()

    slots = []
    current_date = start_date

    while current_date <= end_date:
        if current_date.weekday() in target_weekdays:
            # สร้าง naive datetime ใน local time (Bangkok)
            naive_start = datetime.combine(current_date, t_start)
            naive_end = datetime.combine(current_date, t_end)
            
            # แปลงเป็น aware datetime (Bangkok) แล้ว Django จะจัดการแปลงเป็น UTC เมื่อเซฟลง DB
            # หรือใช้ make_aware ซึ่งจะแปลงตาม BKK_TZ
            aware_start = make_aware(naive_start, BKK_TZ)
            aware_end = make_aware(naive_end, BKK_TZ)
            
            slots.append((aware_start, aware_end))
        
        current_date += timedelta(days=1)

    return slots
