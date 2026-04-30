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


class BookingReadSerializer(serializers.ModelSerializer):
    room = RoomBriefSerializer(read_only=True)
    booker = UserBriefSerializer(read_only=True)
    approved_by = UserBriefSerializer(read_only=True)
    teaching_info = TeachingInfoSerializer(read_only=True)
    training_info = TrainingInfoSerializer(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    purpose_display = serializers.CharField(
        source="get_purpose_type_display", read_only=True
    )

    class Meta:
        model = Booking
        fields = [
            "booking_id",
            "room",
            "booker",
            "approved_by",
            "start_datetime",
            "end_datetime",
            "status",
            "status_display",
            "purpose_type",
            "purpose_display",
            "reject_reason",
            "teaching_info",
            "training_info",
            "recurring_group",
            "additional_requests",
            "admin_notes",
            "created_at",
        ]


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
        ]

    def validate(self, data):
        purpose_type = data.get("purpose_type")
        if purpose_type == "teaching":
            if not data.get("teaching_info"):
                raise serializers.ValidationError({"teaching_info": "This field is required for teaching purpose."})
            if data.get("training_info"):
                raise serializers.ValidationError({"training_info": "This field must not be provided for teaching purpose."})
        elif purpose_type == "training":
            if not data.get("training_info"):
                raise serializers.ValidationError({"training_info": "This field is required for training purpose."})
            if data.get("teaching_info"):
                raise serializers.ValidationError({"teaching_info": "This field must not be provided for training purpose."})
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
