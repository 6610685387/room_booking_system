from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter, inline_serializer
from drf_spectacular.types import OpenApiTypes
from rest_framework import serializers

booking_viewset_schema = extend_schema_view(
    check_conflict=extend_schema(
        summary="1. เช็กห้องว่างและ Conflict",
        description="ส่งข้อมูลวันที่ เวลา และห้อง เพื่อตรวจสอบว่ามีวันไหนชนหรือติด Blackout บ้าง",
        request=inline_serializer(
            name="CheckConflictPayload",
            fields={
                "room_id": serializers.IntegerField(help_text="ID ของห้องที่ต้องการจอง"),
                "date_start": serializers.DateField(help_text="YYYY-MM-DD"),
                "date_end": serializers.DateField(help_text="YYYY-MM-DD"),
                "days_of_week": serializers.ListField(child=serializers.CharField(), help_text='เช่น ["Mon", "Tue"]'),
                "time_start": serializers.TimeField(format="%H:%M", help_text="HH:MM เช่น 10:00"),
                "time_end": serializers.TimeField(format="%H:%M", help_text="HH:MM เช่น 12:00"),
            }
        ),
    ),
    create=extend_schema(
        summary="2. สร้างการจองห้อง",
        description="สร้างการจองแบบครั้งเดียว หรือแบบ Recurring",
        request=inline_serializer(
            name="BookingCreatePayload",
            fields={
                "room_id": serializers.IntegerField(help_text="ID ของห้องที่ต้องการจอง"),
                "date_start": serializers.DateField(help_text="YYYY-MM-DD"),
                "date_end": serializers.DateField(help_text="YYYY-MM-DD"),
                "days_of_week": serializers.ListField(child=serializers.CharField(), help_text='เช่น ["Mon", "Tue"]'),
                "time_start": serializers.TimeField(format="%H:%M", help_text="HH:MM เช่น 10:00"),
                "time_end": serializers.TimeField(format="%H:%M", help_text="HH:MM เช่น 12:00"),
                "purpose_type": serializers.ChoiceField(choices=["teaching", "training"]),
                "skip_conflicts": serializers.BooleanField(default=False, help_text="True = ข้ามวันที่มีปัญหา, False = ยกเลิกทั้งหมดถ้าเจอชน"),
                "teaching_info": serializers.DictField(required=False, help_text='ส่งเมื่อ purpose_type="teaching"'),
                "training_info": serializers.DictField(required=False, help_text='ส่งเมื่อ purpose_type="training"'),
            }
        ),
        responses={201: OpenApiTypes.OBJECT}
    ),
    my_bookings=extend_schema(
        summary="3. ดูประวัติการจองของฉัน",
        description="ดึงรายการจองทั้งหมดของตัวเอง สามารถ filter ด้วย ?status=Pending ได้",
        parameters=[OpenApiParameter(name="status", description="กรองตามสถานะ เช่น Pending, Approved", required=False, type=str)]
    ),
    retrieve=extend_schema(
        summary="4. ดูรายละเอียดการจอง (ระบุ ID)",
        description="ดูข้อมูลการจองเฉพาะ ID นั้นๆ (ต้องเป็นเจ้าของ หรือ Admin)"
    ),
    cancel=extend_schema(
        summary="5. ยกเลิกการจอง (1 รายการ)",
        description="ยกเลิกการจองที่เวลายังไม่เริ่มต้น",
        request=None,
    ),
    cancel_recurring=extend_schema(
        summary="6. ยกเลิกการจองแบบกลุ่ม (Recurring)",
        description="ยกเลิกการจองทั้งหมดใน group_id นั้น ที่ยังไม่ถึงเวลาเริ่ม",
        request=None,
    )
)