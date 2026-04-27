from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    # account (index, login, logout, success pages)
    path("", include("account.urls")),
    # DRF API
    path("api/bookings/", include("bookings.urls")),
    path("api/rooms/", include("rooms.urls")),
]
