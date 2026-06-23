from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from . import services
from .models import Position, User
from .serializers import (
    PositionSerializer,
    ChangePasswordSerializer,
    UserCreateSerializer,
    UserMeSerializer,
    UserSerializer,
    UserUpdateSerializer,
)


class UserViewSet(ViewSet):
    def get_permissions(self):
        if self.action in ("me",):
            return [IsAuthenticated()]
        return [IsAdminUser()]

    def list(self, request: Request) -> Response:
        users = User.objects.filter(status=User.Status.ACTIVE).order_by("first_name")
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)

    def retrieve(self, request: Request, pk: int) -> Response:
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = UserSerializer(user)
        return Response(serializer.data)

    def create(self, request: Request) -> Response:
        serializer = UserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = services.create_user(
            created_by=request.user, **serializer.validated_data
        )
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)

    def update(self, request: Request, pk: int) -> Response:
        user = User.objects.get(pk=pk)
        serializer = UserUpdateSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        user = services.update_user(user=user, **serializer.validated_data)
        return Response(UserSerializer(user).data)

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
        services.change_password(user=user, new_password=serializer.validated_data["password"])
        return Response({"detail": "Password updated successfully."})

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def me(self, request: Request) -> Response:
        serializer = UserMeSerializer(request.user)
        return Response(serializer.data)


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
