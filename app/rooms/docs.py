from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter

room_list_schema = extend_schema_view(
    get=extend_schema(
        summary="ดึงรายชื่อห้องทั้งหมด",
        description="แสดงรายการห้อง สามารถกรองเฉพาะห้องที่เปิดใช้งานด้วย ?is_active=true",
        parameters=[
            OpenApiParameter(name="is_active", description="true หรือ false", required=False, type=str)
        ]
    )
)

room_schedule_schema = extend_schema_view(
    get=extend_schema(
        summary="ดึงตารางการใช้ห้อง (รายสัปดาห์)",
        description="ดูตารางจองของห้อง ระบุวันเริ่มต้นสัปดาห์ (ต้องเป็นวันอาทิตย์) เช่น ?week_start=2026-05-03",
        parameters=[
            OpenApiParameter(name="week_start", description="YYYY-MM-DD (ต้องเป็นวันอาทิตย์)", required=True, type=str)
        ]
    )
)

room_blackout_schema = extend_schema_view(
    get=extend_schema(
        summary="ดึงรายการ Blackout ของห้อง",
        description="ดูช่วงเวลาปิดปรับปรุง/วันหยุดของห้องนั้น สามารถระบุช่วงวันที่ ?from=...&to=...",
        parameters=[
            OpenApiParameter(name="from", description="YYYY-MM-DD", required=False, type=str),
            OpenApiParameter(name="to", description="YYYY-MM-DD", required=False, type=str)
        ]
    )
)