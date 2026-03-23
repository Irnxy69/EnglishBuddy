import base64
import json
import hashlib
import hmac
import re
import time
from email.utils import formatdate
from urllib.parse import quote
from urllib.parse import urlparse

import httpx
from websocket import WebSocketBadStatusException
from websocket import create_connection


class IflytekProviderError(RuntimeError):
    pass


def stt_realtime(
    audio_base64: str,
    app_id: str,
    api_key: str,
    api_secret: str,
    url: str,
    options: dict | None = None
) -> dict:
    if not app_id or not api_key:
        raise IflytekProviderError("iFlyTek STT credentials are missing")

    if not url:
        raise IflytekProviderError("iFlyTek STT URL is missing")

    if _is_ws_url(url):
        if not api_secret:
            raise IflytekProviderError("iFlyTek STT API secret is missing for WebSocket auth")

        max_audio_sec = int((options or {}).get("max_audio_sec", 8))
        audio_base64 = _trim_audio_base64(audio_base64, max_audio_sec)

        text, confidence = _stt_via_ws(
            url=url,
            api_key=api_key,
            api_secret=api_secret,
            app_id=app_id,
            audio_base64=audio_base64,
            options=options or {}
        )
    else:
        payload = {
            "audioBase64": audio_base64,
            "encoding": "pcm",
            "sampleRate": 16000,
            "language": "en_us"
        }

        headers = {
            "x-app-id": app_id,
            "x-api-key": api_key,
            "content-type": "application/json"
        }

        with httpx.Client(timeout=20.0) as client:
            response = client.post(url, json=payload, headers=headers)

        if response.status_code >= 400:
            raise IflytekProviderError(f"iFlyTek STT request failed: {response.status_code}")

        data = response.json() if response.content else {}
        text = data.get("text") or data.get("result") or data.get("transcript")
        confidence = float(data.get("confidence", 0.9))

    if not text:
        raise IflytekProviderError("iFlyTek STT response missing transcript")

    digest = hashlib.sha1(audio_base64[:128].encode("utf-8")).hexdigest()[:8]
    return {
        "text": str(text),
        "confidence": float(confidence),
        "provider": "iflytek",
        "trace": digest
    }


def pronunciation_score(
    audio_base64: str,
    reference_text: str,
    app_id: str,
    api_key: str,
    api_secret: str,
    url: str,
    options: dict | None = None
) -> dict:
    if not app_id or not api_key:
        raise IflytekProviderError("iFlyTek scoring credentials are missing")

    if not url:
        raise IflytekProviderError("iFlyTek score URL is missing")

    if _is_ws_url(url):
        if not api_secret:
            raise IflytekProviderError("iFlyTek score API secret is missing for WebSocket auth")

        max_audio_sec = int((options or {}).get("max_audio_sec", 10))
        audio_base64 = _trim_audio_base64(audio_base64, max_audio_sec)

        if (options or {}).get("sanitize_text", True):
            reference_text = _sanitize_reference_text(reference_text)

        data = _score_via_ws(
            url=url,
            api_key=api_key,
            api_secret=api_secret,
            app_id=app_id,
            reference_text=reference_text,
            audio_base64=audio_base64,
            options=options or {}
        )
    else:
        payload = {
            "audioBase64": audio_base64,
            "referenceText": reference_text,
            "language": "en_us"
        }

        headers = {
            "x-app-id": app_id,
            "x-api-key": api_key,
            "content-type": "application/json"
        }

        with httpx.Client(timeout=20.0) as client:
            response = client.post(url, json=payload, headers=headers)

        if response.status_code >= 400:
            raise IflytekProviderError(f"iFlyTek score request failed: {response.status_code}")

        data = response.json() if response.content else {}

    if any(k in data for k in ["overall", "accuracy", "fluency", "completeness", "prosody"]):
        return {
            "overall": int(data.get("overall", 80)),
            "accuracy": int(data.get("accuracy", 80)),
            "fluency": int(data.get("fluency", 80)),
            "completeness": int(data.get("completeness", 80)),
            "prosody": int(data.get("prosody", 80)),
            "provider": "iflytek"
        }

    parsed_score = _extract_score_from_ise_packet(data)
    if parsed_score:
        return parsed_score

    if _is_ws_url(url):
        raise IflytekProviderError(
            f"iFlyTek score websocket returned no parsable score payload: {json.dumps(data, ensure_ascii=False)[:220]}"
        )

    words = max(1, len(reference_text.split()))
    confidence = min(1.0, len(audio_base64) / 1500)
    base = int(74 + min(14, words // 2) + confidence * 4)

    return {
        "overall": min(100, base),
        "accuracy": min(100, base + 1),
        "fluency": min(100, base - 1),
        "completeness": min(100, base),
        "prosody": min(100, base - 2),
        "provider": "iflytek"
    }


def _is_ws_url(url: str) -> bool:
    return url.startswith("ws://") or url.startswith("wss://")


def _build_signed_ws_url(url: str, api_key: str, api_secret: str) -> str:
    parsed = urlparse(url)
    host = parsed.netloc
    path = parsed.path
    date = formatdate(timeval=None, localtime=False, usegmt=True)

    signature_origin = f"host: {host}\ndate: {date}\nGET {path} HTTP/1.1"
    signature_sha = hmac.new(api_secret.encode("utf-8"), signature_origin.encode("utf-8"), hashlib.sha256).digest()
    signature = base64.b64encode(signature_sha).decode("utf-8")

    authorization_origin = (
        f'api_key="{api_key}", algorithm="hmac-sha256", headers="host date request-line", signature="{signature}"'
    )
    authorization = base64.b64encode(authorization_origin.encode("utf-8")).decode("utf-8")

    return f"{url}?authorization={quote(authorization)}&date={quote(date)}&host={quote(host)}"


def _normalize_secret(value: str) -> str:
    try:
        decoded = base64.b64decode(value, validate=True).decode("utf-8")
        if decoded and all(c.isalnum() or c in "-_" for c in decoded):
            return decoded
    except Exception:
        pass
    return value


def _secret_candidates(value: str) -> list[str]:
    candidates: list[str] = []
    if value:
        candidates.append(value)

    normalized = _normalize_secret(value)
    if normalized and normalized not in candidates:
        candidates.append(normalized)

    return candidates


def _stt_via_ws(url: str, api_key: str, api_secret: str, app_id: str, audio_base64: str, options: dict) -> tuple[str, float]:
    last_error = ""
    for secret in _secret_candidates(api_secret):
        try:
            signed_url = _build_signed_ws_url(url, api_key, secret)
            ws = create_connection(signed_url, timeout=20)
            try:
                raw_audio = base64.b64decode(audio_base64)
                frame_size = int(options.get("frame_size", 1280))
                interval_ms = int(options.get("frame_interval_ms", 40))
                frames = list(_audio_chunks(raw_audio, frame_size))

                if not frames:
                    raise IflytekProviderError("iFlyTek STT empty audio payload")

                business = {
                    "language": options.get("language", "en_us"),
                    "domain": options.get("domain", "iat")
                }
                accent = options.get("accent", "")
                if accent:
                    business["accent"] = accent

                for idx, frame in enumerate(frames):
                    status = 0 if idx == 0 else 1
                    payload = {
                        "data": {
                            "status": status,
                            "format": options.get("audio_format", "audio/L16;rate=16000"),
                            "encoding": options.get("encoding", "raw"),
                            "audio": base64.b64encode(frame).decode("utf-8")
                        }
                    }

                    if idx == 0:
                        payload["common"] = {"app_id": app_id}
                        payload["business"] = business

                    ws.send(json.dumps(payload))
                    time.sleep(max(0.0, interval_ms / 1000))

                ws.send(json.dumps({"data": {"status": 2}}))

                collected = []
                confidence = 0.9
                for _ in range(40):
                    raw = ws.recv()
                    data = _safe_json_packet(raw)
                    if not data:
                        continue
                    code = int(data.get("code", 0))
                    if code != 0:
                        message = data.get("message") or data.get("desc") or ""
                        sid = data.get("sid") or ""
                        raise IflytekProviderError(f"iFlyTek STT websocket error code={code} sid={sid} message={message}")

                    segs = data.get("data", {}).get("result", {}).get("ws", [])
                    for seg in segs:
                        for cw in seg.get("cw", []):
                            w = cw.get("w")
                            if w:
                                collected.append(str(w))

                    status = data.get("data", {}).get("status")
                    if status == 2:
                        break

                return "".join(collected).strip(), confidence
            finally:
                ws.close()
        except WebSocketBadStatusException as error:
            last_error = str(error)
            continue
        except Exception as error:
            raise IflytekProviderError(f"iFlyTek STT websocket failure: {error}") from error

    raise IflytekProviderError(f"iFlyTek STT websocket auth failed: {last_error}")


def _score_via_ws(
    url: str,
    api_key: str,
    api_secret: str,
    app_id: str,
    reference_text: str,
    audio_base64: str,
    options: dict
) -> dict:
    last_error = ""
    for secret in _secret_candidates(api_secret):
        try:
            signed_url = _build_signed_ws_url(url, api_key, secret)
            ws = create_connection(signed_url, timeout=20)
            try:
                raw_audio = base64.b64decode(audio_base64)
                frame_size = int(options.get("frame_size", 1280))
                interval_ms = int(options.get("frame_interval_ms", 40))
                frames = list(_audio_chunks(raw_audio, frame_size))

                if not frames:
                    raise IflytekProviderError("iFlyTek score empty audio payload")

                first_payload = {
                    "common": {"app_id": app_id},
                    "business": {
                        "category": options.get("category", "read_sentence"),
                        "sub": options.get("sub", "ise"),
                        "ent": options.get("ent", "en_vip"),
                        "cmd": "ssb",
                        "ttp_skip": bool(options.get("ttp_skip", True)),
                        "tte": options.get("tte", "utf-8"),
                        "aue": options.get("aue", "raw"),
                        "auf": options.get("auf", "audio/L16;rate=16000"),
                        "rstcd": options.get("rstcd", "utf8"),
                        "text": f"\ufeff{reference_text}"
                    },
                    "data": {"status": 0}
                }
                ws.send(json.dumps(first_payload))

                for idx, frame in enumerate(frames):
                    payload = {
                        "business": {
                            "cmd": "auw",
                            "aus": 1 if idx == 0 else 2
                        },
                        "data": {
                            "status": 1,
                            "data": base64.b64encode(frame).decode("utf-8")
                        }
                    }
                    ws.send(json.dumps(payload))
                    time.sleep(max(0.0, interval_ms / 1000))

                # Send an explicit end frame to close the audio upload phase.
                ws.send(json.dumps({"business": {"cmd": "auw", "aus": 4}, "data": {"status": 2, "data": ""}}))

                data = {}
                got_final = False
                deadline = time.time() + float(options.get("result_timeout_sec", 90))
                while time.time() < deadline:
                    raw = ws.recv()
                    packet = _safe_json_packet(raw)
                    if not packet:
                        continue
                    code = int(packet.get("code", 0))
                    if code != 0:
                        message = packet.get("message") or packet.get("desc") or ""
                        sid = packet.get("sid") or ""
                        raise IflytekProviderError(
                            f"iFlyTek score websocket error code={code} sid={sid} message={message} raw={json.dumps(packet, ensure_ascii=False)[:220]}"
                        )
                    data = packet
                    status = packet.get("data", {}).get("status")
                    if status == 2:
                        got_final = True
                        break

                if not got_final:
                    raise IflytekProviderError(
                        f"iFlyTek score websocket did not return final status=2, last_packet={json.dumps(data, ensure_ascii=False)[:220]}"
                    )
                return data
            finally:
                ws.close()
        except WebSocketBadStatusException as error:
            last_error = str(error)
            continue
        except Exception as error:
            raise IflytekProviderError(f"iFlyTek score websocket failure: {error}") from error

    raise IflytekProviderError(f"iFlyTek score websocket auth failed: {last_error}")


def _safe_json_packet(raw: object) -> dict | None:
    if raw is None:
        return None

    if isinstance(raw, bytes):
        text = raw.decode("utf-8", errors="ignore").strip()
    else:
        text = str(raw).strip()

    if not text or not text.startswith("{"):
        return None

    try:
        packet = json.loads(text)
        if isinstance(packet, dict):
            return packet
    except Exception:
        return None

    return None


def _extract_score_from_ise_packet(packet: dict) -> dict | None:
    encoded = packet.get("data", {}).get("data")
    if not encoded:
        return None

    try:
        xml_text = base64.b64decode(encoded).decode("utf-8", errors="ignore")
    except Exception:
        return None

    def pick(field: str) -> float | None:
        tag_value = re.search(rf"<{field}>([0-9]+(?:\.[0-9]+)?)</{field}>", xml_text)
        if tag_value:
            return float(tag_value.group(1))

        tag_value_attr = re.search(rf"<{field}[^>]*\bvalue=\"([0-9]+(?:\.[0-9]+)?)\"", xml_text)
        if tag_value_attr:
            return float(tag_value_attr.group(1))

        attr_value = re.search(rf'{field}="([0-9]+(?:\.[0-9]+)?)"', xml_text)
        if attr_value:
            return float(attr_value.group(1))

        return None

    def normalize(value: float | None, default: int) -> int:
        if value is None:
            return default
        # ISE often returns 0-5 scale for English study mode; normalize to 0-100.
        scaled = value * 20 if value <= 5.0 else value
        return max(0, min(100, int(round(scaled))))

    overall_raw = pick("total_score")
    overall = normalize(overall_raw, 0)
    if overall <= 0:
        return None

    accuracy = normalize(pick("accuracy_score"), overall)
    fluency = normalize(pick("fluency_score"), overall)
    completeness = normalize(pick("integrity_score"), overall)
    prosody = normalize(pick("standard_score") or pick("phone_score"), overall)

    return {
        "overall": overall,
        "accuracy": accuracy,
        "fluency": fluency,
        "completeness": completeness,
        "prosody": prosody,
        "provider": "iflytek"
    }


def debug_ws_auth(url: str, api_key: str, api_secret: str) -> dict:
    if not _is_ws_url(url):
        return {"ok": False, "error": "URL is not websocket"}

    if not api_key or not api_secret:
        return {"ok": False, "error": "Missing api_key or api_secret"}

    attempts = []
    for secret in _secret_candidates(api_secret):
        try:
            signed_url = _build_signed_ws_url(url, api_key, secret)
            ws = create_connection(signed_url, timeout=10)
            ws.close()
            attempts.append({"ok": True, "secretMode": "decoded" if secret != api_secret else "raw"})
            return {"ok": True, "attempts": attempts}
        except Exception as error:
            attempts.append({"ok": False, "secretMode": "decoded" if secret != api_secret else "raw", "error": str(error)})

    return {"ok": False, "attempts": attempts}


def _build_ise_payload(app_id: str, reference_text: str, audio_base64: str, options: dict) -> dict:
    payload = {
        "common": {"app_id": app_id},
        "business": {
            "category": options.get("category", "read_sentence"),
            "sub": options.get("sub", "ise"),
            "ent": options.get("ent", "en_vip"),
            "cmd": "ssb",
            "ttp_skip": bool(options.get("ttp_skip", True)),
            "tte": options.get("tte", "utf-8"),
            "aue": options.get("aue", "raw"),
            "auf": options.get("auf", "audio/L16;rate=16000"),
            "rstcd": options.get("rstcd", "utf8"),
            "text": f"\ufeff{reference_text}"
        },
        "data": {"status": 0}
    }

    return payload


def _trim_audio_base64(audio_base64: str, max_audio_sec: int) -> str:
    if max_audio_sec <= 0:
        return audio_base64

    try:
        raw = base64.b64decode(audio_base64)
    except Exception:
        return audio_base64

    max_bytes = max_audio_sec * 16000 * 2
    if len(raw) <= max_bytes:
        return audio_base64

    return base64.b64encode(raw[:max_bytes]).decode("utf-8")


def _sanitize_reference_text(text: str) -> str:
    cleaned = re.sub(r"[^A-Za-z' ]+", " ", text)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned or "hello"


def _audio_chunks(data: bytes, frame_size: int):
    for i in range(0, len(data), frame_size):
        yield data[i : i + frame_size]
