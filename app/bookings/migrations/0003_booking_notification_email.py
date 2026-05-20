from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("bookings", "0002_booking_additional_requests_booking_admin_notes"),
    ]

    operations = [
        migrations.AddField(
            model_name="booking",
            name="notification_email",
            field=models.EmailField(
                blank=True,
                null=True,
                help_text="อีเมลที่ใช้รับแจ้งเตือนสำหรับการจองนี้ (ถ้าว่างจะใช้อีเมลของผู้จองในระบบ)",
            ),
        ),
    ]
