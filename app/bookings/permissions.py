from rest_framework import permissions

class IsOwnerOrAdmin(permissions.BasePermission):
    """
    อนุญาตให้เข้าถึง Object ได้เฉพาะคนที่เป็นเจ้าของ (booker) หรือเป็น Admin
    ใช้สำหรับ Action 'retrieve' (SYS-21)
    """
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        
        if request.user.role == 'Admin':
            return True
            
        return hasattr(obj, 'booker') and obj.booker_id == request.user.user_id

class IsOwner(permissions.BasePermission):
    """
    อนุญาตให้เข้าถึง Object ได้เฉพาะคนที่เป็นเจ้าของ (booker) เท่านั้น
    แม้จะเป็น Admin ก็ต้องเป็นเจ้าของถึงจะทำได้ (ใช้สำหรับ 'cancel') (SYS-20)
    """
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
            
        return hasattr(obj, 'booker') and obj.booker_id == request.user.user_id
