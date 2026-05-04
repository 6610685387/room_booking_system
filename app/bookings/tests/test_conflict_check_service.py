from zoneinfo import ZoneInfo
from django.utils.timezone import make_aware
from django.test import TestCase
from datetime import datetime, date
from rooms.models import Room, BlackoutPeriod, FavouriteRoom
from account.models import User
from bookings.models import Booking
from bookings.services.conflict_check_service import find_alternative_rooms
from django.test.utils import CaptureQueriesContext
from django.db import connection

BKK = ZoneInfo("Asia/Bangkok")

class ConflictSuggestionTest(TestCase):
    def setUp(self):
        # Original room
        self.room_target = Room.objects.create(
            room_code="406-3", room_name="ห้องประชุม 1",
            room_type="Meeting Room", capacity=60, is_active=True
        )
        # Potential alternative rooms
        self.room_alt1 = Room.objects.create(
            room_code="406-4", room_name="ห้องประชุม 2",
            room_type="Meeting Room", capacity=60, is_active=True
        )
        self.room_alt2 = Room.objects.create(
            room_code="406-5", room_name="ห้องประชุม 3",
            room_type="Meeting Room", capacity=80, is_active=True
        )
        self.room_small = Room.objects.create(
            room_code="101", room_name="ห้องเรียนเล็ก",
            room_type="Classroom", capacity=30, is_active=True
        )
        self.room_inactive = Room.objects.create(
            room_code="102", room_name="ห้องปิดปรับปรุง",
            room_type="Classroom", capacity=100, is_active=False
        )
        
        self.user = User.objects.create(
            username="testuser", displayname_th="นักทดสอบ", role=User.Role.LECTURER
        )

    def _dt(self, date_str, time_str):
        naive = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
        return make_aware(naive, BKK)

    def test_find_alternative_rooms_with_conflict(self):
        # 1. Create conflict in room_target
        Booking.objects.create(
            room=self.room_target, booker=self.user,
            start_datetime=self._dt("2026-05-05", "10:00"),
            end_datetime=self._dt("2026-05-05", "12:00"),
            status="Approved", purpose_type="teaching"
        )
        
        # 2. Create conflict in room_alt2 too
        Booking.objects.create(
            room=self.room_alt2, booker=self.user,
            start_datetime=self._dt("2026-05-05", "11:00"),
            end_datetime=self._dt("2026-05-05", "13:00"),
            status="Approved", purpose_type="teaching"
        )

        # room_alt1 is free
        suggestions = find_alternative_rooms(
            original_room_id=self.room_target.room_id,
            date_start=date(2026, 5, 5),
            date_end=date(2026, 5, 5),
            days_of_week=["Tue"],
            time_start="10:00",
            time_end="12:00",
            user_id=self.user.user_id
        )

        # Expected: room_alt1 should be suggested.
        # room_alt2 has conflict.
        # room_small has low capacity.
        # room_inactive is inactive.
        self.assertEqual(len(suggestions), 1)
        self.assertEqual(suggestions[0]["room_code"], "406-4")
        self.assertFalse(suggestions[0]["is_favourite"])

    def test_find_alternative_rooms_no_available(self):
        # Occupy all rooms
        for r in [self.room_target, self.room_alt1, self.room_alt2]:
            Booking.objects.create(
                room=r, booker=self.user,
                start_datetime=self._dt("2026-05-05", "10:00"),
                end_datetime=self._dt("2026-05-05", "12:00"),
                status="Approved", purpose_type="teaching"
            )
        
        suggestions = find_alternative_rooms(
            original_room_id=self.room_target.room_id,
            date_start=date(2026, 5, 5),
            date_end=date(2026, 5, 5),
            days_of_week=["Tue"],
            time_start="10:00",
            time_end="12:00",
            user_id=self.user.user_id
        )
        self.assertEqual(len(suggestions), 0)

    def test_find_alternative_rooms_capacity_low(self):
        # target room needs capacity 60
        # only room_small is free
        Booking.objects.create(
            room=self.room_target, booker=self.user,
            start_datetime=self._dt("2026-05-05", "10:00"),
            end_datetime=self._dt("2026-05-05", "12:00"),
            status="Approved", purpose_type="teaching"
        )
        # Occupy alt1 and alt2
        for r in [self.room_alt1, self.room_alt2]:
            Booking.objects.create(
                room=r, booker=self.user,
                start_datetime=self._dt("2026-05-05", "10:00"),
                end_datetime=self._dt("2026-05-05", "12:00"),
                status="Approved", purpose_type="teaching"
            )
        
        # room_small is free but capacity=30 < 60
        suggestions = find_alternative_rooms(
            original_room_id=self.room_target.room_id,
            date_start=date(2026, 5, 5),
            date_end=date(2026, 5, 5),
            days_of_week=["Tue"],
            time_start="10:00",
            time_end="12:00",
            user_id=self.user.user_id
        )
        self.assertEqual(len(suggestions), 0)

    def test_find_alternative_rooms_unlimited_suggestions(self):
        # target has conflict
        Booking.objects.create(
            room=self.room_target, booker=self.user,
            start_datetime=self._dt("2026-05-05", "10:00"),
            end_datetime=self._dt("2026-05-05", "12:00"),
            status="Approved", purpose_type="teaching"
        )
        # Add more rooms
        for i in range(6, 11):
            Room.objects.create(
                room_code=f"406-{i}", room_name=f"ห้องประชุม {i}",
                room_type="Meeting Room", capacity=60, is_active=True
            )
        
        suggestions = find_alternative_rooms(
            original_room_id=self.room_target.room_id,
            date_start=date(2026, 5, 5),
            date_end=date(2026, 5, 5),
            days_of_week=["Tue"],
            time_start="10:00",
            time_end="12:00",
            user_id=self.user.user_id
        )
        # Original alt1, alt2 (2) + New 5 rooms (5) = 7 suggestions
        self.assertEqual(len(suggestions), 7)

    def test_find_alternative_rooms_is_favourite(self):
        # target has conflict
        Booking.objects.create(
            room=self.room_target, booker=self.user,
            start_datetime=self._dt("2026-05-05", "10:00"),
            end_datetime=self._dt("2026-05-05", "12:00"),
            status="Approved", purpose_type="teaching"
        )
        # set alt2 as favourite
        FavouriteRoom.objects.create(user=self.user, room=self.room_alt2)

        suggestions = find_alternative_rooms(
            original_room_id=self.room_target.room_id,
            date_start=date(2026, 5, 5),
            date_end=date(2026, 5, 5),
            days_of_week=["Tue"],
            time_start="10:00",
            time_end="12:00",
            user_id=self.user.user_id
        )
        # alt1, alt2
        self.assertEqual(len(suggestions), 2)
        
        # alt1 (capacity 60) should come first due to order_by("capacity")
        self.assertEqual(suggestions[0]["room_code"], "406-4")
        self.assertFalse(suggestions[0]["is_favourite"])
        
        # alt2 (capacity 80)
        self.assertEqual(suggestions[1]["room_code"], "406-5")
        self.assertTrue(suggestions[1]["is_favourite"])

    def test_find_alternative_rooms_queries(self):
        # สร้างห้องจำลอง 10 ห้องเพื่อพิสูจน์ N+1
        for i in range(10, 20):
            Room.objects.create(
                room_code=f"ROOM-{i}", room_name=f"ห้อง {i}",
                room_type="Meeting Room", capacity=60, is_active=True
            )
            
        # ล็อกจำนวน Query ให้ตึงขึ้นตามคำแนะนำ
        with CaptureQueriesContext(connection) as captured:
            result = find_alternative_rooms(
                original_room_id=self.room_target.room_id,
                date_start=date(2026, 5, 5),
                date_end=date(2026, 5, 5),
                days_of_week=["Tue"],
                time_start="10:00",
                time_end="12:00",
                user_id=self.user.user_id
            )
            
        self.assertLessEqual(len(captured.captured_queries), 5)
        self.assertEqual(len(result), 12)