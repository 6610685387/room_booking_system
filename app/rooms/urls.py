from django.urls import path
from .views import RoomListView, RoomScheduleView, RoomBlackoutView
from .views import FavouriteRoomToggleView, FavouriteRoomListView

urlpatterns = [
    path("",                         RoomListView.as_view(),      name="room-list"),
    path("favourites/",              FavouriteRoomListView.as_view(), name="room-favourite-list"),
    path("<int:room_id>/schedule/",  RoomScheduleView.as_view(),  name="room-schedule"),
    path("<int:room_id>/blackouts/", RoomBlackoutView.as_view(),  name="room-blackouts"),
    path("<int:room_id>/favourite/", FavouriteRoomToggleView.as_view(), name="room-favourite-toggle"),
]
