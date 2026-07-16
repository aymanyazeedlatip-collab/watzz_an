"""Validated request and response shapes for the WATTZAN Gemini assistant."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class ChatbotHistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=4000)

    @field_validator("content")
    @classmethod
    def strip_content(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Chat message content cannot be empty.")
        return cleaned


class ChatbotMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=3000)
    history: list[ChatbotHistoryMessage] = Field(default_factory=list, max_length=12)
    context: dict[str, Any] = Field(default_factory=dict)
    current_page: str | None = Field(default=None, max_length=100)

    @field_validator("message")
    @classmethod
    def strip_message(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Message cannot be empty.")
        return cleaned


class ChatbotUsage(BaseModel):
    prompt_tokens: int | None = None
    response_tokens: int | None = None
    thinking_tokens: int | None = None
    total_tokens: int | None = None


class ChatbotMessageResponse(BaseModel):
    reply: str
    model: str
    provider: str = "Google Gemini API"
    context_used: bool
    usage: ChatbotUsage | None = None
    finish_reason: str | None = None
    retried_for_length: bool = False
    data_notice: str
