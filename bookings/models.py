from django.conf import settings
from django.db import models
from django.db.models import Q
from rooms.models import Room


class RecurringGroup(models.Model):
    group_id = models.AutoField(primary_key=True)
    booker = models.ForeignKey(
        settings.AUTH_USER_MODEL,         
        on_delete=models.CASCADE,
        related_name='recurring_groups'
    )
    room = models.ForeignKey(
        Room, on_delete=models.CASCADE, related_name='recurring_groups'
    )
    day_pattern = models.CharField(max_length=50)
    date_start = models.DateField()
    date_end = models.DateField()
    time_start = models.TimeField()
    time_end = models.TimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'recurring_groups'


class Booking(models.Model):
    STATUS_CHOICES = [
        ('Pending', 'รอการอนุมัติ'),
        ('Approved', 'อนุมัติแล้ว'),
        ('Rejected', 'ปฏิเสธ'),
        ('Cancelled', 'ยกเลิก'),
    ]
    PURPOSE_CHOICES = [
        ('teaching', 'สอน'),
        ('training', 'อบรม'),
    ]

    booking_id = models.AutoField(primary_key=True)
    room = models.ForeignKey(
        Room, on_delete=models.PROTECT, related_name='bookings'
    )
    booker = models.ForeignKey(
        settings.AUTH_USER_MODEL,          
        on_delete=models.PROTECT,
        related_name='bookings_as_booker'
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,        
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='bookings_approved'
    )
    recurring_group = models.ForeignKey(
        RecurringGroup, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='bookings'
    )
    start_datetime = models.DateTimeField()
    end_datetime = models.DateTimeField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='Pending')
    purpose_type = models.CharField(max_length=10, choices=PURPOSE_CHOICES)
    reject_reason = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'bookings'
        indexes = [
            models.Index(
                fields=['room', 'start_datetime', 'end_datetime', 'status'],
                name='idx_conflict_detection'
            ),
            models.Index(
                fields=['status', 'start_datetime'],
                name='idx_report_filter'
            ),
        ]

    @staticmethod
    def has_conflict(room_id, start_dt, end_dt, exclude_booking_id=None):
        qs = Booking.objects.filter(
            room_id=room_id,
            status__in=['Pending', 'Approved'],
        ).filter(
            Q(start_datetime__lt=end_dt) & Q(end_datetime__gt=start_dt)
        )
        if exclude_booking_id:
            qs = qs.exclude(booking_id=exclude_booking_id)
        return qs.exists()


class TeachingInfo(models.Model):
    PROGRAM_CHOICES = [
        ('Bachelor', 'ปริญญาตรีภาคปกติ'),
        ('Master', 'ปริญญาโท'),
        ('TEP-TEPE', 'TEP-TEPE'),
        ('TU-PINE', 'TU-PINE'),
    ]

    booking = models.OneToOneField(
        Booking, on_delete=models.CASCADE, related_name='teaching_info'
    )
    subject_code = models.CharField(max_length=20)
    subject_name = models.CharField(max_length=200)
    program_type = models.CharField(max_length=20, choices=PROGRAM_CHOICES)

    class Meta:
        db_table = 'teaching_info'


class TrainingInfo(models.Model):
    booking = models.OneToOneField(
        Booking, on_delete=models.CASCADE, related_name='training_info'
    )
    topic = models.CharField(max_length=300)

    class Meta:
        db_table = 'training_info'