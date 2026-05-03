from __future__ import annotations

import logging
from datetime import date, timedelta

from celery import shared_task
from django.utils.timezone import localtime, now

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def send_booking_reminders(self):
    from bookings.models import Booking
    from bookings.services.email_service import notify_booker_reminder

    tomorrow = localtime(now()).date() + timedelta(days=1)
    logger.info("send_booking_reminders: ส่ง reminder สำหรับวัน %s", tomorrow)

    bookings = Booking.objects.filter(
        status="Approved",
        start_datetime__date=tomorrow,
    ).select_related("booker", "room")

    sent = 0
    failed = 0
    for booking in bookings:
        try:
            success = notify_booker_reminder(booking)
            if success:
                sent += 1
            else:
                failed += 1
        except Exception as exc:  # noqa: BLE001
            logger.error(
                "send_booking_reminders: ส่ง reminder สำหรับ #%s ล้มเหลว: %s",
                booking.booking_id,
                exc,
            )
            failed += 1

    logger.info(
        "send_booking_reminders เสร็จ: ส่งสำเร็จ %d / ล้มเหลว %d รายการ",
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
