from rest_framework import serializers
from .models import Room, BlackoutPeriod


class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = "__all__"
        read_only_fields = ["room_id", "created_at", "updated_at"]


class RoomBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ["room_id", "room_code", "room_name", "capacity"]


class BlackoutPeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model = BlackoutPeriod
        fields = "__all__"
        read_only_fields = ["blackout_id"]

    def validate(self, data):
        if data["start_date"] > data["end_date"]:
            raise serializers.ValidationError("start_date ต้องไม่มากกว่า end_date")
        return data
