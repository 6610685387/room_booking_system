from django.urls import path
from .views import RoomListView, RoomScheduleView, RoomBlackoutView

urlpatterns = [
    path("",                         RoomListView.as_view(),      name="room-list"),
    path("<int:room_id>/schedule/",  RoomScheduleView.as_view(),  name="room-schedule"),
    path("<int:room_id>/blackouts/", RoomBlackoutView.as_view(),  name="room-blackouts"),
]
