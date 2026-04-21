from django.contrib import admin
from .models import Room, BlackoutPeriod


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ("room_code", "room_name", "room_type", "capacity", "is_active")
    search_fields = ("room_code", "room_name")  # ← แก้จาก name, location
    list_filter = ("room_type", "is_active")


@admin.register(BlackoutPeriod)
class BlackoutPeriodAdmin(admin.ModelAdmin):
    list_display = ("room", "start_date", "end_date", "reason")
    search_fields = ("room__room_name",)
