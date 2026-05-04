from django.urls import path
from . import views

urlpatterns = [
    path("", views.dashboard, name="dashboard"),
    path("create/", views.create_room, name="admin_create"),
    path("read/", views.get_room, name="admin_read"),
    path("update/", views.update_room, name="admin_update"),
    path("delete/", views.delete_room, name="admin_delete"),
    path("blackout/", views.blackout_room, name="blackout"),
]