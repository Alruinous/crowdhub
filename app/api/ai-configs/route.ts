import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET - 获取所有AI配置
export async function GET() {
  try {
    const configs = await db.aiConfig.findMany({
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(configs);
  } catch (error) {
    console.error("获取AI配置失败:", error);
    return NextResponse.json({ error: "获取AI配置失败" }, { status: 500 });
  }
}

// POST - 创建新的AI配置
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { key, value, label } = body;

    if (!key || !value || !label) {
      return NextResponse.json(
        { error: "缺少必要字段: key, value, label" },
        { status: 400 }
      );
    }

    // 检查是否已存在同名配置
    const existing = await db.aiConfig.findUnique({
      where: { key },
    });

    if (existing) {
      return NextResponse.json(
        { error: `已存在同名配置键: ${key}` },
        { status: 409 }
      );
    }

    const newConfig = await db.aiConfig.create({
      data: { key, value, label },
    });

    return NextResponse.json(newConfig, { status: 201 });
  } catch (error) {
    console.error("创建AI配置失败:", error);
    return NextResponse.json({ error: "创建AI配置失败" }, { status: 500 });
  }
}
