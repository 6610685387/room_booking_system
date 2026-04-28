from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter, inline_serializer
from rest_framework import serializers
from .serializers import RoomSerializer, BlackoutPeriodReadSerializer

# Explicit class for nested schedule data to avoid "inline_serializer" instantiation issues
class ScheduleSlotSerializer(serializers.Serializer):
    booking_id = serializers.IntegerField()
    day = serializers.CharField(help_text="Mon, Tue, ...")
    start_time = serializers.CharField(help_text="HH:MM")
    end_time = serializers.CharField(help_text="HH:MM")
    status = serializers.CharField()
    purpose_type = serializers.CharField()
    label = serializers.CharField(help_text="ชื่อวิชา หรือ หัวข้ออบรม")

class RoomScheduleResponseSerializer(serializers.Serializer):
    room_id = serializers.IntegerField()
    room_code = serializers.CharField()
    week_start = serializers.CharField(help_text="YYYY-MM-DD")
    blackout_days = serializers.ListField(child=serializers.CharField(), help_text="รายชื่อวันที่ปิดปรับปรุง [YYYY-MM-DD]")
    slots = ScheduleSlotSerializer(many=True)

room_list_schema = extend_schema_view(
    get=extend_schema(
        summary="ดึงรายชื่อห้องทั้งหมด",
        description="แสดงรายการห้อง สามารถกรองเฉพาะห้องที่เปิดใช้งานด้วย ?is_active=true",
        parameters=[
            OpenApiParameter(name="is_active", description="true หรือ false", required=False, type=str)
        ],
        responses={200: RoomSerializer(many=True)}
    )
)

room_schedule_schema = extend_schema_view(
    get=extend_schema(
        summary="ดึงตารางการใช้ห้อง (รายสัปดาห์)",
        description="ดูตารางจองของห้อง ระบุวันเริ่มต้นสัปดาห์ (ต้องเป็นวันอาทิตย์) เช่น ?week_start=2026-05-03",
        parameters=[
            OpenApiParameter(name="week_start", description="YYYY-MM-DD (ต้องเป็นวันอาทิตย์)", required=True, type=str)
        ],
        responses={200: RoomScheduleResponseSerializer}
    )
)

room_blackout_schema = extend_schema_view(
    get=extend_schema(
        summary="ดึงรายการ Blackout ของห้อง",
        description="ดูช่วงเวลาปิดปรับปรุง/วันหยุดของห้องนั้น สามารถระบุช่วงวันที่ ?from=...&to=...",
        parameters=[
            OpenApiParameter(name="from", description="YYYY-MM-DD", required=False, type=str),
            OpenApiParameter(name="to", description="YYYY-MM-DD", required=False, type=str)
        ],
        responses={200: BlackoutPeriodReadSerializer(many=True)}
    )
)
