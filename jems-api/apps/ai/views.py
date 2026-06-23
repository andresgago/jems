from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from . import services
from .models import Conversation
from .serializers import (
    ConversationListSerializer,
    ConversationSerializer,
    SendMessageSerializer,
    MessageSerializer,
)


class ConversationViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request: Request) -> Response:
        qs = Conversation.objects.filter(user=request.user)
        return Response(ConversationListSerializer(qs, many=True).data)

    def create(self, request: Request) -> Response:
        topic = request.data.get("topic", "")
        conversation = services.create_conversation(user=request.user, topic=topic)
        return Response(
            ConversationSerializer(conversation).data,
            status=status.HTTP_201_CREATED,
        )

    def retrieve(self, request: Request, pk: int) -> Response:
        conversation = get_object_or_404(
            Conversation.objects.prefetch_related("messages"),
            pk=pk,
            user=request.user,
        )
        return Response(ConversationSerializer(conversation).data)

    def destroy(self, request: Request, pk: int) -> Response:
        conversation = get_object_or_404(Conversation, pk=pk, user=request.user)
        conversation.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def send_message(self, request: Request, pk: int) -> Response:
        conversation = get_object_or_404(Conversation, pk=pk, user=request.user)
        serializer = SendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            reply = services.send_message(
                conversation=conversation,
                content=serializer.validated_data["content"],
            )
        except RuntimeError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response(MessageSerializer(reply).data, status=status.HTTP_201_CREATED)
