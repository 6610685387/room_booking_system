from django.contrib import admin
from .models import Room, BlackoutPeriod, FavouriteRoom


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ("room_code", "room_name", "room_type", "capacity", "is_active")
    search_fields = ("room_code", "room_name") 
    list_filter = ("room_type", "is_active")


@admin.register(BlackoutPeriod)
class BlackoutPeriodAdmin(admin.ModelAdmin):
    list_display = ("room", "start_datetime", "end_datetime", "reason")
    search_fields = ("room__room_name",)


@admin.register(FavouriteRoom)
class FavouriteRoomAdmin(admin.ModelAdmin):
    list_display = ("user", "room")
    search_fields = ("user__username", "room__room_name")
