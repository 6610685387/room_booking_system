from django.shortcuts import render, get_object_or_404
from django.utils.timezone import localtime
from django.utils import timezone
from django.db import transaction
from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from drf_spectacular.utils import extend_schema
from rooms.models import Room, BlackoutPeriod
from rooms.serializers import RoomSerializer, BlackoutPeriodSerializer, BlackoutPeriodReadSerializer
from bookings.models import Booking
from bookings.services.admin_booking_service import bulk_approve_bookings, bulk_reject_bookings

# --- Blackout ---
@extend_schema(tags=["blackout"], summary="ดึงข้อมูล Blackout ที่ยังไม่หมดเวลาทั้งหมด")
class BlackoutPeriodUpcomingListView(generics.ListAPIView):
    serializer_class = BlackoutPeriodReadSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        now = timezone.now()
        return BlackoutPeriod.objects.filter(
            end_datetime__gt=now
        ).order_by('start_datetime')


@extend_schema(tags=["blackout"], summary="ดึงข้อมูล Blackout ที่ยังไม่หมดเวลา (ระบุห้อง)")
class RoomBlackoutPeriodUpcomingListView(generics.ListAPIView):
    serializer_class = BlackoutPeriodReadSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        room_id = self.kwargs.get('room_id')
        now = timezone.now()
        return BlackoutPeriod.objects.filter(
            room_id=room_id,
            end_datetime__gt=now
        ).order_by('start_datetime')

@extend_schema(tags=["blackout"])
class BlackoutPeriodCreateView(generics.CreateAPIView):
    queryset = BlackoutPeriod.objects.all()
    serializer_class = BlackoutPeriodSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        blackout = serializer.save(created_by=self.request.user)
        
        now = timezone.now()
        if blackout.start_datetime <= now <= blackout.end_datetime:
            room = blackout.room
            room.is_active = False
            room.save(update_fields=['is_active'])

@extend_schema(tags=["blackout"])
class BlackoutPeriodDeleteView(generics.DestroyAPIView):
    queryset = BlackoutPeriod.objects.all()
    serializer_class = BlackoutPeriodSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'blackout_id'

    def perform_destroy(self, instance):
        room = instance.room
        
        instance.delete()
        
        now = timezone.now()
        has_active_blackout = room.blackout_periods.filter(
            start_datetime__lte=now,
            end_datetime__gte=now
        ).exists()
        
        if not has_active_blackout and not room.is_active:
            room.is_active = True
            room.save(update_fields=['is_active'])

# --- Room CRUD ---
@extend_schema(
    request={"multipart/form-data": RoomSerializer}, 
    responses=RoomSerializer
)
@api_view(["GET", "POST"])
@permission_classes([IsAdminUser])
@parser_classes([MultiPartParser, FormParser])
def room_list_create_api(request):
    if request.method == "GET":
        rooms = Room.objects.all()
        now = timezone.now()
        
        for room in rooms:
            is_blackout = BlackoutPeriod.objects.filter(
                room=room,
                start_datetime__lte=now,
                end_datetime__gte=now
            ).exists()
            
            expected_active = not is_blackout
            if room.is_active != expected_active:
                room.is_active = expected_active
                room.save(update_fields=['is_active'])

        serializer = RoomSerializer(rooms, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    elif request.method == "POST":
        room_code = request.data.get("room_code")
        room_name = request.data.get("room_name")
        room_type = request.data.get("room_type")
        capacity = request.data.get("capacity")
        is_active_str = request.data.get("is_active", "True")
        room_image = request.FILES.get("room_image")

        if not all([room_code, room_name, room_type, capacity]):
            return Response({"error": "ข้อมูลไม่ครบถ้วน"}, status=status.HTTP_400_BAD_REQUEST)
        
        if Room.objects.filter(room_code=room_code).exists():
            return Response({"error": "room_code นี้มีในระบบแล้ว"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            capacity_int = int(capacity)
            if capacity_int <= 0:
                return Response({"error": "capacity ต้องมากกว่า 0"}, status=status.HTTP_400_BAD_REQUEST)
        except ValueError:
            return Response({"error": "capacity ต้องเป็นตัวเลข"}, status=status.HTTP_400_BAD_REQUEST)

        is_active = str(is_active_str).lower() in ['true', '1', 't', 'y', 'yes']

        room = Room.objects.create(
            room_code=room_code,
            room_name=room_name,
            room_type=room_type,
            capacity=capacity_int,
            is_active=is_active,
            room_image=room_image,
            updated_by=request.user
        )

        return Response(RoomSerializer(room).data, status=status.HTTP_201_CREATED)


@extend_schema(methods=["PATCH"], request={"multipart/form-data": RoomSerializer}, responses={200: RoomSerializer})
@extend_schema(methods=["GET", "DELETE"], request=None) 
@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAdminUser])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def room_detail_api(request, room_id):
    room = get_object_or_404(Room, pk=room_id)

    if request.method == "GET":
        now = timezone.now()
        is_blackout = BlackoutPeriod.objects.filter(
            room=room,
            start_datetime__lte=now,
            end_datetime__gte=now
        ).exists()

        expected_active = not is_blackout
        if room.is_active != expected_active:
            room.is_active = expected_active
            room.save(update_fields=['is_active'])

        return Response(RoomSerializer(room).data, status=status.HTTP_200_OK)

    elif request.method == "PATCH":
        room_code = request.data.get("room_code")
        capacity = request.data.get("capacity")

        if room_code and room_code != room.room_code:
            if Room.objects.filter(room_code=room_code).exists():
                return Response({"error": "room_code นี้มีในระบบแล้ว"}, status=status.HTTP_400_BAD_REQUEST)
            room.room_code = room_code

        if capacity is not None:
            try:
                capacity_int = int(capacity)
                if capacity_int <= 0:
                    return Response({"error": "capacity ต้องมากกว่า 0"}, status=status.HTTP_400_BAD_REQUEST)
                room.capacity = capacity_int
            except ValueError:
                return Response({"error": "capacity ต้องเป็นตัวเลข"}, status=status.HTTP_400_BAD_REQUEST)

        if "room_name" in request.data:
            room.room_name = request.data.get("room_name")
        if "room_type" in request.data:
            room.room_type = request.data.get("room_type")
        if "is_active" in request.data:
            is_active_str = request.data.get("is_active")
            room.is_active = str(is_active_str).lower() in ['true', '1', 't', 'y', 'yes']
        if "room_image" in request.FILES:
            room.room_image = request.FILES.get("room_image")

        room.updated_by = request.user
        room.save()

        return Response(RoomSerializer(room).data, status=status.HTTP_200_OK)

    elif request.method == "DELETE":
        room.delete()
        return Response(status=status.HTTP_204_NO_CONTENT) #Delete success


# ------- Booking -------

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_booking_list(request):
    qs = (
        Booking.objects.select_related("room", "booker", "teaching_info", "training_info")
        .order_by("-created_at")
    )
    status_param = request.query_params.get("status")
    if status_param:
        qs = qs.filter(status=status_param)

    results = []
    for bk in qs:
        subject = ""
        if bk.purpose_type == "teaching" and hasattr(bk, "teaching_info"):
            subject = f"{bk.teaching_info.subject_code} {bk.teaching_info.subject_name}"
        elif bk.purpose_type == "training" and hasattr(bk, "training_info"):
            subject = bk.training_info.topic

        results.append({
            "booking_id": bk.booking_id,
            "room": {
                "room_id": bk.room.room_id,
                "room_code": bk.room.room_code,
                "room_name": bk.room.room_name,
                "capacity": bk.room.capacity,
            },
            "booker": {
                "user_id": bk.booker.user_id,
                "displayname_th": bk.booker.displayname_th,
            },
            "start_datetime": localtime(bk.start_datetime).isoformat(),
            "end_datetime": localtime(bk.end_datetime).isoformat(),
            "status": bk.status,
            "purpose_type": bk.purpose_type,
            "subject": subject,
            "additional_requests": bk.additional_requests,
            "admin_notes": bk.admin_notes,
            "reject_reason": bk.reject_reason,
            "recurring_group_id": bk.recurring_group_id,
            "created_at": localtime(bk.created_at).isoformat(),
        })
    return Response(results, status=200)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def admin_booking_approve(request, booking_id):
    bk = get_object_or_404(Booking, pk=booking_id)
    if bk.status != "Pending":
        return Response({"error": f"สถานะปัจจุบันคือ {bk.status} ไม่สามารถอนุมัติได้"}, status=400)
    bk.status = "Approved"
    bk.admin_notes = request.data.get("admin_notes", "")
    bk.approved_by = request.user
    bk.save()
    return Response({"booking_id": bk.booking_id, "status": "Approved", "message": "อนุมัติเรียบร้อยแล้ว"}, status=200)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def admin_booking_reject(request, booking_id):
    bk = get_object_or_404(Booking, pk=booking_id)
    if bk.status != "Pending":
        return Response({"error": f"สถานะปัจจุบันคือ {bk.status} ไม่สามารถปฏิเสธได้"}, status=400)
    reject_reason = request.data.get("reject_reason", "").strip()
    if not reject_reason:
        return Response({"error": "กรุณาระบุเหตุผล"}, status=400)
    bk.status = "Rejected"
    bk.reject_reason = reject_reason
    bk.save()
    return Response({"booking_id": bk.booking_id, "status": "Rejected", "message": "ปฏิเสธเรียบร้อยแล้ว"}, status=200)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def admin_booking_approve_recurring(request, group_id):
    admin_notes = request.data.get("admin_notes", "")
    approved_count = bulk_approve_bookings(group_id, admin_notes, request.user)

    if approved_count == 0:
        return Response({"error": "ไม่พบการจองที่รออนุมัติในกลุ่มนี้"}, status=404)

    return Response(
        {
            "group_id": group_id,
            "approved_count": approved_count,
            "message": f"อนุมัติ {approved_count} รายการเรียบร้อยแล้ว",
        },
        status=200,
    )


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def admin_booking_reject_recurring(request, group_id):
    reject_reason = request.data.get("reject_reason", "").strip()
    if not reject_reason:
        return Response({"error": "กรุณาระบุเหตุผล"}, status=400)

    rejected_count = bulk_reject_bookings(group_id, reject_reason)

    if rejected_count == 0:
        return Response({"error": "ไม่พบการจองที่รออนุมัติในกลุ่มนี้"}, status=404)

    return Response(
        {
            "group_id": group_id,
            "rejected_count": rejected_count,
            "message": f"ปฏิเสธ {rejected_count} รายการเรียบร้อยแล้ว",
        },
        status=200,
    )
