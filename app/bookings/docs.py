from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter, inline_serializer
from rest_framework import serializers

# We use explicit classes for complex nested responses to avoid "inline_serializer" 
# instantiation issues with ListField and improve reliability.

class ConflictDetailSerializer(serializers.Serializer):
    conflict_type = serializers.CharField(help_text="booking หรือ blackout")
    date = serializers.CharField(help_text="YYYY-MM-DD")
    start_time = serializers.CharField(required=False)
    end_time = serializers.CharField(required=False)
    booker_name = serializers.CharField(required=False)
    status = serializers.CharField(required=False)
    reason = serializers.CharField(required=False, help_text="เหตุผล Blackout")

class ConflictSummarySerializer(serializers.Serializer):
    total_dates = serializers.IntegerField()
    available_count = serializers.IntegerField()
    conflict_count = serializers.IntegerField()
    blackout_count = serializers.IntegerField()

class ConflictReportSerializer(serializers.Serializer):
    has_conflict = serializers.BooleanField()
    summary = ConflictSummarySerializer()
    available_dates = serializers.ListField(child=serializers.CharField())
    conflicts = ConflictDetailSerializer(many=True)
    blackouts = ConflictDetailSerializer(many=True)

class MyBookingResponseSerializer(serializers.Serializer):
    booking_id = serializers.IntegerField()
    room_code = serializers.CharField()
    room_name = serializers.CharField()
    start_datetime = serializers.DateTimeField()
    end_datetime = serializers.DateTimeField()
    status = serializers.CharField()
    purpose_type = serializers.CharField()
    recurring_group_id = serializers.IntegerField(allow_null=True)
    subject = serializers.CharField()
    reject_reason = serializers.CharField(allow_null=True)
    can_cancel = serializers.BooleanField()
    created_at = serializers.DateTimeField()

class BookingDetailResponseSerializer(serializers.Serializer):
    booking_id = serializers.IntegerField()
    room = inline_serializer(
        name="BookingRoomDetail",
        fields={
            "room_id": serializers.IntegerField(),
            "room_code": serializers.CharField(),
            "room_name": serializers.CharField(),
            "capacity": serializers.IntegerField(),
        }
    )
    booker = inline_serializer(
        name="BookingBookerDetail",
        fields={
            "user_id": serializers.IntegerField(),
            "displayname_th": serializers.CharField(),
        }
    )
    start_datetime = serializers.DateTimeField()
    end_datetime = serializers.DateTimeField()
    status = serializers.CharField()
    purpose_type = serializers.CharField()
    teaching_info = serializers.DictField(allow_null=True)
    training_info = serializers.DictField(allow_null=True)
    recurring_group_id = serializers.IntegerField(allow_null=True)
    reject_reason = serializers.CharField(allow_null=True)
    can_cancel = serializers.BooleanField()
    created_at = serializers.DateTimeField()

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
        responses={200: ConflictReportSerializer}
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
                "teaching_info": inline_serializer(
                    name="TeachingInfoInput",
                    fields={
                        "subject_code": serializers.CharField(),
                        "subject_name": serializers.CharField(),
                        "program_type": serializers.CharField(),
                    },
                    required=False
                ),
                "training_info": inline_serializer(
                    name="TrainingInfoInput",
                    fields={
                        "topic": serializers.CharField(),
                    },
                    required=False
                ),
            }
        ),
        responses={
            201: inline_serializer(
                name="BookingCreateResponse",
                fields={
                    "booking_ids": serializers.ListField(child=serializers.IntegerField()),
                    "skipped_dates": serializers.ListField(child=serializers.CharField()),
                    "recurring_group_id": serializers.IntegerField(),
                    "total_created": serializers.IntegerField(),
                    "total_skipped": serializers.IntegerField(),
                    "status": serializers.CharField(),
                    "message": serializers.CharField(),
                }
            ),
            409: inline_serializer(
                name="BookingConflictError",
                fields={
                    "error": serializers.CharField(),
                    "report": ConflictReportSerializer() # Pass instance here as it's a response
                }
            )
        }
    ),
    my_bookings=extend_schema(
        summary="3. ดูประวัติการจองของฉัน",
        description="ดึงรายการจองทั้งหมดของตัวเอง สามารถ filter ด้วย ?status=Pending ได้",
        parameters=[OpenApiParameter(name="status", description="กรองตามสถานะ เช่น Pending, Approved", required=False, type=str)],
        responses={200: MyBookingResponseSerializer(many=True)}
    ),
    retrieve=extend_schema(
        summary="4. ดูรายละเอียดการจอง (ระบุ ID)",
        description="ดูข้อมูลการจองเฉพาะ ID นั้นๆ (ต้องเป็นเจ้าของ หรือ Admin)",
        responses={200: BookingDetailResponseSerializer}
    ),
    cancel=extend_schema(
        summary="5. ยกเลิกการจอง (1 รายการ)",
        description="ยกเลิกการจองที่เวลายังไม่เริ่มต้น",
        request=None,
        responses={
            200: inline_serializer(
                name="BookingCancelResponse",
                fields={
                    "booking_id": serializers.IntegerField(),
                    "previous_status": serializers.CharField(),
                    "status": serializers.CharField(),
                    "notify_admin": serializers.BooleanField(),
                    "message": serializers.CharField(),
                }
            )
        }
    ),
    cancel_recurring=extend_schema(
        summary="6. ยกเลิกการจองแบบกลุ่ม (Recurring)",
        description="ยกเลิกการจองทั้งหมดใน group_id นั้น ที่ยังไม่ถึงเวลาเริ่ม",
        request=None,
        responses={
            200: inline_serializer(
                name="RecurringCancelResponse",
                fields={
                    "group_id": serializers.IntegerField(),
                    "cancelled_count": serializers.IntegerField(),
                    "skipped_count": serializers.IntegerField(),
                    "skipped_reason": serializers.CharField(),
                    "had_approved": serializers.BooleanField(),
                    "notify_admin": serializers.BooleanField(),
                    "message": serializers.CharField(),
                }
            )
        }
    )
)
