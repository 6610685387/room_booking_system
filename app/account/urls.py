from django.urls import path
from . import views

urlpatterns = [
    path("", views.login_view, name="index"),
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    # ── JWT API ─────────────────────────────────────────────────────
    path("api/auth/login/", views.LoginAPIView.as_view(), name="api_login"),
    path(
        "api/auth/token/refresh/",
        views.TokenRefreshAPIView.as_view(),
        name="api_token_refresh",
    ),
    path("api/auth/me/", views.MeAPIView.as_view(), name="api_me"),
]
