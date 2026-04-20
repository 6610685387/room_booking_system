import requests
from django.conf import settings
from django.shortcuts import render, redirect
from django.contrib.auth import login, logout
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
    if user.role == "Admin":
        return redirect("/login-success/admin/")
    if user.role == "Student":
        return redirect("/login-success/student/")
    return redirect("/login-success/lecturer/")


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
            request, "account/login.html", {"error": f"ไม่สามารถเชื่อมต่อ TU API ได้: {e}"}
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
        return render(request, "account/login.html", {"error": "ประเภทบัญชีนี้ไม่รองรับ"})

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
            request, "account/login.html", {"error": f"ไม่สามารถเชื่อมต่อ TU API ได้: {e}"}
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
