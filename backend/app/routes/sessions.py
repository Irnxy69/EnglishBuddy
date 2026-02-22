import uuid
from fastapi import APIRouter, Depends, HTTPException
from app.auth import get_current_user
from app.database import get_supabase

router = APIRouter()


@router.post("/sessions")
async def create_session(
    mode: str = "ielts",
    current_user: dict = Depends(get_current_user),
):
    """创建新的练习会话"""
    supabase = get_supabase()
    session_id = str(uuid.uuid4())

    result = supabase.table("sessions").insert({
        "id": session_id,
        "user_id": current_user["sub"],
        "mode": mode,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create session")

    return {"session_id": session_id, "mode": mode}


@router.get("/sessions")
async def list_sessions(current_user: dict = Depends(get_current_user)):
    """获取用户历史会话列表"""
    supabase = get_supabase()
    result = (
        supabase.table("sessions")
        .select("id, mode, created_at, ended_at")
        .eq("user_id", current_user["sub"])
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )
    return {"sessions": result.data}


@router.get("/sessions/{session_id}")
async def get_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """获取特定会话的完整消息记录"""
    supabase = get_supabase()

    # 验证会话归属
    session = (
        supabase.table("sessions")
        .select("*")
        .eq("id", session_id)
        .eq("user_id", current_user["sub"])
        .execute()
    )
    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    # 获取消息
    messages = (
        supabase.table("messages")
        .select("role, content, created_at")
        .eq("session_id", session_id)
        .order("created_at")
        .execute()
    )

    # 获取报告（如果有）
    report = (
        supabase.table("reports")
        .select("content, band_score, created_at")
        .eq("session_id", session_id)
        .execute()
    )

    return {
        "session": session.data[0],
        "messages": messages.data,
        "report": report.data[0] if report.data else None,
    }


@router.patch("/sessions/{session_id}/end")
async def end_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """标记会话结束"""
    from datetime import datetime, timezone
    supabase = get_supabase()
    supabase.table("sessions").update(
        {"ended_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", session_id).eq("user_id", current_user["sub"]).execute()
    return {"status": "ended"}
