import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST - 测试AI连接
export async function POST() {
  try {
    // 获取当前配置
    const baseURLConfig = await db.aiConfig.findUnique({
      where: { key: "baseURL" },
    });

    const modelConfig = await db.aiConfig.findUnique({
      where: { key: "model" },
    });

    const apiKeyConfig = await db.aiConfig.findUnique({
      where: { key: "apiKey" },
    });

    // 使用默认值或从数据库获取的值
    const baseURL = baseURLConfig?.value || "http://192.168.5.22:30371";
    const model = modelConfig?.value || "/models/DeepSeek-R1-Distill-Qwen-32B";
    const apiKey = apiKeyConfig?.value || "";

    // 拼接 chat completions 端点（OpenAI 兼容）
    const chatEndpoint = baseURL.endsWith("/chat/completions")
      ? baseURL
      : `${baseURL.replace(/\/+$/, "")}/chat/completions`;

    // 准备请求头
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    // 如果apiKey存在，添加到请求头
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    // 发送一个最小的 chat completion 请求，真实校验连接与认证
    const payload = {
      model,
      messages: [{ role: "user", content: "hi" }],
      max_tokens: 1,
    };

    const response = await fetch(chatEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return NextResponse.json(
        {
          success: false,
          error: "AI 服务连接或认证失败",
          message: `HTTP ${response.status}: ${errorText.slice(0, 300)}`,
          model,
          apiKeyConfigured: !!apiKey,
        },
        { status: 502 }
      );
    }

    // 返回成功信息
    return NextResponse.json({
      success: true,
      message: "连接成功",
      model: model,
      apiKeyConfigured: !!apiKey,
    });
  } catch (error) {
    console.error("测试AI连接失败:", error);
    return NextResponse.json(
      {
        success: false,
        error: "测试AI连接失败",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
