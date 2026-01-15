import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const { id: taskId } = await params;
    const { annotations } = await request.json();

    if (!Array.isArray(annotations) || annotations.length === 0) {
      return NextResponse.json(
        { error: "无效的标注数据" },
        { status: 400 }
      );
    }

    // 在事务中批量处理所有标注
    const result = await db.$transaction(async (tx) => {
      let savedCount = 0;

      for (const item of annotations) {
        const { annotationResultId, selections } = item;

        if (!annotationResultId || !Array.isArray(selections)) {
          continue;
        }

        // 检查 annotationResult 是否存在且未完成
        const annotationResult = await tx.annotationResult.findUnique({
          where: { id: annotationResultId },
          include: {
            annotation: true,
          },
        });

        if (!annotationResult) {
          console.warn(`AnnotationResult ${annotationResultId} 不存在`);
          continue;
        }

        // 如果已经完成，跳过（防止重复保存）
        if (annotationResult.isFinished) {
          console.log(`AnnotationResult ${annotationResultId} 已完成，跳过`);
          continue;
        }

        // 验证任务所有权
        if (annotationResult.annotation.taskId !== taskId) {
          console.warn(`AnnotationResult ${annotationResultId} 不属于任务 ${taskId}`);
          continue;
        }

        // 删除旧的 selection 记录
        await tx.annotationSelection.deleteMany({
          where: { resultId: annotationResultId },
        });

        // 创建新的 selection 记录
        if (selections.length > 0) {
          await tx.annotationSelection.createMany({
            data: selections.map((sel) => ({
              resultId: annotationResultId,
              dimensionName: sel.dimensionName,
              pathIds: sel.pathIds,
              pathNames: sel.pathNames || [],
            })),
          });
        }

        // 使用条件更新：仅当 isFinished=false 时才更新（防止并发重复）
        const updateResult = await tx.annotationResult.updateMany({
          where: {
            id: annotationResultId,
            isFinished: false,  // 关键：只更新未完成的
          },
          data: {
            isFinished: true,
            completedAt: new Date(),
          },
        });

        // 如果更新成功（count=1），说明我们是第一个完成的，才 +1
        if (updateResult.count === 1) {
          await tx.annotation.update({
            where: { id: annotationResult.annotationId },
            data: {
              completedCount: { increment: 1 },
            },
          });
          savedCount++;
        }
      }

      return { savedCount };
    });

    return NextResponse.json({
      success: true,
      savedCount: result.savedCount,
      message: `成功保存 ${result.savedCount} 条标注`,
    });

  } catch (error) {
    console.error("保存标注失败:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存标注失败" },
      { status: 500 }
    );
  }
}
