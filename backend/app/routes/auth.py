from fastapi import APIRouter, Depends, HTTPException, status
from passlib.context import CryptContext
from app.auth import create_access_token, get_current_user
from app.models import RegisterRequest, LoginRequest, TokenResponse
from app.database import get_supabase

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@router.post("/auth/register", response_model=TokenResponse)
async def register(request: RegisterRequest):
    """用户注册"""
    supabase = get_supabase()

    # 检查邮箱是否已存在
    existing = supabase.table("users").select("id").eq("email", request.email).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = pwd_context.hash(request.password)
    result = supabase.table("users").insert({
        "email": request.email,
        "hashed_password": hashed_password,
        "name": request.name or request.email.split("@")[0],
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Registration failed")

    user = result.data[0]
    token = create_access_token({"sub": user["id"], "email": user["email"]})
    return TokenResponse(access_token=token, user_id=user["id"], email=user["email"])


@router.post("/auth/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    """用户登录"""
    supabase = get_supabase()

    result = supabase.table("users").select("*").eq("email", request.email).execute()
    if not result.data:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user = result.data[0]
    if not pwd_context.verify(request.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": user["id"], "email": user["email"]})
    return TokenResponse(access_token=token, user_id=user["id"], email=user["email"])


@router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """获取当前用户信息"""
    return {"user_id": current_user["sub"], "email": current_user["email"]}
