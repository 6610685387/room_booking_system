from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ['username']
    list_display = ['username', 'displayname_th', 'role', 'is_active', 'is_staff']
    list_filter = ['role', 'is_active', 'is_staff']
    search_fields = ['username', 'displayname_th', 'email']

    fieldsets = (
        (None, {'fields': ('username',)}),
        ('ข้อมูลส่วนตัว', {'fields': (
            'displayname_th', 'displayname_en',
            'email', 'department',
        )}),
        ('สิทธิ์', {'fields': ('role', 'is_active', 'is_staff', 'is_superuser')}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'displayname_th', 'role'),
        }),
    )

    filter_horizontal = []