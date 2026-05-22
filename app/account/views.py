import requests
from django.conf import settings
from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.contrib.auth import login, logout, authenticate
from .models import User

# ── TU REST API URLs ──────────────────────────────────────────────────
TU_AUTH_URL = "https://restapi.tu.ac.th/api/v1/auth/Ad/verify"
TU_INSTRUCTOR_URL = "https://restapi.tu.ac.th/api/v2/profile/Instructors/info/"
TU_EMPLOYEE_URL = "https://restapi.tu.ac.th/api/v2/profile/emp/info/"


# ── Helpers ───────────────────────────────────────────────────────────


def _app_key():
    return getattr(settings, "TU_APP_KEY", "") or ""


def _admin_usernames():
    return getattr(settings, "ECE_ADMIN_USERNAMES", []) or []


def _tu_headers():
    return {
        "Content-Type": "application/json",
        "Application-Key": _app_key(),
    }


# ── ECE department / faculty keywords ────────────────────────────────
ECE_KEYWORDS = [
    "วิศวกรรมไฟฟ้าและคอมพิวเตอร์",
    "electrical and computer engineering",
    "ece",
]
NO_PERMISSION_MSG = (
    "ไม่มีสิทธิ์เข้าใช้งาน "
    "ระบบนี้ใช้สำหรับอาจารย์และผู้ดูแลระบบ"
    "ภาควิชาวิศวกรรมไฟฟ้าและคอมพิวเตอร์ คณะวิศวกรรมศาสตร์เท่านั้น"
)


def _is_ece_member(fields: dict) -> bool:
    """
    ตรวจสอบว่าข้อมูลจาก TU API ระบุว่าอยู่ใน ECE หรือไม่

    รับ dict ที่อาจมี key ใดก็ได้จาก:
      Instructor API : Faculty_Name_Th, Faculty_Name_En
      Employee API   : department, organization
      Auth API       : department, organization

    เช็ค substring case-insensitive — ผ่านถ้าพบ keyword ใด keyword หนึ่ง
    """
    combined = " ".join(
        str(fields.get(k, ""))
        for k in (
            "Faculty_Name_Th",
            "Faculty_Name_En",
            "department",
            "organization",
        )
    ).lower()

    return any(kw in combined for kw in ECE_KEYWORDS)


def _redirect_by_role(user):
    if user.role == User.Role.ADMIN:
        return redirect("/dashboard/admin/#dashboard")
    return redirect("/dashboard/lecturer/#dashboard")


def _get_redirect_url(user):
    """คืน URL string สำหรับใช้กับ JSON response (ไม่ใช่ HttpResponse)"""
    if user.role == User.Role.ADMIN:
        return "/dashboard/admin/#dashboard"
    return "/dashboard/lecturer/#dashboard"


def _upsert_and_login(request, username, profile_defaults, fallback_role):
    """
    สร้าง หรืออัปเดต user แล้ว login session
    - มีอยู่แล้ว  → อัปเดตเฉพาะ profile fields (ไม่แตะ role)
    - ยังไม่มี    → สร้างใหม่ด้วย fallback_role
    """
    existing = User.objects.filter(username=username).first()
    if existing:
        for field, value in profile_defaults.items():
            setattr(existing, field, value)
        existing.save(update_fields=list(profile_defaults.keys()))
        user = existing
    else:
        user = User.objects.create(
            username=username, role=fallback_role, **profile_defaults
        )
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    return user


def _check_tu_instructor(email: str) -> dict | None:
    """
    GET /api/v2/profile/Instructors/info/?Email=<email>
    คืน dict ข้อมูลอาจารย์คนแรกจาก data[], หรือ None ถ้าไม่พบ / error
    """
    if not email:
        return None
    try:
        resp = requests.get(
            TU_INSTRUCTOR_URL,
            params={"Email": email},
            headers=_tu_headers(),
            timeout=10,
        )
        data = resp.json()
        if data.get("status") and isinstance(data.get("data"), list) and data["data"]:
            return data["data"][0]
    except Exception:
        pass
    return None


def _check_tu_employee(username: str) -> dict | None:
    """
    GET /api/v2/profile/emp/info/?username=<username>
    คืน dict ข้อมูลบุคลากร หรือ None ถ้าไม่พบ / error
    """
    if not username:
        return None
    try:
        resp = requests.get(
            TU_EMPLOYEE_URL,
            params={"username": username},
            headers=_tu_headers(),
            timeout=10,
        )
        data = resp.json()
        if data.get("status"):
            d = data.get("data")
            if isinstance(d, list):
                return d[0] if d else None
            if isinstance(d, dict):
                return d
    except Exception:
        pass
    return None


def _build_profile_from_instructor(instructor: dict, auth_data: dict) -> dict:
    """สร้าง profile dict จาก TU Instructor API response"""
    fname_th = instructor.get("First_Name_Th", "")
    lname_th = instructor.get("Last_Name_Th", "")
    fname_en = instructor.get("First_Name_En", "")
    lname_en = instructor.get("Last_Name_En", "")
    return {
        "displayname_th": f"{fname_th} {lname_th}".strip()
        or auth_data.get("displayname_th", ""),
        "displayname_en": f"{fname_en} {lname_en}".strip()
        or auth_data.get("displayname_en", ""),
        "email": instructor.get("Email", auth_data.get("email", "")),
        "department": instructor.get(
            "Faculty_Name_Th", auth_data.get("department", "")
        ),
        "faculty": instructor.get("Faculty_Name_En", ""),
    }


def _build_profile_from_employee(emp: dict, auth_data: dict) -> dict:
    """สร้าง profile dict จาก TU Employee API response"""
    return {
        "displayname_th": emp.get(
            "displayname_th", auth_data.get("displayname_th", "")
        ),
        "displayname_en": emp.get(
            "displayname_en", auth_data.get("displayname_en", "")
        ),
        "email": emp.get("email", auth_data.get("email", "")),
        "department": emp.get("department", auth_data.get("department", "")),
        "faculty": emp.get("organization", auth_data.get("organization", "")),
    }


def _build_profile_from_auth(auth_data: dict) -> dict:
    """สร้าง profile dict จาก TU Auth API response เท่านั้น (fallback)"""
    return {
        "displayname_th": auth_data.get("displayname_th", ""),
        "displayname_en": auth_data.get("displayname_en", ""),
        "email": auth_data.get("email", ""),
        "department": auth_data.get("department", ""),
        "faculty": auth_data.get("organization", auth_data.get("faculty", "")),
    }


# ── Core login logic ──────────────────────────────────────────────────


def _perform_login(request, username, password):
    """
    ดำเนิน login flow เต็ม (ใช้ร่วมกันระหว่าง session view และ JWT API view)

    Return:
        (user, None)          ถ้าสำเร็จ  — user ถูก login เข้า session แล้ว
        (None, error_str)     ถ้าล้มเหลว
    """

    # ─── Step 1 : TU Auth API ──────────────────────────────────────
    auth_data = None
    conn_error = None

    try:
        resp = requests.post(
            TU_AUTH_URL,
            json={"UserName": username, "PassWord": password},
            headers=_tu_headers(),
            timeout=10,
        )
        auth_data = resp.json()
    except requests.exceptions.Timeout:
        conn_error = "TU API ตอบสนองช้า กรุณาลองใหม่"
    except Exception as e:
        conn_error = f"ไม่สามารถเชื่อมต่อ TU API ได้: {e}"

    import logging as _log

    _log.getLogger(__name__).warning("[LOGIN DEBUG] TU AUTH: %s", auth_data)

    # TU API ไม่ตอบสนอง → ข้ามไป DB Fallback (Step 4) ทันที
    if auth_data is None:
        return _db_fallback(request, username) or (
            None,
            conn_error or "ไม่สามารถเชื่อมต่อ TU API ได้",
        )

    # ─── [FIX] credentials ผิดตาม TU Auth → ลอง Django DB ก่อน ───
    # กรณีที่ user มีอยู่ใน DB พร้อม password ถูกต้อง แต่ TU account มีปัญหา
    if not auth_data.get("status"):
        django_user = authenticate(request, username=username, password=password)
        if django_user and not django_user.is_superuser:
            if getattr(django_user, "role", None) in (
                User.Role.LECTURER,
                User.Role.ADMIN,
            ):
                login(
                    request,
                    django_user,
                    backend="django.contrib.auth.backends.ModelBackend",
                )
                return django_user, None
        return None, auth_data.get("message", "Username หรือ Password ไม่ถูกต้อง")

    account_type = auth_data.get("type", "")
    email = auth_data.get("email", "")

    # นักศึกษา / บุคคลภายนอก → บล็อกทันที
    if account_type == "student" or (username.isdigit() and len(username) == 10):
        return None, NO_PERMISSION_MSG

    if account_type != "employee":
        return None, "ประเภทบัญชีนี้ไม่รองรับ"

    # ─── Step 2 : TU Instructor API (ค้นด้วย email) ───────────────
    instructor = _check_tu_instructor(email)
    _log.getLogger(__name__).warning("[LOGIN DEBUG] TU INSTRUCTOR: %s", instructor)
    if instructor:
        if not _is_ece_member(instructor):
            _log.getLogger(__name__).warning(
                "[LOGIN DEBUG] ECE CHECK FAILED: %s", instructor
            )
            return None, NO_PERMISSION_MSG
        existing = User.objects.filter(username=username).first()
        assigned_role = existing.role if existing else User.Role.LECTURER
        profile = _build_profile_from_instructor(instructor, auth_data)
        user = _upsert_and_login(request, username, profile, assigned_role)
        return user, None

    # ─── Step 3 : TU Employee API + admin list ────────────────────
    admin_list = _admin_usernames()
    if username in admin_list:
        emp = _check_tu_employee(username)
        if emp:
            if not _is_ece_member(emp):
                return None, NO_PERMISSION_MSG
            existing = User.objects.filter(username=username).first()
            assigned_role = existing.role if existing else User.Role.ADMIN
            profile = _build_profile_from_employee(emp, auth_data)
            user = _upsert_and_login(request, username, profile, assigned_role)
            return user, None

    # ─── Step 4 : Django DB Fallback ─────────────────────────────
    result = _db_fallback(request, username)
    if result:
        return result  # (user, None)

    return None, NO_PERMISSION_MSG


def _db_fallback(request, username):
    """
    เช็ค Django DB ว่ามี user ที่มี role=lecturer/admin มั้ย
    ถ้ามี → login แล้วคืน (user, None)
    ถ้าไม่มี → คืน None

    หมายเหตุ: ใช้สำหรับกรณี TU API ล่มเท่านั้น (ไม่ตรวจ password)
              การตรวจ password เมื่อ TU Auth คืน status=false ทำใน _perform_login
              ผ่าน authenticate() แทน
    """
    existing = User.objects.filter(username=username).first()
    if existing and existing.role in (User.Role.LECTURER, User.Role.ADMIN):
        login(request, existing, backend="django.contrib.auth.backends.ModelBackend")
        return existing, None
    return None


# ── Session-based Views ───────────────────────────────────────────────


def index(request):
    if request.user.is_authenticated:
        return _redirect_by_role(request.user)
    return render(request, "account/index.html")


def login_view(request):
    if request.user.is_authenticated:
        return _redirect_by_role(request.user)

    if request.method == "GET":
        return render(request, "account/login.html")

    is_ajax = request.headers.get("X-Requested-With") == "XMLHttpRequest"

    username = request.POST.get("username", "").strip()
    password = request.POST.get("password", "").strip()

    if not username or not password:
        error = "กรุณากรอก Username และ Password"
        if is_ajax:
            return JsonResponse({"error": error}, status=400)
        return render(request, "account/login.html", {"error": error})

    # Superuser bypass — local Django account (createsuperuser)
    local_user = authenticate(request, username=username, password=password)
    if local_user is not None and local_user.is_superuser:
        login(request, local_user, backend="django.contrib.auth.backends.ModelBackend")
        if is_ajax:
            return JsonResponse({"redirect": "/dashboard/admin/#dashboard"})
        return redirect("/dashboard/admin/#dashboard")

    user, error = _perform_login(request, username, password)
    if error:
        if is_ajax:
            return JsonResponse({"error": error}, status=401)
        return render(request, "account/login.html", {"error": error})

    if is_ajax:
        return JsonResponse({"redirect": _get_redirect_url(user)})
    return _redirect_by_role(user)


def logout_view(request):
    logout(request)
    return redirect("/")


# ── Success pages ─────────────────────────────────────────────────────


def login_success_lecturer(request):
    return render(request, "account/success_lecturer.html")


def login_success_admin(request):
    return render(request, "account/success_admin.html")


def login_success_student(request):
    return render(request, "account/success_student.html")


# ══════════════════════════════════════════════════════════════════════
#  JWT Auth API Views
# ══════════════════════════════════════════════════════════════════════

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
    """สร้าง JWT access + refresh token"""
    refresh = RefreshToken.for_user(user)
    return str(refresh.access_token), str(refresh)


class LoginAPIView(APIView):
    """
    POST /api/auth/login/

    ─── Login Flow ───────────────────────────────────────────────────
    1. TU Auth API      → verify credentials
    2. TU Instructor API (Email) → พบ → Lecturer → หน้าจองห้อง
    3. TU Employee API (username) + ECE_ADMIN_USERNAMES → Admin → dashboard
    4. Django DB Fallback → role=lecturer/admin → ผ่าน
    5. นักศึกษา / บุคคลภายนอก → 403 ไม่มีสิทธิ์
    ──────────────────────────────────────────────────────────────────
    """

    permission_classes = [AllowAny]

    @extend_schema(
        summary="Login ด้วย TU Account (อาจารย์ / Admin ภาควิชาเท่านั้น)",
        description=(
            "ส่ง username และ password ไป verify กับ TU REST API\n\n"
            "**ลำดับการตรวจสอบ:**\n"
            "1. TU Auth API → ยืนยัน credentials\n"
            "2. TU Instructor API (Email) → อาจารย์ → role=**lecturer**\n"
            "3. TU Employee API (username) + ECE_ADMIN_USERNAMES → role=**admin**\n"
            "4. Django DB Fallback → ใช้เมื่อ TU API ล่ม\n\n"
            "นักศึกษาและบุคคลภายนอก **ไม่มีสิทธิ์** เข้าใช้งาน\n\n"
            "เมื่อสำเร็จจะได้รับ `access` token (อายุ 8 ชั่วโมง) "
            "และ `refresh` token (อายุ 7 วัน)\n"
            "นำ `access` token ไปใส่ใน Header: `Authorization: Bearer <access>`"
        ),
        request=LoginRequestSerializer,
        responses={
            200: LoginResponseSerializer,
            400: OpenApiResponse(description="ข้อมูลไม่ครบหรือไม่ถูกต้อง"),
            401: OpenApiResponse(
                description="Username/Password ผิด หรือ TU API ปฏิเสธ"
            ),
            403: OpenApiResponse(description="ไม่มีสิทธิ์ (นักศึกษา / บุคคลภายนอก)"),
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

        # Superuser bypass
        local_user = authenticate(request, username=username, password=password)
        if local_user is not None and local_user.is_superuser:
            access, refresh = _get_tokens(local_user)
            return Response(
                {
                    "access": access,
                    "refresh": refresh,
                    "user": {
                        "user_id": local_user.user_id,
                        "username": local_user.username,
                        "displayname_th": local_user.displayname_th,
                        "role": local_user.role,
                    },
                },
                status=status.HTTP_200_OK,
            )

        user, error = _perform_login(request, username, password)
        if error:
            http_status = (
                status.HTTP_403_FORBIDDEN
                if "ไม่มีสิทธิ์" in error
                else status.HTTP_401_UNAUTHORIZED
            )
            return Response({"detail": error}, status=http_status)

        access, refresh = _get_tokens(user)
        return Response(
            {
                "access": access,
                "refresh": refresh,
                "user": {
                    "user_id": user.user_id,
                    "username": user.username,
                    "displayname_th": user.displayname_th,
                    "role": user.role,
                },
            },
            status=status.HTTP_200_OK,
        )


class TokenRefreshAPIView(APIView):
    """POST /api/auth/token/refresh/ — รับ refresh token แล้วคืน access token ใหม่"""

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
    """GET /api/auth/me/ — ดึงข้อมูลผู้ใช้ที่ login อยู่"""

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

    @extend_schema(
        summary="อัปเดตข้อมูลผู้ใช้ปัจจุบัน",
        description="อัปเดตข้อมูลบางส่วน เช่น notification_email",
        request=MeSerializer,
        responses={
            200: MeSerializer,
            400: OpenApiResponse(description="ข้อมูลไม่ถูกต้อง"),
            401: OpenApiResponse(description="ยังไม่ได้ login หรือ token หมดอายุ"),
        },
        tags=["Auth"],
    )
    def patch(self, request):
        serializer = MeSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
