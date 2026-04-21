from django.contrib import admin
from .models import Booking, TeachingInfo, TrainingInfo, RecurringGroup


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = (
        'booking_id', 'room', 'booker', 'status', 'purpose_type',
        'start_datetime', 'end_datetime', 'created_at'
    )
    list_filter = ('status', 'purpose_type', 'room')
    search_fields = (
        'room__room_name',         
        'booker__username',
        'booker__displayname_th',
        'teaching_info__subject_code',   
        'teaching_info__subject_name',
        'training_info__topic',         
    )
    readonly_fields = ('created_at',)


@admin.register(TeachingInfo)
class TeachingInfoAdmin(admin.ModelAdmin):
    list_display = ('booking', 'subject_code', 'subject_name', 'program_type')
    search_fields = ('subject_code', 'subject_name')
    list_filter = ('program_type',)


@admin.register(TrainingInfo)
class TrainingInfoAdmin(admin.ModelAdmin):
    list_display = ('booking', 'topic')
    search_fields = ('topic',)


@admin.register(RecurringGroup)
class RecurringGroupAdmin(admin.ModelAdmin):
    list_display = ('group_id', 'booker', 'room', 'day_pattern', 'date_start', 'date_end')
    search_fields = ('booker__username', 'room__room_name')