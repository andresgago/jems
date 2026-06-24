from .models import City, State


def list_cities(
    *,
    q: str = "",
    state_id: int | None = None,
    active: bool | None = None,
):
    qs = City.objects.select_related("state").order_by("zip", "name")
    if q:
        from django.db.models import Q

        qs = qs.filter(Q(name__icontains=q) | Q(zip__icontains=q))
    if state_id is not None:
        qs = qs.filter(state_id=state_id)
    if active is not None:
        qs = qs.filter(active=active)
    return qs


def create_city(*, name: str, zip: str, state: State, timezone: str = "") -> City:
    city = City(name=name, zip=zip, state=state, timezone=timezone)
    city.full_clean()
    city.save()
    return city


def update_city(*, city: City, **fields) -> City:
    for field, value in fields.items():
        setattr(city, field, value)
    city.full_clean()
    city.save()
    return city


def toggle_city_status(*, city: City) -> City:
    city.active = not city.active
    city.save(update_fields=["active"])
    return city
