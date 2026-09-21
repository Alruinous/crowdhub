import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { KEY_NORMAL_TASK_REQUIRES_APPROVAL } from "@/lib/settings";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "仅管理员可操作" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { requiresApproval } = body as { requiresApproval?: boolean };
    if (typeof requiresApproval !== "boolean") {
      return NextResponse.json({ error: "缺少 requiresApproval 布尔参数" }, { status: 400 });
    }

    await db.aiConfig.upsert({
      where: { key: KEY_NORMAL_TASK_REQUIRES_APPROVAL },
      create: {
        key: KEY_NORMAL_TASK_REQUIRES_APPROVAL,
        value: String(requiresApproval),
        label: "日常任务是否需要管理员审核",
      },
      update: { value: String(requiresApproval) },
    });

    return NextResponse.json({ success: true, requiresApproval });
  } catch (error) {
    console.error("保存日常任务审核设置失败:", error);
    return NextResponse.json(
      { error: "保存失败: " + (error instanceof Error ? error.message : "未知错误") },
      { status: 500 }
    );
  }
}
