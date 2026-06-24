from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from .models import State
from .serializers import StateSerializer


class StateViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request: Request) -> Response:
        states = State.objects.order_by("name")
        return Response(StateSerializer(states, many=True).data)
