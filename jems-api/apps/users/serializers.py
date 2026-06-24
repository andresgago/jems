from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import DisplayOptions, Position, SystemConfig, User


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


class UserListSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    position_name = serializers.CharField(source="position.name", read_only=True)
    main_dispatcher_name = serializers.CharField(
        source="main_dispatcher.full_name", read_only=True
    )
    dispatcher_type_display = serializers.CharField(
        source="get_dispatcher_type_display", read_only=True
    )
    contract_display = serializers.CharField(
        source="get_contract_display", read_only=True
    )

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
            "dispatcher_type_display",
            "is_main_dispatcher",
            "contract",
            "contract_display",
            "percent",
            "hours",
            "start_hour",
            "end_hour",
            "color",
            "photo",
            "address",
            "social_security_number",
            "position",
            "position_name",
            "main_dispatcher",
            "main_dispatcher_name",
            "carriers_access",
            "dispatcher_access",
            "carrier",
            "is_staff",
            "last_login",
            "last_login_ip",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class UserDetailSerializer(UserListSerializer):
    created_by_name = serializers.CharField(
        source="created_by.full_name", read_only=True
    )
    updated_by_name = serializers.CharField(
        source="updated_by.full_name", read_only=True
    )

    class Meta(UserListSerializer.Meta):
        fields = UserListSerializer.Meta.fields + [
            "created_by",
            "created_by_name",
            "updated_by",
            "updated_by_name",
        ]


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
            "status",
            "is_dispatcher",
            "dispatcher_type",
            "is_main_dispatcher",
            "contract",
            "percent",
            "hours",
            "start_hour",
            "end_hour",
            "color",
            "photo",
            "address",
            "social_security_number",
            "position",
            "main_dispatcher",
            "carriers_access",
            "dispatcher_access",
            "carrier",
            "is_staff",
        ]

    def validate(self, attrs):
        _validate_pay_fields(attrs)
        return attrs


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "first_name",
            "last_name",
            "email",
            "phone",
            "status",
            "is_dispatcher",
            "dispatcher_type",
            "is_main_dispatcher",
            "contract",
            "percent",
            "hours",
            "start_hour",
            "end_hour",
            "color",
            "photo",
            "address",
            "social_security_number",
            "position",
            "main_dispatcher",
            "carriers_access",
            "dispatcher_access",
            "carrier",
            "is_staff",
        ]

    def validate(self, attrs):
        _validate_pay_fields(attrs)
        return attrs


def _validate_pay_fields(attrs):
    percent = attrs.get("percent")
    if percent is not None and (percent < 0 or percent > 100):
        raise serializers.ValidationError(
            {"percent": "Percent must be between 0 and 100."}
        )
    hours = attrs.get("hours")
    if hours is not None and hours < 0:
        raise serializers.ValidationError(
            {"hours": "Hours must be greater than or equal to 0."}
        )


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


class UserOptionSerializer(serializers.ModelSerializer):
    label = serializers.CharField(source="full_name", read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "label",
            "full_name",
            "first_name",
            "last_name",
            "is_dispatcher",
            "dispatcher_type",
            "contract",
            "color",
        ]


class UserPhotoSerializer(serializers.Serializer):
    photo = serializers.ImageField()


class PositionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Position
        fields = ["id", "name", "is_active"]


class SystemConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemConfig
        fields = [
            "id",
            "start_hours_work_dispatcher",
            "end_hours_work_dispatcher",
            "dispatcher_invoice_hour",
            "dispatcher_invoice_percent",
            "driver_invoice",
            "owner_invoice",
            "carrier",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class DisplayOptionsSerializer(serializers.ModelSerializer):
    class Meta:
        model = DisplayOptions
        fields = ["id", "truck", "trailer", "driver", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


# Backward-compatible name for existing imports/tests.
UserSerializer = UserDetailSerializer
