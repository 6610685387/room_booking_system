from rest_framework.permissions import BasePermission
from account.models import User

class IsAdminRole(BasePermission):
    """
    อนุญาตเฉพาะ user ที่มี role == ADMIN เท่านั้น
    """
    message = "เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่เข้าถึงได้"

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == User.Role.ADMIN 
        )