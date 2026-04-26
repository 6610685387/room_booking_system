from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from account.models import User
from rooms.models import Room, BlackoutPeriod
from bookings.models import Booking, TeachingInfo, TrainingInfo
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo
from django.utils.timezone import make_aware

BKK = ZoneInfo("Asia/Bangkok")

class RoomAPITest(APITestCase):
    def setUp(self):
        # Create user
        self.user = User.objects.create_user(username="testuser", password="password123")
        self.client.force_authenticate(user=self.user)

        # Create rooms
        self.room1 = Room.objects.create(
            room_code="406-3", room_name="ห้องประชุม 1",
            room_type="Meeting Room", capacity=60, is_active=True
        )
        self.room2 = Room.objects.create(
            room_code="101", room_name="ห้องเรียน 1",
            room_type="Classroom", capacity=40, is_active=False
        )

    def test_room_list_no_filter(self):
        url = reverse("room-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_room_list_filter_active(self):
        url = reverse("room-list")
        response = self.client.get(url, {"is_active": "true"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["room_code"], "406-3")

    def test_room_list_filter_inactive(self):
        url = reverse("room-list")
        response = self.client.get(url, {"is_active": "false"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["room_code"], "101")

    def test_room_schedule_validation(self):
        url = reverse("room-schedule", args=[self.room1.room_id])
        
        # Missing week_start
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
        # Format error
        response = self.client.get(url, {"week_start": "27-04-2026"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
        # Not a Sunday (2026-04-27 is Monday)
        response = self.client.get(url, {"week_start": "2026-04-27"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "week_start must be a Sunday")

    def test_room_schedule_data(self):
        # 2026-04-26 is a Sunday
        week_start = "2026-04-26"
        url = reverse("room-schedule", args=[self.room1.room_id])
        
        # Create a booking (2026-04-28 is Tuesday, inside the week)
        start_dt = make_aware(datetime.combine(date(2026, 4, 28), time(10, 0)), BKK)
        end_dt = make_aware(datetime.combine(date(2026, 4, 28), time(12, 0)), BKK)
        booking = Booking.objects.create(
            room=self.room1, booker=self.user,
            start_datetime=start_dt, end_datetime=end_dt,
            status="Approved", purpose_type="teaching"
        )
        TeachingInfo.objects.create(
            booking=booking, subject_code="CS101", subject_name="Intro to CS", program_type="Bachelor"
        )
        
        # Create a blackout (Thu - Fri, inside the week)
        BlackoutPeriod.objects.create(
            room=self.room1, start_date=date(2026, 4, 30), end_date=date(2026, 5, 1),
            reason="Holiday", created_by=self.user
        )

        response = self.client.get(url, {"week_start": week_start})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["room_code"], "406-3")
        self.assertEqual(len(response.data["slots"]), 1)
        self.assertEqual(response.data["slots"][0]["label"], "CS101 Intro to CS")
        self.assertEqual(response.data["slots"][0]["day"], "Tue")
        
        # Blackout 2026-04-30 (Thu) and 2026-05-01 (Fri)
        self.assertIn("2026-04-30", response.data["blackout_days"])
        self.assertIn("2026-05-01", response.data["blackout_days"])
        self.assertEqual(len(response.data["blackout_days"]), 2)

    def test_room_blackout_list(self):
        url = reverse("room-blackouts", args=[self.room1.room_id])
        
        # Create blackouts
        BlackoutPeriod.objects.create(
            room=self.room1, start_date=date(2026, 5, 1), end_date=date(2026, 5, 5),
            reason="Reason 1", created_by=self.user
        )
        BlackoutPeriod.objects.create(
            room=self.room1, start_date=date(2026, 6, 1), end_date=date(2026, 6, 5),
            reason="Reason 2", created_by=self.user
        )

        # No filter
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

        # With filter
        response = self.client.get(url, {"from": "2026-05-10"})
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["reason"], "Reason 2")