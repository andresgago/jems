from django.urls import path

from .views import StateViewSet

state_list = StateViewSet.as_view({"get": "list"})

urlpatterns = [
    path("states/", state_list, name="state-list"),
]
