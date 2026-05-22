from __future__ import annotations

import logging
import threading

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.timezone import localtime
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Thread-local flag สำหรับ bulk mode (ปิด signal ระหว่างสร้าง booking หลายรายการ)
# ---------------------------------------------------------------------------
_bulk_state = threading.local()


def set_bulk_mode(active: bool) -> None:
    _bulk_state.active = active


def is_bulk_mode() -> bool:
    return getattr(_bulk_state, "active", False)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _send(subject: str, to: list[str], template_name: str, context: dict) -> bool:
    if not to or not any(to):
        logger.warning("email_service._send: ไม่มีอีเมลปลายทาง — ข้าม")
        return False

    try:
        html_body = render_to_string(f"email/{template_name}.html", context)
        text_body = render_to_string(f"email/{template_name}.txt", context)

        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=to,
        )
        msg.attach_alternative(html_body, "text/html")
        msg.send()
        logger.info("ส่งอีเมล '%s' → %s สำเร็จ", subject, to)
        return True
    except Exception as exc:  # noqa: BLE001
        logger.error("ส่งอีเมล '%s' ล้มเหลว: %s", subject, exc)
        return False


def _booking_context(booking) -> dict:
    start = localtime(booking.start_datetime)
    end = localtime(booking.end_datetime)
    return {
        "booking": booking,
        "booker_name": booking.booker.displayname_th or booking.booker.username,
        "room_name": booking.room.room_name,
        "date_str": start.strftime("%d/%m/%Y"),
        "time_str": f"{start.strftime('%H:%M')} – {end.strftime('%H:%M')} น.",
        "site_url": getattr(settings, "SITE_URL", ""),
    }


def _get_admin_emails() -> list[str]:
    User = get_user_model()
    emails = list(
        User.objects.filter(role=User.Role.ADMIN, is_active=True)
        .exclude(email="")
        .values_list("email", flat=True)
    )
    if not emails:
        logger.warning("ไม่พบ Admin user ที่มีอีเมล")
    return emails


# ---------------------------------------------------------------------------
# 1. แจ้ง Admin เมื่อมีการจองใหม่ (รายการเดียว — ใช้โดย signal fallback)
# ---------------------------------------------------------------------------


def notify_admin_new_booking(booking) -> bool:
    admin_emails = _get_admin_emails()
    if not admin_emails:
        return False
    ctx = _booking_context(booking)
    ctx["purpose_display"] = dict(booking.PURPOSE_CHOICES).get(
        booking.purpose_type, booking.purpose_type
    )
    return _send(
        subject=f"[จองห้อง] มีการจองใหม่ #{booking.booking_id} — {ctx['room_name']}",
        to=admin_emails,
        template_name="admin_new_booking",
        context=ctx,
    )


# ---------------------------------------------------------------------------
# 1b. แจ้ง Admin เมื่อมีการจองใหม่แบบ Bulk (รวมทุก slot เป็นเมลเดียว)
# ---------------------------------------------------------------------------


def notify_admin_new_booking_bulk(bookings, group) -> bool:
    admin_emails = _get_admin_emails()
    if not admin_emails:
        return False

    booking_list = list(bookings)
    if not booking_list:
        return False

    first = booking_list[0]
    booker_name = first.booker.displayname_th or first.booker.username
    room_name = first.room.room_name
    purpose_display = dict(first.PURPOSE_CHOICES).get(
        first.purpose_type, first.purpose_type
    )

    slots = []
    for bk in booking_list:
        start = localtime(bk.start_datetime)
        end = localtime(bk.end_datetime)
        slots.append(
            {
                "booking_id": bk.booking_id,
                "date_str": start.strftime("%d/%m/%Y"),
                "time_str": f"{start.strftime('%H:%M')} – {end.strftime('%H:%M')} น.",
            }
        )

    ctx = {
        "booker_name": booker_name,
        "booker_username": first.booker.username,
        "room_name": room_name,
        "purpose_display": purpose_display,
        "total_count": len(booking_list),
        "slots": slots,
        "group_id": group.group_id,
        "site_url": getattr(settings, "SITE_URL", ""),
    }

    return _send(
        subject=f"[จองห้อง] มีการจองใหม่ {len(booking_list)} รายการ — {room_name} (กลุ่ม #{group.group_id})",
        to=admin_emails,
        template_name="admin_new_booking_bulk",
        context=ctx,
    )


# ---------------------------------------------------------------------------
# 2. แจ้งผู้จองเมื่อสร้างการจองสำเร็จ (สถานะ Pending)
# ---------------------------------------------------------------------------


def notify_booker_pending(booking) -> bool:
    booker_email = (
        booking.notification_email
        or booking.booker.notification_email
        or booking.booker.email
    )
    if not booker_email:
        logger.warning(
            "booker %s ไม่มีอีเมล — ข้ามการแจ้งสถานะ pending", booking.booker.username
        )
        return False

    ctx = _booking_context(booking)

    return _send(
        subject=f"[จองห้อง] การจอง #{booking.booking_id} อยู่ระหว่างรอการอนุมัติ ⏳",
        to=[booker_email],
        template_name="booker_pending",
        context=ctx,
    )


# ---------------------------------------------------------------------------
# 3. แจ้งผู้จองเมื่อการจองได้รับการอนุมัติ
# ---------------------------------------------------------------------------


def notify_booker_approved(booking) -> bool:
    booker_email = (
        booking.notification_email
        or booking.booker.notification_email
        or booking.booker.email
    )
    if not booker_email:
        logger.warning(
            "booker %s ไม่มีอีเมล — ข้ามการแจ้งอนุมัติ", booking.booker.username
        )
        return False

    ctx = _booking_context(booking)
    ctx["admin_notes"] = booking.admin_notes or ""

    return _send(
        subject=f"[จองห้อง] การจอง #{booking.booking_id} ได้รับการอนุมัติแล้ว ✅",
        to=[booker_email],
        template_name="booker_approved",
        context=ctx,
    )


# ---------------------------------------------------------------------------
# 3. แจ้งผู้จองเมื่อการจองถูกปฏิเสธ
# ---------------------------------------------------------------------------


def notify_booker_rejected(booking) -> bool:
    booker_email = (
        booking.notification_email
        or booking.booker.notification_email
        or booking.booker.email
    )
    if not booker_email:
        logger.warning(
            "booker %s ไม่มีอีเมล — ข้ามการแจ้งปฏิเสธ", booking.booker.username
        )
        return False

    ctx = _booking_context(booking)
    ctx["reject_reason"] = booking.reject_reason or "—"

    return _send(
        subject=f"[จองห้อง] การจอง #{booking.booking_id} ถูกปฏิเสธ ❌",
        to=[booker_email],
        template_name="booker_rejected",
        context=ctx,
    )


# ---------------------------------------------------------------------------
# 4. แจ้ง Admin เมื่อการจองถูกยกเลิก
# ---------------------------------------------------------------------------


def notify_admin_cancelled(booking, cancelled_by_username: str = "") -> bool:
    admin_emails = _get_admin_emails()
    if not admin_emails:
        return False
    ctx = _booking_context(booking)
    ctx["cancelled_by"] = cancelled_by_username or booking.booker.username
    return _send(
        subject=f"[จองห้อง] การจอง #{booking.booking_id} ถูกยกเลิก ⚠️",
        to=admin_emails,
        template_name="admin_cancelled",
        context=ctx,
    )


# ---------------------------------------------------------------------------
# 5. ส่ง Reminder ล่วงหน้า 1 วัน — รายการเดียว (fallback)
# ---------------------------------------------------------------------------


def notify_booker_reminder(booking) -> bool:
    booker_email = (
        booking.notification_email
        or booking.booker.notification_email
        or booking.booker.email
    )
    if not booker_email:
        logger.warning("booker %s ไม่มีอีเมล — ข้าม reminder", booking.booker.username)
        return False

    ctx = _booking_context(booking)

    return _send(
        subject=f"[จองห้อง] Reminder: การจอง #{booking.booking_id} พรุ่งนี้ 🔔",
        to=[booker_email],
        template_name="booker_reminder",
        context=ctx,
    )


# ---------------------------------------------------------------------------
# 5b. ส่ง Reminder แบบ Bulk — รวมทุกการจองของผู้ใช้คนเดียวเป็นเมลเดียว
# ---------------------------------------------------------------------------


def notify_booker_reminder_bulk(booker, bookings: list, target_email: str) -> bool:
    """
    ส่ง reminder รวมทุก booking ของ booker คนนี้ที่มีพรุ่งนี้
    target_email คืออีเมลที่จะส่งถึง (อาจมาจาก notification_email หรือ booker.email)
    """
    if not target_email:
        logger.warning("booker %s ไม่มีอีเมล — ข้าม reminder bulk", booker.username)
        return False

    if not bookings:
        return False

    booker_name = booker.displayname_th or booker.username

    slots = []
    for bk in bookings:
        start = localtime(bk.start_datetime)
        end = localtime(bk.end_datetime)
        slots.append(
            {
                "booking_id": bk.booking_id,
                "room_name": bk.room.room_name,
                "date_str": start.strftime("%d/%m/%Y"),
                "time_str": f"{start.strftime('%H:%M')} – {end.strftime('%H:%M')} น.",
            }
        )

    ctx = {
        "booker_name": booker_name,
        "total_count": len(bookings),
        "slots": slots,
        "site_url": getattr(settings, "SITE_URL", ""),
    }

    return _send(
        subject=f"[จองห้อง] Reminder: คุณมี {len(bookings)} การจองพรุ่งนี้ 🔔",
        to=[target_email],
        template_name="booker_reminder_bulk",
        context=ctx,
    )
