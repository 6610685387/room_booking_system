from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo
from django.shortcuts import get_object_or_404
from django.utils.timezone import localtime, make_aware
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from bookings.models import Booking
from .models import BlackoutPeriod, Room
from .serializers import BlackoutPeriodReadSerializer, RoomSerializer
from .docs import room_list_schema, room_schedule_schema, room_blackout_schema

# Create your views here.
BKK_TZ = ZoneInfo("Asia/Bangkok")


@room_list_schema
class RoomListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request) -> Response:
        """
        GET /api/rooms/
        List all rooms with optional filters: is_active, min_capacity, room_type.
        """
        qs = Room.objects.all().order_by("room_code")
        
        # กรอง is_active
        is_active_param = request.query_params.get("is_active", None)
        if is_active_param == "true":
            qs = qs.filter(is_active=True)
        elif is_active_param == "false":
            qs = qs.filter(is_active=False)

        # [NEW] กรองความจุขั้นต่ำ
        min_capacity_param = request.query_params.get("min_capacity", None)
        if min_capacity_param is not None:
            try:
                qs = qs.filter(capacity__gte=int(min_capacity_param))
            except ValueError:
                return Response({"error": "min_capacity ต้องเป็นตัวเลข"}, status=400)

        # [NEW] กรองประเภทห้อง
        room_type_param = request.query_params.get("room_type", None)
        if room_type_param is not None:
            qs = qs.filter(room_type=room_type_param)
            
        serializer = RoomSerializer(qs, many=True)
        return Response(serializer.data, status=200)


@room_schedule_schema
class RoomScheduleView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, room_id: int) -> Response:
        """
        GET /api/rooms/{room_id}/schedule/
        Get room schedule for a specific week starting on Monday.
        """
        DAY_ABBR = {0:"Mon", 1:"Tue", 2:"Wed", 3:"Thu", 4:"Fri", 5:"Sat", 6:"Sun"}

        # Step 1: Validate room exists
        room = get_object_or_404(Room, pk=room_id)

        # Step 2: Validate week_start
        week_start_str = request.query_params.get("week_start", None)
        if week_start_str is None:
            return Response(
                {"error": "week_start parameter is required (format: YYYY-MM-DD)"},
                status=400
            )
        
        try:
            week_start_date = date.fromisoformat(week_start_str)
        except ValueError:
            return Response(
                {"error": "week_start format must be YYYY-MM-DD"},
                status=400
            )
        
        if week_start_date.weekday() != 6:    # 6 = Sunday (SYS-10)
            return Response(
                {"error": "week_start must be a Sunday"},
                status=400
            )

        # Step 3: Define week boundary
        next_week_start_date = week_start_date + timedelta(days=7)
        week_start_dt = make_aware(datetime.combine(week_start_date, time(0, 0, 0)), BKK_TZ)
        next_week_start_dt = make_aware(datetime.combine(next_week_start_date, time(0, 0, 0)), BKK_TZ)

        # Step 4: Fetch bookings in this week
        bookings = Booking.objects.filter(
            room_id             = room_id,
            status__in          = ["Pending", "Approved"],    # SYS-12
            start_datetime__gte = week_start_dt,
            start_datetime__lt  = next_week_start_dt,
        ).select_related("teaching_info", "training_info").order_by("start_datetime")

        # Step 5: Build slots list
        slots = []
        for booking in bookings:
            local_start = localtime(booking.start_datetime, BKK_TZ)
            local_end   = localtime(booking.end_datetime,   BKK_TZ)
            
            # Build label (SYS-13)
            label = ""
            if booking.purpose_type == "teaching":
                ti = getattr(booking, "teaching_info", None)
                if ti:
                    label = f"{ti.subject_code} {ti.subject_name}"
            elif booking.purpose_type == "training":
                tr = getattr(booking, "training_info", None)
                if tr:
                    label = tr.topic

            slots.append({
                "booking_id":   booking.booking_id,
                "day":          DAY_ABBR[local_start.weekday()],   # SYS-14
                "start_time":   local_start.strftime("%H:%M"),
                "end_time":     local_end.strftime("%H:%M"),
                "status":       booking.status,
                "purpose_type": booking.purpose_type,
                "label":        label,
            })

        # Step 6: Build blackout_days for this week (SYS-15)
        blackout_periods = BlackoutPeriod.objects.filter(
            room_id           = room_id,
            start_datetime__lt = next_week_start_dt,    # เริ่มก่อนจบสัปดาห์นี้
            end_datetime__gte  = week_start_dt,         # จบหลังเริ่มสัปดาห์นี้
        )
        blackout_set = set()
        for bp in blackout_periods:
            # ใช้ localtime เพื่อให้ .date() ตรงกับเวลาไทย (SYS-15.1)
            bp_start_date = localtime(bp.start_datetime, BKK_TZ).date()
            bp_end_date   = localtime(bp.end_datetime,   BKK_TZ).date()
            for day_offset in range(7):   # 0=จันทร์ ... 6=อาทิตย์
                check_date = week_start_date + timedelta(days=day_offset)
                if bp_start_date <= check_date <= bp_end_date:
                    blackout_set.add(check_date.isoformat())
        
        blackout_days = sorted(list(blackout_set))

        # Step 7: Return response
        return Response({
            "room_id":       room.room_id,
            "room_code":     room.room_code,
            "week_start":    week_start_str,
            "blackout_days": blackout_days,
            "slots":         slots,
        }, status=200)

@room_blackout_schema
class RoomBlackoutView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, room_id: int) -> Response:
        """
        GET /api/rooms/{room_id}/blackouts/
        List blackout periods for a specific room with optional date filtering.
        """
        # Step 1: Validate room exists
        room = get_object_or_404(Room, pk=room_id)

        # Step 2: Base queryset
        qs = BlackoutPeriod.objects.filter(room_id=room_id).order_by("start_datetime")

        # Step 3: Apply optional date range filters
        from_str = request.query_params.get("from", None)
        to_str   = request.query_params.get("to",   None)

        if from_str is not None:
            try:
                from_date = date.fromisoformat(from_str)
                from_dt = make_aware(datetime.combine(from_date, time(0, 0, 0)), BKK_TZ)
            except ValueError:
                return Response({"error": "from format must be YYYY-MM-DD"}, status=400)
            qs = qs.filter(end_datetime__gte=from_dt)    # blackout จบหลังเริ่มจากวันที่กำหนด

        if to_str is not None:
            try:
                to_date = date.fromisoformat(to_str)
                next_day_dt = make_aware(datetime.combine(to_date + timedelta(days=1), time(0, 0, 0)), BKK_TZ)
            except ValueError:
                return Response({"error": "to format must be YYYY-MM-DD"}, status=400)
            qs = qs.filter(start_datetime__lt=next_day_dt)    # blackout เริ่มก่อนจบวันที่กำหนด

        # Step 4: Serialize and return
        serializer = BlackoutPeriodReadSerializer(qs, many=True)
        return Response(serializer.data, status=200)
