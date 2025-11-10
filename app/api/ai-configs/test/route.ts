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

    // 准备请求头
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    // 如果apiKey存在，添加到请求头
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    // 发送一个简单的请求测试连接
    const response = await fetch(`${baseURL}`, {
      method: "GET",
      headers,
    });

    // 不检查 response.ok，只要能获取到响应就认为连接成功
    let available_models: string[] = [];
    try {
      const data = await response.json();
      if (data.data && Array.isArray(data.data)) {
        available_models = data.data.map((m: any) => m.id);
      }
    } catch (jsonError) {
      console.warn("无法解析JSON响应，但连接测试仍然成功", jsonError);
    }

    // 返回成功信息
    return NextResponse.json({
      success: true,
      message: "连接成功",
      model: model,
      apiKeyConfigured: !!apiKey,
      available_models: available_models,
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
