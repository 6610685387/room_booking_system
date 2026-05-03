from __future__ import annotations

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from bookings.models import Booking
from bookings.services.email_service import (
    notify_admin_cancelled,
    notify_admin_new_booking,
    notify_booker_approved,
    notify_booker_rejected,
)

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Booking)
def booking_post_save(sender, instance: Booking, created: bool, **kwargs):
    if created:
        logger.info("Signal: Booking #%s ใหม่ — แจ้ง Admin", instance.booking_id)
        notify_admin_new_booking(instance)
        return
    try:
        previous = Booking.objects.get(pk=instance.pk)
    except Booking.DoesNotExist:
        return

    pre_status = getattr(instance, "_pre_status", None)
    new_status = instance.status

    if pre_status is None or pre_status == new_status:
        return

    logger.info(
        "Signal: Booking #%s status %s → %s",
        instance.booking_id,
        pre_status,
        new_status,
    )

    if new_status == "Approved":
        notify_booker_approved(instance)

    elif new_status == "Rejected":
        notify_booker_rejected(instance)

    elif new_status == "Cancelled":
        notify_admin_cancelled(instance)
