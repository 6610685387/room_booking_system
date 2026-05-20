from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'room', views.AdminCRUDViewSet)

urlpatterns = [
    path("", views.dashboard, name="admin_dashboard"),
    path("blackout/", views.blackout_room, name="blackout"),
    path("req/", include(router.urls)),
    path("bookings/", views.admin_booking_list, name="admin_booking_list"),
    path("bookings/<int:booking_id>/approve/", views.admin_booking_approve, name="admin_booking_approve"),
    path("bookings/<int:booking_id>/reject/", views.admin_booking_reject, name="admin_booking_reject"),
]
