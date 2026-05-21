from django.shortcuts import render, get_object_or_404
from django.utils.timezone import localtime
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rooms.models import Room
from rooms.serializers import RoomBriefSerializer
from bookings.models import Booking


def dashboard(request):
    return render(request, "admindash/dashboard.html")


def blackout_room(request):
    return Response(status=204)


class AdminCRUDViewSet(viewsets.ModelViewSet):
    queryset = Room.objects.all()
    serializer_class = RoomBriefSerializer


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
