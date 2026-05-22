from django.db import transaction
from bookings.models import Booking

def bulk_approve_bookings(group_id, admin_notes, approved_by):
    """
    อนุมัติการจองทั้งหมดในกลุ่มที่เป็น Pending
    คืนค่าเป็นจำนวนรายการที่ถูกอนุมัติ
    """
    with transaction.atomic():
        bookings = Booking.objects.select_for_update().filter(
            recurring_group_id=group_id, 
            status="Pending"
        )
        
        if not bookings.exists():
            return 0

        approved_count = 0
        for bk in bookings:
            bk.status = "Approved"
            bk.admin_notes = admin_notes
            bk.approved_by = approved_by
            bk.save()
            approved_count += 1
            
    return approved_count

def bulk_reject_bookings(group_id, reject_reason):
    """
    ปฏิเสธการจองทั้งหมดในกลุ่มที่เป็น Pending
    คืนค่าเป็นจำนวนรายการที่ถูกปฏิเสธ
    """
    with transaction.atomic():
        bookings = Booking.objects.select_for_update().filter(
            recurring_group_id=group_id, 
            status="Pending"
        )
        
        if not bookings.exists():
            return 0

        rejected_count = 0
        for bk in bookings:
            bk.status = "Rejected"
            bk.reject_reason = reject_reason
            bk.save()
            rejected_count += 1
            
    return rejected_count
