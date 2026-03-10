# EnglishBuddy 项目状况报告

## 📊 项目概览

**EnglishBuddy** 是一个基于 AI 的英语口语练习平台，支持多端访问（Web、iOS Native、React Native）。项目使用现代化技术栈，提供 IELTS 口语、日常对话和面试等多种练习模式。

---

## 🏗️ 项目架构

### 整体结构
```
EnglishBuddy/
├── backend/           # Python FastAPI 后端
├── frontend/          # Next.js Web 前端
├── iOS/              # 原生 iOS 应用 (SwiftUI)
├── mobile/           # React Native (Expo) 跨平台应用
└── cloudflare-worker/ # Cloudflare Worker (边缘计算)
```

---

## 🔧 技术栈详情

### 后端 (Backend)
- **框架**: FastAPI (Python)
- **数据库**: PostgreSQL (Supabase)
- **认证**: JWT Token
- **主要功能**:
  - 用户认证 (注册/登录)
  - 语音转文字 (Transcribe)
  - AI 聊天对话 (Chat)
  - 文字转语音 (TTS)
  - 练习报告生成 (Report)
  - 会话管理 (Sessions)

**代码规模**: 约 633 行 Python 代码

**API 路由**:
```
/api/auth         - 认证相关
/api/transcribe   - 语音识别
/api/chat         - AI 对话
/api/tts          - 文字转语音
/api/report       - 生成评估报告
/api/sessions     - 会话管理
/health           - 健康检查
```

### 前端 (Frontend - Web)
- **框架**: Next.js 16.1.6
- **UI**: React 19 + Tailwind CSS 4
- **状态管理**: Zustand
- **主要依赖**:
  - `axios` - HTTP 请求
  - `react-markdown` - Markdown 渲染
  - `remark-gfm` - GitHub Flavored Markdown 支持

### iOS 原生应用
- **框架**: SwiftUI
- **语音技术**: AVFoundation + Speech Framework
- **网络**: 自定义 APIClient
- **存储**: Keychain (安全存储)

**代码规模**: 约 1,253 行 Swift 代码

**核心功能模块**:
```swift
Core/
  ├── Networking/   - API 客户端、端点定义、错误处理
  ├── Speech/       - 语音识别、文字转语音
  └── Storage/      - Keychain 管理

Models/           - 数据模型 (User, Session, Message)
ViewModels/       - 视图逻辑 (AuthViewModel, ChatViewModel)
Views/            - UI 视图 (登录、聊天、历史记录)
```

### Mobile (React Native + Expo)
- **框架**: Expo 54.0.0 + React Native 0.81.5
- **路由**: expo-router 6.0.23
- **状态管理**: Zustand
- **主要功能**:
  - expo-speech (语音合成)
  - expo-secure-store (安全存储)
  - async-storage (本地存储)

**当前状态**: 基础框架搭建完成，处于诊断模式

---

## 💾 数据库设计

### 主要数据表

1. **users** - 用户表
   - id (UUID)
   - email (唯一)
   - hashed_password
   - name
   - created_at

2. **sessions** - 练习会话表
   - id (UUID)
   - user_id (外键)
   - mode (ielts/daily/interview)
   - created_at / ended_at

3. **messages** - 消息表
   - id (UUID)
   - session_id (外键)
   - role (user/assistant)
   - content
   - audio_url (可选)
   - created_at

4. **reports** - 评估报告表
   - id (UUID)
   - session_id (外键)
   - content (Markdown 格式)
   - band_score (IELTS 分数)
   - created_at

---

## 📈 最近开发进展

### 近期提交历史 (最近 10 次)
```
fdc5246  feat(ios): implement phase 5 production enhancements
b8b685d  feat(ios): implement zero-latency push-to-talk with 0.5s release delay
683b483  fix(ios): align ChatEndpoint URL and ChatRequest schema
9ebc439  fix(ios): align CreateSessionResponse model with backend
1ca6c8c  fix(ios): remove trailing slash in session endpoints
76286d6  fix(ios): force on-device recognition to prevent TLS errors
d3345b6  fix: resolve iOS Native STT permission and AudioSession conflicts
74011e6  feat: complete Native iOS App (SwiftUI + AVFoundation + Speech)
38a925a  fix: install missing dependencies for expo-router
0ff4abd  fix: upgrade async-storage for React Native new arch
```

### 开发重点
- ✅ **iOS 原生应用已完成**，包含完整的语音识别和实时对话功能
- ✅ 实现了零延迟 Push-to-Talk 机制 (0.5s 释放延迟)
- ✅ 修复了多个 iOS 语音识别和网络请求问题
- ✅ 后端 API 已稳定运行
- 🚧 **React Native 移动端**处于初始阶段

---

## 🔐 安全与配置

### 环境变量管理
- 所有敏感信息通过 `.env` 文件管理
- `.gitignore` 已正确配置，防止机密信息泄露
- 支持的配置:
  - `backend/.env` - 后端配置
  - `frontend/.env.local` - 前端配置

### 认证机制
- JWT Token 认证
- iOS Keychain 安全存储
- CORS 已配置允许跨域请求

---

## 📁 当前工作区状态

### Git 状态
```
分支: main
主分支: main

已修改文件:
  M .gitignore
  M mobile/app/_layout.tsx
  M mobile/app/index.tsx

未跟踪文件:
  ?? mobile/.expo/settings.json
```

### 待处理问题
1. `.gitignore` 有修改未提交
2. `mobile/` 目录下有正在开发的文件
3. `.expo/settings.json` 未被版本控制

---

## 🎯 核心功能特性

### 1. 多种练习模式
- **IELTS 口语**: 雅思口语考试模拟
- **Daily 对话**: 日常英语对话练习
- **Interview 面试**: 英语面试场景训练

### 2. 实时语音交互
- 语音识别 (STT): 将用户语音转为文字
- AI 回复生成: 基于 GPT 的智能对话
- 文字转语音 (TTS): 播放 AI 回复

### 3. 智能评估报告
- 自动生成 Markdown 格式的练习报告
- IELTS 分数评估 (band_score)
- 详细的语言能力分析

### 4. 会话历史管理
- 保存所有练习会话
- 支持查看历史对话记录
- 可继续之前的会话

---

## 📊 项目规模统计

| 模块 | 语言 | 代码行数 | 状态 |
|------|------|---------|------|
| Backend API | Python | ~633 行 | ✅ 已完成 |
| iOS Native | Swift | ~1,253 行 | ✅ 已完成 |
| Web Frontend | TypeScript/React | 未统计 | ✅ 已完成 |
| Mobile (RN) | TypeScript/React Native | 未统计 | 🚧 开发中 |

---

## 🚀 部署与运行

### 后端
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### 前端
```bash
cd frontend
npm install
npm run dev
```

### iOS
1. 使用 Xcode 打开 `iOS/EnglishBuddy.xcodeproj`
2. 配置开发者证书
3. 选择真机或模拟器运行

### Mobile (Expo)
```bash
cd mobile
npm install
npm start
# 或使用特定平台
npm run ios      # iOS
npm run android  # Android
npm run web      # Web
```

---

## 🔄 下一步计划建议

### 短期目标
1. 🔧 提交当前 `mobile/` 的修改
2. 📱 完善 React Native 移动端功能
3. 🧪 增加单元测试覆盖率
4. 📚 完善 API 文档

### 中期目标
1. 🌐 优化 Cloudflare Worker 边缘计算
2. 🎨 改进 UI/UX 设计
3. 📊 添加数据分析和可视化
4. 🔔 实现推送通知功能

### 长期目标
1. 🤖 引入更先进的 AI 模型
2. 🌍 多语言支持
3. 👥 社交功能（排行榜、好友系统）
4. 💰 付费订阅功能

---

## 📝 技术债务与改进点

1. **测试覆盖**: 缺少单元测试和集成测试
2. **文档**: API 文档不够完善
3. **错误处理**: 部分错误处理逻辑需要增强
4. **性能优化**: 考虑添加缓存机制
5. **CI/CD**: 尚未配置自动化部署流程

---

## 👥 团队协作建议

1. 使用 Git Flow 工作流
2. 所有新功能通过 Pull Request 审查
3. 遵循代码规范 (ESLint for JS/TS, Black for Python)
4. 定期进行代码审查
5. 维护 CHANGELOG.md 记录版本变更

---

## 📞 联系与支持

- **项目仓库**: Git 本地管理
- **主要开发者**: xuyushuo
- **开发平台**: macOS (Darwin 25.2.0)
- **Python 版本**: 3.12
- **Node.js**: 最新 LTS

---

**报告生成时间**: 2026-03-09
**项目版本**: v1.0.0
**状态**: 🟢 活跃开发中
