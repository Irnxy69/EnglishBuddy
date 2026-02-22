import re
from fastapi import APIRouter, Depends, HTTPException
from openai import OpenAI
from app.config import settings
from app.auth import get_current_user
from app.models import ReportRequest, ReportResponse
from app.database import get_supabase

router = APIRouter()

REPORT_PROMPT_TEMPLATE = """
You are an IELTS Speaking examiner. Analyze the following student-examiner conversation and generate a structured feedback report.

Conversation:
{conversation}

Output the report in this EXACT Markdown format:

## 📊 IELTS Speaking Assessment Report

**Estimated Band Score**: [X.X] — [Brief justification in one sentence]

---

### ❌ Grammar & Phrasing Corrections
| Your Expression | Better Native Expression | Why? |
|---|---|---|
| [quote exact user error] | [correction] | [brief grammar/collocation note] |

*(List 3–5 key errors. Skip this section if no errors found.)*

---

### 🌟 Vocabulary Upgrades
| You said | More Impressive Alternative |
|---|---|
| [simple word] | [advanced/IELTS-level synonym] |

---

### 💡 Examiner's Overall Feedback
**Fluency & Coherence**: [1 sentence]
**Lexical Resource**: [1 sentence]  
**Grammatical Range**: [1 sentence]
**Pronunciation tip**: [1 practical tip]

---

### 🎯 Focus for Next Practice
[2–3 bullet points of specific, actionable advice]
"""


def extract_band_score(report_text: str) -> float | None:
    """从报告文本中提取雅思分数"""
    match = re.search(r"Band Score\*\*:\s*(\d+(?:\.\d+)?)", report_text)
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            pass
    return None


@router.post("/report/generate", response_model=ReportResponse)
async def generate_report(
    request: ReportRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    根据对话历史生成 IELTS 评估报告，并保存到数据库。
    """
    if len(request.history) < 4:
        raise HTTPException(status_code=400, detail="Need at least 2 rounds of conversation to generate a report")

    # 格式化对话历史
    conversation_text = ""
    for msg in request.history:
        role_label = "Examiner (Echo)" if msg.role == "assistant" else "Student"
        conversation_text += f"{role_label}: {msg.content}\n\n"

    prompt = REPORT_PROMPT_TEMPLATE.format(conversation=conversation_text)

    try:
        client = OpenAI(
            api_key=settings.deepseek_api_key,
            base_url=settings.deepseek_base_url,
        )
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,  # 报告更精准，降低随机性
            max_tokens=1500,
        )
        report_content = response.choices[0].message.content.strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")

    band_score = extract_band_score(report_content)

    # 保存报告到数据库
    try:
        supabase = get_supabase()
        supabase.table("reports").insert({
            "session_id": request.session_id,
            "content": report_content,
            "band_score": band_score,
        }).execute()
    except Exception:
        pass  # 数据库写入失败不影响返回

    return ReportResponse(
        session_id=request.session_id,
        content=report_content,
        band_score=band_score,
    )
