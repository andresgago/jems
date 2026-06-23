from unittest.mock import patch

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.ai.models import Conversation, Message
from apps.ai.tests.factories import ConversationFactory, MessageFactory
from apps.users.tests.factories import UserFactory


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user():
    return UserFactory()


@pytest.fixture
def auth_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


# ── Conversations ─────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestConversationViews:
    def test_list_own_conversations(self, auth_client, user):
        ConversationFactory(user=user)
        ConversationFactory(user=user)
        other = UserFactory()
        ConversationFactory(user=other)
        response = auth_client.get(reverse("ai-conversation-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2

    def test_create_conversation(self, auth_client, user):
        response = auth_client.post(
            reverse("ai-conversation-list"),
            {"topic": "Fleet status Q3"},
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["topic"] == "Fleet status Q3"
        assert response.data["user"] == user.pk

    def test_create_without_topic(self, auth_client):
        response = auth_client.post(reverse("ai-conversation-list"), {})
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["topic"] == ""

    def test_retrieve_with_messages(self, auth_client, user):
        conv = ConversationFactory(user=user)
        MessageFactory(conversation=conv, role=Message.Role.USER, content="Hello")
        MessageFactory(
            conversation=conv, role=Message.Role.ASSISTANT, content="Hi there"
        )
        response = auth_client.get(
            reverse("ai-conversation-detail", kwargs={"pk": conv.pk})
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["messages"]) == 2

    def test_cannot_retrieve_other_users_conversation(self, auth_client):
        other = UserFactory()
        conv = ConversationFactory(user=other)
        response = auth_client.get(
            reverse("ai-conversation-detail", kwargs={"pk": conv.pk})
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_conversation(self, auth_client, user):
        conv = ConversationFactory(user=user)
        response = auth_client.delete(
            reverse("ai-conversation-detail", kwargs={"pk": conv.pk})
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Conversation.objects.filter(pk=conv.pk).exists()

    def test_unauthenticated_blocked(self, api_client):
        response = api_client.get(reverse("ai-conversation-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ── Send message ──────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestSendMessage:
    def test_send_message_calls_service(self, auth_client, user):
        conv = ConversationFactory(user=user)
        mock_reply = Message(
            conversation=conv,
            role=Message.Role.ASSISTANT,
            content="I can help with that.",
        )
        mock_reply.pk = 99

        with patch(
            "apps.ai.views.services.send_message", return_value=mock_reply
        ) as mock_svc:
            response = auth_client.post(
                reverse("ai-conversation-message", kwargs={"pk": conv.pk}),
                {"content": "What loads are active?"},
            )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["content"] == "I can help with that."
        mock_svc.assert_called_once()

    def test_empty_content_rejected(self, auth_client, user):
        conv = ConversationFactory(user=user)
        response = auth_client.post(
            reverse("ai-conversation-message", kwargs={"pk": conv.pk}),
            {"content": ""},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_missing_api_key_returns_503(self, auth_client, user):
        conv = ConversationFactory(user=user)
        with patch(
            "apps.ai.views.services.send_message",
            side_effect=RuntimeError("ANTHROPIC_API_KEY is not configured."),
        ):
            response = auth_client.post(
                reverse("ai-conversation-message", kwargs={"pk": conv.pk}),
                {"content": "Hello"},
            )
        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE

    def test_cannot_message_other_users_conversation(self, auth_client):
        other = UserFactory()
        conv = ConversationFactory(user=other)
        response = auth_client.post(
            reverse("ai-conversation-message", kwargs={"pk": conv.pk}),
            {"content": "Hijack"},
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND
