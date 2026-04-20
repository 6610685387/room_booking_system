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
        ]

    def validate(self, data):
        if data["start_datetime"] >= data["end_datetime"]:
            raise serializers.ValidationError("start_datetime ต้องน้อยกว่า end_datetime")
        purpose = data.get("purpose_type")
        if purpose == "teaching" and not data.get("teaching_info"):
            raise serializers.ValidationError(
                "กรุณาระบุ teaching_info สำหรับการจองประเภทสอน"
            )
        if purpose == "training" and not data.get("training_info"):
            raise serializers.ValidationError(
                "กรุณาระบุ training_info สำหรับการจองประเภทอบรม"
            )
        exclude_id = self.instance.booking_id if self.instance else None
        if Booking.has_conflict(
            room_id=data["room"].room_id,
            start_dt=data["start_datetime"],
            end_dt=data["end_datetime"],
            exclude_booking_id=exclude_id,
        ):
            raise serializers.ValidationError(
                "ห้องนี้ถูกจองในช่วงเวลาดังกล่าวแล้ว กรุณาเลือกเวลาอื่น"
            )
        return data

    def create(self, validated_data):
        teaching_data = validated_data.pop("teaching_info", None)
        training_data = validated_data.pop("training_info", None)
        booking = Booking.objects.create(**validated_data)
        if teaching_data:
            TeachingInfo.objects.create(booking=booking, **teaching_data)
        if training_data:
            TrainingInfo.objects.create(booking=booking, **training_data)
        return booking

    def update(self, instance, validated_data):
        teaching_data = validated_data.pop("teaching_info", None)
        training_data = validated_data.pop("training_info", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if teaching_data:
            TeachingInfo.objects.update_or_create(
                booking=instance, defaults=teaching_data
            )
        if training_data:
            TrainingInfo.objects.update_or_create(
                booking=instance, defaults=training_data
            )
        return instance
