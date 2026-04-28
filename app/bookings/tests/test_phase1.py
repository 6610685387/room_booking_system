from zoneinfo import ZoneInfo
from django.utils.timezone import make_aware
from django.test import TestCase
from datetime import datetime, date, timedelta
from rooms.models import Room, BlackoutPeriod
from account.models import User
from bookings.models import Booking
from bookings.services.conflict_check_service import build_conflict_report
from bookings.validators import validate_date_range, validate_booking_time
from django.core.exceptions import ValidationError

BKK = ZoneInfo("Asia/Bangkok")

class Phase1RefactorTest(TestCase):
    def setUp(self):
        self.room = Room.objects.create(
            room_code="406-3", room_name="ห้องประชุม 1",
            room_type="Meeting Room", capacity=60, is_active=True
        )
        self.lecturer = User.objects.create(
            username="lec1", displayname_th="อ.ทดสอบ", role="Lecturer"
        )

    def _dt(self, date_str, time_str):
        """Helper: สร้าง aware datetime จาก Bangkok local time"""
        naive = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
        return make_aware(naive, BKK)

    def test_validate_date_range_150_days(self):
        start = date(2026, 1, 1)
        end_ok = start + timedelta(days=150)
        end_fail = start + timedelta(days=151)
        
        # Should not raise
        validate_date_range(start, end_ok)
        
        # Should raise
        with self.assertRaises(ValidationError) as cm:
            validate_date_range(start, end_fail)
        self.assertEqual(cm.exception.message, "สามารถจองล่วงหน้าได้ไม่เกิน 150 วัน")

    def test_validate_booking_time_no_overnight(self):
        # 2026-05-05 23:00 to 2026-05-05 23:30 (Same day)
        start = self._dt("2026-05-05", "23:00")
        end_ok = self._dt("2026-05-05", "23:30")
        # 2026-05-05 23:00 to 2026-05-06 01:00 (Cross day)
        end_fail = self._dt("2026-05-06", "01:00")
        
        # Should not raise
        validate_booking_time(start, end_ok)
        
        # Should raise
        with self.assertRaises(ValidationError) as cm:
            validate_booking_time(start, end_fail)
        self.assertEqual(cm.exception.message, "ไม่สามารถจองข้ามวันได้ (เวลาเริ่มต้นและสิ้นสุดต้องอยู่ในวันเดียวกัน)")

    def test_build_conflict_report_query_count(self):
        # Create some existing bookings and blackouts
        # Booking: Tuesday 5 May, 10:00-11:00
        Booking.objects.create(
            room=self.room, booker=self.lecturer,
            start_datetime=self._dt("2026-05-05", "10:00"),
            end_datetime=self._dt("2026-05-05", "11:00"),
            status="Approved", purpose_type="teaching"
        )
        # Blackout: Sunday 10 May
        BlackoutPeriod.objects.create(
            room=self.room,
            start_datetime=self._dt("2026-05-10", "00:00"),
            end_datetime=self._dt("2026-05-10", "23:59"),
            reason="Big Cleaning Day",
            created_by=self.lecturer
        )
        
        # Check conflict for Tuesday and Sunday between 1 May and 14 May
        # Slots:
        # 1. Tue 5 May 10:30-11:30 -> Conflict with Booking
        # 2. Sun 10 May 10:30-11:30 -> Conflict with Blackout
        # 3. Tue 12 May 10:30-11:30 -> Available
        
        with self.assertNumQueries(2):
            report = build_conflict_report(
                room_id=self.room.room_id,
                date_start=date(2026, 5, 1),
                date_end=date(2026, 5, 14),
                days_of_week=["Tue", "Sun"],
                time_start="10:30",
                time_end="11:30"
            )
        
        self.assertTrue(report["has_conflict"])
        self.assertEqual(report["summary"]["total_dates"], 4)
        self.assertEqual(report["summary"]["conflict_count"], 1)
        self.assertEqual(report["summary"]["blackout_count"], 1)
        self.assertEqual(report["summary"]["available_count"], 2)
        
        self.assertEqual(report["conflicts"][0]["date"], "2026-05-05")
        self.assertEqual(report["blackouts"][0]["date"], "2026-05-10")
        self.assertIn("2026-05-03", report["available_dates"])
        self.assertIn("2026-05-12", report["available_dates"])

    def test_build_conflict_report_no_slots(self):
        # Test when no slots are generated (e.g. date_start > date_end)
        report = build_conflict_report(
            room_id=self.room.room_id,
            date_start=date(2026, 5, 14),
            date_end=date(2026, 5, 1),
            days_of_week=["Mon"],
            time_start="10:00",
            time_end="11:00"
        )
        self.assertFalse(report["has_conflict"])
        self.assertEqual(report["summary"]["total_dates"], 0)
