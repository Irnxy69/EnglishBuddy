/**
 * EnglishBuddy — Groq API Proxy
 * 
 * 部署到 Cloudflare Workers，让中国大陆服务器可以访问 Groq API
 * 
 * 部署步骤：
 * 1. 登录 Cloudflare Dashboard → Workers & Pages → Create Worker
 * 2. 把此文件内容粘贴进去，点 Deploy
 * 3. 复制 Worker 的 URL（如 https://groq-proxy.你的名字.workers.dev）
 * 4. 在服务器 .env 中设置 GROQ_BASE_URL=https://groq-proxy.xxx.workers.dev
 */

const GROQ_API_BASE = "https://api.groq.com";

// 安全白名单：只允许来自你服务器的请求（可选，留空则不限制）
const ALLOWED_ORIGINS = [
  "https://englishbuddy.top",
  "http://localhost:8000",
];

export default {
  async fetch(request, env, ctx) {
    // 处理 CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const url = new URL(request.url);

    // 只代理 /openai/v1/* 路径（Groq API 路径）
    if (!url.pathname.startsWith("/openai/v1/")) {
      return new Response("EnglishBuddy Groq Proxy — OK", { status: 200 });
    }

    // 构建目标 URL
    const targetUrl = GROQ_API_BASE + url.pathname + url.search;

    // 转发请求，保留所有 Header（包括 Authorization）
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: "follow",
    });

    try {
      const response = await fetch(proxyRequest);

      // 添加 CORS 头
      const newHeaders = new Headers(response.headers);
      newHeaders.set("Access-Control-Allow-Origin", "*");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    } catch (error) {
      return new Response(
        JSON.stringify({ error: { message: `Proxy error: ${error.message}` } }),
        {
          status: 502,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }
  },
};
