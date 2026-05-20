from rest_framework import serializers
from .models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = "__all__"
        read_only_fields = ["user_id", "created_at"]


class UserBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["user_id", "username", "displayname_th", "role"]


# ── Auth API Serializers ────────────────────────────────────────────


class LoginRequestSerializer(serializers.Serializer):
    """Request body สำหรับ POST /api/auth/login/"""

    username = serializers.CharField(
        help_text="รหัสนักศึกษา (10 หลัก) หรือ username ของอาจารย์/เจ้าหน้าที่"
    )
    password = serializers.CharField(
        write_only=True,
        style={"input_type": "password"},
        help_text="รหัสผ่าน TU Account",
    )


class LoginResponseSerializer(serializers.Serializer):
    """Response body ของ POST /api/auth/login/"""

    access = serializers.CharField(help_text="JWT Access Token (อายุ 8 ชั่วโมง)")
    refresh = serializers.CharField(help_text="JWT Refresh Token (อายุ 7 วัน)")
    user = UserBriefSerializer(help_text="ข้อมูลผู้ใช้")


class TokenRefreshResponseSerializer(serializers.Serializer):
    """Response body ของ POST /api/auth/token/refresh/"""

    access = serializers.CharField(help_text="JWT Access Token ใหม่")


class MeSerializer(serializers.ModelSerializer):
    """ข้อมูลผู้ใช้ปัจจุบัน"""

    class Meta:
        model = User
        fields = [
            "user_id",
            "username",
            "displayname_th",
            "displayname_en",
            "email",
            "department",
            "faculty",
            "role",
            "created_at",
        ]
        read_only_fields = fields
