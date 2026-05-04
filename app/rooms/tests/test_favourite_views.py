from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from account.models import User
from rooms.models import Room, FavouriteRoom
from django.test.utils import CaptureQueriesContext  
from django.db import connection                    

class FavouriteRoomTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", password="password123", role=User.Role.LECTURER)
        self.room = Room.objects.create(
            room_code="R101", room_name="Test Room",
            room_type="Meeting Room", capacity=10, is_active=True
        )
        self.client.force_authenticate(user=self.user)

    def test_toggle_favourite_add(self):
        url = reverse("room-favourite-toggle", args=[self.room.room_id])
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["is_favourite"])
        self.assertTrue(FavouriteRoom.objects.filter(user=self.user, room=self.room).exists())

    def test_toggle_favourite_remove(self):
        # Pre-add favourite
        FavouriteRoom.objects.create(user=self.user, room=self.room)
        
        url = reverse("room-favourite-toggle", args=[self.room.room_id])
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["is_favourite"])
        self.assertFalse(FavouriteRoom.objects.filter(user=self.user, room=self.room).exists())

    def test_favourite_list(self):
        # Add favourite
        FavouriteRoom.objects.create(user=self.user, room=self.room)
        
        # Create another room and another user's favourite
        room2 = Room.objects.create(room_code="R102", room_name="Room 2", room_type="Classroom", capacity=20, is_active=True)
        user2 = User.objects.create_user(username="user2", password="password", role=User.Role.LECTURER)
        FavouriteRoom.objects.create(user=user2, room=room2)

        url = reverse("room-favourite-list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["room_code"], "R101")

    def test_toggle_favourite_not_found(self):
        url = reverse("room-favourite-toggle", args=[999])
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_toggle_favourite_multiple_times(self):
        """1) ทดสอบ Toggle ซ้ำๆ: Add -> Remove -> Add"""
        url = reverse("room-favourite-toggle", args=[self.room.room_id])
        
        # กดครั้งที่ 1 (Add)
        res1 = self.client.post(url)
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res1.data["is_favourite"])
        
        # กดครั้งที่ 2 (Remove)
        res2 = self.client.post(url)
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertFalse(res2.data["is_favourite"])
        
        # กดครั้งที่ 3 (Add Again)
        res3 = self.client.post(url)
        self.assertEqual(res3.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res3.data["is_favourite"])

    def test_unauthenticated_user_cannot_access(self):
        """2) ทดสอบ Permission: ไม่ได้ Login ต้องโดนเตะ (401 หรือ 403)"""
        # เตะ User ออกจาก Session
        self.client.force_authenticate(user=None)

        url_toggle = reverse("room-favourite-toggle", args=[self.room.room_id])
        url_list = reverse("room-favourite-list")

        # DRF อาจคืน 401 หรือ 403 ขึ้นอยู่กับการตั้งค่า Authentication
        self.assertIn(self.client.post(url_toggle).status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])
        self.assertIn(self.client.get(url_list).status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_cannot_favourite_inactive_room(self):
        """3) ทดสอบห้อง Inactive: ต้องคืนค่า 404 (ดักด้วย is_active=True ไว้แล้ว)"""
        inactive_room = Room.objects.create(
            room_code="R999", room_name="Closed Room",
            room_type="Classroom", capacity=30, is_active=False
        )
        url = reverse("room-favourite-toggle", args=[inactive_room.room_id])
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_favourite_list_performance(self):
        """4) ทดสอบ Performance: ป้องกัน N+1 Query (ให้มีระยะหายใจ ไม่เปราะบาง)"""
        # สร้างห้องโปรดเพิ่มอีก 3 ห้อง
        for i in range(3):
            r = Room.objects.create(room_code=f"PF{i}", room_name=f"PF Room {i}", room_type="Classroom", capacity=10, is_active=True)
            FavouriteRoom.objects.create(user=self.user, room=r)

        url = reverse("room-favourite-list")

        # ใช้ CaptureQueriesContext เพื่อจับจำนวน Query แทนการฟิกซ์เลขเป๊ะๆ
        with CaptureQueriesContext(connection) as captured_queries:
            response = self.client.get(url)
            
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 3)
        
        # ตรวจสอบว่า Query ต้อง "ไม่เกิน 3 ครั้ง" 
        # สิ่งนี้จะช่วยกันลูป N+1 ได้อย่างมีประสิทธิภาพ (ถ้าติด N+1 จริง Query จะพุ่งไป 4+) แต่ก็ไม่เปราะบางเกินไป
        self.assertLessEqual(len(captured_queries.captured_queries), 3)