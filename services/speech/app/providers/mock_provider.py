import base64


def mock_stt(_: str) -> dict:
    return {
        "text": "Hello, I would like a medium latte and a blueberry muffin.",
        "confidence": 0.94,
        "provider": "mock"
    }


def mock_score(reference_text: str) -> dict:
    length_penalty = 0 if len(reference_text.split()) >= 4 else 5
    base = 84 - length_penalty

    return {
        "overall": base,
        "accuracy": base + 2,
        "fluency": base - 1,
        "completeness": base,
        "prosody": base - 2,
        "provider": "mock"
    }


def mock_tts(text: str) -> dict:
    fake_audio = base64.b64encode(f"MOCK_TTS::{text}".encode("utf-8")).decode("utf-8")
    return {
        "audioBase64": fake_audio,
        "format": "wav",
        "provider": "mock"
    }
