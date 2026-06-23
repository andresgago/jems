from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Position, User


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["full_name"] = user.full_name
        token["username"] = user.username
        roles = []
        if user.is_superuser:
            roles.append("root")
        if user.is_staff:
            roles.append("admin")
        if user.is_dispatcher:
            roles.append("dispatcher")
        token["roles"] = roles
        return token


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "full_name",
            "email",
            "phone",
            "status",
            "is_dispatcher",
            "dispatcher_type",
            "is_main_dispatcher",
            "percent",
            "hours",
            "start_hour",
            "end_hour",
            "color",
            "photo",
            "carriers_access",
            "is_staff",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = User
        fields = [
            "username",
            "first_name",
            "last_name",
            "email",
            "phone",
            "password",
            "is_dispatcher",
            "dispatcher_type",
            "is_main_dispatcher",
            "percent",
            "hours",
            "start_hour",
            "end_hour",
            "color",
            "carriers_access",
            "is_staff",
        ]


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "first_name",
            "last_name",
            "email",
            "phone",
            "is_dispatcher",
            "dispatcher_type",
            "is_main_dispatcher",
            "percent",
            "hours",
            "start_hour",
            "end_hour",
            "color",
            "carriers_access",
            "is_staff",
        ]


class ChangePasswordSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)

    def validate(self, data: dict) -> dict:
        if data["password"] != data["password_confirm"]:
            raise serializers.ValidationError("Passwords do not match.")
        return data


class UserMeSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "full_name",
            "email",
            "phone",
            "is_dispatcher",
            "color",
            "photo",
            "carriers_access",
            "is_staff",
        ]


class PositionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Position
        fields = ["id", "name", "is_active"]
