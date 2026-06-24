from django.urls import path

from .views import (
    DisplayOptionsViewSet,
    PositionViewSet,
    SystemConfigViewSet,
    UserViewSet,
)

user_list = UserViewSet.as_view({"get": "list", "post": "create"})
user_detail = UserViewSet.as_view(
    {"get": "retrieve", "put": "update", "patch": "update", "delete": "destroy"}
)
user_options = UserViewSet.as_view({"get": "options"})
user_toggle_status = UserViewSet.as_view({"post": "toggle_status"})
user_toggle_dispatcher = UserViewSet.as_view({"post": "toggle_dispatcher"})
user_change_password = UserViewSet.as_view({"post": "change_password"})
user_me = UserViewSet.as_view({"get": "me"})
user_photo = UserViewSet.as_view({"post": "photo", "delete": "photo"})

position_list = PositionViewSet.as_view({"get": "list", "post": "create"})
position_detail = PositionViewSet.as_view({"patch": "partial_update"})
system_config = SystemConfigViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update"}
)
display_options = DisplayOptionsViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update"}
)

urlpatterns = [
    path("", user_list, name="user-list"),
    path("me/", user_me, name="user-me"),
    path("options/", user_options, name="user-options"),
    path("settings/config/", system_config, name="system-config"),
    path("settings/display-options/", display_options, name="display-options"),
    path("<int:pk>/", user_detail, name="user-detail"),
    path("<int:pk>/toggle-status/", user_toggle_status, name="user-toggle-status"),
    path(
        "<int:pk>/toggle-dispatcher/",
        user_toggle_dispatcher,
        name="user-toggle-dispatcher",
    ),
    path(
        "<int:pk>/change-password/", user_change_password, name="user-change-password"
    ),
    path("<int:pk>/photo/", user_photo, name="user-photo"),
    path("positions/", position_list, name="position-list"),
    path("positions/<int:pk>/", position_detail, name="position-detail"),
]
