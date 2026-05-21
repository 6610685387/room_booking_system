from django.contrib import admin
from .models import User

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    ordering = ["username"]
    list_display = ["username", "displayname_th", "role", "is_active", "is_staff"]
    list_filter = ["role", "is_active", "is_staff"]
    search_fields = ["username", "displayname_th", "email"]

    fields = (
        "username", 
        "password", 
        "displayname_th", 
        "displayname_en", 
        "email", 
        "department", 
        "role", 
        "is_active", 
        "is_staff", 
        "is_superuser"
    )

    def save_model(self, request, obj, form, change):
        if obj.password and not obj.password.startswith('pbkdf2_'):
            obj.set_password(obj.password)
        super().save_model(request, obj, form, change)