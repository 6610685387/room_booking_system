from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from django.db.models import Q
from bookings.models import Booking
from rooms.models import Room


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
    today = timezone.localdate().isoformat()

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
                "today": today,
                "days_of_week": days_of_week,
            },
        )

    # POST — basic save (validation บน model / service)
    from django.utils.dateparse import parse_datetime
    import datetime

    room_id = request.POST.get("room_id")
    date = request.POST.get("date")
    time_start = request.POST.get("time_start")
    time_end = request.POST.get("time_end")
    purpose = request.POST.get("purpose_type")

    try:
        start_dt = timezone.make_aware(
            datetime.datetime.strptime(f"{date} {time_start}", "%Y-%m-%d %H:%M")
        )
        end_dt = timezone.make_aware(
            datetime.datetime.strptime(f"{date} {time_end}", "%Y-%m-%d %H:%M")
        )
    except (ValueError, TypeError):
        return render(
            request,
            "bookings/new_booking.html",
            {
                "rooms": rooms,
                "today": today,
                "days_of_week": days_of_week,
                "error": "กรุณาระบุวันที่และเวลาให้ครบถ้วน",
            },
        )

    if end_dt <= start_dt:
        return render(
            request,
            "bookings/new_booking.html",
            {
                "rooms": rooms,
                "today": today,
                "days_of_week": days_of_week,
                "error": "เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น",
            },
        )

    if Booking.has_conflict(room_id, start_dt, end_dt):
        return render(
            request,
            "bookings/new_booking.html",
            {
                "rooms": rooms,
                "today": today,
                "days_of_week": days_of_week,
                "error": "ช่วงเวลานี้มีการจองซ้อนทับอยู่แล้ว กรุณาเลือกเวลาอื่น",
            },
        )

    booking = Booking.objects.create(
        room_id=room_id,
        booker=request.user,
        start_datetime=start_dt,
        end_datetime=end_dt,
        purpose_type=purpose,
        status="Pending",
    )

    # Save purpose detail
    if purpose == "teaching":
        from bookings.models import TeachingInfo

        TeachingInfo.objects.create(
            booking=booking,
            subject_code=request.POST.get("subject_code", ""),
            subject_name=request.POST.get("subject_name", ""),
            program_type=request.POST.get("program_type", "Bachelor"),
        )
    elif purpose == "training":
        from bookings.models import TrainingInfo

        TrainingInfo.objects.create(
            booking=booking,
            topic=request.POST.get("topic", ""),
        )

    return redirect("/dashboard/")


@login_required
def cancel_booking(request, booking_id):
    booking = get_object_or_404(Booking, booking_id=booking_id, booker=request.user)
    if request.method == "POST" and booking.status == "Pending":
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
    booking = get_object_or_404(Booking, booking_id=booking_id)
    if request.method == "POST":
        booking.status = "Approved"
        booking.approved_by = request.user
        booking.save()
    return redirect("/admin-dashboard/")


@login_required
def reject_booking(request, booking_id):
    if request.user.role != "Admin":
        return redirect("/dashboard/")
    booking = get_object_or_404(Booking, booking_id=booking_id)
    if request.method == "POST":
        booking.status = "Rejected"
        booking.reject_reason = request.POST.get("reject_reason", "")
        booking.approved_by = request.user
        booking.save()
    return redirect("/admin-dashboard/")
