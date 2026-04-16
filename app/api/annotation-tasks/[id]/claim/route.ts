//用户认领任务时的后端逻辑

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    // 只有worker可以认领任务
    if (session.user.role !== "WORKER") {
      return NextResponse.json(
        { error: "只有Worker用户可以认领任务" },
        { status: 403 }
      );
    }

    const taskId = (await params).id;
    
    // 获取请求体中的擅长领域信息
    const body = await req.json().catch(() => ({}));
    const { expertiseAreas } = body as { expertiseAreas?: string[] };

    // 获取任务信息（包括标签文件数据）
    const task = await db.annotationTask.findUnique({
      where: { id: taskId },
      include: {
        workers: {
          select: { id: true },
        },
        labelFile: {
          select: {
            data: true,
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }

    // 检查任务是否已审批
    if (!task.approved) {
      return NextResponse.json(
        { error: "任务尚未审批，无法认领" },
        { status: 400 }
      );
    }

    // 检查任务状态
    if (task.status === "COMPLETED") {
      return NextResponse.json(
        { error: "任务已完成，无法认领" },
        { status: 400 }
      );
    }

    // 安全检查：确保 workers 字段存在且是数组
    // 注意：Prisma 在使用 include 时，即使没有关联数据也会返回空数组 []，而不是 undefined
    // 这个检查主要是防止查询时忘记 include workers 字段的情况
    if (!Array.isArray(task.workers)) {
      console.error(`[Claim] 任务 ${taskId} 的 workers 字段不存在或不是数组`);
      return NextResponse.json(
        { error: "任务数据异常" },
        { status: 500 }
      );
    }

    // 检查用户是否已经认领（workers 可能是空数组 []，这是正常的）
    const alreadyClaimed = task.workers.some(
      (worker) => worker.id === session.user.id
    );

    if (alreadyClaimed) {
      return NextResponse.json(
        { error: "您已经认领过该任务" },
        { status: 400 }
      );
    }

    // 检查是否已达到最大认领人数
    if (task.workers.length >= task.maxWorkers) {
      return NextResponse.json(
        { error: "任务已达到最大认领人数" },
        { status: 400 }
      );
    }

    // 认领任务：将用户添加到workers关系中
    await db.annotationTask.update({
      where: { id: taskId },
      data: {
        workers: {
          connect: { id: session.user.id },
        },
      },
    });

    // ============================================
    // 📝 初始化用户能力向量
    // ============================================
    
    // 获取第一个维度的所有第一级分类选项
    const getFirstCategoryOptions = (): string[] => {
      const labelFileData = task.labelFile?.data as any;
      if (!labelFileData?.dimensions || labelFileData.dimensions.length === 0) {
        return [];
      }
      const firstDimension = labelFileData.dimensions[0];
      if (!firstDimension.schema || firstDimension.schema.length === 0) {
        return [];
      }
      return firstDimension.schema.map((item: any) => item.name);
    };

    const allCategories = getFirstCategoryOptions();
    
    if (allCategories.length > 0) {
      // console.log(`[Claim] 用户 ${session.user.name} 选择的擅长领域:`, expertiseAreas);
      // console.log(`[Claim] 任务所有分类:`, allCategories);
      
      // 初始化各个向量
      const vectorLength = allCategories.length;
      const abilityVector: Record<string, number> = {};
      const correctCounts: Record<string, number> = {};
      const totalCounts: Record<string, number> = {};
      const alphaValues: Record<string, number> = {};
      
      // β 值固定为 1，不需要存储
      const beta = 1;
      // 对于每个分类，初始化参数
      allCategories.forEach((category) => {
        const isExpertise = expertiseAreas && expertiseAreas.includes(category);
        
        // 初始化统计数据
        correctCounts[category] = 0;
        totalCounts[category] = 0;
        // 设置 Beta 分布的 α 参数（擅长领域=10，其他=1）
        alphaValues[category] = isExpertise ? 10 : 1;
        
        // 计算初始能力值: a_ij = (correct_ij + α_ij) / (total_ij + α_ij + β_ij)
        // β_ij 固定为 1
        const alpha = alphaValues[category];
        const correct = correctCounts[category];
        const total = totalCounts[category];
        
        abilityVector[category] = parseFloat(
          ((correct + alpha) / (total + alpha + beta)).toFixed(5)
        );
      });
      
      // console.log(`[Claim] 初始化能力向量:`, abilityVector);
      
      // 计算统计信息
      const abilityValues = Object.values(abilityVector);
      const avgScore = abilityValues.reduce((sum, val) => sum + val, 0) / abilityValues.length;
      const minScore = Math.min(...abilityValues);
      const maxScore = Math.max(...abilityValues);
      
      // 创建或更新用户能力向量记录
      await db.userAnnotationTaskAbility.upsert({
        where: {
          userId_taskId: {
            userId: session.user.id,
            taskId: taskId,
          },
        },
        create: {
          userId: session.user.id,
          taskId: taskId,
          abilityVector: abilityVector,
          vectorLength: vectorLength,
          alphaValues: alphaValues,
          correctCounts: correctCounts,
          totalCounts: totalCounts,
          avgScore: parseFloat(avgScore.toFixed(5)),
          minScore: parseFloat(minScore.toFixed(5)),
          maxScore: parseFloat(maxScore.toFixed(5)),
          totalAnnotations: 0,
        },
        update: {
          abilityVector: abilityVector,
          vectorLength: vectorLength,
          alphaValues: alphaValues,
          correctCounts: correctCounts,
          totalCounts: totalCounts,
          avgScore: parseFloat(avgScore.toFixed(5)),
          minScore: parseFloat(minScore.toFixed(5)),
          maxScore: parseFloat(maxScore.toFixed(5)),
        },
      });
      
      // console.log(`[Claim] 用户能力向量初始化成功`); 
    }

    return NextResponse.json({
      success: true,
      message: "认领成功",
    });
  } catch (error) {
    console.error("认领任务失败:", error);
    return NextResponse.json(
      { error: "认领任务失败，请稍后重试" },
      { status: 500 }
    );
  }
}
