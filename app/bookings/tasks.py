from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date, timedelta

from celery import shared_task
from django.utils.timezone import localtime, now

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def send_booking_reminders(self):
    from bookings.models import Booking
    from bookings.services.email_service import notify_booker_reminder_bulk

    tomorrow = localtime(now()).date() + timedelta(days=1)
    logger.info("send_booking_reminders: ส่ง reminder สำหรับวัน %s", tomorrow)

    bookings = Booking.objects.filter(
        status="Approved",
        start_datetime__date=tomorrow,
    ).select_related("booker", "room")

    # จัดกลุ่มตาม target_email (notification_email หรือ booker.email)
    groups: dict[str, dict] = defaultdict(lambda: {"booker": None, "bookings": []})
    for bk in bookings:
        target_email = bk.notification_email or bk.booker.email
        if not target_email:
            logger.warning("booker %s ไม่มีอีเมล — ข้าม", bk.booker.username)
            continue
        groups[target_email]["booker"] = bk.booker
        groups[target_email]["bookings"].append(bk)

    sent = 0
    failed = 0
    for target_email, data in groups.items():
        try:
            success = notify_booker_reminder_bulk(
                booker=data["booker"],
                bookings=data["bookings"],
                target_email=target_email,
            )
            if success:
                sent += 1
            else:
                failed += 1
        except Exception as exc:  # noqa: BLE001
            logger.error(
                "send_booking_reminders: ส่ง reminder ไปยัง %s ล้มเหลว: %s",
                target_email,
                exc,
            )
            failed += 1

    logger.info(
        "send_booking_reminders เสร็จ: ส่งสำเร็จ %d / ล้มเหลว %d อีเมล",
        sent,
        failed,
    )
    return {"sent": sent, "failed": failed, "date": str(tomorrow)}


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_single_reminder(self, booking_id: int):
    from bookings.models import Booking
    from bookings.services.email_service import notify_booker_reminder

    try:
        booking = Booking.objects.select_related("booker", "room").get(pk=booking_id)
        notify_booker_reminder(booking)
    except Booking.DoesNotExist:
        logger.error("send_single_reminder: ไม่พบ Booking #%s", booking_id)
