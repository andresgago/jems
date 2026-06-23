from django.urls import path

from .views import ConversationViewSet

conversation_list = ConversationViewSet.as_view({"get": "list", "post": "create"})
conversation_detail = ConversationViewSet.as_view(
    {"get": "retrieve", "delete": "destroy"}
)
conversation_message = ConversationViewSet.as_view({"post": "send_message"})

urlpatterns = [
    path("conversations/", conversation_list, name="ai-conversation-list"),
    path("conversations/<int:pk>/", conversation_detail, name="ai-conversation-detail"),
    path(
        "conversations/<int:pk>/messages/",
        conversation_message,
        name="ai-conversation-message",
    ),
]
