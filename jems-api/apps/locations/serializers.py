from rest_framework import serializers

from .models import City, State


class StateSerializer(serializers.ModelSerializer):
    class Meta:
        model = State
        fields = ["id", "name", "abbreviation"]


class CityListSerializer(serializers.ModelSerializer):
    state_name = serializers.CharField(source="state.name", read_only=True, default="")
    state_abbreviation = serializers.CharField(
        source="state.abbreviation", read_only=True, default=""
    )

    class Meta:
        model = City
        fields = [
            "id",
            "name",
            "zip",
            "state",
            "state_name",
            "state_abbreviation",
            "active",
            "timezone",
        ]


class CityDetailSerializer(CityListSerializer):
    state_data = StateSerializer(source="state", read_only=True)

    class Meta(CityListSerializer.Meta):
        fields = CityListSerializer.Meta.fields + ["state_data"]


class CityWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = City
        fields = ["name", "zip", "state", "active", "timezone"]

    def validate_zip(self, value: str) -> str:
        v = value.strip()
        if len(v) != 5 or not v.isdigit():
            raise serializers.ValidationError("Zip code must be exactly 5 digits.")
        return v

    def validate(self, attrs):
        name = attrs.get("name", "")
        zip_code = attrs.get("zip", "")
        state = attrs.get("state")
        if name and zip_code and state:
            qs = City.objects.filter(name=name, zip=zip_code, state=state)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    "A city with this name, zip, and state already exists."
                )
        return attrs
