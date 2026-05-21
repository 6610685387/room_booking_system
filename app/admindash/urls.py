from django.urls import path
from . import views

urlpatterns = [
    # path("", views.dashboard, name="admin_dashboard"),
    # --- blackout ---
    path('blackout/', views.BlackoutPeriodCreateView.as_view(), name='blackout-create'),
    path('blackout/<int:blackout_id>/', views.BlackoutPeriodDeleteView.as_view(), name='blackout-delete'),
    # --- room ---
    path('req/room/', views.room_list_create_api, name='room_list_create'),
    path('req/room/<int:room_id>/', views.room_detail_api, name='room_detail'),
    path("bookings/", views.admin_booking_list, name="admin_booking_list"),
    path("bookings/<int:booking_id>/approve/", views.admin_booking_approve, name="admin_booking_approve"),
    path("bookings/<int:booking_id>/reject/", views.admin_booking_reject, name="admin_booking_reject"),
]
