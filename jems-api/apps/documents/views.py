from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from .models import DriverFile, ImportRecordFile, TrailerFile, TruckFile
from .serializers import (
    DriverFileSerializer,
    ImportRecordFileSerializer,
    TrailerFileSerializer,
    TruckFileSerializer,
)


class DriverFileViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request: Request) -> Response:
        qs = DriverFile.objects.all()
        driver_id = request.query_params.get("driver")
        if driver_id:
            qs = qs.filter(driver_id=driver_id)
        return Response(DriverFileSerializer(qs, many=True).data)

    def create(self, request: Request) -> Response:
        serializer = DriverFileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def destroy(self, request: Request, pk: int) -> Response:
        try:
            doc = DriverFile.objects.get(pk=pk)
        except DriverFile.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        doc.file.delete(save=False)
        doc.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TruckFileViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request: Request) -> Response:
        qs = TruckFile.objects.all()
        truck_id = request.query_params.get("truck")
        if truck_id:
            qs = qs.filter(truck_id=truck_id)
        return Response(TruckFileSerializer(qs, many=True).data)

    def create(self, request: Request) -> Response:
        serializer = TruckFileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def destroy(self, request: Request, pk: int) -> Response:
        try:
            doc = TruckFile.objects.get(pk=pk)
        except TruckFile.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        doc.file.delete(save=False)
        doc.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TrailerFileViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request: Request) -> Response:
        qs = TrailerFile.objects.all()
        trailer_id = request.query_params.get("trailer")
        if trailer_id:
            qs = qs.filter(trailer_id=trailer_id)
        return Response(TrailerFileSerializer(qs, many=True).data)

    def create(self, request: Request) -> Response:
        serializer = TrailerFileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def destroy(self, request: Request, pk: int) -> Response:
        try:
            doc = TrailerFile.objects.get(pk=pk)
        except TrailerFile.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        doc.file.delete(save=False)
        doc.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ImportRecordFileViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request: Request) -> Response:
        qs = ImportRecordFile.objects.all()
        return Response(ImportRecordFileSerializer(qs, many=True).data)

    def create(self, request: Request) -> Response:
        serializer = ImportRecordFileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def destroy(self, request: Request, pk: int) -> Response:
        try:
            record = ImportRecordFile.objects.get(pk=pk)
        except ImportRecordFile.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        record.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
