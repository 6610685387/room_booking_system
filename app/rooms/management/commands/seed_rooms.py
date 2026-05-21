from django.core.management.base import BaseCommand
from rooms.models import Room

class Command(BaseCommand):
    help = 'Seeds the database with initial room data'

    def handle(self, *args, **kwargs):
        rooms_data = [
            {
                'room_code': '406-3',
                'room_name': 'ห้องประชุม 1',
                'room_type': 'Meeting Room',
                'capacity': 60,
                'is_active': True
            },
            {
                'room_code': '406-5',
                'room_name': 'ห้องประชุม 2',
                'room_type': 'Meeting Room',
                'capacity': 15,
                'is_active': True
            },
            {
                'room_code': '408-1',
                'room_name': 'ห้องประชุม 3',
                'room_type': 'Meeting Room',
                'capacity': 10,
                'is_active': True
            },
            {
                'room_code': '408-2/1',
                'room_name': 'ห้องบรรยาย 1',
                'room_type': 'Classroom',
                'capacity': 20,
                'is_active': True
            },
            {
                'room_code': '408-2/2',
                'room_name': 'ห้องบรรยาย 2',
                'room_type': 'Classroom',
                'capacity': 20,
                'is_active': True
            }
        ]

        created_count = 0
        for data in rooms_data:
            room, created = Room.objects.get_or_create(
                room_code=data['room_code'],
                defaults=data
            )
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f"Created room: {room.room_code} - {room.room_name}"))
            else:
                self.stdout.write(f"Room already exists: {room.room_code}")

        self.stdout.write(self.style.SUCCESS(f"\nSuccessfully created {created_count} new rooms."))
