from datetime import datetime, timedelta

def generate_recurring_slots(
    start_date, end_date, recurring_days: list[int],
    start_time, end_time
) -> list[tuple[datetime, datetime]]:
    """
    สร้าง list ของ (start_datetime, end_datetime) สำหรับแต่ละ occurrence
    recurring_days: [1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun]
    """
    # implementation will be completed in Phase 3
    pass
