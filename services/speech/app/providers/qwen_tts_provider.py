import base64
import httpx


class QwenTtsProviderError(RuntimeError):
    pass


def synthesize_tts(text: str, api_key: str, base_url: str, endpoint: str, model: str, voice: str) -> dict:
    if not api_key:
        raise QwenTtsProviderError("Qwen TTS API key is missing")

    endpoint_candidates = _build_endpoint_candidates(base_url, endpoint)
    payload = {
        "model": model,
        "input": text,
        "voice": voice,
        "response_format": "wav"
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    last_error = ""
    with httpx.Client(timeout=30.0) as client:
        for endpoint_url in endpoint_candidates:
            response = client.post(endpoint_url, json=payload, headers=headers)

            if response.status_code == 404:
                last_error = f"404 at {endpoint_url}"
                continue

            if response.status_code >= 400:
                raise QwenTtsProviderError(f"Qwen TTS request failed: {response.status_code}")

            content_type = response.headers.get("content-type", "")

            if "application/json" in content_type:
                data = response.json()
                audio_base64 = data.get("audio") or data.get("audioBase64") or data.get("output", {}).get("audio")
                if not audio_base64:
                    raise QwenTtsProviderError("Qwen TTS response missing audio content")
                return {
                    "audioBase64": str(audio_base64),
                    "format": "wav",
                    "provider": "qwen-tts"
                }

            return {
                "audioBase64": base64.b64encode(response.content).decode("utf-8"),
                "format": "wav",
                "provider": "qwen-tts"
            }

    raise QwenTtsProviderError(f"Qwen TTS endpoint not found. {last_error}")


def _build_endpoint_candidates(base_url: str, endpoint: str) -> list[str]:
    candidates: list[str] = []

    if endpoint.startswith("http://") or endpoint.startswith("https://"):
        candidates.append(endpoint)
    else:
        endpoint_path = endpoint if endpoint.startswith("/") else f"/{endpoint}"
        candidates.append(f"{base_url.rstrip('/')}{endpoint_path}")

    legacy = f"{base_url.rstrip('/')}/audio/speech"
    if legacy not in candidates:
        candidates.append(legacy)

    return candidates
