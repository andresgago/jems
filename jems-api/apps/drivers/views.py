from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from . import services
from .models import Driver, DriverDocument, DriverType, DriverVacation
from .serializers import (
    DocumentUploadSerializer,
    DriverCreateUpdateSerializer,
    DriverDocumentSerializer,
    DriverListSerializer,
    DriverSerializer,
    DriverTypeSerializer,
    DriverVacationSerializer,
    PhotoUploadSerializer,
)


class DriverTypeViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request: Request) -> Response:
        types = DriverType.objects.filter(is_active=True).order_by("name")
        return Response(DriverTypeSerializer(types, many=True).data)

    def create(self, request: Request) -> Response:
        name = request.data.get("name", "").strip()
        driver_type = services.create_driver_type(name=name)
        return Response(
            DriverTypeSerializer(driver_type).data, status=status.HTTP_201_CREATED
        )


class DriverViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request: Request) -> Response:
        drivers = (
            Driver.objects.exclude(status=Driver.Status.TERMINATED)
            .select_related("driver_type", "carrier")
            .order_by("first_name", "last_name")
        )
        return Response(DriverListSerializer(drivers, many=True).data)

    def retrieve(self, request: Request, pk: int) -> Response:
        driver = (
            Driver.objects.select_related(
                "driver_type", "license_state", "fuel_card", "team_driver", "carrier"
            )
            .prefetch_related("documents")
            .get(pk=pk)
        )
        return Response(DriverSerializer(driver).data)

    def create(self, request: Request) -> Response:
        serializer = DriverCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        driver = services.create_driver(
            created_by=request.user, **serializer.validated_data
        )
        return Response(DriverSerializer(driver).data, status=status.HTTP_201_CREATED)

    def update(self, request: Request, pk: int) -> Response:
        driver = Driver.objects.get(pk=pk)
        serializer = DriverCreateUpdateSerializer(
            driver, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        driver = services.update_driver(driver=driver, **serializer.validated_data)
        return Response(DriverSerializer(driver).data)

    def destroy(self, request: Request, pk: int) -> Response:
        driver = Driver.objects.get(pk=pk)
        driver.status = Driver.Status.TERMINATED
        driver.save(update_fields=["status", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="toggle-status")
    def toggle_status(self, request: Request, pk: int) -> Response:
        driver = Driver.objects.get(pk=pk)
        driver = services.toggle_driver_status(driver=driver)
        return Response(DriverListSerializer(driver).data)

    @action(detail=True, methods=["post"], url_path="photo")
    def upload_photo(self, request: Request, pk: int) -> Response:
        driver = Driver.objects.get(pk=pk)
        serializer = PhotoUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        driver = services.set_photo(
            driver=driver, photo=serializer.validated_data["photo"]
        )
        return Response(DriverSerializer(driver).data)

    @action(detail=True, methods=["delete"], url_path="photo")
    def delete_photo(self, request: Request, pk: int) -> Response:
        driver = Driver.objects.get(pk=pk)
        driver = services.remove_photo(driver=driver)
        return Response(DriverSerializer(driver).data)

    @action(detail=True, methods=["post"], url_path="documents")
    def upload_document(self, request: Request, pk: int) -> Response:
        driver = Driver.objects.get(pk=pk)
        serializer = DocumentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        document = services.upload_document(driver=driver, **serializer.validated_data)
        return Response(
            DriverDocumentSerializer(document).data, status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=["get"], url_path="documents")
    def list_documents(self, request: Request, pk: int) -> Response:
        documents = DriverDocument.objects.filter(driver_id=pk).order_by("-created_at")
        return Response(DriverDocumentSerializer(documents, many=True).data)


class DriverVacationViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request: Request, driver_pk: int) -> Response:
        vacations = DriverVacation.objects.filter(driver_id=driver_pk).order_by(
            "-start"
        )
        return Response(DriverVacationSerializer(vacations, many=True).data)

    def create(self, request: Request, driver_pk: int) -> Response:
        driver = Driver.objects.get(pk=driver_pk)
        serializer = DriverVacationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        vacation = DriverVacation.objects.create(
            driver=driver, **serializer.validated_data
        )
        return Response(
            DriverVacationSerializer(vacation).data, status=status.HTTP_201_CREATED
        )

    def destroy(self, request: Request, driver_pk: int, pk: int) -> Response:
        try:
            vacation = DriverVacation.objects.get(pk=pk, driver_id=driver_pk)
        except DriverVacation.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        vacation.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DriverDocumentViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def destroy(self, request: Request, pk: int) -> Response:
        try:
            document = DriverDocument.objects.get(pk=pk)
        except DriverDocument.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        services.delete_document(document=document)
        return Response(status=status.HTTP_204_NO_CONTENT)
