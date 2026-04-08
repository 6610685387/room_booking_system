from django.contrib import admin
from .models import Booking

@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = (
        'room', 'booker', 'status', 'purpose_type', 
        'start_datetime', 'end_datetime', 'created_at'
    )
    list_filter = ('status', 'purpose_type', 'room')
    search_fields = ('room__name', 'booker__username', 'subject_code', 'subject_name', 'topic')
