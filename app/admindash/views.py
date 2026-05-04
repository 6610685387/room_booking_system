from django.shortcuts import render
from rest_framework import viewsets
from rooms.models import Room
from rooms.serializers import RoomBriefSerializer

# Create your views here.
def dashboard(request): #for frontend design
    return render(request, "admindash/dashboard.html")

def blackout_room(request):
    return 0

class AdminCRUDViewSet(viewsets.ModelViewSet):
    queryset = Room.objects.all()
    serializer_class = RoomBriefSerializer
