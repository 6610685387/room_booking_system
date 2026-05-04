from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views.booking_views import BookingViewSet
from .views import booking_views  # เปลี่ยนวิธี import นิดหน่อยเพื่อให้เรียกใช้ฟังก์ชันหน้าเว็บได้

app_name = 'bookings'

router = DefaultRouter()
router.register(r"", BookingViewSet, basename="booking")



urlpatterns = [
    path("dashboard/lecturer/", booking_views.lecturer_dashboard, name="lecturer_dashboard"),
    path("dashboard/admin/", booking_views.admin_dashboard, name="admin_dashboard"),
    path("", include(router.urls)),
]
