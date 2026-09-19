"""
Local replacement for emergentintegrations.llm.chat
Uses Anthropic SDK directly for local development
"""
import os
from anthropic import AsyncAnthropic


class UserMessage:
    """Wrapper for user messages"""
    def __init__(self, text: str):
        self.text = text


class LlmChat:
    """
    LLM Chat wrapper that mimics Emergent's LlmChat interface
    but uses Anthropic SDK directly
    """
    def __init__(self, api_key: str, session_id: str, system_message: str = ""):
        self.api_key = api_key
        self.session_id = session_id
        self.system_message = system_message
        self.model = "claude-sonnet-4-5-20250929"  # default model
        self.client = None

    def with_model(self, provider: str, model: str):
        """
        Set the model to use
        Args:
            provider: e.g., "anthropic"
            model: e.g., "claude-sonnet-4-5-20250929"
        """
        self.model = model
        return self

    async def send_message(self, message: UserMessage) -> str:
        """
        Send a message and get AI response
        Args:
            message: UserMessage instance with text
        Returns:
            AI response as string
        """
        # Initialize Anthropic client lazily
        if self.client is None:
            # Try to use ANTHROPIC_API_KEY from env, fallback to the api_key passed
            anthropic_key = os.getenv("ANTHROPIC_API_KEY") or self.api_key
            self.client = AsyncAnthropic(api_key=anthropic_key)

        # Create the message request
        response = await self.client.messages.create(
            model=self.model,
            max_tokens=8096,
            system=self.system_message,
            messages=[
                {"role": "user", "content": message.text}
            ]
        )

        # Extract and return the text content
        return response.content[0].text
