from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.core.management import call_command
from account.models import User
from rooms.models import Room
from bookings.models import Booking, RecurringGroup
from datetime import date, datetime, time, timedelta
import zoneinfo
from django.utils import timezone
from django.utils.timezone import make_aware

BKK = zoneinfo.ZoneInfo("Asia/Bangkok")

class AdminBulkBookingTest(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin1", password="password123", role=User.Role.ADMIN, displayname_th="เจ้าหน้าที่ ทดสอบ"
        )
        self.lecturer = User.objects.create_user(
            username="lec1", password="password123", role=User.Role.LECTURER, displayname_th="อาจารย์ ทดสอบ"
        )
        self.room = Room.objects.create(
            room_code="406-3", room_name="ห้องประชุม 1", room_type="Meeting Room", capacity=60, is_active=True
        )
        self.client.force_authenticate(user=self.admin)

    def test_approve_recurring_group_success(self):
        group = RecurringGroup.objects.create(
            booker=self.lecturer, room=self.room, day_pattern="Mon",
            date_start=date(2026, 6, 1), date_end=date(2026, 6, 8),
            time_start=time(10, 0), time_end=time(12, 0)
        )
        bk1 = Booking.objects.create(
            room=self.room, booker=self.lecturer, status="Pending", purpose_type="training", recurring_group=group,
            start_datetime=make_aware(datetime.combine(date(2026, 6, 1), time(10, 0)), BKK),
            end_datetime=make_aware(datetime.combine(date(2026, 6, 1), time(12, 0)), BKK)
        )
        bk2 = Booking.objects.create(
            room=self.room, booker=self.lecturer, status="Pending", purpose_type="training", recurring_group=group,
            start_datetime=make_aware(datetime.combine(date(2026, 6, 8), time(10, 0)), BKK),
            end_datetime=make_aware(datetime.combine(date(2026, 6, 8), time(12, 0)), BKK)
        )

        url = reverse("admindash:admin_booking_approve_recurring", args=[group.group_id])
        response = self.client.patch(url, {"admin_notes": "Bulk approved"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["approved_count"], 2)

        bk1.refresh_from_db()
        bk2.refresh_from_db()
        self.assertEqual(bk1.status, "Approved")
        self.assertEqual(bk2.status, "Approved")
        self.assertEqual(bk1.admin_notes, "Bulk approved")

    def test_reject_recurring_group_success(self):
        group = RecurringGroup.objects.create(
            booker=self.lecturer, room=self.room, day_pattern="Mon",
            date_start=date(2026, 6, 1), date_end=date(2026, 6, 8),
            time_start=time(10, 0), time_end=time(12, 0)
        )
        bk1 = Booking.objects.create(
            room=self.room, booker=self.lecturer, status="Pending", purpose_type="training", recurring_group=group,
            start_datetime=make_aware(datetime.combine(date(2026, 6, 1), time(10, 0)), BKK),
            end_datetime=make_aware(datetime.combine(date(2026, 6, 1), time(12, 0)), BKK)
        )

        url = reverse("admindash:admin_booking_reject_recurring", args=[group.group_id])
        response = self.client.patch(url, {"reject_reason": "Bulk rejected"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["rejected_count"], 1)

        bk1.refresh_from_db()
        self.assertEqual(bk1.status, "Rejected")
        self.assertEqual(bk1.reject_reason, "Bulk rejected")

    def test_auto_reject_expired_command(self):
        # สร้างการจองในอดีต (Yesterday)
        past_date = date.today() - timedelta(days=1)
        bk_past = Booking.objects.create(
            room=self.room, booker=self.lecturer, status="Pending", purpose_type="training",
            start_datetime=make_aware(datetime.combine(past_date, time(10, 0)), BKK),
            end_datetime=make_aware(datetime.combine(past_date, time(12, 0)), BKK)
        )
        
        # สร้างการจองในอนาคต (Tomorrow)
        future_date = date.today() + timedelta(days=1)
        bk_future = Booking.objects.create(
            room=self.room, booker=self.lecturer, status="Pending", purpose_type="training",
            start_datetime=make_aware(datetime.combine(future_date, time(10, 0)), BKK),
            end_datetime=make_aware(datetime.combine(future_date, time(12, 0)), BKK)
        )

        # เรียกใช้ management command
        call_command('auto_reject_expired')

        bk_past.refresh_from_db()
        bk_future.refresh_from_db()

        # รายการในอดีตต้องถูก Reject
        self.assertEqual(bk_past.status, "Rejected")
        self.assertIn("ระบบปฏิเสธคำขออัตโนมัติ", bk_past.reject_reason)
        
        # รายการในอนาคตต้องยังเป็น Pending
        self.assertEqual(bk_future.status, "Pending")
