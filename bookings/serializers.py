from rest_framework import serializers
from .models import Booking
from rooms.serializers import RoomSerializer

class BookingListSerializer(serializers.ModelSerializer):
    room_name = serializers.CharField(source='room.name', read_only=True)
    
    class Meta:
        model = Booking
        fields = [
            'id', 'room', 'room_name', 'start_datetime', 'end_datetime', 
            'status', 'purpose_type', 'created_at'
        ]

class BookingDetailSerializer(serializers.ModelSerializer):
    room = RoomSerializer(read_only=True)
    booker_name = serializers.CharField(source='booker.get_full_name', read_only=True)
    
    class Meta:
        model = Booking
        fields = '__all__'

class BookingCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = [
            'room', 'purpose_type', 'subject_code', 'subject_name', 
            'program_type', 'topic', 'start_datetime', 'end_datetime', 
            'is_recurring'
        ]
    
    def validate(self, data):
        # Initial validation will be here. 
        # Detailed logic in Phase 3.
        if data['start_datetime'] >= data['end_datetime']:
            raise serializers.ValidationError("End time must be after start time.")
        return data
