from django.core.management.base import BaseCommand
from bookings.services.auto_reject_service import process_auto_reject_expired

class Command(BaseCommand):
    help = 'Auto-reject pending bookings whose start_datetime has passed'

    def handle(self, *args, **options):
        count = process_auto_reject_expired()
        
        if count == 0:
            self.stdout.write(self.style.SUCCESS('ไม่พบการจองที่หมดอายุ'))
        else:
            self.stdout.write(self.style.SUCCESS(f'Auto-rejected สำเร็จจำนวน {count} รายการ'))
