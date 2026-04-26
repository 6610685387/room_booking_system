from zoneinfo import ZoneInfo
from django.utils.timezone import make_aware
from django.test import TestCase
from datetime import datetime
from rooms.models import Room, BlackoutPeriod
from account.models import User
from bookings.models import Booking
from bookings.services.conflict import check_conflict

BKK = ZoneInfo("Asia/Bangkok")

class ConflictDetectionTest(TestCase):
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

    def _make_booking(self, start, end, status="Approved"):
        return Booking.objects.create(
            room=self.room, booker=self.lecturer,
            start_datetime=start, end_datetime=end,
            status=status, purpose_type="training"
        )

    def test_conflict_approved(self):
        # T1: Booking Approved 10:00–11:00 วันที่ 2026-05-05, check 10:30–11:30 -> True
        start = self._dt("2026-05-05", "10:00")
        end = self._dt("2026-05-05", "11:00")
        self._make_booking(start, end, status="Approved")
        
        check_start = self._dt("2026-05-05", "10:30")
        check_end = self._dt("2026-05-05", "11:30")
        self.assertTrue(check_conflict(self.room.room_id, check_start, check_end))

    def test_conflict_pending(self):
        # T2: Booking Pending 10:00–11:00, check 10:30–11:30 -> True
        start = self._dt("2026-05-05", "10:00")
        end = self._dt("2026-05-05", "11:00")
        self._make_booking(start, end, status="Pending")
        
        check_start = self._dt("2026-05-05", "10:30")
        check_end = self._dt("2026-05-05", "11:30")
        self.assertTrue(check_conflict(self.room.room_id, check_start, check_end))

    def test_no_conflict_adjacent(self):
        # T3: Booking 10:00–11:00, check 11:00–12:00 -> False (SYS-05)
        start = self._dt("2026-05-05", "10:00")
        end = self._dt("2026-05-05", "11:00")
        self._make_booking(start, end)
        
        check_start = self._dt("2026-05-05", "11:00")
        check_end = self._dt("2026-05-05", "12:00")
        self.assertFalse(check_conflict(self.room.room_id, check_start, check_end))

    def test_no_conflict_rejected(self):
        # T4: Booking Rejected 10:00–12:00, check 10:00–12:00 -> False (SYS-04)
        start = self._dt("2026-05-05", "10:00")
        end = self._dt("2026-05-05", "12:00")
        self._make_booking(start, end, status="Rejected")
        
        self.assertFalse(check_conflict(self.room.room_id, start, end))

    def test_conflict_blackout(self):
        # T5: BlackoutPeriod 2026-05-05, check slot วันที่ 2026-05-05 -> True
        BlackoutPeriod.objects.create(
            room=self.room,
            start_date=datetime.strptime("2026-05-05", "%Y-%m-%d").date(),
            end_date=datetime.strptime("2026-05-05", "%Y-%m-%d").date(),
            reason="Holiday",
            created_by=self.lecturer
        )
        
        check_start = self._dt("2026-05-05", "10:00")
        check_end = self._dt("2026-05-05", "11:00")
        self.assertTrue(check_conflict(self.room.room_id, check_start, check_end))

    def test_exclude_own_booking(self):
        # T6: Booking A 10:00–11:00, check ด้วย exclude_booking_id=A.id -> False
        start = self._dt("2026-05-05", "10:00")
        end = self._dt("2026-05-05", "11:00")
        booking = self._make_booking(start, end)
        
        self.assertFalse(check_conflict(self.room.room_id, start, end, exclude_booking_id=booking.booking_id))

    def test_empty_room(self):
        # T7: ไม่มีอะไรเลย -> False
        check_start = self._dt("2026-05-05", "10:00")
        check_end = self._dt("2026-05-05", "11:00")
        self.assertFalse(check_conflict(self.room.room_id, check_start, check_end))
