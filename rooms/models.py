from django.conf import settings
from django.db import models
from django.utils import timezone


class Room(models.Model):
    ROOM_TYPE_CHOICES = [
        ("Meeting Room", "ห้องประชุม"),
        ("Classroom", "ห้องเรียน"),
    ]

    room_id = models.AutoField(primary_key=True)
    room_code = models.CharField(max_length=20, unique=True)
    room_name = models.CharField(max_length=100)
    room_type = models.CharField(max_length=20, choices=ROOM_TYPE_CHOICES)
    capacity = models.PositiveIntegerField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="rooms_updated",
    )

    class Meta:
        db_table = "rooms"

    def __str__(self):
        return f"{self.room_code} - {self.room_name}"


class BlackoutPeriod(models.Model):
    blackout_id = models.AutoField(primary_key=True)
    room = models.ForeignKey(
        Room, on_delete=models.CASCADE, related_name="blackout_periods"
    )
    start_date = models.DateField()
    end_date = models.DateField()
    reason = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="blackout_periods_created",
    )

    class Meta:
        db_table = "blackout_periods"

    def __str__(self):
        return f"{self.room.room_code} blackout {self.start_date} to {self.end_date}"
