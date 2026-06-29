from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.users.serializers import CustomTokenObtainPairSerializer

from .views import version_view


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/version/", version_view, name="version"),
    path(
        "api/v1/auth/login/", CustomTokenObtainPairView.as_view(), name="token-obtain"
    ),
    path("api/v1/auth/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("api/v1/users/", include("apps.users.urls")),
    path("api/v1/drivers/", include("apps.drivers.urls")),
    path("api/v1/fleet/", include("apps.fleet.urls")),
    path("api/v1/carriers/", include("apps.carriers.urls")),
    path("api/v1/locations/", include("apps.locations.urls")),
    path("api/v1/brokers/", include("apps.brokers.urls")),
    path("api/v1/loads/", include("apps.loads.urls")),
    path("api/v1/accounting/", include("apps.accounting.urls")),
    path("api/v1/dispatch/", include("apps.dispatch.urls")),
    path("api/v1/documents/", include("apps.documents.urls")),
    path("api/v1/integrations/", include("apps.integrations.urls")),
    path("api/v1/ai/", include("apps.ai.urls")),
    path("api/v1/dashboard/", include("apps.dashboard.urls")),
    path("api/v1/reports/", include("apps.reports.urls")),
]
