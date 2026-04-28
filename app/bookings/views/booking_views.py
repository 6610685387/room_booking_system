from datetime import date, datetime, time
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone
from django.utils.timezone import localtime
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.core.exceptions import ValidationError

from rooms.models import Room
from bookings.models import Booking, RecurringGroup
from bookings.serializers import BookingWriteSerializer
from bookings.services.conflict_check_service import build_conflict_report
from bookings.services.recurring import generate_recurring_slots
from bookings.validators import validate_date_range, validate_days_of_week
from bookings.permissions import IsOwnerOrAdmin, IsOwner

from bookings.docs import booking_viewset_schema

@booking_viewset_schema
class BookingViewSet(viewsets.ViewSet):
    def get_permissions(self):
        # ตรวจสอบความเป็นเจ้าของหรือ Admin สำหรับการดูรายละเอียด
        if self.action == 'retrieve':
            return [IsAuthenticated(), IsOwnerOrAdmin()]
        
        # ตรวจสอบความเป็นเจ้าของเท่านั้นสำหรับการยกเลิก (SYS-20)
        if self.action == 'cancel':
            return [IsAuthenticated(), IsOwner()]
        
        # Action ทั่วไป (list, create, check_conflict, my_bookings, cancel_recurring) ใช้เพียงการ Login
        # Note: cancel_recurring มีการกรอง booker=request.user ในตัวอยู่แล้ว
        return [IsAuthenticated()]

    @action(detail=False, methods=["post"], url_path="check-conflict")
    def check_conflict(self, request):
        """
        POST /api/bookings/check-conflict/
        """
        room_id = request.data.get("room_id")
        date_start = request.data.get("date_start")
        date_end = request.data.get("date_end")
        days_of_week = request.data.get("days_of_week")
        time_start = request.data.get("time_start")
        time_end = request.data.get("time_end")

        if not all([room_id, date_start, date_end, days_of_week, time_start, time_end]):
            return Response({"error": "Bad Request: Missing required fields"}, status=400)

        try:
            d_start = date.fromisoformat(date_start)
            d_end = date.fromisoformat(date_end)
            validate_date_range(d_start, d_end)
            validate_days_of_week(days_of_week)
            get_object_or_404(Room, pk=room_id)
        except (ValueError, ValidationError) as e:
            msg = str(e.message) if hasattr(e, 'message') else str(e)
            return Response({"error": msg}, status=400)

        report = build_conflict_report(
            room_id, d_start, d_end, days_of_week, time_start, time_end
        )
        return Response(report, status=200)

    def create(self, request):
        """
        POST /api/bookings/
        """
        payload = request.data
        room_id = payload.get("room_id")
        date_start = payload.get("date_start")
        date_end = payload.get("date_end")
        days_of_week = payload.get("days_of_week")
        time_start = payload.get("time_start")
        time_end = payload.get("time_end")
        purpose_type = payload.get("purpose_type")
        skip_conflicts = payload.get("skip_conflicts", False)

        if not all([room_id, date_start, date_end, days_of_week, time_start, time_end, purpose_type]):
            return Response({"error": "Bad Request: Missing required fields"}, status=400)

        try:
            d_start = date.fromisoformat(date_start)
            d_end = date.fromisoformat(date_end)
            validate_date_range(d_start, d_end)
            validate_days_of_week(days_of_week)
            # t_start_obj and t_end_obj are needed for generate_recurring_slots later
            datetime.strptime(time_start, "%H:%M").time()
            datetime.strptime(time_end, "%H:%M").time()
        except (ValueError, ValidationError) as e:
            msg = str(e.message) if hasattr(e, 'message') else str(e)
            return Response({"error": msg}, status=400)

        with transaction.atomic():
            # Lock the room to prevent race conditions
            room = get_object_or_404(Room.objects.select_for_update(), pk=room_id)
            
            # Check for conflicts inside the lock
            report = build_conflict_report(
                room_id, d_start, d_end, days_of_week, time_start, time_end
            )

            if report["has_conflict"] and not skip_conflicts:
                return Response({
                    "error": "มี conflict ในช่วงเวลาที่เลือก และ skip_conflicts=False",
                    "report": report
                }, status=409)

            if report["summary"]["available_count"] == 0:
                return Response({"error": "ไม่มีวันว่างให้จองเลย"}, status=400)

            t_start_obj = datetime.strptime(time_start, "%H:%M").time()
            t_end_obj = datetime.strptime(time_end, "%H:%M").time()

            group = RecurringGroup.objects.create(
                booker=request.user,
                room=room,
                day_pattern=",".join(days_of_week),
                date_start=d_start,
                date_end=d_end,
                time_start=t_start_obj,
                time_end=t_end_obj
            )

            booking_ids = []
            all_slots = generate_recurring_slots(d_start, d_end, days_of_week, time_start, time_end)

            for (s_dt, e_dt) in all_slots:
                slot_date_str = localtime(s_dt).strftime("%Y-%m-%d")
                if slot_date_str not in report["available_dates"]:
                    continue

                slot_data = request.data.copy()
                slot_data['room'] = room_id
                slot_data['start_datetime'] = s_dt
                slot_data['end_datetime'] = e_dt
                slot_data['recurring_group'] = group.group_id
                
                serializer = BookingWriteSerializer(data=slot_data)
                serializer.is_valid(raise_exception=True)
                serializer.save(booker=request.user, status="Pending")
                booking_ids.append(serializer.instance.booking_id)

        total_skipped = report["summary"]["conflict_count"] + report["summary"]["blackout_count"]
        skipped_dates = [c["date"] for c in report.get("conflicts", [])] + [b["date"] for b in report.get("blackouts", [])]
        
        return Response({
            "booking_ids": booking_ids,
            "skipped_dates": sorted(skipped_dates),
            "recurring_group_id": group.group_id,
            "total_created": len(booking_ids),
            "total_skipped": total_skipped,
            "status": "Pending",
            "message": f"จองสำเร็จ {len(booking_ids)} รายการ (ข้าม {total_skipped} วันที่มีปัญหา)"
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="my")
    def my_bookings(self, request):
        """
        GET /api/bookings/my/
        """
        qs = Booking.objects.filter(booker=request.user).select_related("room", "teaching_info", "training_info").order_by("-start_datetime")

        status_param = request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)

        results = []
        now_bkk = localtime(timezone.now())

        for bk in qs:
            local_start = localtime(bk.start_datetime)
            can_cancel = (bk.status in ["Pending", "Approved"]) and (local_start > now_bkk)

            subject = ""
            if bk.purpose_type == "teaching" and hasattr(bk, "teaching_info"):
                subject = f"{bk.teaching_info.subject_code} {bk.teaching_info.subject_name}"
            elif bk.purpose_type == "training" and hasattr(bk, "training_info"):
                subject = bk.training_info.topic

            results.append({
                "booking_id": bk.booking_id,
                "room_code": bk.room.room_code,
                "room_name": bk.room.room_name,
                "start_datetime": local_start.isoformat(),
                "end_datetime": localtime(bk.end_datetime).isoformat(),
                "status": bk.status,
                "purpose_type": bk.purpose_type,
                "recurring_group_id": bk.recurring_group_id,
                "subject": subject,
                "reject_reason": bk.reject_reason,
                "can_cancel": can_cancel,
                "created_at": localtime(bk.created_at).isoformat()
            })

        return Response(results, status=200)

    def retrieve(self, request, pk=None):
        """
        GET /api/bookings/{id}/
        """
        bk = get_object_or_404(Booking.objects.select_related("room", "booker", "teaching_info", "training_info"), pk=pk)
        self.check_object_permissions(request, bk)

        now_bkk = localtime(timezone.now())
        local_start = localtime(bk.start_datetime)
        can_cancel = (bk.status in ["Pending", "Approved"]) and (local_start > now_bkk)

        data = {
            "booking_id": bk.booking_id,
            "room": {
                "room_id": bk.room.room_id,
                "room_code": bk.room.room_code,
                "room_name": bk.room.room_name,
                "capacity": bk.room.capacity
            },
            "booker": {
                "user_id": bk.booker.user_id,
                "displayname_th": bk.booker.displayname_th
            },
            "start_datetime": local_start.isoformat(),
            "end_datetime": localtime(bk.end_datetime).isoformat(),
            "status": bk.status,
            "purpose_type": bk.purpose_type,
            "teaching_info": None,
            "training_info": None,
            "recurring_group_id": bk.recurring_group_id,
            "reject_reason": bk.reject_reason,
            "can_cancel": can_cancel,
            "created_at": localtime(bk.created_at).isoformat()
        }

        if bk.purpose_type == "teaching" and hasattr(bk, "teaching_info"):
            data["teaching_info"] = {
                "subject_code": bk.teaching_info.subject_code,
                "subject_name": bk.teaching_info.subject_name,
                "program_type": bk.teaching_info.program_type
            }
        elif bk.purpose_type == "training" and hasattr(bk, "training_info"):
            data["training_info"] = {"topic": bk.training_info.topic}

        return Response(data, status=200)

    @action(detail=True, methods=["patch"])
    def cancel(self, request, pk=None):
        """
        PATCH /api/bookings/{id}/cancel/
        """
        # Note for Role 4: Saving this booking will trigger a post_save signal.
        # Please catch status == "Cancelled" to send an email notification.

        with transaction.atomic():
            bk = get_object_or_404(Booking.objects.select_for_update(), pk=pk)
            self.check_object_permissions(request, bk)

            now_bkk = localtime(timezone.now())
            local_start = localtime(bk.start_datetime)

            if local_start <= now_bkk:
                return Response({"error": "เลยเวลาเริ่มต้นไปแล้ว ไม่สามารถยกเลิกได้"}, status=400)
            if bk.status not in ["Pending", "Approved"]:
                return Response({"error": f"สถานะปัจจุบันคือ {bk.status} ไม่สามารถยกเลิกได้"}, status=400)

            previous_status = bk.status
            bk.status = "Cancelled"
            bk.save()

        return Response({
            "booking_id": bk.booking_id,
            "previous_status": previous_status,
            "status": "Cancelled",
            "notify_admin": (previous_status == "Approved"),
            "message": "ยกเลิกการจองเรียบร้อยแล้ว"
        }, status=200)

    @action(detail=False, methods=["patch"], url_path=r"recurring/(?P<group_id>\d+)/cancel")
    def cancel_recurring(self, request, group_id=None):
        """
        PATCH /api/bookings/recurring/{group_id}/cancel/
        """
        # Note for Role 4: Saving this booking will trigger a post_save signal.
        # Please catch status == "Cancelled" to send an email notification.
        
        now_bkk = localtime(timezone.now())
        cancelled_count = 0
        skipped_count = 0
        had_approved = False

        with transaction.atomic():
            # Apply select_for_update to lock the bookings being cancelled
            # การจองกลุ่มนี้ต้องเป็นของผู้ใช้ (SYS-20)
            bookings = Booking.objects.select_for_update().filter(
                recurring_group_id=group_id,
                booker=request.user
            )

            if not bookings.exists():
                return Response({"error": "ไม่พบข้อมูล หรือคุณไม่มีสิทธิ์ยกเลิก"}, status=404)

            for bk in bookings:
                local_start = localtime(bk.start_datetime)
                if bk.status in ["Pending", "Approved"] and local_start > now_bkk:
                    if bk.status == "Approved":
                        had_approved = True
                    bk.status = "Cancelled"
                    bk.save()
                    cancelled_count += 1
                else:
                    skipped_count += 1

        return Response({
            "group_id": int(group_id),
            "cancelled_count": cancelled_count,
            "skipped_count": skipped_count,
            "skipped_reason": "start_datetime ผ่านไปแล้ว หรือสถานะถูกเปลี่ยนไปแล้ว",
            "had_approved": had_approved,
            "notify_admin": had_approved,
            "message": f"ยกเลิก {cancelled_count} รายการ (ข้าม {skipped_count} รายการที่ยกเลิกไม่ได้)"
        }, status=200)
