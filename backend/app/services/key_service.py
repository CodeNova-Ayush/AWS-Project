"""Key service — store and retrieve user API keys with Fernet symmetric encryption.
Supports dynamic multi-provider configuration (Groq, Mistral, NVIDIA, OpenRouter, OpenAI, Anthropic, Custom).
"""

from typing import Dict, Optional, Any
from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

FALLBACK_FERNET_KEY = b"7DyOuYlPbHJUI1v4m2GvTnwe-gYAMAm6VaMzPLDug4Q="

DEFAULT_PROVIDER_CONFIGS: Dict[str, Dict[str, str]] = {
    "openai": {
        "name": "OpenAI",
        "base_url": "https://api.openai.com/v1",
        "default_model": "gpt-4o-mini",
    },
    "groq": {
        "name": "Groq",
        "base_url": "https://api.groq.com/openai/v1",
        "default_model": "llama-3.1-8b-instant",
    },
    "mistral": {
        "name": "Mistral AI",
        "base_url": "https://api.mistral.ai/v1",
        "default_model": "codestral-latest",
    },
    "nvidia": {
        "name": "NVIDIA NIM",
        "base_url": "https://integrate.api.nvidia.com/v1",
        "default_model": "meta/llama-3.1-70b-instruct",
    },
    "openrouter": {
        "name": "OpenRouter",
        "base_url": "https://openrouter.ai/api/v1",
        "default_model": "anthropic/claude-3.5-sonnet",
    },
    "anthropic": {
        "name": "Anthropic",
        "base_url": "",
        "default_model": "claude-3-5-sonnet-20241022",
    },
    "custom": {
        "name": "Custom / Self-Hosted",
        "base_url": "",
        "default_model": "",
    },
}


def _cipher() -> Fernet:
    key = settings.fernet_secret_key
    if key:
        try:
            return Fernet(key.encode())
        except Exception:
            pass
    return Fernet(FALLBACK_FERNET_KEY)


def encrypt_key(raw_key: str) -> str:
    """Encrypt a plaintext API key to a storable token."""
    return _cipher().encrypt(raw_key.strip().encode()).decode()


def decrypt_key(encrypted_key: str) -> str:
    """Decrypt a stored token back to plaintext."""
    try:
        return _cipher().decrypt(encrypted_key.encode()).decode()
    except InvalidToken:
        raise ValueError("Failed to decrypt key — token invalid or key mismatch")


async def save_provider_key(
    db,
    user_id: str,
    provider: str,
    api_key: str,
    model: str = "",
    base_url: str = "",
    set_active: bool = True,
) -> None:
    """Save an encrypted API key and config for a specific provider."""
    provider = provider.lower().strip()
    preset = DEFAULT_PROVIDER_CONFIGS.get(provider, {})
    resolved_base_url = base_url.strip() or preset.get("base_url", "")
    resolved_model = model.strip() or preset.get("default_model", "")

    update_fields: Dict[str, Any] = {
        f"providers.{provider}.api_key_enc": encrypt_key(api_key),
        f"providers.{provider}.base_url": resolved_base_url,
        f"providers.{provider}.model": resolved_model,
    }

    # Also keep legacy keys in sync for backwards compatibility
    if provider == "openai":
        update_fields["openai_key_enc"] = encrypt_key(api_key)
    elif provider == "anthropic":
        update_fields["anthropic_key_enc"] = encrypt_key(api_key)

    if set_active:
        update_fields["active_provider"] = provider
        update_fields["active_model"] = resolved_model

    await db.user_keys.update_one(
        {"user_id": user_id},
        {"$set": {"user_id": user_id, **update_fields}},
        upsert=True,
    )


async def set_active_provider(db, user_id: str, provider: str, model: str = "") -> None:
    """Set the user's active provider and model for AI generation."""
    provider = provider.lower().strip()
    preset = DEFAULT_PROVIDER_CONFIGS.get(provider, {})
    resolved_model = model.strip() or preset.get("default_model", "")

    update: Dict[str, Any] = {"active_provider": provider}
    if resolved_model:
        update["active_model"] = resolved_model

    await db.user_keys.update_one(
        {"user_id": user_id},
        {"$set": update},
        upsert=True,
    )


async def delete_provider_key(db, user_id: str, provider: str) -> None:
    """Remove a specific provider key."""
    provider = provider.lower().strip()
    unset_fields = {f"providers.{provider}": ""}
    if provider == "openai":
        unset_fields["openai_key_enc"] = ""
    elif provider == "anthropic":
        unset_fields["anthropic_key_enc"] = ""

    await db.user_keys.update_one(
        {"user_id": user_id},
        {"$unset": unset_fields},
    )

    # If the active provider was deleted, reset active_provider
    doc = await db.user_keys.find_one({"user_id": user_id})
    if doc and doc.get("active_provider") == provider:
        remaining = doc.get("providers", {})
        new_active = next((p for p, data in remaining.items() if data.get("api_key_enc")), "")
        new_model = remaining.get(new_active, {}).get("model", "") if new_active else ""
        await db.user_keys.update_one(
            {"user_id": user_id},
            {"$set": {"active_provider": new_active, "active_model": new_model}},
        )


async def get_provider_config(db, user_id: str, provider: Optional[str] = None) -> Dict[str, Any]:
    """
    Return decrypted API key, base_url, and model for requested provider or currently active provider.
    Falls back to environment variables if no user key is found.
    """
    import os
    doc = await db.user_keys.find_one({"user_id": user_id}, {"_id": 0}) or {}
    providers = doc.get("providers", {})

    target_provider = (provider or doc.get("active_provider") or "").lower().strip()

    # If no target specified or active, select first available configured provider
    if not target_provider or target_provider not in providers:
        if "openai_key_enc" in doc or "openai" in providers:
            target_provider = "openai"
        elif "anthropic_key_enc" in doc or "anthropic" in providers:
            target_provider = "anthropic"
        elif providers:
            target_provider = next(iter(providers))
        elif os.environ.get("OPENAI_API_KEY"):
            target_provider = "openai"
        elif os.environ.get("ANTHROPIC_API_KEY"):
            target_provider = "anthropic"
        else:
            target_provider = "openai"

    preset = DEFAULT_PROVIDER_CONFIGS.get(target_provider, {})
    p_data = providers.get(target_provider, {})

    api_key = ""
    if p_data.get("api_key_enc"):
        try:
            api_key = decrypt_key(p_data["api_key_enc"])
        except ValueError:
            pass

    # Backwards compatibility check
    if not api_key:
        if target_provider == "openai" and doc.get("openai_key_enc"):
            try:
                api_key = decrypt_key(doc["openai_key_enc"])
            except ValueError:
                pass
        elif target_provider == "anthropic" and doc.get("anthropic_key_enc"):
            try:
                api_key = decrypt_key(doc["anthropic_key_enc"])
            except ValueError:
                pass

    # Env fallback if still missing
    if not api_key:
        if target_provider == "openai":
            api_key = os.environ.get("OPENAI_API_KEY", "")
        elif target_provider == "anthropic":
            api_key = os.environ.get("ANTHROPIC_API_KEY", "")

    base_url = p_data.get("base_url") or preset.get("base_url", "")
    model = p_data.get("model") or preset.get("default_model", "")
    if doc.get("active_model") and target_provider == doc.get("active_provider"):
        model = doc.get("active_model")

    return {
        "provider": target_provider,
        "api_key": api_key,
        "base_url": base_url,
        "model": model,
    }


async def get_user_providers_status(db, user_id: str) -> Dict[str, Any]:
    """Return status of all configured providers, active provider, and models."""
    doc = await db.user_keys.find_one({"user_id": user_id}, {"_id": 0}) or {}
    providers = doc.get("providers", {})

    status_map: Dict[str, Any] = {}
    for prov_id, preset in DEFAULT_PROVIDER_CONFIGS.items():
        p_data = providers.get(prov_id, {})
        has_key = bool(p_data.get("api_key_enc"))
        if not has_key:
            if prov_id == "openai" and doc.get("openai_key_enc"):
                has_key = True
            elif prov_id == "anthropic" and doc.get("anthropic_key_enc"):
                has_key = True

        status_map[prov_id] = {
            "configured": has_key,
            "name": preset.get("name", prov_id.capitalize()),
            "base_url": p_data.get("base_url") or preset.get("base_url", ""),
            "model": p_data.get("model") or preset.get("default_model", ""),
        }

    # Also include any custom provider names not in preset list
    for prov_id, p_data in providers.items():
        if prov_id not in status_map and p_data.get("api_key_enc"):
            status_map[prov_id] = {
                "configured": True,
                "name": prov_id.capitalize(),
                "base_url": p_data.get("base_url", ""),
                "model": p_data.get("model", ""),
            }

    active_provider = doc.get("active_provider") or ("openai" if status_map.get("openai", {}).get("configured") else next((p for p, d in status_map.items() if d.get("configured")), "openai"))
    active_model = doc.get("active_model") or status_map.get(active_provider, {}).get("model", "")

    return {
        "providers": status_map,
        "active_provider": active_provider,
        "active_model": active_model,
        # Legacy fields:
        "has_openai_key": status_map.get("openai", {}).get("configured", False),
        "has_anthropic_key": status_map.get("anthropic", {}).get("configured", False),
    }


# ──── Legacy functions for backward compatibility ────

async def save_user_keys(db, user_id: str, openai_key: str = "", anthropic_key: str = "") -> None:
    """Legacy encryption and upsert of OpenAI / Anthropic keys."""
    if openai_key:
        await save_provider_key(db, user_id, "openai", openai_key, set_active=True)
    if anthropic_key:
        await save_provider_key(db, user_id, "anthropic", anthropic_key, set_active=not bool(openai_key))


async def get_user_keys(db, user_id: str) -> dict:
    """Legacy helper returning decrypted openai and anthropic keys."""
    import os
    cfg_openai = await get_provider_config(db, user_id, "openai")
    cfg_anthropic = await get_provider_config(db, user_id, "anthropic")
    return {
        "openai_key": cfg_openai.get("api_key") or os.environ.get("OPENAI_API_KEY", ""),
        "anthropic_key": cfg_anthropic.get("api_key") or os.environ.get("ANTHROPIC_API_KEY", ""),
    }


# ──── Dynamic Model Discovery & Live Fetching ────

CURATED_FALLBACK_MODELS: Dict[str, list] = {
    "mistral": [
        {"id": "codestral-latest", "name": "Codestral Latest", "tag": "Code Specialist", "description": "Cutting-edge model for code completion and review"},
        {"id": "mistral-small-latest", "name": "Mistral Small Latest", "tag": "Fast & Light", "description": "High speed, low latency reasoning"},
        {"id": "ministral-8b-latest", "name": "Ministral 8B", "tag": "Ultra-Fast", "description": "Super-fast lightweight model"},
        {"id": "open-mistral-7b", "name": "Mistral 7B (Open)", "tag": "Free Tier", "description": "Open weights general purpose model"},
        {"id": "mistral-large-latest", "name": "Mistral Large Latest", "tag": "Paid Tier", "description": "Flagship reasoning (requires paid subscription)"},
    ],
    "groq": [
        {"id": "llama-3.1-8b-instant", "name": "Llama 3.1 8B Instant", "tag": "Ultra-Fast", "description": "High speed inference via Groq LPU"},
        {"id": "qwen/qwen3.8-27b", "name": "Qwen 3.8 27B", "tag": "Recommended", "description": "Powerful open reasoning model on Groq"},
        {"id": "openai/gpt-oss-120b", "name": "GPT-OSS 120B", "tag": "Deep Reasoning", "description": "High parameter reasoning model on Groq"},
        {"id": "llama-3.3-70b-versatile", "name": "Llama 3.3 70B", "tag": "Versatile", "description": "General purpose 70B parameter model"},
    ],
    "openai": [
        {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "tag": "Recommended", "description": "Fast, smart, and cost-effective"},
        {"id": "gpt-4o", "name": "GPT-4o", "tag": "Flagship", "description": "Most versatile multimodal reasoning model"},
        {"id": "o3-mini", "name": "o3 Mini", "tag": "Reasoning", "description": "High intelligence STEM and coding model"},
    ],
    "nvidia": [
        {"id": "meta/llama-3.1-70b-instruct", "name": "Llama 3.1 70B Instruct", "tag": "Recommended", "description": "Accelerated NIM inference"},
        {"id": "mistralai/mixtral-8x22b-instruct-v0.1", "name": "Mixtral 8x22B", "tag": "High Capacity", "description": "Sparse mixture of experts"},
        {"id": "nvidia/nemotron-4-340b-instruct", "name": "Nemotron 4 340B", "tag": "Enterprise", "description": "NVIDIA frontier enterprise model"},
    ],
    "openrouter": [
        {"id": "anthropic/claude-3.5-sonnet", "name": "Claude 3.5 Sonnet", "tag": "Top for Code", "description": "Premier model for engineering"},
        {"id": "deepseek/deepseek-r1", "name": "DeepSeek R1", "tag": "Reasoning Champion", "description": "Open reasoning flagship"},
        {"id": "google/gemini-2.0-flash-exp", "name": "Gemini 2.0 Flash", "tag": "Fast Multimodal", "description": "Google next-gen low latency model"},
    ],
    "anthropic": [
        {"id": "claude-3-5-sonnet-20241022", "name": "Claude 3.5 Sonnet", "tag": "Recommended", "description": "State-of-the-art coding and agent model"},
        {"id": "claude-3-5-haiku-20241022", "name": "Claude 3.5 Haiku", "tag": "Fast & Efficient", "description": "High speed and responsiveness"},
        {"id": "claude-3-opus-20240229", "name": "Claude 3 Opus", "tag": "Deep Thought", "description": "Complex analysis and reasoning"},
    ],
    "custom": [
        {"id": "default", "name": "Default Model", "tag": "Custom", "description": "Default model for custom endpoint"},
    ],
}


def _tag_for_model(model_id: str) -> str:
    m = model_id.lower()
    if "code" in m:
        return "Coding Specialist"
    if "mini" in m or "small" in m or "8b" in m or "haiku" in m:
        return "Fast & Light"
    if "large" in m or "opus" in m or "405b" in m or "120b" in m:
        return "Heavy / Flagship"
    if "instruct" in m or "chat" in m or "sonnet" in m or "4o" in m:
        return "Recommended"
    return "General"


async def fetch_provider_models(
    db,
    user_id: str,
    provider: str,
    api_key: str = "",
    base_url: str = "",
) -> Dict[str, Any]:
    """Fetch real-time available models from the provider API, falling back to curated presets."""
    import httpx
    import logging
    log = logging.getLogger(__name__)

    provider = provider.lower().strip()
    preset = DEFAULT_PROVIDER_CONFIGS.get(provider, {})

    # Resolve API key and Base URL
    if not api_key:
        cfg = await get_provider_config(db, user_id, provider)
        api_key = cfg.get("api_key", "")
    resolved_base_url = (base_url.strip() or preset.get("base_url", "")).rstrip("/")

    fallbacks = CURATED_FALLBACK_MODELS.get(provider, CURATED_FALLBACK_MODELS["custom"])
    default_model = preset.get("default_model", fallbacks[0]["id"] if fallbacks else "")

    if not api_key:
        return {
            "provider": provider,
            "is_live": False,
            "models": fallbacks,
            "default_model": default_model,
            "message": "Enter your API key to fetch live models available on your account.",
        }

    # Live endpoints mapping
    models_url = ""
    headers = {"Authorization": f"Bearer {api_key}"}

    if provider == "mistral":
        models_url = "https://api.mistral.ai/v1/models"
    elif provider == "groq":
        models_url = "https://api.groq.com/openai/v1/models"
    elif provider == "openai":
        models_url = "https://api.openai.com/v1/models"
    elif provider == "nvidia":
        models_url = "https://integrate.api.nvidia.com/v1/models"
    elif provider == "openrouter":
        models_url = "https://openrouter.ai/api/v1/models"
    elif provider == "custom" and resolved_base_url:
        models_url = f"{resolved_base_url}/models"

    if not models_url:
        # Anthropic or providers without a public list endpoint
        return {
            "provider": provider,
            "is_live": False,
            "models": fallbacks,
            "default_model": default_model,
            "message": "Curated models for this provider",
        }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(models_url, headers=headers)
            if resp.status_code == 200:
                raw_data = resp.json().get("data", [])
                formatted = []
                for item in raw_data:
                    m_id = item.get("id") or ""
                    if not m_id:
                        continue
                    # Exclude non-chat / whisper audio models unless necessary
                    if any(x in m_id.lower() for x in ["whisper", "tts", "embedding", "moderation", "guard"]):
                        continue
                    
                    name = item.get("name") or m_id
                    desc = item.get("description") or f"{provider.capitalize()} model: {m_id}"
                    tag = _tag_for_model(m_id)
                    formatted.append({
                        "id": m_id,
                        "name": name,
                        "description": desc,
                        "tag": tag,
                    })

                # Sort models: Coding & Recommended first, then alphabetically
                def sort_key(x):
                    t = x["tag"]
                    if "Coding" in t:
                        return (0, x["id"])
                    if "Recommended" in t:
                        return (1, x["id"])
                    if "Fast" in t:
                        return (2, x["id"])
                    return (3, x["id"])

                formatted.sort(key=sort_key)

                if formatted:
                    # Pick best default model
                    top_default = formatted[0]["id"]
                    for candidate in formatted:
                        if "code" in candidate["id"].lower():
                            top_default = candidate["id"]
                            break
                    return {
                        "provider": provider,
                        "is_live": True,
                        "count": len(formatted),
                        "models": formatted,
                        "default_model": top_default,
                        "message": f"Successfully loaded {len(formatted)} live models from {provider.capitalize()} API",
                    }
            elif resp.status_code in (401, 403):
                log.warning("API key rejected while fetching models for %s: %s", provider, resp.status_code)
                return {
                    "provider": provider,
                    "is_live": False,
                    "models": fallbacks,
                    "default_model": default_model,
                    "error": f"Invalid or restricted API key ({resp.status_code})",
                    "message": "API key was not accepted by the provider. Showing standard presets.",
                }
    except Exception as exc:
        log.warning("Failed to fetch live models for %s: %s", provider, exc)

    return {
        "provider": provider,
        "is_live": False,
        "models": fallbacks,
        "default_model": default_model,
        "message": "Could not reach live models endpoint. Using curated presets.",
    }


async def test_provider_connection(
    db,
    user_id: str,
    provider: str,
    api_key: str = "",
    model: str = "",
    base_url: str = "",
) -> Dict[str, Any]:
    """Perform a lightweight test chat completion with the given or saved credentials."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    provider = provider.lower().strip()
    preset = DEFAULT_PROVIDER_CONFIGS.get(provider, {})
    if not api_key:
        cfg = await get_provider_config(db, user_id, provider)
        api_key = cfg.get("api_key", "")

    if not api_key:
        return {"success": False, "error": f"No API key provided or found for {provider.capitalize()}"}

    resolved_base_url = base_url.strip() or preset.get("base_url", "")
    resolved_model = model.strip() or preset.get("default_model", "")

    try:
        chat = LlmChat(
            api_key=api_key,
            provider=provider,
            model=resolved_model,
            base_url=resolved_base_url or None,
        )
        reply = await chat.send_message(UserMessage(text="Ping. Respond with 'OK' only."))
        return {
            "success": True,
            "message": f"Connection verified! Model '{resolved_model}' responded successfully: {reply.strip()[:60]}",
            "provider": provider,
            "model": resolved_model,
        }
    except Exception as exc:
        return {
            "success": False,
            "error": str(exc),
            "provider": provider,
            "model": resolved_model,
        }

