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
    if (annotation.status === 'COMPLETED') {
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

  // 更高效地检查所有 annotation 是否都为 COMPLETED（数据库查询）
  const unfinishedCount = await db.annotation.count({
    where: {
      taskId: task.id,
      status: { not: 'COMPLETED' }
    }
  });
  if (unfinishedCount === 0) {
    await db.annotationTask.update({
      where: { id: task.id },
      data: { status: 'COMPLETED' },
    });
    console.log(`[Scheduler] 任务 ${task.id} 所有标注已完成，状态已更新为 COMPLETED`);
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
 * 采用投票机制：
 * - 判断前两个维度的第一级分类
 * - 少数服从多数：2人及以上相同则为正确答案
 * - 三个答案都不同则全部错误
 * - 只有两个维度都正确才算正确
 * 
 * @param annotationId 标注数据ID
 * @param taskId 任务ID
 */
async function checkAnnotationCorrectness(annotationId: string, taskId: string): Promise<void> {
  console.log(`[Check] 开始检查标注正确性: ${annotationId}`);
  
  // 1. 获取该 annotation 的所有已完成的标注结果
  const results = await db.annotationResult.findMany({
    where: {
      annotationId: annotationId,
      isFinished: true,
    },
    include: {
      selections: {
        orderBy: { dimensionIndex: 'asc' }
      },
      annotator: {
        select: { id: true, name: true }
      }
    }
  });

  if (results.length < 3) {
    console.log(`[Check] 标注结果不足3人，跳过检查 (当前: ${results.length})`);
    return;
  }


  // 2. 提取前两个维度的第一级分类
  type UserDimensions = {
    userId: string;
    userName: string;
    dim0: string | null;  // 第一个维度的第一级分类ID
    dim1: string | null;  // 第二个维度的第一级分类ID
  };

  const userDimensions: UserDimensions[] = results.map(result => {
    const dim0Selection = result.selections.find(s => s.dimensionIndex === 0);
    const dim1Selection = result.selections.find(s => s.dimensionIndex === 1);
    
    // 使用 pathNames 提取第一级分类名称
    const dim0FirstLevel = dim0Selection && dim0Selection.pathNames 
      ? (JSON.parse(JSON.stringify(dim0Selection.pathNames)) as string[])[0] 
      : null;
    const dim1FirstLevel = dim1Selection && dim1Selection.pathNames
      ? (JSON.parse(JSON.stringify(dim1Selection.pathNames)) as string[])[0] 
      : null;
    
    return {
      userId: result.annotator.id,
      userName: result.annotator.name || '未知',
      dim0: dim0FirstLevel,
      dim1: dim1FirstLevel,
    };
  });

  console.log(`[Check] 用户标注数据:`, userDimensions.map(u => ({
    name: u.userName,
    dim0: u.dim0,
    dim1: u.dim1
  })));

  // 3. 对每个维度进行投票统计
  function findMajorityAnswer(values: (string | null)[]): string | null {
    const counts = new Map<string, number>();
    
    values.forEach(val => {
      if (val) {
        counts.set(val, (counts.get(val) || 0) + 1);
      }
    });
    
    // 找出现次数最多的答案
    let maxCount = 0;
    let majorityAnswer: string | null = null;
    
    counts.forEach((count, answer) => {
      if (count > maxCount) {
        maxCount = count;
        majorityAnswer = answer;
      } else if (count === maxCount && count > 1) {
        // 如果有多个答案票数相同且都大于1，设为null表示没有明确多数
        majorityAnswer = null;
      }
    });
    
    // 只有2人及以上相同才算有效答案
    return maxCount >= 2 ? majorityAnswer : null;
  }

  const correctDim0 = findMajorityAnswer(userDimensions.map(u => u.dim0));
  const correctDim1 = findMajorityAnswer(userDimensions.map(u => u.dim1));

  console.log(`[Check] 维度0正确答案: ${correctDim0 || '无多数答案'}`);
  console.log(`[Check] 维度1正确答案: ${correctDim1 || '无多数答案'}`);

  // 4. 判断每个用户的标注是否正确
  const correctUserIds: string[] = [];
  const incorrectUserIds: string[] = [];

  userDimensions.forEach(user => {
    const dim0Correct = correctDim0 !== null && user.dim0 === correctDim0;
    const dim1Correct = correctDim1 !== null && user.dim1 === correctDim1;
    
    // 两个维度都正确才算正确
    const isCorrect = dim0Correct && dim1Correct;
    
    if (isCorrect) {
      correctUserIds.push(user.userId);
    } else {
      incorrectUserIds.push(user.userId);
    }
    
    console.log(`[Check] 用户 ${user.userName}: ${isCorrect ? '✓ 正确' : '✗ 错误'} (dim0: ${dim0Correct}, dim1: ${dim1Correct})`);
  });

  // 判断是否全员正确
  const allCorrect = incorrectUserIds.length === 0;

  // 5. 更新每个用户的 AnnotationResult.isCorrect
  await Promise.all(
    correctUserIds.map(userId => 
      db.annotationResult.updateMany({
        where: {
          annotationId: annotationId,
          annotatorId: userId,
        },
        data: { isCorrect: true }
      })
    )
  );

  await Promise.all(
    incorrectUserIds.map(userId => 
      db.annotationResult.updateMany({
        where: {
          annotationId: annotationId,
          annotatorId: userId,
        },
        data: { isCorrect: false }
      })
    )
  );

  // 6. 更新用户能力向量（仅使用维度0）
  await updateUserAbilities(taskId, correctUserIds, incorrectUserIds, correctDim0);

  // 7. 标记 annotation 为已完成，如果不是全员正确则需要复审
  await db.annotation.update({
    where: { id: annotationId },
    data: { 
      status: 'COMPLETED',
      needToReview: !allCorrect  // 不是全员正确则需要复审
    }
  });

  console.log(`[Check] ✓ 标注检查完成，正确: ${correctUserIds.length}, 错误: ${incorrectUserIds.length}${!allCorrect ? ' (需要复审)' : ''}`);
}

/**
 * 更新用户能力向量（简化版）
 * 只使用维度0的第一级分类名称来更新能力
 */
async function updateUserAbilities(
  taskId: string,
  correctUserIds: string[],
  incorrectUserIds: string[],
  correctDim0: string | null
): Promise<void> {
  
  if (!correctDim0) {
    console.log(`[Ability] 没有有效的维度0正确答案，跳过能力更新`);
    return;
  }

  console.log(`[Ability] 将更新分类: "${correctDim0}"`);

  // 更新正确用户的能力
  for (const userId of correctUserIds) {
    await updateSingleUserAbility(userId, taskId, correctDim0, true);
  }

  // 更新错误用户的能力
  for (const userId of incorrectUserIds) {
    await updateSingleUserAbility(userId, taskId, correctDim0, false);
  }
}

/**
 * 更新单个用户的能力向量（Object格式）
 * @param userId 用户ID
 * @param taskId 任务ID
 * @param categoryName 分类名称（如"天文地理"）
 * @param isCorrect 是否标注正确
 */
async function updateSingleUserAbility(
  userId: string,
  taskId: string,
  categoryName: string,
  isCorrect: boolean
): Promise<void> {
  
  // 获取用户能力记录（数据库中已默认存在）
  const ability = await db.userAnnotationTaskAbility.findUnique({
    where: {
      userId_taskId: { userId, taskId }
    }
  });

  if (!ability) {
    console.error(`[Ability] 用户 ${userId} 在任务 ${taskId} 中没有能力记录`);
    return;
  }

  // 读取当前统计数据（Object格式）
  const correctCounts = ability.correctCounts as Record<string, number>;
  const totalCounts = ability.totalCounts as Record<string, number>;
  const alphaValues = ability.alphaValues as Record<string, number>;
  const abilityVector = ability.abilityVector as Record<string, number>;

  // 更新该分类的统计数据
  totalCounts[categoryName] += 1;
  if (isCorrect) {
    correctCounts[categoryName] += 1;
  }
  
  // 使用贝叶斯估计重新计算能力值: (α + correct) / (α + β + total)
  const alpha = alphaValues[categoryName];
  const beta = 1;
  abilityVector[categoryName] = (alpha + correctCounts[categoryName]) / (alpha + beta + totalCounts[categoryName]);

  // 重新计算统计信息
  const scores = Object.values(abilityVector);
  const avgScore = scores.length > 0 
    ? scores.reduce((sum, v) => sum + v, 0) / scores.length 
    : 0.5;
  const minScore = scores.length > 0 ? Math.min(...scores) : 0.5;
  const maxScore = scores.length > 0 ? Math.max(...scores) : 0.5;
  const totalAnnotations = Object.values(totalCounts).reduce((sum, v) => sum + v, 0);

  // 更新数据库
  await db.userAnnotationTaskAbility.update({
    where: {
      userId_taskId: { userId, taskId }
    },
    data: {
      abilityVector,
      correctCounts,
      totalCounts,
      avgScore,
      minScore,
      maxScore,
      totalAnnotations,
    }
  });

  console.log(`[Ability] 更新用户 ${userId} 分类"${categoryName}": 能力=${abilityVector[categoryName].toFixed(3)}, 正确=${correctCounts[categoryName]}/${totalCounts[categoryName]}`);
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
