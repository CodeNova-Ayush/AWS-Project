"""Key service — store and retrieve user API keys with Fernet symmetric encryption."""

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


def _cipher() -> Fernet:
    key = settings.fernet_secret_key
    if not key:
        raise RuntimeError("FERNET_SECRET_KEY is not set in .env")
    return Fernet(key.encode())


def encrypt_key(raw_key: str) -> str:
    """Encrypt a plaintext API key to a storable token."""
    return _cipher().encrypt(raw_key.encode()).decode()


def decrypt_key(encrypted_key: str) -> str:
    """Decrypt a stored token back to plaintext."""
    try:
        return _cipher().decrypt(encrypted_key.encode()).decode()
    except InvalidToken:
        raise ValueError("Failed to decrypt key — token invalid or key mismatch")


async def save_user_keys(db, user_id: str, openai_key: str = "", anthropic_key: str = "") -> None:
    """Encrypt and upsert user API keys in MongoDB."""
    update: dict = {}
    if openai_key:
        update["openai_key_enc"] = encrypt_key(openai_key)
    if anthropic_key:
        update["anthropic_key_enc"] = encrypt_key(anthropic_key)
    if update:
        await db.user_keys.update_one(
            {"user_id": user_id},
            {"$set": {"user_id": user_id, **update}},
            upsert=True,
        )


async def get_user_keys(db, user_id: str) -> dict:
    """
    Return decrypted keys for the user.
    Falls back to backend env keys if user has none stored.
    """
    import os
    doc = await db.user_keys.find_one({"user_id": user_id}, {"_id": 0})
    openai_key = os.environ.get("OPENAI_API_KEY", "")
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if doc:
        if doc.get("openai_key_enc"):
            try:
                openai_key = decrypt_key(doc["openai_key_enc"])
            except ValueError:
                pass
        if doc.get("anthropic_key_enc"):
            try:
                anthropic_key = decrypt_key(doc["anthropic_key_enc"])
            except ValueError:
                pass
    return {"openai_key": openai_key, "anthropic_key": anthropic_key}
