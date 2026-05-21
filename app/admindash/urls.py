from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

urlpatterns = [
    path("", views.dashboard, name="admin_dashboard"),
    path("blackout/", views.blackout_room, name="blackout"),
    # --- room ---
    path('api/rooms/', views.room_list_create_api, name='room_list_create'),
    path('api/rooms/<int:room_id>/', views.room_detail_api, name='room_detail'),
    # --- booking ---
    path("bookings/", views.admin_booking_list, name="admin_booking_list"),
    path("bookings/<int:booking_id>/approve/", views.admin_booking_approve, name="admin_booking_approve"),
    path("bookings/<int:booking_id>/reject/", views.admin_booking_reject, name="admin_booking_reject"),
]
