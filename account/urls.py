from django.urls import path
from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path(
        "login-success/lecturer/", views.login_success_lecturer, name="success_lecturer"
    ),
    path("login-success/admin/", views.login_success_admin, name="success_admin"),
    path("login-success/student/", views.login_success_student, name="success_student"),
]
