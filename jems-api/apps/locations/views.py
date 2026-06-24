from rest_framework import status
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from .models import City, State
from .serializers import (
    CityDetailSerializer,
    CityListSerializer,
    CityWriteSerializer,
    StateSerializer,
)
from .services import (
    create_city,
    list_cities,
    toggle_city_status,
    update_city,
)


class CityPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


class StateViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request: Request) -> Response:
        states = State.objects.order_by("name")
        return Response(StateSerializer(states, many=True).data)


class CityViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def _get_city(self, pk: int) -> City | None:
        try:
            return City.objects.select_related("state").get(pk=pk)
        except City.DoesNotExist:
            return None

    def list(self, request: Request) -> Response:
        q = request.query_params.get("q", "").strip()
        state_param = request.query_params.get("state")
        active_param = request.query_params.get("active")

        state_id: int | None = None
        if state_param:
            try:
                state_id = int(state_param)
            except ValueError:
                pass

        active: bool | None = None
        if active_param is not None and active_param != "":
            active = active_param.lower() in ("1", "true")

        qs = list_cities(q=q, state_id=state_id, active=active)
        paginator = CityPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = CityListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def retrieve(self, request: Request, pk: int) -> Response:
        city = self._get_city(pk)
        if city is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(CityDetailSerializer(city).data)

    def create(self, request: Request) -> Response:
        serializer = CityWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        city = create_city(
            name=d["name"],
            zip=d["zip"],
            state=d.get("state"),
            timezone=d.get("timezone", ""),
        )
        city.refresh_from_db()
        return Response(CityDetailSerializer(city).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request: Request, pk: int) -> Response:
        city = self._get_city(pk)
        if city is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = CityWriteSerializer(city, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        city = update_city(city=city, **serializer.validated_data)
        city.refresh_from_db()
        return Response(CityDetailSerializer(city).data)

    @action(detail=True, methods=["post"], url_path="toggle-status")
    def toggle_status(self, request: Request, pk: int) -> Response:
        city = self._get_city(pk)
        if city is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        city = toggle_city_status(city=city)
        return Response({"id": city.pk, "active": city.active})
