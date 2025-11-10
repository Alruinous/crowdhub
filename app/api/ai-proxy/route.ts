import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    // 验证用户权限（可选，根据需求决定是否需要）
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 获取AI配置
    const configs = await db.aiConfig.findMany();
    const baseURL = configs.find((c) => c.key === "baseURL")?.value || "";
    const defaultApiKey = configs.find((c) => c.key === "apiKey")?.value || "";

    if (!baseURL) {
      return NextResponse.json(
        { error: "AI service URL not configured" },
        { status: 500 }
      );
    }

    // 获取请求body
    const body = await req.json();
    const { apiKey: requestApiKey, ...restBody } = body; // 从请求中提取apiKey

    // 使用请求中的apiKey或默认配置中的apiKey
    const apiKey = requestApiKey || defaultApiKey;

    // 准备请求头
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    // 如果apiKey存在，添加到请求头
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    // 转发请求到实际的AI服务
    const aiResponse = await fetch(`${baseURL}`, {
      method: "POST",
      headers,
      body: JSON.stringify(restBody),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      return NextResponse.json(
        { error: `AI service error: ${errorText}` },
        { status: aiResponse.status }
      );
    }

    // 返回AI服务的响应
    const data = await aiResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("AI proxy error:", error);
    return NextResponse.json(
      {
        error: `Internal server error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 }
    );
  }
}
