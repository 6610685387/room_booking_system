from django.utils import timezone
from django.utils.timezone import localtime
from bookings.models import Booking

def process_auto_reject_expired():
    """
    ตรวจสอบและปฏิเสธคำขอที่สถานะ Pending แต่เลยเวลาเริ่มต้นการใช้งานแล้ว
    คืนค่าเป็นจำนวนรายการที่ถูกปฏิเสธ
    """
    now_bkk = localtime(timezone.now())
    expired_bookings = Booking.objects.filter(
        status="Pending",
        start_datetime__lte=now_bkk
    )

    count = expired_bookings.count()
    if count > 0:
        for bk in expired_bookings:
            bk.status = "Rejected"
            bk.reject_reason = "ระบบปฏิเสธคำขออัตโนมัติเนื่องจากเลยเวลาเริ่มต้นการใช้งานแล้ว"
            bk.save()
            
    return count
