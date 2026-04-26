from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from django.db.models import Q
from django.db import transaction
from django.core.exceptions import ValidationError
from bookings.models import Booking
from rooms.models import Room
from bookings.serializers import BookingWriteSerializer
from datetime import datetime, date


# ---------- LECTURER ----------


@login_required
def lecturer_dashboard(request):
    if request.user.role != "Lecturer":
        return redirect("/admin-dashboard/")

    qs = (
        Booking.objects.filter(booker=request.user)
        .select_related("room", "teaching_info", "training_info")
        .order_by("-created_at")[:10]
    )

    context = {
        "bookings": qs,
        "stat_pending": Booking.objects.filter(
            booker=request.user, status="Pending"
        ).count(),
        "stat_approved": Booking.objects.filter(
            booker=request.user, status="Approved"
        ).count(),
        "stat_rejected": Booking.objects.filter(
            booker=request.user, status__in=["Rejected", "Cancelled"]
        ).count(),
    }
    return render(request, "bookings/lecturer_dashboard.html", context)


@login_required
def new_booking(request):
    if request.user.role != "Lecturer":
        return redirect("/admin-dashboard/")

    rooms = Room.objects.filter(is_active=True).order_by("room_code")
    today_iso = timezone.localdate().isoformat()

    days_of_week = [
        ("Mon", "จันทร์"),
        ("Tue", "อังคาร"),
        ("Wed", "พุธ"),
        ("Thu", "พฤหัส"),
        ("Fri", "ศุกร์"),
        ("Sat", "เสาร์"),
        ("Sun", "อาทิตย์"),
    ]

    if request.method == "GET":
        return render(
            request,
            "bookings/new_booking.html",
            {
                "rooms": rooms,
                "today": today_iso,
                "days_of_week": days_of_week,
            },
        )

    # POST — refactored to use service and logic consistent with API
    room_id = request.POST.get("room_id")
    booking_date_str = request.POST.get("date")
    time_start = request.POST.get("time_start")
    time_end = request.POST.get("time_end")
    purpose_type = request.POST.get("purpose_type")

    try:
        # Use BKK timezone for conversion
        import zoneinfo
        BKK = zoneinfo.ZoneInfo("Asia/Bangkok")
        
        d_obj = date.fromisoformat(booking_date_str)
        t_start_obj = datetime.strptime(time_start, "%H:%M").time()
        t_end_obj = datetime.strptime(time_end, "%H:%M").time()
        
        start_dt = timezone.make_aware(datetime.combine(d_obj, t_start_obj), BKK)
        end_dt = timezone.make_aware(datetime.combine(d_obj, t_end_obj), BKK)
    except (ValueError, TypeError):
        return render(
            request,
            "bookings/new_booking.html",
            {
                "rooms": rooms,
                "today": today_iso,
                "days_of_week": days_of_week,
                "error": "กรุณาระบุวันที่และเวลาให้ครบถ้วน",
            },
        )

    # Use same validation as API (validators)
    from bookings.validators import validate_booking_time
    try:
        validate_booking_time(start_dt, end_dt)
    except ValidationError as e:
        return render(
            request,
            "bookings/new_booking.html",
            {
                "rooms": rooms,
                "today": today_iso,
                "days_of_week": days_of_week,
                "error": str(e.message),
            },
        )

    with transaction.atomic():
        # Lock the room to prevent race conditions (Must Fix #1 & #2)
        room = get_object_or_404(Room.objects.select_for_update(), pk=room_id)
        
        # Check for conflicts using the same logic as API
        from bookings.services.conflict_check_service import build_conflict_report
        # Convert weekday to Mon, Tue, etc.
        day_abbr = d_obj.strftime("%a") # Mon, Tue...
        
        report = build_conflict_report(
            room_id, d_obj, d_obj, [day_abbr], time_start, time_end
        )
        
        if report["has_conflict"]:
            error_msg = "ช่วงเวลานี้มีการจองซ้อนทับหรือเป็นช่วงเวลา Blackout"
            if report["conflicts"]:
                error_msg += f" (ติดการจอง: {report['conflicts'][0]['booker_name']})"
            elif report["blackouts"]:
                error_msg += f" (Blackout: {report['blackouts'][0]['reason']})"
                
            return render(
                request,
                "bookings/new_booking.html",
                {
                    "rooms": rooms,
                    "today": today_iso,
                    "days_of_week": days_of_week,
                    "error": error_msg,
                },
            )

        # Create booking using Serializer to keep logic unified
        data = {
            "room": room_id,
            "start_datetime": start_dt,
            "end_datetime": end_dt,
            "purpose_type": purpose_type,
        }
        
        if purpose_type == "teaching":
            data["teaching_info"] = {
                "subject_code": request.POST.get("subject_code", ""),
                "subject_name": request.POST.get("subject_name", ""),
                "program_type": request.POST.get("program_type", "Bachelor"),
            }
        elif purpose_type == "training":
            data["training_info"] = {
                "topic": request.POST.get("topic", ""),
            }

        serializer = BookingWriteSerializer(data=data)
        if serializer.is_valid():
            serializer.save(booker=request.user, status="Pending")
            return redirect("/dashboard/")
        else:
            # Better error formatting (Nice to Have #4)
            first_error_msg = "ข้อมูลไม่ถูกต้อง"
            if serializer.errors:
                # Get the first error message from the first field that has errors
                first_field_errors = next(iter(serializer.errors.values()))
                if isinstance(first_field_errors, list):
                    first_error_msg = first_field_errors[0]
                else:
                    first_error_msg = str(first_field_errors)
                    
            return render(
                request,
                "bookings/new_booking.html",
                {
                    "rooms": rooms,
                    "today": today_iso,
                    "days_of_week": days_of_week,
                    "error": first_error_msg,
                },
            )


@login_required
def cancel_booking(request, booking_id):
    with transaction.atomic():
        booking = get_object_or_404(Booking.objects.select_for_update(), booking_id=booking_id, booker=request.user)
        if request.method == "POST" and booking.status in ["Pending", "Approved"]:
            # Standard cancel logic consistent with API
            now_bkk = timezone.localtime(timezone.now())
            if timezone.localtime(booking.start_datetime) > now_bkk:
                booking.status = "Cancelled"
                booking.save()
    return redirect("/dashboard/")


# ---------- ADMIN ----------


@login_required
def admin_dashboard(request):
    if request.user.role != "Admin":
        return redirect("/dashboard/")

    today = timezone.localdate()
    pending = (
        Booking.objects.filter(status="Pending")
        .select_related("booker", "room", "teaching_info", "training_info")
        .order_by("start_datetime")
    )
    today_bk = (
        Booking.objects.filter(start_datetime__date=today)
        .select_related("booker", "room")
        .order_by("start_datetime")
    )

    from django.utils.timezone import now

    month_start = now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    context = {
        "pending_bookings": pending,
        "today_bookings": today_bk,
        "stat_pending": Booking.objects.filter(status="Pending").count(),
        "stat_approved": Booking.objects.filter(status="Approved").count(),
        "stat_rejected": Booking.objects.filter(status="Rejected").count(),
        "stat_total": Booking.objects.filter(created_at__gte=month_start).count(),
    }
    return render(request, "bookings/admin_dashboard.html", context)


@login_required
def approve_booking(request, booking_id):
    if request.user.role != "Admin":
        return redirect("/dashboard/")
    with transaction.atomic():
        booking = get_object_or_404(Booking.objects.select_for_update(), booking_id=booking_id)
        if request.method == "POST":
            booking.status = "Approved"
            booking.approved_by = request.user
            booking.save()
    return redirect("/admin-dashboard/")


@login_required
def reject_booking(request, booking_id):
    if request.user.role != "Admin":
        return redirect("/dashboard/")
    with transaction.atomic():
        booking = get_object_or_404(Booking.objects.select_for_update(), booking_id=booking_id)
        if request.method == "POST":
            booking.status = "Rejected"
            booking.reject_reason = request.POST.get("reject_reason", "")
            booking.approved_by = request.user
            booking.save()
    return redirect("/admin-dashboard/")
