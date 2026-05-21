import requests
from django.conf import settings
from django.shortcuts import render, redirect
from django.contrib.auth import login, logout, authenticate
from .models import User

TU_AUTH_URL = "https://restapi.tu.ac.th/api/v1/auth/Ad/verify"
TU_STD_URL = "https://restapi.tu.ac.th/api/v2/profile/std/info/"

ALLOWED_DEPT_KEYWORDS = [
    "วิศวกรรมไฟฟ้าและคอมพิวเตอร์",
    "Electrical and Computer Engineering",
]


def _app_key():
    return getattr(settings, "TU_APP_KEY", "") or ""


def _admin_usernames():
    return getattr(settings, "ECE_ADMIN_USERNAMES", []) or []


def _tu_headers():
    return {
        "Content-Type": "application/json",
        "Application-Key": _app_key(),
    }


def _redirect_by_role(user):
    if user.role == User.Role.ADMIN:
        return redirect("/api/bookings/dashboard/admin/")
    return redirect("/api/bookings/dashboard/lecturer/")


def _upsert_and_login(request, username, profile_defaults, fallback_role):
    """
    อัปเดตเฉพาะ profile fields (ชื่อ, email, department ฯลฯ)
    role จะถูกแตะก็ต่อเมื่อยังไม่มี user นั้นในฐานข้อมูล (ใช้ fallback_role)
    """
    existing = User.objects.filter(username=username).first()
    if existing:
        # อัปเดตเฉพาะ profile — ไม่แตะ role เด็ดขาด
        for field, value in profile_defaults.items():
            setattr(existing, field, value)
        existing.save(update_fields=list(profile_defaults.keys()))
        user = existing
    else:
        # สร้างใหม่ — ใช้ fallback_role
        user = User.objects.create(
            username=username, role=fallback_role, **profile_defaults
        )
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    return user


# ── Views ──────────────────────────────────────────────────────────


def index(request):
    if request.user.is_authenticated:
        return _redirect_by_role(request.user)
    return render(request, "account/index.html")


def login_view(request):
    if request.user.is_authenticated:
        return _redirect_by_role(request.user)

    if request.method == "GET":
        return render(request, "account/login.html")

    username = request.POST.get("username", "").strip()
    password = request.POST.get("password", "").strip()

    if not username or not password:
        return render(
            request, "account/login.html", {"error": "กรุณากรอก Username และ Password"}
        )

    # เลือก Superuser bypass ก่อนเสมอ
    # ตรวจสอบ local Django auth ก่อน เพื่อรองรับ superuser ที่สร้างด้วย
    # createsuperuser (มี password เก็บใน DB ไม่ต้องผ่าน TU API)
    local_user = authenticate(request, username=username, password=password)
    if local_user is not None and local_user.is_superuser:
        login(request, local_user, backend="django.contrib.auth.backends.ModelBackend")
        return redirect("/api/bookings/dashboard/admin/")

    # นักศึกษา = ตัวเลขล้วน 10 หลัก (fallback role เป็น Student สำหรับ user ใหม่เท่านั้น)
    if username.isdigit() and len(username) == 10:
        return _handle_student_login(request, username, password)
    return _handle_employee_login(request, username, password)


def _handle_employee_login(request, username, password):
    """อาจารย์ / เจ้าหน้าที่ — POST /api/v1/auth/Ad/verify"""
    try:
        resp = requests.post(
            TU_AUTH_URL,
            json={"UserName": username, "PassWord": password},
            headers=_tu_headers(),
            timeout=10,
        )
        data = resp.json()
    except requests.exceptions.Timeout:
        return render(
            request, "account/login.html", {"error": "TU API ตอบสนองช้า กรุณาลองใหม่"}
        )
    except Exception as e:
        return render(
            request,
            "account/login.html",
            {"error": f"ไม่สามารถเชื่อมต่อ TU API ได้: {e}"},
        )

    if not data.get("status"):
        return render(
            request,
            "account/login.html",
            {"error": data.get("message", "Username หรือ Password ไม่ถูกต้อง")},
        )

    account_type = data.get("type", "")

    # กรณี student login ด้วย username (ไม่ใช่ student ID)
    if account_type == "student":
        return _handle_student_profile(request, username, data)

    if account_type != "employee":
        return render(
            request, "account/login.html", {"error": "ประเภทบัญชีนี้ไม่รองรับ"}
        )

    department = data.get("department", "")
    faculty = data.get("faculty", "")

    # ตรวจสอบว่าอยู่ภาควิชา ECE
    in_ece = any(
        kw.lower() in (department + faculty).lower() for kw in ALLOWED_DEPT_KEYWORDS
    )
    if not in_ece and username not in _admin_usernames():
        return render(
            request,
            "account/login.html",
            {"error": "บัญชีของท่านไม่อยู่ในภาควิชาวิศวกรรมไฟฟ้าและคอมพิวเตอร์"},
        )

    # Role: Admin กำหนดผ่าน ECE_ADMIN_USERNAMES ใน .env
    # ผู้ใช้ใหม่ที่ยังไม่ได้กำหนด role จะได้ Lecturer เป็นค่าเริ่มต้น
    existing = User.objects.filter(username=username).first()
    if existing:
        role = existing.role  # คงค่า role ที่ Admin กำหนดไว้แล้ว
    else:
        role = "Admin" if username in _admin_usernames() else "Lecturer"

    user = _upsert_and_login(
        request,
        username,
        {
            "displayname_th": data.get("displayname_th", ""),
            "displayname_en": data.get("displayname_en", ""),
            "email": data.get("email", ""),
            "department": department,
            "faculty": faculty,
        },
        role,
    )

    return _redirect_by_role(user)


def _handle_student_login(request, student_id, password):
    """นักศึกษา — verify แล้วดึง profile เพิ่มเติม"""
    try:
        resp = requests.post(
            TU_AUTH_URL,
            json={"UserName": student_id, "PassWord": password},
            headers=_tu_headers(),
            timeout=10,
        )
        auth_data = resp.json()
    except requests.exceptions.Timeout:
        return render(
            request, "account/login.html", {"error": "TU API ตอบสนองช้า กรุณาลองใหม่"}
        )
    except Exception as e:
        return render(
            request,
            "account/login.html",
            {"error": f"ไม่สามารถเชื่อมต่อ TU API ได้: {e}"},
        )

    if not auth_data.get("status"):
        return render(
            request,
            "account/login.html",
            {"error": auth_data.get("message", "รหัสนักศึกษาหรือ Password ไม่ถูกต้อง")},
        )

    # ดึง student profile
    try:
        p_resp = requests.get(
            TU_STD_URL,
            params={"id": student_id},
            headers=_tu_headers(),
            timeout=10,
        )
        p_data = p_resp.json()
        p = p_data.get("data", {}) if p_data.get("status") else {}
    except Exception:
        p = {}

    profile = {
        "displayname_th": p.get("displayname_th")
        or auth_data.get("displayname_th", ""),
        "displayname_en": p.get("displayname_en")
        or auth_data.get("displayname_en", ""),
        "email": p.get("email") or auth_data.get("email", ""),
        "department": p.get("department") or auth_data.get("department", ""),
        "faculty": p.get("faculty") or auth_data.get("faculty", ""),
    }
    return _handle_student_profile(request, student_id, profile)


def _handle_student_profile(request, username, profile):
    user = _upsert_and_login(request, username, profile, "Student")
    return _redirect_by_role(user)


# ── Success pages ───────────────────────────────────────────────────


def login_success_lecturer(request):
    return render(request, "account/success_lecturer.html")


def login_success_admin(request):
    return render(request, "account/success_admin.html")


def login_success_student(request):
    return render(request, "account/success_student.html")


# ── Logout ──────────────────────────────────────────────────────────


def logout_view(request):
    logout(request)
    return redirect("/")


# ══════════════════════════════════════════════════════════════════
#  JWT  Auth  API  Views
# ══════════════════════════════════════════════════════════════════

import requests as _req
from django.conf import settings as _settings
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from drf_spectacular.utils import extend_schema, OpenApiResponse
from .serializers import (
    LoginRequestSerializer,
    LoginResponseSerializer,
    TokenRefreshResponseSerializer,
    MeSerializer,
)


def _get_tokens(user):
    """สร้าง JWT access + refresh token สำหรับ user"""
    refresh = RefreshToken.for_user(user)
    return str(refresh.access_token), str(refresh)


def _build_user_or_error(request_obj, username, password):
    """
    เรียก TU API เพื่อ verify แล้ว upsert user ในฐานข้อมูล
    Return (user, None) หรือ (None, error_message)
    """
    TU_AUTH_URL = "https://restapi.tu.ac.th/api/v1/auth/Ad/verify"
    TU_STD_URL = "https://restapi.tu.ac.th/api/v2/profile/std/info/"
    headers = {
        "Content-Type": "application/json",
        "Application-Key": getattr(_settings, "TU_APP_KEY", "") or "",
    }

    # ── verify ─────────────────────────────────────────────────────
    try:
        resp = _req.post(
            TU_AUTH_URL,
            json={"UserName": username, "PassWord": password},
            headers=headers,
            timeout=10,
        )
        auth_data = resp.json()
    except _req.exceptions.Timeout:
        return None, "TU API ตอบสนองช้า กรุณาลองใหม่"
    except Exception as e:
        return None, f"ไม่สามารถเชื่อมต่อ TU API ได้: {e}"

    if not auth_data.get("status"):
        return None, auth_data.get("message", "Username หรือ Password ไม่ถูกต้อง")

    account_type = auth_data.get("type", "")

    # ── นักศึกษา ────────────────────────────────────────────────────
    if username.isdigit() and len(username) == 10 or account_type == "student":
        # ดึง student profile เพิ่มเติม
        try:
            p_resp = _req.get(
                TU_STD_URL, params={"id": username}, headers=headers, timeout=10
            )
            p_data = p_resp.json()
            p = p_data.get("data", {}) if p_data.get("status") else {}
        except Exception:
            p = {}

        profile = {
            "displayname_th": p.get("displayname_th")
            or auth_data.get("displayname_th", ""),
            "displayname_en": p.get("displayname_en")
            or auth_data.get("displayname_en", ""),
            "email": p.get("email") or auth_data.get("email", ""),
            "department": p.get("department") or auth_data.get("department", ""),
            "faculty": p.get("faculty") or auth_data.get("faculty", ""),
        }
        user = _upsert_user(username, profile, "student")
        return user, None

    # ── อาจารย์ / เจ้าหน้าที่ ──────────────────────────────────────
    if account_type != "employee":
        return None, "ประเภทบัญชีนี้ไม่รองรับ"

    department = auth_data.get("department", "")
    faculty = auth_data.get("faculty", "")

    ALLOWED = ["วิศวกรรมไฟฟ้าและคอมพิวเตอร์", "Electrical and Computer Engineering"]
    admin_usernames = getattr(_settings, "ECE_ADMIN_USERNAMES", []) or []
    in_ece = any(kw.lower() in (department + faculty).lower() for kw in ALLOWED)

    if not in_ece and username not in admin_usernames:
        return None, "บัญชีของท่านไม่อยู่ในภาควิชาวิศวกรรมไฟฟ้าและคอมพิวเตอร์"

    existing = User.objects.filter(username=username).first()
    if existing:
        role = existing.role
    else:
        role = "admin" if username in admin_usernames else "lecturer"

    profile = {
        "displayname_th": auth_data.get("displayname_th", ""),
        "displayname_en": auth_data.get("displayname_en", ""),
        "email": auth_data.get("email", ""),
        "department": department,
        "faculty": faculty,
    }
    user = _upsert_user(username, profile, role)
    return user, None


def _upsert_user(username, profile_defaults, fallback_role):
    """Create หรือ update user (ไม่แตะ role ถ้า user มีอยู่แล้ว)"""
    existing = User.objects.filter(username=username).first()
    if existing:
        for field, value in profile_defaults.items():
            setattr(existing, field, value)
        existing.save(update_fields=list(profile_defaults.keys()))
        return existing
    return User.objects.create(
        username=username, role=fallback_role, **profile_defaults
    )


# ── Views ──────────────────────────────────────────────────────────


class LoginAPIView(APIView):
    """
    POST /api/auth/login/

    รับ username + password แล้ว verify ผ่าน TU REST API
    หากสำเร็จจะคืน JWT access token, refresh token และข้อมูล user
    """

    permission_classes = [AllowAny]

    @extend_schema(
        summary="Login ด้วย TU Account",
        description=(
            "ส่ง username และ password ไป verify กับ TU REST API\n\n"
            "- **นักศึกษา**: username เป็นรหัสนักศึกษา 10 หลัก\n"
            "- **อาจารย์/เจ้าหน้าที่**: username เป็น TU username\n\n"
            "เมื่อสำเร็จจะได้รับ `access` token (อายุ 8 ชั่วโมง) และ `refresh` token (อายุ 7 วัน)\n"
            "นำ `access` token ไปใส่ใน Header: `Authorization: Bearer <access>`"
        ),
        request=LoginRequestSerializer,
        responses={
            200: LoginResponseSerializer,
            400: OpenApiResponse(description="ข้อมูลไม่ครบหรือไม่ถูกต้อง"),
            401: OpenApiResponse(
                description="Username/Password ผิด หรือ TU API ปฏิเสธ"
            ),
        },
        tags=["Auth"],
    )
    def post(self, request):
        serializer = LoginRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        username = serializer.validated_data["username"].strip()
        password = serializer.validated_data["password"].strip()

        if not username or not password:
            return Response(
                {"detail": "กรุณากรอก username และ password"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user, error = _build_user_or_error(request, username, password)
        if error:
            return Response({"detail": error}, status=status.HTTP_401_UNAUTHORIZED)

        access, refresh = _get_tokens(user)
        response_data = {
            "access": access,
            "refresh": refresh,
            "user": {
                "user_id": user.user_id,
                "username": user.username,
                "displayname_th": user.displayname_th,
                "role": user.role,
            },
        }
        return Response(response_data, status=status.HTTP_200_OK)


class TokenRefreshAPIView(APIView):
    """
    POST /api/auth/token/refresh/

    รับ refresh token แล้วคืน access token ใหม่
    """

    permission_classes = [AllowAny]

    @extend_schema(
        summary="Refresh Access Token",
        description="ส่ง `refresh` token เพื่อขอ `access` token ใหม่",
        request={
            "application/json": {
                "type": "object",
                "properties": {"refresh": {"type": "string"}},
                "required": ["refresh"],
            }
        },
        responses={
            200: TokenRefreshResponseSerializer,
            401: OpenApiResponse(description="Refresh token ไม่ถูกต้องหรือหมดอายุ"),
        },
        tags=["Auth"],
    )
    def post(self, request):
        from rest_framework_simplejwt.exceptions import TokenError, InvalidToken

        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"detail": "refresh token is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = RefreshToken(refresh_token)
            access = str(token.access_token)
        except (TokenError, InvalidToken) as e:
            return Response({"detail": str(e)}, status=status.HTTP_401_UNAUTHORIZED)
        return Response({"access": access}, status=status.HTTP_200_OK)


class MeAPIView(APIView):
    """
    GET /api/auth/me/

    ดึงข้อมูลผู้ใช้ที่ login อยู่ (ต้องส่ง Authorization: Bearer <access>)
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="ข้อมูลผู้ใช้ปัจจุบัน",
        description="ต้องส่ง `Authorization: Bearer <access_token>` ใน Header",
        responses={
            200: MeSerializer,
            401: OpenApiResponse(description="ยังไม่ได้ login หรือ token หมดอายุ"),
        },
        tags=["Auth"],
    )
    def get(self, request):
        serializer = MeSerializer(request.user)
        return Response(serializer.data)
