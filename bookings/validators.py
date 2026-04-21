from django.core.exceptions import ValidationError
from django.utils import timezone

def validate_booking_time(start_datetime, end_datetime):
    """
    ตรวจสอบความถูกต้องของเวลาจอง
    """
    if start_datetime >= end_datetime:
        raise ValidationError("End time must be after start time.")
    
    # Implementation will be completed in Phase 3
