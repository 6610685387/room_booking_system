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
        if data["start_datetime"] > data["end_datetime"]:
            raise serializers.ValidationError("start_datetime ต้องไม่มากกว่า end_datetime")
        return data


class BlackoutPeriodReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = BlackoutPeriod
        fields = ["blackout_id", "room_id", "start_datetime", "end_datetime", "reason"]
