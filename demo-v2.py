import streamlit as st
import asyncio
import edge_tts
from openai import OpenAI
import os
from faster_whisper import WhisperModel
import tempfile

# ================= ⚙️ 配置区 =================

# 1. 🔑 DeepSeek API Key (必填)
DEEPSEEK_API_KEY = "sk-62988ffd288746b29dec1b0595bace03" 
DEEPSEEK_BASE_URL = "https://api.deepseek.com"

# 2. 🔒 设置一个访问密码 (防止被路人盗用)
ACCESS_PASSWORD = "zju_master" 

# 3. 语音设置
TTS_VOICE = "en-US-AriaNeural" 

# ================= 🚀 初始化 =================

st.set_page_config(page_title="Echo V2.0 - 雅思私教", page_icon="🎓", layout="wide")

@st.cache_resource
def load_whisper_model():
    """CPU 专用配置 (int8 量化)"""
    try:
        model = WhisperModel("small", device="cpu", compute_type="int8")
        return model
    except Exception as e:
        print(f"❌ Whisper 加载失败: {e}")
        return None

@st.cache_resource
def get_llm_client():
    if "sk-" not in DEEPSEEK_API_KEY:
        return None
    return OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)

# 加载资源
if "whisper_loaded" not in st.session_state:
    whisper_model = load_whisper_model()
    client = get_llm_client()
    st.session_state.whisper_loaded = True
else:
    whisper_model = load_whisper_model()
    client = get_llm_client()

# ================= 🔐 安全校验逻辑 =================

def check_password():
    """返回 True 表示密码正确"""
    if "password_correct" not in st.session_state:
        st.session_state.password_correct = False

    # 如果密码已经正确，直接返回
    if st.session_state.password_correct:
        return True

    # 侧边栏输入密码
    st.sidebar.title("🔐 Login")
    pwd_input = st.sidebar.text_input("Enter Access Key", type="password")
    
    if st.sidebar.button("Login"):
        if pwd_input == ACCESS_PASSWORD:
            st.session_state.password_correct = True
            st.rerun() # 刷新页面进入主程序
        else:
            st.sidebar.error("❌ 密码错误")
    
    return False

# ================= 🧠 核心智能逻辑 =================

def transcribe_audio(audio_bytes):
    """听"""
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_wav:
        tmp_wav.write(audio_bytes.getvalue())
        tmp_wav_path = tmp_wav.name
    try:
        segments, info = whisper_model.transcribe(tmp_wav_path, beam_size=5)
        text = "".join([segment.text for segment in segments])
        return text
    finally:
        if os.path.exists(tmp_wav_path):
            os.remove(tmp_wav_path)

def get_ai_response(user_text, chat_history):
    """想：对话模式"""
    system_prompt = """
    You are Echo, an IELTS Speaking examiner.
    1. Chat naturally. Keep responses concise (spoken style).
    2. Do NOT correct grammar in every turn (it breaks flow).
    3. Ask follow-up questions to push the user to speak more.
    """
    messages = [{"role": "system", "content": system_prompt}]
    # 只保留最近 6 轮对话作为上下文，节省 token
    messages.extend(chat_history[-12:]) 
    messages.append({"role": "user", "content": user_text})
    
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=messages,
        temperature=0.7
    )
    return response.choices[0].message.content

def generate_report(chat_history):
    """📊 核心功能：生成评估报告"""
    # 把对话历史转换成文本格式
    conversation_text = ""
    for msg in chat_history:
        role = "Examiner" if msg["role"] == "assistant" else "Student"
        conversation_text += f"{role}: {msg['content']}\n"

    # 超级 Prompt：让 DeepSeek 变身雅思阅卷官
    report_prompt = f"""
    Based on the following conversation, generate a structured IELTS Speaking feedback report.
    
    Conversation:
    {conversation_text}
    
    Output Format (Markdown):
    ## 📊 Assessment Report
    **Estimated Band Score**: [Score 0-9]

    ### ❌ Grammar & Phrasing Corrections
    | Your Sentence | Better Native Expression | Why? (Briefly) |
    |---|---|---|
    | [Quote user's error] | [Correction] | [Grammar rule/Collocation] |
    (List at least 3 key errors if any)

    ### 🌟 Vocabulary Upgrades
    * **[Simple word user used]** → **[Advanced Synonym]**
    
    ### 💡 Examiner's Advice
    [1-2 sentences on fluency or coherence]
    """

    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[{"role": "user", "content": report_prompt}],
        temperature=0.7
    )
    return response.choices[0].message.content

async def generate_audio(text, output_file):
    """说"""
    communicate = edge_tts.Communicate(text, TTS_VOICE)
    await communicate.save(output_file)

# ================= 🎨 主界面逻辑 =================

if check_password(): # 只有密码正确才渲染主界面
    st.title("🎓 Echo V2.0 (IELTS Mode)")
    
    # 侧边栏功能区
    with st.sidebar:
        st.success("✅ Logged in")
        if st.button("🗑️ Start New Topic"):
            st.session_state.messages = []
            st.session_state.report = None # 清空报告
            st.rerun()
            
        st.markdown("---")
        # 生成报告按钮
        if st.button("📝 Generate Report"):
            if len(st.session_state.messages) > 2:
                with st.spinner("🤖 DeepSeek is analyzing your performance..."):
                    report_content = generate_report(st.session_state.messages)
                    st.session_state.report = report_content
            else:
                st.warning("Talk a bit more first!")

    if "messages" not in st.session_state:
        st.session_state.messages = []

    # 1. 显示对话流
    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            st.write(msg["content"])

    # 2. 录音区
    audio_input = st.audio_input("Press to speak...")

    if audio_input:
        if not client or not whisper_model:
            st.error("Engine not ready.")
        else:
            with st.spinner("👂 Listening..."):
                user_text = transcribe_audio(audio_input)
            
            if user_text.strip():
                st.session_state.messages.append({"role": "user", "content": user_text})
                with st.chat_message("user"):
                    st.write(user_text)

                with st.spinner("🧠 Thinking..."):
                    ai_response = get_ai_response(user_text, st.session_state.messages)

                st.session_state.messages.append({"role": "assistant", "content": ai_response})
                with st.chat_message("assistant"):
                    st.write(ai_response)

                with st.spinner("👄 Speaking..."):
                    tts_file = "response.mp3"
                    try:
                        asyncio.run(generate_audio(ai_response, tts_file))
                        st.audio(tts_file, format="audio/mp3", autoplay=True)
                    except Exception as e:
                        st.error(f"TTS Error: {e}")

    # 3. 显示评估报告 (如果有)
    if "report" in st.session_state and st.session_state.report:
        st.markdown("---")
        st.info("👇 以下是你的本局评估报告")
        with st.container(border=True):
            st.markdown(st.session_state.report)