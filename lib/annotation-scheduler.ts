import { db } from "@/lib/db";

/**
 * 标注任务自动调度器
 * 根据publishCycle周期自动处理已发布的标注任务
 */

/**
 * 检查任务是否需要处理
 * 
 * 周期单位由环境变量 USE_MINUTE_CYCLE 控制：
 * - true: 以分钟为单位（用于测试）
 * - false/未设置: 以天为单位（生产环境）
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

  const now = new Date();
  const diffMs = now.getTime() - task.lastProcessedAt.getTime();
  const useMinuteCycle = process.env.USE_MINUTE_CYCLE === 'true';
  
  if (useMinuteCycle) {
    // 以分钟为单位计算
    const diffMinutes = diffMs / (1000 * 60);
    console.log(`[Scheduler] 任务 ${task.id}: 距离上次处理 ${diffMinutes.toFixed(2)} 分钟，周期 ${task.publishCycle} 分钟`);
    return diffMinutes >= task.publishCycle;
  } else {
    // 以天为单位计算
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    console.log(`[Scheduler] 任务 ${task.id}: 距离上次处理 ${diffDays.toFixed(2)} 天，周期 ${task.publishCycle} 天`);
    return diffDays >= task.publishCycle - 1;
  }
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
      await sendAnnotatioinToUser(annotation);
    }
  }

  // 更新任务的 lastProcessedAt 时间
  await db.annotationTask.update({
    where: { id: task.id },
    data: { lastProcessedAt: new Date() },
  });

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
            requirementVector: true,
            taskId: true,
          },
        },
      },
    });

    results.total = tasks.length;

    // 遍历每个任务，检查是否需要处理
    for (const task of tasks) {
      try {
        if (shouldProcessTask(task)) {
          
          // 执行任务处理（内部会更新 lastProcessedAt）
          await processTask(task);

          results.processed++;
        } else {
          results.skipped++;
        }
      } catch (error) {
        results.failed++;
      }
    }


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
          requirementVector: true,
          taskId: true,
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

  // 执行处理（内部会更新 lastProcessedAt）
  await processTask(task);

  return { success: true, message: "任务处理完成" };
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

/**
 * 将annotation发放给合适的用户
 * 根据用户能力向量和数据需求向量的匹配度进行分配
 * 
 * @param annotation 标注数据
 */
async function sendAnnotatioinToUser(annotation: any): Promise<void> {
  
  // 计算需要发放的数量
  const needCount = annotation.requiredCount - annotation.publishedCount;
  const taskId = annotation.taskId;
  
  // 获取annotation的需求向量
  const requirementVector = annotation.requirementVector as Record<string, number> | null;
  
  if (!requirementVector) {
    console.log(`[Distribute] 该数据没有需求向量，无法匹配`);
    return;
  }
  
  // 直接查询该任务的所有用户能力向量（更高效）
  const userAbilities = await db.userAnnotationTaskAbility.findMany({
    where: { taskId: taskId },
    include: {
      user: {
        select: { id: true, name: true }
      }
    }
  });
  
  if (!userAbilities.length) {
    console.log(`[Distribute] 任务没有可用的用户能力向量`);
    return;
  }
  
  // 查询已经有 AnnotationResult 的用户（提前过滤）
  const existingResults = await db.annotationResult.findMany({
    where: {
      annotationId: annotation.id
    },
    select: { annotatorId: true }
  });
  
  const existingUserIds = new Set(existingResults.map(r => r.annotatorId));
  
  // 获取当前周期的起始时间（基于任务的 lastProcessedAt）
  const task = await db.annotationTask.findUnique({
    where: { id: taskId },
    select: { 
      lastProcessedAt: true, 
      publishLimit: true,
      createdAt: true 
    }
  });
  
  if (!task) {
    console.log(`[Distribute] 任务不存在`);
    return;
  }
  
  // 当前周期起始时间：lastProcessedAt 或任务创建时间
  const periodStart = task.lastProcessedAt || task.createdAt;
  const publishLimit = task.publishLimit || 100;
  
  // 统计每个用户在当前周期已接收的数量
  const userReceivedCounts = await db.annotationResult.groupBy({
    by: ['annotatorId'],
    where: {
      annotation: { taskId: taskId },
      createdAt: { gte: periodStart }
    },
    _count: {
      id: true
    }
  });
  
  const userCountMap = new Map(
    userReceivedCounts.map(r => [r.annotatorId, r._count.id])
  );
  
  // 过滤掉已经有分配记录的用户 AND 已达到周期上限的用户
  const availableAbilities = userAbilities.filter(ability => {
    const userId = ability.user.id;
    
    // 已经标注过这条数据
    if (existingUserIds.has(userId)) {
      return false;
    }
    
    // 当前周期已达到上限
    const receivedCount = userCountMap.get(userId) || 0;
    if (receivedCount >= publishLimit) {
      return false;
    }
    
    return true;
  });
  
  if (availableAbilities.length === 0) {
    return;
  }
  
  // 计算每个可用用户的匹配度（点积）
  const userScores: { userId: string; userName: string; score: number }[] = [];
  
  for (const ability of availableAbilities) {
    const abilityVector = ability.abilityVector as Record<string, number>;
    
    // 计算点积（requirementVector · abilityVector）
    let dotProduct = 0;
    for (const [key, reqValue] of Object.entries(requirementVector)) {
      const abilityValue = abilityVector[key] || 0;
      dotProduct += reqValue * abilityValue;
    }
    
    userScores.push({
      userId: ability.user.id,
      userName: ability.user.name || '未知用户',
      score: dotProduct
    });
    
  }
  
  // 按匹配度从高到低排序
  userScores.sort((a, b) => b.score - a.score);
  
  // 从可用用户中选择前 needCount 个
  const selectedUsers = userScores.slice(0, needCount);
  
  for (const selectedUser of selectedUsers) {
    await db.annotationResult.create({
      data: {
        annotationId: annotation.id,
        annotatorId: selectedUser.userId,
      }
    });
  }
  
  // 更新 annotation 的 publishedCount
  await db.annotation.update({
    where: { id: annotation.id },
    data: { publishedCount: annotation.publishedCount + selectedUsers.length }
  });
  
  console.log(`[Distribute] 数据分配完成`);
}
