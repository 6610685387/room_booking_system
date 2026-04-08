import uuid
from django.db import models
from django.contrib.auth.models import User

class Booking(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
    ]
    PURPOSE_CHOICES = [
        ('teaching', 'สอน/ชดเชย/เสริม'),
        ('training', 'อบรม/ติว'),
    ]
    PROGRAM_CHOICES = [
        ('undergraduate', 'ปริญญาตรีภาคปกติ'),
        ('graduate', 'ปริญญาโท'),
        ('tep_tepe', 'TEP-TEPE'),
        ('tu_pine', 'TU-PINE'),
    ]

    room         = models.ForeignKey('rooms.Room', on_delete=models.PROTECT)
    booker       = models.ForeignKey(User, on_delete=models.PROTECT)
    status       = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    purpose_type = models.CharField(max_length=20, choices=PURPOSE_CHOICES)

    # สำหรับ Teaching
    subject_code = models.CharField(max_length=20, blank=True)
    subject_name = models.CharField(max_length=200, blank=True)
    program_type = models.CharField(max_length=20, choices=PROGRAM_CHOICES, blank=True)

    # สำหรับ Training
    topic        = models.CharField(max_length=200, blank=True)

    # เวลา
    start_datetime = models.DateTimeField()
    end_datetime   = models.DateTimeField()

    # Recurring
    is_recurring       = models.BooleanField(default=False)
    recurring_group_id = models.UUIDField(null=True, blank=True)  # ใช้จัด group การจองซ้ำ

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.room} by {self.booker} ({self.start_datetime} to {self.end_datetime})"
