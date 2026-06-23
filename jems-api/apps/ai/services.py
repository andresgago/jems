from __future__ import annotations

from typing import Literal, cast

import anthropic
from django.conf import settings

from apps.users.models import User

from .models import Conversation, Message

SYSTEM_PROMPT = (
    "You are a helpful assistant for JEMS — a trucking management system. "
    "You help dispatchers, drivers, and managers with load planning, compliance, "
    "fleet status, and operational questions. Be concise and precise."
)

MODEL = "claude-sonnet-4-6"


def create_conversation(*, user: User, topic: str = "") -> Conversation:
    return Conversation.objects.create(user=user, topic=topic)


def send_message(*, conversation: Conversation, content: str) -> Message:
    """
    Append a user message, call Claude, append the assistant reply, return it.
    Raises RuntimeError if the ANTHROPIC_API_KEY env var is not set.
    """
    api_key = settings.ANTHROPIC_API_KEY
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not configured.")

    Message.objects.create(
        conversation=conversation,
        role=Message.Role.USER,
        content=content,
    )

    history: list[anthropic.types.MessageParam] = [
        {"role": cast(Literal["user", "assistant"], m.role), "content": m.content}
        for m in conversation.messages.all()
    ]

    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=history,
    )

    first_block = response.content[0]
    reply_text = (
        first_block.text if isinstance(first_block, anthropic.types.TextBlock) else ""
    )
    assistant_message = Message.objects.create(
        conversation=conversation,
        role=Message.Role.ASSISTANT,
        content=reply_text,
    )
    return assistant_message
