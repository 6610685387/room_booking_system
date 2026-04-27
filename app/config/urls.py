from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
urlpatterns = [
    path("admin/", admin.site.urls),
    # account (index, login, logout, success pages)
    path("", include("account.urls")),
    # DRF API
    path("api/bookings/", include("bookings.urls")),
    path("api/rooms/", include("rooms.urls")),
    # swagger-ui
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/schema/swagger-ui/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
]
