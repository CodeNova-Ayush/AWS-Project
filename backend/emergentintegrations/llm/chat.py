"""
Local replacement for emergentintegrations.llm.chat
Supports OpenAI-compatible providers (Groq, Mistral, NVIDIA, OpenRouter, OpenAI, Custom) and Anthropic.
"""
import os
import logging
from typing import Optional
from anthropic import AsyncAnthropic
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)


class UserMessage:
    """Wrapper for user messages"""
    def __init__(self, text: str):
        self.text = text


class LlmChat:
    """
    LLM Chat wrapper supporting:
    - OpenAI, Groq, Mistral, NVIDIA, OpenRouter, Custom via AsyncOpenAI(api_key, base_url)
    - Anthropic via AsyncAnthropic(api_key)
    """
    def __init__(
        self,
        api_key: str = "",
        session_id: str = "",
        system_message: str = "",
        base_url: Optional[str] = None,
        provider: str = "openai",
        model: str = "gpt-4o-mini",
    ):
        self.api_key = api_key
        self.session_id = session_id
        self.system_message = system_message
        self.base_url = base_url
        self.provider = (provider or "openai").lower()
        if model in ("gpt-4.1-mini", "gpt-4.1"):
            self.model = "gpt-4o-mini"
        else:
            self.model = model or "gpt-4o-mini"

    def with_model(self, provider: str, model: str, base_url: Optional[str] = None):
        """
        Set the model and provider to use.
        """
        self.provider = provider.lower() if provider else "openai"
        if base_url:
            self.base_url = base_url

        # Map legacy / emergent aliases
        if model in ("gpt-4.1-mini", "gpt-4.1"):
            self.model = "gpt-4o-mini"
        elif model:
            self.model = model
        return self

    def with_base_url(self, base_url: str):
        self.base_url = base_url
        return self

    async def send_message(self, message: UserMessage) -> str:
        """
        Send a message and get AI response from the configured provider.
        """
        provider = self.provider

        if provider == "anthropic":
            api_key = self.api_key or os.getenv("ANTHROPIC_API_KEY", "")
            if not api_key:
                raise ValueError("No Anthropic API key provided. Please configure your Anthropic key in Profile settings.")

            client = AsyncAnthropic(api_key=api_key)
            response = await client.messages.create(
                model=self.model or "claude-3-5-sonnet-20241022",
                max_tokens=8096,
                system=self.system_message,
                messages=[
                    {"role": "user", "content": message.text}
                ]
            )
            return response.content[0].text

        else:
            # All other providers: OpenAI, Groq, Mistral, NVIDIA, OpenRouter, Custom
            api_key = self.api_key or os.getenv("OPENAI_API_KEY", "")
            if not api_key:
                raise ValueError(f"No API key provided for {provider.capitalize()}. Please configure your API key in Profile settings.")

            client_kwargs = {"api_key": api_key}
            if self.base_url:
                client_kwargs["base_url"] = self.base_url.rstrip("/")

            client = AsyncOpenAI(**client_kwargs)
            messages = []
            if self.system_message:
                messages.append({"role": "system", "content": self.system_message})
            messages.append({"role": "user", "content": message.text})

            response = await client.chat.completions.create(
                model=self.model or "gpt-4o-mini",
                messages=messages,
                max_tokens=4096,
            )
            return response.choices[0].message.content or ""
