from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'room', views.AdminCRUDViewSet)

urlpatterns = [
    path("", views.dashboard, name="admin_dashboard"),
    path("blackout/", views.blackout_room, name="blackout"),
    path("req/", include(router.urls)),
]