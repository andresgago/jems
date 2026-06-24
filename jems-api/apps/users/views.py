from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from . import services
from .models import Position, User
from .serializers import (
    DisplayOptionsSerializer,
    PositionSerializer,
    ChangePasswordSerializer,
    SystemConfigSerializer,
    UserCreateSerializer,
    UserDetailSerializer,
    UserListSerializer,
    UserMeSerializer,
    UserOptionSerializer,
    UserPhotoSerializer,
    UserSerializer,
    UserUpdateSerializer,
)


class UserViewSet(ViewSet):
    def get_permissions(self):
        if self.action in ("me", "options"):
            return [IsAuthenticated()]
        return [IsAdminUser()]

    def list(self, request: Request) -> Response:
        q = request.query_params.get("q", "").strip()
        status_param = request.query_params.get("status")
        dispatcher_param = request.query_params.get("is_dispatcher")
        status_filter = None
        if status_param not in (None, ""):
            try:
                status_filter = int(status_param)
            except ValueError:
                status_filter = None
        is_dispatcher = None
        if dispatcher_param not in (None, ""):
            is_dispatcher = dispatcher_param.lower() in ("1", "true")
        users = services.list_users(
            q=q, status=status_filter, is_dispatcher=is_dispatcher
        )
        serializer = UserListSerializer(users, many=True)
        return Response(serializer.data)

    def retrieve(self, request: Request, pk: int) -> Response:
        try:
            user = User.objects.select_related(
                "position", "main_dispatcher", "created_by", "updated_by"
            ).get(pk=pk)
        except User.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = UserDetailSerializer(user)
        return Response(serializer.data)

    def create(self, request: Request) -> Response:
        serializer = UserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = services.create_user(
            created_by=request.user, **serializer.validated_data
        )
        return Response(UserDetailSerializer(user).data, status=status.HTTP_201_CREATED)

    def update(self, request: Request, pk: int) -> Response:
        user = User.objects.get(pk=pk)
        serializer = UserUpdateSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = services.update_user(
            user=user, updated_by=request.user, **serializer.validated_data
        )
        return Response(UserDetailSerializer(user).data)

    def destroy(self, request: Request, pk: int) -> Response:
        user = User.objects.get(pk=pk)
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="toggle-status")
    def toggle_status(self, request: Request, pk: int) -> Response:
        user = User.objects.get(pk=pk)
        user = services.toggle_user_status(user=user)
        return Response(UserSerializer(user).data)

    @action(detail=True, methods=["post"], url_path="toggle-dispatcher")
    def toggle_dispatcher(self, request: Request, pk: int) -> Response:
        user = User.objects.get(pk=pk)
        user = services.toggle_dispatcher(user=user)
        return Response(UserSerializer(user).data)

    @action(detail=True, methods=["post"], url_path="change-password")
    def change_password(self, request: Request, pk: int) -> Response:
        user = User.objects.get(pk=pk)
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.change_password(
            user=user, new_password=serializer.validated_data["password"]
        )
        return Response({"detail": "Password updated successfully."})

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def me(self, request: Request) -> Response:
        serializer = UserMeSerializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def options(self, request: Request) -> Response:
        def parse_bool(name: str) -> bool:
            return request.query_params.get(name, "").lower() in ("1", "true")

        contract = None
        contract_param = request.query_params.get("contract")
        if contract_param not in (None, ""):
            try:
                contract = int(contract_param)
            except ValueError:
                return Response(
                    {"contract": "Contract must be an integer."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        exclude = None
        exclude_param = request.query_params.get("exclude")
        if exclude_param not in (None, ""):
            try:
                exclude = int(exclude_param)
            except ValueError:
                return Response(
                    {"exclude": "Exclude must be an integer."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        users = services.list_user_options(
            dispatchers=parse_bool("dispatchers"),
            contract=contract,
            main=parse_bool("main"),
            exclude=exclude,
            active_only=not parse_bool("all"),
        )
        return Response(UserOptionSerializer(users, many=True).data)

    @action(detail=True, methods=["post", "delete"], url_path="photo")
    def photo(self, request: Request, pk: int) -> Response:
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if request.method == "DELETE":
            user = services.clear_user_photo(user=user)
            return Response(UserDetailSerializer(user).data)
        serializer = UserPhotoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = services.set_user_photo(
            user=user, photo=serializer.validated_data["photo"]
        )
        return Response(UserDetailSerializer(user).data)


class SystemConfigViewSet(ViewSet):
    permission_classes = [IsAdminUser]

    def retrieve(self, request: Request) -> Response:
        return Response(SystemConfigSerializer(services.get_system_config()).data)

    def partial_update(self, request: Request) -> Response:
        config = services.get_system_config()
        serializer = SystemConfigSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        config = services.update_system_config(**serializer.validated_data)
        return Response(SystemConfigSerializer(config).data)


class DisplayOptionsViewSet(ViewSet):
    permission_classes = [IsAdminUser]

    def retrieve(self, request: Request) -> Response:
        return Response(DisplayOptionsSerializer(services.get_display_options()).data)

    def partial_update(self, request: Request) -> Response:
        options = services.get_display_options()
        serializer = DisplayOptionsSerializer(options, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        options = services.update_display_options(**serializer.validated_data)
        return Response(DisplayOptionsSerializer(options).data)


class PositionViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request: Request) -> Response:
        qs = Position.objects.filter(is_active=True)
        return Response(PositionSerializer(qs, many=True).data)

    def create(self, request: Request) -> Response:
        serializer = PositionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        pos = Position.objects.create(**serializer.validated_data)
        return Response(PositionSerializer(pos).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request: Request, pk: int) -> Response:
        try:
            pos = Position.objects.get(pk=pk)
        except Position.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = PositionSerializer(pos, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        for field, value in serializer.validated_data.items():
            setattr(pos, field, value)
        pos.save()
        return Response(PositionSerializer(pos).data)
