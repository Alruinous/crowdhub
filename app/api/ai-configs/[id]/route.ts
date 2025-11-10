import { NextResponse } from "next/server";
import { db } from "@/lib/db";

interface RouteParams {
  params: {
    id: string;
  };
}

// GET - 获取特定ID的配置
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = params;

    const config = await db.aiConfig.findUnique({
      where: { id },
    });

    if (!config) {
      return NextResponse.json({ error: "配置不存在" }, { status: 404 });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error("获取AI配置失败:", error);
    return NextResponse.json({ error: "获取AI配置失败" }, { status: 500 });
  }
}

// PATCH - 更新特定ID的配置
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = params;
    const body = await request.json();
    const { value } = body;

    if (value === undefined) {
      return NextResponse.json(
        { error: "缺少必要字段: value" },
        { status: 400 }
      );
    }

    // 检查配置是否存在
    const existingConfig = await db.aiConfig.findUnique({
      where: { id },
    });

    if (!existingConfig) {
      return NextResponse.json({ error: "配置不存在" }, { status: 404 });
    }

    // 更新配置
    const updatedConfig = await db.aiConfig.update({
      where: { id },
      data: { value },
    });

    return NextResponse.json(updatedConfig);
  } catch (error) {
    console.error("更新AI配置失败:", error);
    return NextResponse.json({ error: "更新AI配置失败" }, { status: 500 });
  }
}

// DELETE - 删除特定ID的配置
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = params;

    // 检查配置是否存在
    const existingConfig = await db.aiConfig.findUnique({
      where: { id },
    });

    if (!existingConfig) {
      return NextResponse.json({ error: "配置不存在" }, { status: 404 });
    }

    // 删除配置
    await db.aiConfig.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("删除AI配置失败:", error);
    return NextResponse.json({ error: "删除AI配置失败" }, { status: 500 });
  }
}
