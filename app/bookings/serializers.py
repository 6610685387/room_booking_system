from rest_framework import serializers
from .models import Booking, TeachingInfo, TrainingInfo, RecurringGroup
from account.serializers import UserBriefSerializer
from rooms.serializers import RoomBriefSerializer


class TeachingInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeachingInfo
        fields = ["subject_code", "subject_name", "program_type"]


class TrainingInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainingInfo
        fields = ["topic"]

# --- Lecturer Read ---
class BookingPublicSerializer(serializers.ModelSerializer):
    booker_display = serializers.SerializerMethodField()
    room_name = serializers.CharField(source='room.room_name', read_only=True)

    class Meta:
        model = Booking
        fields = [
            'booking_id', 'room', 'room_name', 'start_datetime', 
            'end_datetime', 'status', 'purpose_type', 'booker_display'
        ]

    def get_booker_display(self, obj):
        request = self.context.get('request')
        if request and request.user == obj.booker:
            return getattr(obj.booker, 'username', 'You') 
        return "ไม่ระบุตัวตน (Anonymous)"

# --- Admin Read ---
class BookingAdminSerializer(serializers.ModelSerializer):
    booker_name = serializers.CharField(source='booker.username', read_only=True)
    room_name = serializers.CharField(source='room.room_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.username', read_only=True)

    class Meta:
        model = Booking
        fields = '__all__'


class BookingWriteSerializer(serializers.ModelSerializer):
    teaching_info = TeachingInfoSerializer(required=False)
    training_info = TrainingInfoSerializer(required=False)

    class Meta:
        model = Booking
        fields = [
            "room",
            "start_datetime",
            "end_datetime",
            "purpose_type",
            "teaching_info",
            "training_info",
            "recurring_group",
            "additional_requests",
            "notification_email",
        ]

    def validate(self, data):
        purpose_type = data.get("purpose_type")
        if purpose_type == "teaching":
            if not data.get("teaching_info"):
                raise serializers.ValidationError(
                    {"teaching_info": "This field is required for teaching purpose."}
                )
            if data.get("training_info"):
                raise serializers.ValidationError(
                    {
                        "training_info": "This field must not be provided for teaching purpose."
                    }
                )
        elif purpose_type == "training":
            if not data.get("training_info"):
                raise serializers.ValidationError(
                    {"training_info": "This field is required for training purpose."}
                )
            if data.get("teaching_info"):
                raise serializers.ValidationError(
                    {
                        "teaching_info": "This field must not be provided for training purpose."
                    }
                )
        return data

    def create(self, validated_data):
        teaching_info_data = validated_data.pop("teaching_info", None)
        training_info_data = validated_data.pop("training_info", None)

        booking = Booking.objects.create(**validated_data)

        if teaching_info_data:
            TeachingInfo.objects.create(booking=booking, **teaching_info_data)
        elif training_info_data:
            TrainingInfo.objects.create(booking=booking, **training_info_data)

        return booking
