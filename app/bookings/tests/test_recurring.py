from django.test import TestCase
from datetime import date, datetime
from bookings.services.recurring import generate_recurring_slots

class RecurringSlotTest(TestCase):
    def test_mon_fri_one_week(self):
        # Mon–Fri between 2026-04-28 and 2026-05-02 -> 4 slots (Tue–Fri)
        days = ["Mon", "Tue", "Wed", "Thu", "Fri"]
        start_d = date(2026, 4, 28)
        end_d = date(2026, 5, 2)
        slots = generate_recurring_slots(start_d, end_d, days, "10:00", "11:00")
        
        self.assertEqual(len(slots), 4)
        for s, e in slots:
            self.assertIsInstance(s, datetime)
            self.assertIsInstance(e, datetime)
            self.assertIsNotNone(s.tzinfo)
            self.assertLess(s, e)

    def test_mon_wed_two_weeks(self):
        # Mon-Wed between 2026-04-28 and 2026-05-08 -> 3 slots (Wed 29 Apr, Mon 4 May, Wed 6 May)
        days = ["Mon", "Wed"]
        start_d = date(2026, 4, 28)
        end_d = date(2026, 5, 8)
        slots = generate_recurring_slots(start_d, end_d, days, "10:00", "11:00")
        self.assertEqual(len(slots), 3)

    def test_single_day_match(self):
        # Matching weekday -> 1 slot
        days = ["Mon"]
        start_d = date(2026, 4, 27)
        end_d = date(2026, 4, 27)
        slots = generate_recurring_slots(start_d, end_d, days, "10:00", "11:00")
        self.assertEqual(len(slots), 1)

    def test_single_day_no_match(self):
        # No matching weekday -> 0 slots
        days = ["Tue"]
        start_d = date(2026, 4, 27)
        end_d = date(2026, 4, 27)
        slots = generate_recurring_slots(start_d, end_d, days, "10:00", "11:00")
        self.assertEqual(len(slots), 0)

    def test_start_after_end(self):
        # start after end -> empty list
        days = ["Mon"]
        start_d = date(2026, 5, 10)
        end_d = date(2026, 5, 1)
        slots = generate_recurring_slots(start_d, end_d, days, "10:00", "11:00")
        self.assertEqual(slots, [])
