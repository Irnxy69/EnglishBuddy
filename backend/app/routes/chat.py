from fastapi import APIRouter, Depends, HTTPException
from openai import OpenAI
from app.config import settings
from app.auth import get_current_user
from app.models import ChatRequest, ChatResponse
from app.database import get_supabase

router = APIRouter()

# 各模式的 System Prompt
SYSTEM_PROMPTS = {
    "ielts": """You are Echo, a professional IELTS Speaking examiner and coach.
Your role:
1. Have natural conversations on IELTS topics (Part 1/2/3 style).
2. Keep responses concise and spoken-style (2-4 sentences).
3. Do NOT correct every grammar mistake - focus on conversation flow.
4. Ask ONE follow-up question per turn to encourage the user to elaborate.
5. Occasionally introduce new angles: "What about...?", "How does that compare to...?"
""",
    "daily": """You are Echo, a friendly native English speaker helping someone practice everyday English.
Your role:
1. Chat naturally about daily life topics (hobbies, travel, food, work, etc.).
2. Use casual, natural English with contractions and idioms.
3. Keep responses short and engaging (2-3 sentences).
4. Ask one follow-up question per turn.
5. Gently model better phrasing by using it in your own reply (don't explicitly correct).
""",
    "interview": """You are Echo, a professional career coach helping someone practice job interviews in English.
Your role:
1. Conduct a realistic job interview simulation.
2. Ask behavioral questions (STAR format), situational questions, and follow-ups.
3. Keep your questions crisp and professional.
4. After each user answer, give brief positive reinforcement before the next question.
5. Focus on fluency and structure, not grammar perfection.
""",
}

_llm_client: OpenAI | None = None


def get_llm_client() -> OpenAI:
    global _llm_client
    if _llm_client is None:
        _llm_client = OpenAI(
            api_key=settings.deepseek_api_key,
            base_url=settings.deepseek_base_url,
        )
    return _llm_client


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    接收用户文字 + 历史，返回 AI 回复。
    同时将消息持久化到 Supabase。
    """
    system_prompt = SYSTEM_PROMPTS.get(request.mode.value, SYSTEM_PROMPTS["ielts"])
    
    messages = [{"role": "system", "content": system_prompt}]
    # 只保留最近 12 条（6 轮）
    for msg in request.history[-12:]:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": request.user_text})

    try:
        client = get_llm_client()
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=messages,
            temperature=0.7,
            max_tokens=300,
        )
        ai_reply = response.choices[0].message.content.strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM error: {str(e)}")

    # 持久化消息到 Supabase（异步，不阻塞响应）
    try:
        supabase = get_supabase()
        supabase.table("messages").insert([
            {
                "session_id": request.session_id,
                "role": "user",
                "content": request.user_text,
            },
            {
                "session_id": request.session_id,
                "role": "assistant",
                "content": ai_reply,
            },
        ]).execute()
    except Exception:
        pass  # 数据库写入失败不影响主流程

    return ChatResponse(reply=ai_reply, session_id=request.session_id)
