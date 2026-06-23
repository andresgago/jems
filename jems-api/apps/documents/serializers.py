from rest_framework import serializers

from .models import DriverFile, ImportRecordFile, TrailerFile, TruckFile


class DriverFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = DriverFile
        fields = ["id", "driver", "type", "file", "expiry_date", "created_at"]
        read_only_fields = ["id", "created_at"]


class TruckFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = TruckFile
        fields = ["id", "truck", "type", "file", "expiry_date", "created_at"]
        read_only_fields = ["id", "created_at"]


class TrailerFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrailerFile
        fields = ["id", "trailer", "type", "file", "expiry_date", "created_at"]
        read_only_fields = ["id", "created_at"]


class ImportRecordFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportRecordFile
        fields = ["id", "type", "filename", "sha1_file", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]
