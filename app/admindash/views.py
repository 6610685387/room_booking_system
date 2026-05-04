from django.shortcuts import render

# Create your views here.
def dashboard(request): #for frontend design
    return render(request, "admindash/dashboard.html")

def create_room(request):
    if request.method == "POST":
        return render(request, "admindash/dashboard.html")
    
def get_room(request):
    return 0

def update_room(request):
    return 0

def delete_room(request):
    return 0

def blackout_room(request):
    return 0
