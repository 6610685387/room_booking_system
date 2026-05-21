from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from bookings.views.booking_views import admin_dashboard, lecturer_dashboard

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("account.urls")),

    path("dashboard/admin/", admin_dashboard, name="dashboard_admin"),
    path("dashboard/lecturer/", lecturer_dashboard, name="dashboard_lecturer"),

    path("api/bookings/", include("bookings.urls")),
    path("api/rooms/", include("rooms.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/schema/swagger-ui/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path("api/admin/", include("admindash.urls")),
    path("api/reports/", include("reports.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
