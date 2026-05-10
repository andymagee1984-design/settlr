"""
apps/users/serializers.py
"""

from rest_framework import serializers
from .models import User, Role, CRMPermission


class CRMPermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CRMPermission
        fields = ["id", "code", "description", "category"]


class RoleSerializer(serializers.ModelSerializer):
    permissions = CRMPermissionSerializer(many=True, read_only=True)

    class Meta:
        model = Role
        fields = ["id", "name", "is_system_role", "permissions"]


class UserSerializer(serializers.ModelSerializer):
    role = RoleSerializer(read_only=True)
    role_id = serializers.UUIDField(write_only=True, required=False)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name", "full_name",
            "role", "role_id", "agent", "is_active", "created_at",
        ]
        read_only_fields = ["id", "created_at", "agent"]

    def get_full_name(self, obj):
        return obj.get_full_name()


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    role_id = serializers.UUIDField(required=False, allow_null=True)

    class Meta:
        model = User
        fields = ["email", "first_name", "last_name", "password", "role_id", "is_active"]

    def create(self, validated_data):
        org = self.context["request"].user.organisation
        password = validated_data.pop("password")
        user = User(**validated_data, organisation=org)
        user.set_password(password)
        user.save()
        return user
