import { db } from "@/lib/db";

/**
 * 标注任务自动调度器
 * 根据publishCycle周期自动处理已发布的标注任务
 */

/**
 * 检查任务是否需要处理
 */
function shouldProcessTask(task: {
  publishCycle: number | null;
  lastProcessedAt: Date | null;
  status: string;
  [key: string]: any; // 允许其他字段
}): boolean {
  // 只处理已发布的任务
  if (task.status !== "IN_PROGRESS") {
    return false;
  }

  // 没有设置周期，不处理
  if (!task.publishCycle || task.publishCycle <= 0) {
    return false;
  }

  // 如果从未处理过，需要处理
  if (!task.lastProcessedAt) {
    return true;
  }

  // 计算距离上次处理的天数
  const now = new Date();
  const diffMs = now.getTime() - task.lastProcessedAt.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  // 如果超过发布周期，或者距离发布周期已经不足一天，则需要处理
  // 这样可以确保定时任务在每天0点时能够正确处理前一天发布的任务
  return diffDays >= task.publishCycle - 1;
}

/**
 * 处理单个任务的核心逻辑
 * 
 * ⚠️ TODO: 在这里添加你的具体处理逻辑
 * 
 * 可能的操作包括：
 * - 为每个worker分配新的标注数据
 * - 发送通知给workers
 * - 统计进度并更新任务状态
 * - 生成报告
 * - 检查任务完成情况
 * 
 * @param task 需要处理的标注任务（包含完整关联数据）
 */
async function processTask(task: any): Promise<void> {
  console.log(`\n[Scheduler] ========================================`);
  console.log(`[Scheduler] 开始处理任务: ${task.title}, ID: ${task.id}`);
  console.log(`[Scheduler] 发布周期: ${task.publishCycle} 天`);
  console.log(`[Scheduler] 当前workers数量: ${task.workers.length}, 每次发布上限: ${task.publishLimit} 条`);
  console.log(`[Scheduler] 总数据条数: ${task.annotations.length}`);
  console.log(`[Scheduler] ========================================\n`);

  // ============================================
  // 📝 遍历所有 annotation 并根据状态执行相应操作
  // ============================================
  
  for (const annotation of task.annotations) {
    // 跳过已完成的 annotation
    if (annotation.isfinished) {
      continue;
    }

    // 操作1: 当completedCount等于requiredCount时，判断标注是否正确
    if (annotation.completedCount === annotation.requiredCount) {
      await checkAnnotationCorrectness(annotation.id, task.id);
    }

    // 操作2: 当publishedCount小于requiredCount时，发放数据给workers
    if (annotation.publishedCount < annotation.requiredCount) {
      
      
    }
  }

  console.log(`[Scheduler] ✓ 任务处理逻辑执行完成\n`);
}

/**
 * 扫描并处理所有需要处理的标注任务
 */
export async function processAnnotationTasks(): Promise<{
  total: number;
  processed: number;
  failed: number;
  skipped: number;
}> {
  console.log(`\n[Scheduler] ========== 开始扫描标注任务 ==========`);
  console.log(`[Scheduler] 北京时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);

  const results = {
    total: 0,
    processed: 0,
    failed: 0,
    skipped: 0,
  };

  try {
    // 查询所有进行中的任务
    const tasks = await db.annotationTask.findMany({
      where: {
        status: "IN_PROGRESS",
        approved: true,
      },
      include: {
        publisher: {
          select: { id: true, name: true },
        },
        workers: {
          select: { id: true, name: true },
        },
        annotations: {
          select: { 
            id: true, 
            status: true, 
            rowIndex: true,
            isfinished: true,
            requiredCount: true,
            completedCount: true,
            publishedCount: true,
          },
        },
      },
    });

    results.total = tasks.length;
    console.log(`[Scheduler] 找到 ${tasks.length} 个进行中任务\n`);

    // 遍历每个任务，检查是否需要处理
    for (const task of tasks) {
      try {
        if (shouldProcessTask(task)) {
          console.log(`[Scheduler] 📋 任务需要处理: ${task.title}`);
          
          // 执行任务处理
          await processTask(task);
          
          // 更新lastProcessedAt时间
          await db.annotationTask.update({
            where: { id: task.id },
            data: { lastProcessedAt: new Date() },
          });

          results.processed++;
          console.log(`[Scheduler] ✓ 任务处理成功: ${task.title}\n`);
        } else {
          results.skipped++;
          
          // 计算下次处理时间
          const nextTime = getNextProcessTime(task);
          const nextTimeStr = nextTime 
            ? nextTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
            : '未设置';
          
          console.log(`[Scheduler] ⏭️  跳过任务: ${task.title} (下次处理: ${nextTimeStr})`);
        }
      } catch (error) {
        results.failed++;
        console.error(`[Scheduler] ✗ 处理任务失败: ${task.title}`, error);
      }
    }

    console.log(`\n[Scheduler] ========== 扫描完成 ==========`);
    console.log(`[Scheduler] 总任务数: ${results.total}`);
    console.log(`[Scheduler] 处理成功: ${results.processed}`);
    console.log(`[Scheduler] 跳过任务: ${results.skipped}`);
    console.log(`[Scheduler] 处理失败: ${results.failed}`);
    console.log(`[Scheduler] ===================================\n`);

    return results;
  } catch (error) {
    console.error("[Scheduler] 扫描任务时发生错误:", error);
    throw error;
  }
}

/**
 * 手动触发单个任务的处理
 * @param taskId 任务ID
 */
export async function processTaskById(taskId: string) {
  console.log(`\n[Scheduler] 手动触发任务处理: ${taskId}`);
  
  const task = await db.annotationTask.findUnique({
    where: { id: taskId },
    include: {
      publisher: {
        select: { id: true, name: true },
      },
      workers: {
        select: { id: true, name: true },
      },
      annotations: {
        select: { 
          id: true, 
          status: true, 
          rowIndex: true,
          isfinished: true,
          requiredCount: true,
          completedCount: true,
          publishedCount: true,
        },
      },
    },
  });

  if (!task) {
    throw new Error("任务不存在");
  }

  if (task.status !== "IN_PROGRESS") {
    throw new Error("只能处理已发布的任务");
  }

  // 执行处理
  await processTask(task);

  // 更新处理时间
  await db.annotationTask.update({
    where: { id: taskId },
    data: { lastProcessedAt: new Date() },
  });

  return { success: true, message: "任务处理完成" };
}

/**
 * 计算任务下次处理时间
 * @param task 标注任务
 * @returns 下次处理时间
 */
export function getNextProcessTime(task: any): Date | null {
  if (!task.publishCycle || task.publishCycle <= 0) {
    return null;
  }

  const baseTime = task.lastProcessedAt 
    ? new Date(task.lastProcessedAt)
    : new Date(task.createdAt);

  const nextTime = new Date(baseTime);
  nextTime.setDate(nextTime.getDate() + task.publishCycle);
  
  return nextTime;
}

/**
 * 检查annotation正确性
 * 当一条数据的标注完成数量达到要求时调用
 * 
 * @param annotationId 标注数据ID
 * @param taskId 任务ID
 */
async function checkAnnotationCorrectness(annotationId: string, taskId: string): Promise<void> {
  
  // ============================================
  // TODO: 实现标注正确性检查逻辑
  // ============================================
  // 获取该 annotation 的所有 AnnotationResult
  // 比较各个标注者的结果，采用加权投票的形式
  // 计算一致性
  // 如果一致性达标，标记 isCorrect 为 true
  // 更新标注者的能力向量（UserAnnotationTaskAbility）
  // 标记 annotation.isfinished = true


  
}
