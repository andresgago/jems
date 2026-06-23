from __future__ import annotations

from django.conf import settings

from .models import Conversation, Message

SYSTEM_PROMPT = (
    "You are a helpful assistant for JEMS — a trucking management system. "
    "You help dispatchers, drivers, and managers with load planning, compliance, "
    "fleet status, and operational questions. Be concise and precise."
)

MODEL = "claude-sonnet-4-6"


def create_conversation(*, user: object, topic: str = "") -> Conversation:
    return Conversation.objects.create(user=user, topic=topic)


def send_message(*, conversation: Conversation, content: str) -> Message:
    """
    Append a user message, call Claude, append the assistant reply, return it.
    Raises RuntimeError if the ANTHROPIC_API_KEY env var is not set.
    """
    import anthropic

    api_key = settings.ANTHROPIC_API_KEY
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not configured.")

    Message.objects.create(
        conversation=conversation,
        role=Message.Role.USER,
        content=content,
    )

    history = [
        {"role": m.role, "content": m.content}
        for m in conversation.messages.all()
    ]

    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=history,
    )

    reply_text = response.content[0].text
    assistant_message = Message.objects.create(
        conversation=conversation,
        role=Message.Role.ASSISTANT,
        content=reply_text,
    )
    return assistant_message
