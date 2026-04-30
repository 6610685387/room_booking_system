from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from account.models import User
from rooms.models import Room, BlackoutPeriod, FavouriteRoom
from bookings.models import Booking, RecurringGroup, TeachingInfo
from datetime import date, datetime, time, timedelta
import zoneinfo
from django.utils import timezone
from django.utils.timezone import make_aware

BKK = zoneinfo.ZoneInfo("Asia/Bangkok")

class BookingAPITest(APITestCase):
    def setUp(self):
        # Create users
        self.lecturer = User.objects.create_user(username="lec1", password="password123", role="Lecturer", displayname_th="อาจารย์ ทดสอบ")
        self.admin = User.objects.create_user(username="admin1", password="password123", role="Admin", displayname_th="เจ้าหน้าที่ ทดสอบ")
        
        self.client.force_authenticate(user=self.lecturer)

        # Create room
        self.room = Room.objects.create(
            room_code="406-3", room_name="ห้องประชุม 1",
            room_type="Meeting Room", capacity=60, is_active=True
        )

    def test_check_conflict_available(self):
        url = reverse("booking-check-conflict")
        data = {
            "room_id": self.room.room_id,
            "date_start": "2026-05-01",
            "date_end": "2026-05-01",
            "days_of_week": ["Fri"],
            "time_start": "10:00",
            "time_end": "12:00"
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["has_conflict"])
        self.assertEqual(response.data["summary"]["available_count"], 1)

    def test_check_conflict_view_with_suggestions(self):
        # 1. Create conflict in self.room
        start_dt = make_aware(datetime.combine(date(2026, 5, 4), time(10, 0)), BKK)
        end_dt = make_aware(datetime.combine(date(2026, 5, 4), time(12, 0)), BKK)
        Booking.objects.create(
            room=self.room, booker=self.admin,
            start_datetime=start_dt, end_datetime=end_dt,
            status="Approved", purpose_type="training"
        )
        
        # 2. Create an alternative room that is free
        room_alt = Room.objects.create(
            room_code="406-4", room_name="ห้องประชุม 2",
            room_type="Meeting Room", capacity=60, is_active=True
        )

        url = reverse("booking-check-conflict")
        data = {
            "room_id": self.room.room_id,
            "date_start": "2026-05-04",
            "date_end": "2026-05-04",
            "days_of_week": ["Mon"],
            "time_start": "11:00",
            "time_end": "13:00"
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["has_conflict"])
        self.assertIn("suggested_rooms", response.data)
        self.assertEqual(len(response.data["suggested_rooms"]), 1)
        self.assertEqual(response.data["suggested_rooms"][0]["room_code"], "406-4")
        self.assertIn("is_favourite", response.data["suggested_rooms"][0])
        self.assertFalse(response.data["suggested_rooms"][0]["is_favourite"])

    def test_check_conflict_view_with_favourite_room(self):
        # 1. จำลองการจองให้ห้องเป้าหมายเต็ม
        start_dt = make_aware(datetime.combine(date(2026, 5, 4), time(10, 0)), BKK)
        end_dt = make_aware(datetime.combine(date(2026, 5, 4), time(12, 0)), BKK)
        Booking.objects.create(
            room=self.room, booker=self.admin,
            start_datetime=start_dt, end_datetime=end_dt,
            status="Approved", purpose_type="training"
        )
        
        # 2. สร้างห้องสำรองที่ว่างอยู่
        room_alt = Room.objects.create(
            room_code="406-4", room_name="ห้องประชุม 2",
            room_type="Meeting Room", capacity=60, is_active=True
        )

        # 3. ให้ User (self.lecturer) กด Favourite ห้องสำรองนี้ไว้
        FavouriteRoom.objects.create(user=self.lecturer, room=room_alt)

        # 4. ยิง API Check Conflict
        url = reverse("booking-check-conflict")
        data = {
            "room_id": self.room.room_id,
            "date_start": "2026-05-04",
            "date_end": "2026-05-04",
            "days_of_week": ["Mon"],
            "time_start": "11:00",
            "time_end": "13:00"
        }
        response = self.client.post(url, data, format='json')
        
        # 5. ตรวจสอบผลลัพธ์
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["has_conflict"])
        self.assertEqual(len(response.data["suggested_rooms"]), 1)
        self.assertEqual(response.data["suggested_rooms"][0]["room_code"], "406-4")
        self.assertTrue(response.data["suggested_rooms"][0]["is_favourite"]) # ต้องเป็น True

    def test_create_booking_success(self):
        url = reverse("booking-list")
        data = {
            "room_id": self.room.room_id,
            "date_start": "2026-05-04",
            "date_end": "2026-05-04",
            "days_of_week": ["Mon"],
            "time_start": "10:00",
            "time_end": "12:00",
            "purpose_type": "teaching",
            "teaching_info": {
                "subject_code": "CS101",
                "subject_name": "Intro to CS",
                "program_type": "Bachelor"
            }
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["total_created"], 1)
        self.assertEqual(response.data["status"], "Pending")
        
        # Verify DB
        self.assertEqual(Booking.objects.count(), 1)
        booking = Booking.objects.first()
        self.assertEqual(booking.status, "Pending")
        self.assertEqual(booking.teaching_info.subject_code, "CS101")

    def test_create_booking_conflict(self):
        # Create an existing booking
        start_dt = make_aware(datetime.combine(date(2026, 5, 4), time(10, 0)), BKK)
        end_dt = make_aware(datetime.combine(date(2026, 5, 4), time(12, 0)), BKK)
        Booking.objects.create(
            room=self.room, booker=self.admin,
            start_datetime=start_dt, end_datetime=end_dt,
            status="Approved", purpose_type="training"
        )

        url = reverse("booking-list")
        data = {
            "room_id": self.room.room_id,
            "date_start": "2026-05-04",
            "date_end": "2026-05-04",
            "days_of_week": ["Mon"],
            "time_start": "11:00",
            "time_end": "13:00",
            "purpose_type": "training",
            "training_info": {"topic": "Conflict Test"}
        }
        
        # Should fail with 409
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(response.data["report"]["has_conflict"])

        # Try with skip_conflicts=True
        data["skip_conflicts"] = True
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "ไม่มีวันว่างให้จองเลย")

    def test_my_bookings(self):
        # Create a booking for self
        start_dt = make_aware(datetime.combine(date(2026, 5, 4), time(10, 0)), BKK)
        end_dt = make_aware(datetime.combine(date(2026, 5, 4), time(12, 0)), BKK)
        Booking.objects.create(room=self.room, booker=self.lecturer, start_datetime=start_dt, end_datetime=end_dt, status="Approved", purpose_type="training")
        
        # Create a booking for someone else
        Booking.objects.create(room=self.room, booker=self.admin, start_datetime=start_dt + timedelta(days=1), end_datetime=end_dt + timedelta(days=1), status="Approved", purpose_type="training")

        url = reverse("booking-my-bookings")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_cancel_booking(self):
        # Create a future booking
        future_date = date.today() + timedelta(days=5)
        start_dt = make_aware(datetime.combine(future_date, time(10, 0)), BKK)
        end_dt = make_aware(datetime.combine(future_date, time(12, 0)), BKK)
        booking = Booking.objects.create(room=self.room, booker=self.lecturer, start_datetime=start_dt, end_datetime=end_dt, status="Approved", purpose_type="training")

        url = reverse("booking-cancel", args=[booking.booking_id])
        response = self.client.patch(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "Cancelled")
        
        booking.refresh_from_db()
        self.assertEqual(booking.status, "Cancelled")

    def test_cancel_past_booking_fail(self):
        # Create a past booking
        past_date = date.today() - timedelta(days=5)
        start_dt = make_aware(datetime.combine(past_date, time(10, 0)), BKK)
        end_dt = make_aware(datetime.combine(past_date, time(12, 0)), BKK)
        booking = Booking.objects.create(room=self.room, booker=self.lecturer, start_datetime=start_dt, end_datetime=end_dt, status="Approved", purpose_type="training")

        url = reverse("booking-cancel", args=[booking.booking_id])
        response = self.client.patch(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("เลยเวลาเริ่มต้นไปแล้ว", response.data["error"])

    def test_cancel_others_booking_fail_lecturer(self):
        # Create a future booking for admin
        future_date = date.today() + timedelta(days=5)
        start_dt = make_aware(datetime.combine(future_date, time(10, 0)), BKK)
        end_dt = make_aware(datetime.combine(future_date, time(12, 0)), BKK)
        booking = Booking.objects.create(room=self.room, booker=self.admin, start_datetime=start_dt, end_datetime=end_dt, status="Approved", purpose_type="training")

        url = reverse("booking-cancel", args=[booking.booking_id])
        response = self.client.patch(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_retrieve_others_booking_fail_lecturer(self):
        # Create a booking for admin
        start_dt = make_aware(datetime.combine(date(2026, 5, 4), time(10, 0)), BKK)
        end_dt = make_aware(datetime.combine(date(2026, 5, 4), time(12, 0)), BKK)
        booking = Booking.objects.create(room=self.room, booker=self.admin, start_datetime=start_dt, end_datetime=end_dt, status="Approved", purpose_type="training")

        url = reverse("booking-detail", args=[booking.booking_id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_retrieve_others_booking_success(self):
        # Create a booking for lecturer
        start_dt = make_aware(datetime.combine(date(2026, 5, 4), time(10, 0)), BKK)
        end_dt = make_aware(datetime.combine(date(2026, 5, 4), time(12, 0)), BKK)
        booking = Booking.objects.create(room=self.room, booker=self.lecturer, start_datetime=start_dt, end_datetime=end_dt, status="Approved", purpose_type="training")

        # Login as admin
        self.client.force_authenticate(user=self.admin)
        url = reverse("booking-detail", args=[booking.booking_id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["booking_id"], booking.booking_id)

    def test_admin_cancel_others_booking_fail(self):
        # Create a future booking for lecturer
        future_date = date.today() + timedelta(days=5)
        start_dt = make_aware(datetime.combine(future_date, time(10, 0)), BKK)
        end_dt = make_aware(datetime.combine(future_date, time(12, 0)), BKK)
        booking = Booking.objects.create(room=self.room, booker=self.lecturer, start_datetime=start_dt, end_datetime=end_dt, status="Approved", purpose_type="training")

        # Login as admin
        self.client.force_authenticate(user=self.admin)
        url = reverse("booking-cancel", args=[booking.booking_id])
        response = self.client.patch(url)
        # Should be 403 because Admin can only cancel their own booking via this API (SYS-20)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_booking_additional_requests(self):
        url = reverse("booking-list")
        data = {
            "room_id": self.room.room_id,
            "date_start": "2026-05-04",
            "date_end": "2026-05-04",
            "days_of_week": ["Mon"],
            "time_start": "10:00",
            "time_end": "12:00",
            "purpose_type": "teaching",
            "teaching_info": {
                "subject_code": "CS101",
                "subject_name": "Intro to CS",
                "program_type": "Bachelor"
            },
            "additional_requests": "Request projector"
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Verify DB
        booking = Booking.objects.first()
        self.assertEqual(booking.additional_requests, "Request projector")

    def test_retrieve_booking_expose_fields(self):
        start_dt = make_aware(datetime.combine(date(2026, 5, 4), time(10, 0)), BKK)
        end_dt = make_aware(datetime.combine(date(2026, 5, 4), time(12, 0)), BKK)
        booking = Booking.objects.create(
            room=self.room, booker=self.lecturer,
            start_datetime=start_dt, end_datetime=end_dt,
            status="Approved", purpose_type="training",
            additional_requests="Request mic",
            admin_notes="Approved with mic"
        )

        url = reverse("booking-detail", args=[booking.booking_id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["additional_requests"], "Request mic")
        self.assertEqual(response.data["admin_notes"], "Approved with mic")

        # Check my_bookings too
        url_my = reverse("booking-my-bookings")
        response_my = self.client.get(url_my)
        self.assertEqual(response_my.status_code, status.HTTP_200_OK)
        self.assertEqual(response_my.data[0]["additional_requests"], "Request mic")

    def test_cancel_recurring_booking(self):
        # สร้าง Group และ Booking 2 วันในอนาคต
        group = RecurringGroup.objects.create(
            booker=self.lecturer, room=self.room, day_pattern="Mon",
            date_start=date.today() + timedelta(days=1), date_end=date.today() + timedelta(days=8),
            time_start=time(10, 0), time_end=time(12, 0)
        )
        
        start_dt_1 = make_aware(datetime.combine(date.today() + timedelta(days=1), time(10, 0)), BKK)
        end_dt_1 = make_aware(datetime.combine(date.today() + timedelta(days=1), time(12, 0)), BKK)
        booking1 = Booking.objects.create(room=self.room, booker=self.lecturer, start_datetime=start_dt_1, end_datetime=end_dt_1, status="Pending", purpose_type="teaching", recurring_group=group)

        start_dt_2 = make_aware(datetime.combine(date.today() + timedelta(days=8), time(10, 0)), BKK)
        end_dt_2 = make_aware(datetime.combine(date.today() + timedelta(days=8), time(12, 0)), BKK)
        booking2 = Booking.objects.create(room=self.room, booker=self.lecturer, start_datetime=start_dt_2, end_datetime=end_dt_2, status="Approved", purpose_type="teaching", recurring_group=group)

        # ยิง API ยกเลิกทั้งกลุ่ม
        url = reverse("booking-cancel-recurring", args=[group.group_id])
        response = self.client.patch(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["cancelled_count"], 2)
        
        booking1.refresh_from_db()
        booking2.refresh_from_db()
        self.assertEqual(booking1.status, "Cancelled")
        self.assertEqual(booking2.status, "Cancelled")

    def test_create_booking_invalid_info_combination(self):
        url = reverse("booking-list")
        data = {
            "room_id": self.room.room_id,
            "date_start": "2026-05-04",
            "date_end": "2026-05-04",
            "days_of_week": ["Mon"],
            "time_start": "10:00",
            "time_end": "12:00",
            "purpose_type": "teaching",
            "teaching_info": {
                "subject_code": "CS101",
                "subject_name": "Intro to CS",
                "program_type": "Bachelor"
            },
            "training_info": {
                "topic": "Should not be here"
            }
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("training_info", response.data)

    def test_create_booking_missing_required_info(self):
        """เทสกรณี: ส่ง purpose_type แต่ไม่ยอมส่ง info ที่จำเป็นมาให้"""
        url = reverse("booking-list")
        data = {
            "room_id": self.room.room_id,
            "date_start": "2026-05-04",
            "date_end": "2026-05-04",
            "days_of_week": ["Mon"],
            "time_start": "10:00",
            "time_end": "12:00",
            "purpose_type": "training",
            # เจตนาไม่ส่ง "training_info" มา
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("training_info", response.data) # ต้องฟ้องว่าต้องการฟิลด์นี้

    def test_create_booking_invalid_purpose_type(self):
        """เทสกรณี: ส่ง purpose_type ผิดแปลกไปจาก Choices"""
        url = reverse("booking-list")
        data = {
            "room_id": self.room.room_id,
            "date_start": "2026-05-04",
            "date_end": "2026-05-04",
            "days_of_week": ["Mon"],
            "time_start": "10:00",
            "time_end": "12:00",
            "purpose_type": "party", # <--- ค่านี้ไม่มีในระบบ
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("purpose_type", response.data)

    def test_create_booking_missing_teaching_info(self):
        """เทส Edge Case: purpose เป็น teaching แต่ไม่ส่ง teaching_info"""
        url = reverse("booking-list")
        data = {
            "room_id": self.room.room_id,
            "date_start": "2026-05-04",
            "date_end": "2026-05-04",
            "days_of_week": ["Mon"],
            "time_start": "10:00",
            "time_end": "12:00",
            "purpose_type": "teaching",
            # ไม่ส่ง teaching_info
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("teaching_info", response.data)