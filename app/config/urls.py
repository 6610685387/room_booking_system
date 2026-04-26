from django.contrib import admin
from django.urls import path, include
from bookings.views.dashboard_views import (
    lecturer_dashboard,
    new_booking,
    cancel_booking,
    admin_dashboard,
    approve_booking,
    reject_booking,
)

urlpatterns = [
    path("admin/", admin.site.urls),
    # account (index, login, logout, success pages)
    path("", include("account.urls")),
    # lecturer
    path("dashboard/", lecturer_dashboard, name="lecturer_dashboard"),
    path("bookings/new/", new_booking, name="new_booking"),
    path("bookings/<int:booking_id>/cancel/", cancel_booking, name="cancel_booking"),
    # admin
    path("admin-dashboard/", admin_dashboard, name="admin_dashboard"),
    path(
        "admin/bookings/<int:booking_id>/approve/",
        approve_booking,
        name="approve_booking",
    ),
    path(
        "admin/bookings/<int:booking_id>/reject/", reject_booking, name="reject_booking"
    ),
    # DRF API
    path("api/bookings/", include("bookings.urls")),
    path("api/rooms/", include("rooms.urls")),
]
