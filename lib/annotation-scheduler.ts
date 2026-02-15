import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { enableDebugLogs } from "@/lib/debug";

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
  // 安全检查：确保 task 对象存在且包含必要的字段
  if (!task) {
    throw new Error("任务对象不存在");
  }
  
  if (!task.workers) {
    console.warn(`[Scheduler] ⚠️  任务 ${task.id} 没有 workers 字段，使用空数组`);
    task.workers = [];
  }
  
  if (!task.annotations) {
    console.warn(`[Scheduler] ⚠️  任务 ${task.id} 没有 annotations 字段，使用空数组`);
    task.annotations = [];
  }
  
  console.log(`\n[Scheduler] ========================================`);
  console.log(`[Scheduler] 开始处理任务: ${task.title}, ID: ${task.id}`);
  console.log(`[Scheduler] 发布周期: ${task.publishCycle} 天`);
  console.log(`[Scheduler] 当前workers数量: ${task.workers?.length || 0}, 每次发布上限: ${task.publishLimit} 条`);
  console.log(`[Scheduler] 总数据条数: ${task.annotations?.length || 0}`);
  console.log(`[Scheduler] ========================================\n`);

  // ============================================
  // 📝 遍历所有 annotation 并根据状态执行相应操作
  // ============================================
  
  // 确保 annotations 是数组
  const annotations = Array.isArray(task.annotations) ? task.annotations : [];
  
  for (const annotation of annotations) {
    // 跳过已完成的 annotation
    if (annotation.status === 'COMPLETED') {
      continue;
    }

    // 操作1: 当completedCount等于requiredCount时，判断标注是否正确
    if (annotation.completedCount === annotation.requiredCount) {
      const result = await checkAnnotationCorrectness(annotation.id, task.id);
      if (result.abilityUpdate?.correctDim0) {
        await updateUserAbilities(
          task.id,
          result.abilityUpdate.correctUserIds,
          result.abilityUpdate.incorrectUserIds,
          result.abilityUpdate.correctDim0
        );
      }
    }

    // 操作2: 当publishedCount小于requiredCount时，发放数据给workers
    if (annotation.publishedCount < annotation.requiredCount) {
      await sendAnnotatioinToUser(annotation);
    }
  }

  // 操作3: 将 needToReview 的条目发放给一级复审员（按段连续分配）- 暂时注释，仅支持手动分配
  // await distributeNeedToReviewToReviewers(task.id);

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

const LEVEL_L1_REVIEW = 1;

/**
 * 将 needToReview 且尚未分配 round=1 的条目发放给一级复审员
 * 策略：按 rowIndex 升序，按复审员均分段连续分配（第 1 段给 R1，第 2 段给 R2，…）
 * @param taskId 标注任务 ID
 * @returns 本次发放的条目数
 */
export async function distributeNeedToReviewToReviewers(taskId: string): Promise<number> {
  const reviewers = await db.annotationTaskReviewer.findMany({
    where: { taskId, level: LEVEL_L1_REVIEW },
    orderBy: { userId: "asc" },
    select: { userId: true },
  });
  if (reviewers.length === 0) return 0;

  const annotations = await db.annotation.findMany({
    where: {
      taskId,
      needToReview: true,
      status: "COMPLETED",
      results: { none: { round: LEVEL_L1_REVIEW } },
    },
    orderBy: { rowIndex: "asc" },
    select: { id: true, rowIndex: true },
  });
  if (annotations.length === 0) return 0;

  const N = annotations.length;
  const K = reviewers.length;
  const base = Math.floor(N / K);
  const remainder = N % K;
  const toInsert: { annotationId: string; annotatorId: string; round: number }[] = [];
  let idx = 0;
  for (let r = 0; r < K; r++) {
    const count = base + (r < remainder ? 1 : 0);
    const reviewerId = reviewers[r].userId;
    for (let c = 0; c < count; c++) {
      const ann = annotations[idx++];
      toInsert.push({
        annotationId: ann.id,
        annotatorId: reviewerId,
        round: LEVEL_L1_REVIEW,
      });
    }
  }
  // 同一 annotation 不重复发给同一复审员：排除已存在的 (annotationId, annotatorId, round)
  const annotationIdsL1 = [...new Set(toInsert.map((t) => t.annotationId))];
  const existingL1 = await db.annotationResult.findMany({
    where: {
      annotationId: { in: annotationIdsL1 },
      round: LEVEL_L1_REVIEW,
    },
    select: { annotationId: true, annotatorId: true },
  });
  const existingSetL1 = new Set(existingL1.map((e) => `${e.annotationId}:${e.annotatorId}`));
  const toInsertL1 = toInsert.filter((t) => !existingSetL1.has(`${t.annotationId}:${t.annotatorId}`));
  const BATCH_SIZE = 500;
  for (let i = 0; i < toInsertL1.length; i += BATCH_SIZE) {
    const batch = toInsertL1.slice(i, i + BATCH_SIZE);
    await db.annotationResult.createMany({ data: batch });
  }
  const distributedIdsL1 = [...new Set(toInsertL1.map((t) => t.annotationId))];
  if (distributedIdsL1.length > 0) {
    await db.annotation.updateMany({
      where: { id: { in: distributedIdsL1 } },
      data: { needDistributeL1: false },
    });
  }
  console.log(
    `[Scheduler] 已发放 ${toInsertL1.length} 条需复审条目给 ${K} 名一级复审员${toInsertL1.length < toInsert.length ? `（跳过已分配 ${toInsert.length - toInsertL1.length} 条）` : ""}`
  );
  return toInsertL1.length;
}

const LEVEL_L2_REVIEW = 2;

/**
 * 将 needDistributeL2 的条目发放给二级复审员。
 * 策略：与一级一致，每条 annotation 只发给一个人，且只发给「尚未对该条做过二级复审」的复审员；在可选复审员中按当前负载（已有+本次已分配条数）选最少者，尽量均分。仅对本次实际新下发的条目置 needDistributeL2=false。
 * @param taskId 标注任务 ID
 * @returns 本次新增的 (annotation, 复审员) 条数
 */
export async function distributeNeedToReview2ToReviewers(taskId: string): Promise<number> {
  const reviewers = await db.annotationTaskReviewer.findMany({
    where: { taskId, level: LEVEL_L2_REVIEW },
    orderBy: { userId: "asc" },
    select: { userId: true },
  });
  if (reviewers.length === 0) return 0;

  const annotations = await db.annotation.findMany({
    where: {
      taskId,
      needDistributeL2: true,
      status: "COMPLETED",
    },
    orderBy: { rowIndex: "asc" },
    select: { id: true, rowIndex: true },
  });
  if (annotations.length === 0) return 0;

  const annotationIdsL2 = annotations.map((a) => a.id);
  const existingL2 = await db.annotationResult.findMany({
    where: {
      annotationId: { in: annotationIdsL2 },
      round: LEVEL_L2_REVIEW,
    },
    select: { annotationId: true, annotatorId: true },
  });
  const K = reviewers.length;
  const reviewerIds = reviewers.map((r) => r.userId);
  const reviewerIdToIndex = new Map<string, number>();
  for (let i = 0; i < K; i++) reviewerIdToIndex.set(reviewerIds[i], i);
  const existingByAnn = new Map<string, Set<string>>();
  const emptyHad = new Set<string>();
  for (const e of existingL2) {
    if (!existingByAnn.has(e.annotationId)) existingByAnn.set(e.annotationId, new Set());
    existingByAnn.get(e.annotationId)!.add(e.annotatorId);
  }
  const loads = new Array<number>(K);
  for (let i = 0; i < K; i++) loads[i] = 0;
  for (const e of existingL2) {
    const idx = reviewerIdToIndex.get(e.annotatorId);
    if (idx !== undefined) loads[idx]++;
  }
  const toInsertL2: { annotationId: string; annotatorId: string; round: number }[] = [];
  toInsertL2.length = annotations.length;
  let outIdx = 0;
  for (const ann of annotations) {
    const had = existingByAnn.get(ann.id) ?? emptyHad;
    let bestIdx = -1;
    let bestLoad = Infinity;
    for (let i = 0; i < K; i++) {
      if (had.has(reviewerIds[i])) continue;
      if (loads[i] < bestLoad) {
        bestLoad = loads[i];
        bestIdx = i;
      }
    }
    if (bestIdx === -1) continue;
    toInsertL2[outIdx++] = {
      annotationId: ann.id,
      annotatorId: reviewerIds[bestIdx],
      round: LEVEL_L2_REVIEW,
    };
    loads[bestIdx]++;
  }
  toInsertL2.length = outIdx;

  const BATCH_SIZE = 500;
  for (let i = 0; i < toInsertL2.length; i += BATCH_SIZE) {
    const batch = toInsertL2.slice(i, i + BATCH_SIZE);
    await db.annotationResult.createMany({ data: batch });
  }

  const distributedIdsL2 = [...new Set(toInsertL2.map((t) => t.annotationId))];
  if (distributedIdsL2.length > 0) {
    await db.annotation.updateMany({
      where: { id: { in: distributedIdsL2 } },
      data: { needDistributeL2: false },
    });
  }

  const skipped = annotations.length - toInsertL2.length;
  console.log(
    `[Scheduler] 已发放 ${toInsertL2.length} 条需二级复审条目给 ${K} 名二级复审员${skipped > 0 ? `（${skipped} 条已均有复审员未再分配）` : ""}`
  );
  return toInsertL2.length;
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




/** 单次正确性检查的返回：是否执行了判定 + 需延迟批量写回的能力更新（由 recheck 统一收集后批量写入，单条调用时由调用方即时写回） */
type CheckResult = {
  didCheck: boolean;
  abilityUpdate: { correctUserIds: string[]; incorrectUserIds: string[]; correctDim0: string | null } | null;
};

/** 供单条调用与 recheck 共用：基于已加载的 results 与 annotation 执行判定并写库，返回 CheckResult */
type ResultForCheck = {
  isFinished: boolean;
  selections: Array<{ dimensionIndex: number; pathIds: unknown; pathNames: unknown }>;
  annotator: { id: string; name: string | null };
};

async function runCheckForAnnotation(
  annotationId: string,
  taskId: string,
  results: ResultForCheck[],
  annotation: { status: string } | null
): Promise<CheckResult> {
  if (results.length < 2) {
    if (enableDebugLogs) console.log(`[Check] 标注结果不足2条，跳过检查 (当前: ${results.length})`);
    return { didCheck: false, abilityUpdate: null };
  }
  if (!results.every((r) => r.isFinished)) {
    if (enableDebugLogs) console.log(`[Check] 该条目尚有未完成的 result，暂不进行正确性判定`);
    return { didCheck: false, abilityUpdate: null };
  }
  if (!annotation) return { didCheck: false, abilityUpdate: null };

  if (enableDebugLogs) {
    console.log(`[Check] annotationId=${annotationId}, status=${annotation.status}, results.length=${results.length}`);
  }

  // ——— 两人标注且尚未 COMPLETED：仅用 dim0/dim1 第一级是否一致判断 needToReview（是否发一级审核员），并标记为 COMPLETED；不做 finalResult / needToReview2 ———
  if (results.length === 2 && annotation.status !== "COMPLETED") {
    const resultsToUse = results.slice(0, 2);
    type UserDimensions = {
      userId: string;
      userName: string;
      dim0: string | null;
      dim1: string | null;
    };
    const userDimensions: UserDimensions[] = resultsToUse.map((result) => {
      const dim0Selection = result.selections.find((s) => s.dimensionIndex === 0);
      const dim1Selection = result.selections.find((s) => s.dimensionIndex === 1);
      const dim0FirstLevel =
        dim0Selection?.pathNames != null
          ? (JSON.parse(JSON.stringify(dim0Selection.pathNames)) as string[])[0] ?? null
          : null;
      const dim1FirstLevel =
        dim1Selection?.pathNames != null
          ? (JSON.parse(JSON.stringify(dim1Selection.pathNames)) as string[])[0] ?? null
          : null;
      return {
        userId: result.annotator.id,
        userName: result.annotator.name || "未知",
        dim0: dim0FirstLevel,
        dim1: dim1FirstLevel,
      };
    });
    const user1 = userDimensions[0];
    const user2 = userDimensions[1];
    const dim0Match = user1.dim0 === user2.dim0;
    const dim1Match = user1.dim1 === user2.dim1;
    const allMatch = dim0Match && dim1Match;
    const correctUserIds = allMatch ? [user1.userId, user2.userId] : [];
    const incorrectUserIds = allMatch ? [] : [user1.userId, user2.userId];
    const correctDim0 = allMatch ? user1.dim0 : null;

    await Promise.all(
      correctUserIds.map((userId) =>
        db.annotationResult.updateMany({
          where: { annotationId, annotatorId: userId, round: 0 },
          data: { isCorrect: true },
        })
      )
    );
    await Promise.all(
      incorrectUserIds.map((userId) =>
        db.annotationResult.updateMany({
          where: { annotationId, annotatorId: userId, round: 0 },
          data: { isCorrect: false },
        })
      )
    );
    await db.annotation.update({
      where: { id: annotationId },
      data: {
        status: "COMPLETED",
        needToReview: !allMatch,
        needToReview2: false,
        needDistributeL1: !allMatch,
        needDistributeL2: false,
      },
    });
    if (enableDebugLogs) {
      console.log(`[Check] ✓ 2人标注一级检查完成，正确: ${correctUserIds.length}, 错误: ${incorrectUserIds.length}${!allMatch ? " (需要一级复审)" : ""}`);
    }
    return { didCheck: true, abilityUpdate: allMatch && correctDim0 ? { correctUserIds, incorrectUserIds, correctDim0 } : null };
  }

  // ——— 已做过一级判断的两人（status=COMPLETED）或三人及以上：每维度多数决，能确定则写 finalResult，否则 needToReview2 = true ———
  // 规则：若某维度存在「一个 annotator 多条 selection」（多选层级），则按「除去最后一级路径」的前缀多数决，再将该前缀下所有 selection 的最后一级取并集作为正确答案
  const n = results.length;
  const dimensionIndices = Array.from(
    new Set(results.flatMap((r) => r.selections.map((s) => s.dimensionIndex))).values()
  ).sort((a, b) => a - b);

  if (enableDebugLogs) {
    console.log(`[Check] 进入每维度多数决: n=${n}, dimensionIndices=[${dimensionIndices.join(", ")}]`);
  }

  type WinnerSelection = { dimensionIndex: number; pathIds: string[]; pathNames: string[] | null };
  const winnersByDimension: WinnerSelection[] = [];

  for (const dimIdx of dimensionIndices) {
    const dimSelections = results.flatMap((r) =>
      (r.selections.filter((s) => s.dimensionIndex === dimIdx) as { pathIds: unknown; pathNames: unknown }[]).map(
        (s) => ({ pathIds: JSON.parse(JSON.stringify(s.pathIds)) as string[], pathNames: s.pathNames != null ? (JSON.parse(JSON.stringify(s.pathNames)) as string[]) : null })
      )
    ).filter((s) => s.pathIds?.length > 0);

    // 多选维度：若该维度下任意一条 selection 的分类路径为多级（pathIds 长度>1），则按前缀多数决；否则为单选（整条路径多数决）
    const isMultiSelectionDimension = dimSelections.some(
      (s) => (s.pathIds?.length ?? 0) > 1
    );
    if (enableDebugLogs) {
      console.log(`[Check] 维度 ${dimIdx}: dimSelections.length=${dimSelections.length}, isMultiSelectionDimension=${isMultiSelectionDimension}（存在多级路径）`, dimSelections);
    }
    if (!isMultiSelectionDimension) {
      // 单条 selection：按完整 pathIds 多数决
      const keyToCount = new Map<string, number>();
      const keyToSelection = new Map<string, { pathIds: string[]; pathNames: string[] | null }>();
      for (const result of results) {
        const sel = result.selections.find((s) => s.dimensionIndex === dimIdx);
        if (!sel?.pathIds) continue;
        const pathIds = JSON.parse(JSON.stringify(sel.pathIds)) as string[];
        const pathNames = sel.pathNames != null ? (JSON.parse(JSON.stringify(sel.pathNames)) as string[]) : null;
        const key = JSON.stringify(pathIds);
        keyToCount.set(key, (keyToCount.get(key) ?? 0) + 1);
        if (!keyToSelection.has(key)) keyToSelection.set(key, { pathIds, pathNames });
      }
      let maxCount = 0;
      let winnerKey: string | null = null;
      for (const [key, count] of keyToCount) {
        if (count > maxCount) {
          maxCount = count;
          winnerKey = key;
        } else if (count === maxCount && count > 0) {
          winnerKey = null;
        }
      }
      // 唯一最多即胜出（不需过半）：有唯一最高票即可
      const hasUniqueWinner = winnerKey != null;
      if (enableDebugLogs) {
        console.log(`[Check] 维度 ${dimIdx} 单选: keyToCount=`, [...keyToCount.entries()], "winnerKey=", winnerKey?.slice(0, 100), "maxCount=", maxCount, "hasUniqueWinner=", hasUniqueWinner);
      }
      if (!hasUniqueWinner) {
        if (enableDebugLogs) {
          console.log(`[Check] 维度 ${dimIdx} 单选无唯一最多，中止后续维度判定`);
        }
        winnersByDimension.length = 0;
        break;
      }
      const sel = keyToSelection.get(winnerKey!)!;
      winnersByDimension.push({
        dimensionIndex: dimIdx,
        pathIds: sel.pathIds,
        pathNames: sel.pathNames,
      });
    } else {
      // 多选层级：按「除去最后一级」的前缀多数决，再将该前缀下所有 selection 的全路径去重并集作为正确答案
      // 1) 按「人」计票：每个标注员在该维度只算一票，投给其选择的前缀；同一人选了同一前缀下的多条（多选最后一级）只计一票
      // 2) 得票最多的前缀若为唯一最多则胜出（不需过半）；平票则无胜出
      // 3) 胜出前缀下所有不同的「全路径」去重后作为该维度的正确答案（多条 pathIds）
      const keyToCount = new Map<string, number>();
      const keyToFullPaths = new Map<string, Map<string, { pathIds: string[]; pathNames: string[] | null }>>();
      // 按人统计：每人对其选中的每个不同前缀各贡献 1 票（同一前缀下多选最后一级只算一票）
      for (const result of results) {
        const selectionsInDim = result.selections.filter((s) => s.dimensionIndex === dimIdx);
        const prefixesVoted = new Set<string>();
        for (const s of selectionsInDim) {
          const pathIds = Array.isArray(s.pathIds) ? (JSON.parse(JSON.stringify(s.pathIds)) as string[]) : [];
          if (pathIds.length === 0) continue;
          const prefix = pathIds.length > 1 ? pathIds.slice(0, -1) : [];
          const key = JSON.stringify(prefix);
          prefixesVoted.add(key);
        }
        for (const key of prefixesVoted) {
          keyToCount.set(key, (keyToCount.get(key) ?? 0) + 1);
        }
      }
      // 收集每个前缀下的全路径（用于胜出后输出正确答案）
      for (const { pathIds, pathNames } of dimSelections) {
        const prefix = pathIds.length > 1 ? pathIds.slice(0, -1) : [];
        const key = JSON.stringify(prefix);
        if (!keyToFullPaths.has(key)) keyToFullPaths.set(key, new Map());
        const pathMap = keyToFullPaths.get(key)!;
        const pathKey = JSON.stringify(pathIds);
        if (!pathMap.has(pathKey)) pathMap.set(pathKey, { pathIds, pathNames });
      }
      let maxCount = 0;
      let winnerKey: string | null = null;
      for (const [key, count] of keyToCount) {
        if (count > maxCount) {
          maxCount = count;
          winnerKey = key;
        } else if (count === maxCount && count > 0) {
          winnerKey = null;
        }
      }
      const totalAnnotators = results.length;
      const hasUniqueWinner = winnerKey != null && totalAnnotators > 0;
      if (enableDebugLogs) {
        const prefixCounts = [...keyToCount.entries()].map(([k, v]) => [k.length > 60 ? k.slice(0, 60) + "…" : k, v]);
        console.log(
          `[Check] 维度 ${dimIdx} 前缀多数决(按人计票): totalAnnotators=${totalAnnotators}, keyToCount(前缀->人数)=`,
          prefixCounts,
          "winnerKey(前缀)=",
          winnerKey?.slice(0, 80),
          "maxCount=",
          maxCount,
          "hasUniqueWinner=",
          hasUniqueWinner
        );
      }
      if (!hasUniqueWinner) {
        if (enableDebugLogs) {
          console.log(`[Check] 维度 ${dimIdx} 前缀多数决无唯一最多，中止后续维度判定`);
        }
        winnersByDimension.length = 0;
        break;
      }
      const fullPathsMap = keyToFullPaths.get(winnerKey!)!;
      if (enableDebugLogs) {
        const pathsAll = [...fullPathsMap.values()].map((p) => p.pathIds);
        console.log(`[Check] 维度 ${dimIdx} 前缀多数决 胜出: 全路径条数=${fullPathsMap.size}, pathIds 全部=`, pathsAll);
      }
      for (const { pathIds, pathNames } of fullPathsMap.values()) {
        winnersByDimension.push({
          dimensionIndex: dimIdx,
          pathIds,
          pathNames,
        });
      }
    }
  }
  if (enableDebugLogs) {
    console.log("winnersByDimension: ", winnersByDimension);
  }
  
  // 多选维度会为同一维度推入多条 winner，不能直接用 length 比较；应判断「每个维度都至少有一条 winner」
  const allDimensionsResolved = dimensionIndices.every((dimIdx) =>
    winnersByDimension.some((w) => w.dimensionIndex === dimIdx)
  );
  const finalResultJson = allDimensionsResolved
    ? winnersByDimension.map((w) => ({
        dimensionIndex: w.dimensionIndex,
        pathIds: w.pathIds,
        pathNames: w.pathNames,
      }))
    : null;

  if (enableDebugLogs) {
    console.log(
      `[Check] 多数决结果: allDimensionsResolved=${allDimensionsResolved}, winners条数=${winnersByDimension.length}, 写入=${finalResultJson != null ? "finalResult" : "needToReview2"}`
    );
  }

  const correctUserIds: string[] = [];
  const incorrectUserIds: string[] = [];
  if (allDimensionsResolved) {
    for (const result of results) {
      let match = true;
      for (const dimIdx of dimensionIndices) {
        const winnersForDim = winnersByDimension.filter((w) => w.dimensionIndex === dimIdx);
        const resultSelectionsInDim = result.selections.filter((s) => s.dimensionIndex === dimIdx);
        const winnerPathIdSet = new Set(winnersForDim.map((w) => JSON.stringify(w.pathIds)));
        const resultPathIdsList = resultSelectionsInDim.map((s) =>
          s.pathIds != null ? (JSON.parse(JSON.stringify(s.pathIds)) as string[]) : []
        );
        const everyResultPathInWinners =
          resultPathIdsList.length > 0 &&
          resultPathIdsList.every((pathIds) => winnerPathIdSet.has(JSON.stringify(pathIds)));
        if (!everyResultPathInWinners) {
          match = false;
          break;
        }
      }
      if (match) correctUserIds.push(result.annotator.id);
      else incorrectUserIds.push(result.annotator.id);
    }
  } else {
    incorrectUserIds.push(...results.map((r) => r.annotator.id));
  }

  // 仅当所有维度都确定多数时才更新各 result 的 isCorrect；有维度不确定时不改 isCorrect，只设 needToReview2，等二级复审员补一条 result 后再判
  if (allDimensionsResolved) {
    await Promise.all(
      correctUserIds.map((userId) =>
        db.annotationResult.updateMany({
          where: { annotationId, annotatorId: userId, round: 0 },
          data: { isCorrect: true },
        })
      )
    );
    await Promise.all(
      incorrectUserIds.map((userId) =>
        db.annotationResult.updateMany({
          where: { annotationId, annotatorId: userId, round: 0 },
          data: { isCorrect: false },
        })
      )
    );
  }

  const firstDimWinner = winnersByDimension.find((w) => w.dimensionIndex === dimensionIndices[0]);
  const correctDim0 =
    allDimensionsResolved && firstDimWinner
      ? firstDimWinner.pathNames?.[0] ?? null
      : null;

  // 不修改 needToReview，保留用于统计标注员复审率；needDistributeL1/L2 照常更新
  if (finalResultJson != null) {
    await db.annotation.update({
      where: { id: annotationId },
      data: {
        status: "COMPLETED",
        needToReview2: false,
        needDistributeL2: false,
        finalResult: finalResultJson,
        resultConfirmed: true,
      },
    });
  } else {
    await db.annotation.update({
      where: { id: annotationId },
      data: {
        status: "COMPLETED",
        needToReview2: true,
        needDistributeL2: true,
        finalResult: Prisma.JsonNull,
        resultConfirmed: false,
      },
    });
  }

  if (enableDebugLogs) {
    console.log(
      `[Check] ✓ ${n}人标注检查完成，少数服从多数: 正确=${correctUserIds.length}, 错误=${incorrectUserIds.length}` +
        (allDimensionsResolved ? ", 已写 finalResult" : ", needToReview2=true")
    );
  }
  const abilityUpdate =
    allDimensionsResolved && correctUserIds.length > 0 && correctDim0
      ? { correctUserIds, incorrectUserIds, correctDim0 }
      : null;
  return { didCheck: true, abilityUpdate };
}

/** 单条调用：先拉取 results 与 annotation，再执行判定与写库 */
async function checkAnnotationCorrectness(annotationId: string, taskId: string): Promise<CheckResult> {
  if (enableDebugLogs) console.log(`[Check] 开始检查标注正确性: ${annotationId}`);
  const results = await db.annotationResult.findMany({
    where: { annotationId },
    include: {
      selections: { orderBy: { dimensionIndex: "asc" } },
      annotator: { select: { id: true, name: true } },
    },
  });
  const annotation = await db.annotation.findUnique({
    where: { id: annotationId },
    select: { status: true },
  });
  return runCheckForAnnotation(annotationId, taskId, results, annotation);
}

/**
 * 重新检查整个任务的标注正确性（供发布者手动触发）
 * 仅对「最终结果未确定、人数已达标、且 needDistributeL1/needDistributeL2 均为 false」的条目调用 checkAnnotationCorrectness。
 * needDistributeL1 或 needDistributeL2 为 true 表示已判定需复审但尚未下发，不重复检查；下发后置为 false，之后可再次被检查。
 * needToReview/needToReview2 保留用于任务状态展示，不下发时不再改回 false。
 * 能力更新在全部检查完成后按用户批量写入，减少 DB 往返。
 */
export async function recheckTaskCorrectness(taskId: string): Promise<{ checked: number }> {
  const annotations = await db.annotation.findMany({
    where: { taskId },
    select: {
      id: true,
      status: true,
      requiredCount: true,
      completedCount: true,
      resultConfirmed: true,
      needDistributeL1: true,
      needDistributeL2: true,
    },
  });

  const toCheck = annotations.filter(
    (a) =>
      !a.resultConfirmed &&
      a.completedCount >= a.requiredCount &&
      !a.needDistributeL1 &&
      !a.needDistributeL2
  );

  if (toCheck.length === 0) return { checked: 0 };

  // 批量拉取所有待检查条目的 results（含 selections、annotator），将「每条 2 次读」降为「整次 recheck 1 次读」
  const toCheckIds = toCheck.map((a) => a.id);
  const allResults = await db.annotationResult.findMany({
    where: { annotationId: { in: toCheckIds } },
    include: {
      selections: { orderBy: { dimensionIndex: "asc" } },
      annotator: { select: { id: true, name: true } },
    },
  });
  const resultsByAnnId = new Map<string, ResultForCheck[]>();
  for (const r of allResults) {
    const list = resultsByAnnId.get(r.annotationId) ?? [];
    list.push(r as ResultForCheck);
    resultsByAnnId.set(r.annotationId, list);
  }

  const abilityUpdatesByUser = new Map<string, { correctDim0: string; isCorrect: boolean }[]>();
  let checked = 0;
  for (const ann of toCheck) {
    const results = resultsByAnnId.get(ann.id) ?? [];
    const result = await runCheckForAnnotation(ann.id, taskId, results, { status: ann.status });
    if (result.didCheck) checked += 1;
    if (result.abilityUpdate?.correctDim0) {
      const { correctUserIds, incorrectUserIds, correctDim0 } = result.abilityUpdate;
      for (const uid of correctUserIds) {
        const list = abilityUpdatesByUser.get(uid) ?? [];
        list.push({ correctDim0, isCorrect: true });
        abilityUpdatesByUser.set(uid, list);
      }
      for (const uid of incorrectUserIds) {
        const list = abilityUpdatesByUser.get(uid) ?? [];
        list.push({ correctDim0, isCorrect: false });
        abilityUpdatesByUser.set(uid, list);
      }
    }
  }
  if (abilityUpdatesByUser.size > 0) {
    await applyBatchUserAbilityUpdates(taskId, abilityUpdatesByUser);
  }
  return { checked };
}




/**
 * 检查annotation正确性（已废弃的旧版本，保留作为参考）
 * 当一条数据的标注完成数量达到要求时调用
 * 
 * 旧版本采用投票机制（3人标注）：
 * - 判断前两个维度的第一级分类
 * - 少数服从多数：2人及以上相同则为正确答案
 * - 三个答案都不同则全部错误
 * - 只有两个维度都正确才算正确
 * 
 * 新版本（2人标注）：
 * - 两人结果相同为正确，否则全错
 * 
 * @param annotationId 标注数据ID
 * @param taskId 任务ID
 */
// async function checkAnnotationCorrectness(annotationId: string, taskId: string): Promise<void> {
//   console.log(`[Check] 开始检查标注正确性: ${annotationId}`);
  
//   // 1. 获取该 annotation 的所有已完成的标注结果
//   const results = await db.annotationResult.findMany({
//     where: {
//       annotationId: annotationId,
//       isFinished: true,
//     },
//     include: {
//       selections: {
//         orderBy: { dimensionIndex: 'asc' }
//       },
//       annotator: {
//         select: { id: true, name: true }
//       }
//     }
//   });

//   if (results.length < 3) {
//     console.log(`[Check] 标注结果不足3人，跳过检查 (当前: ${results.length})`);
//     return;
//   }


//   // 2. 提取前两个维度的第一级分类
//   type UserDimensions = {
//     userId: string;
//     userName: string;
//     dim0: string | null;  // 第一个维度的第一级分类ID
//     dim1: string | null;  // 第二个维度的第一级分类ID
//   };

//   const userDimensions: UserDimensions[] = results.map(result => {
//     const dim0Selection = result.selections.find(s => s.dimensionIndex === 0);
//     const dim1Selection = result.selections.find(s => s.dimensionIndex === 1);
    
//     // 使用 pathNames 提取第一级分类名称
//     const dim0FirstLevel = dim0Selection && dim0Selection.pathNames 
//       ? (JSON.parse(JSON.stringify(dim0Selection.pathNames)) as string[])[0] 
//       : null;
//     const dim1FirstLevel = dim1Selection && dim1Selection.pathNames
//       ? (JSON.parse(JSON.stringify(dim1Selection.pathNames)) as string[])[0] 
//       : null;
    
//     return {
//       userId: result.annotator.id,
//       userName: result.annotator.name || '未知',
//       dim0: dim0FirstLevel,
//       dim1: dim1FirstLevel,
//     };
//   });

//   console.log(`[Check] 用户标注数据:`, userDimensions.map(u => ({
//     name: u.userName,
//     dim0: u.dim0,
//     dim1: u.dim1
//   })));

//   // 3. 对每个维度进行投票统计
//   function findMajorityAnswer(values: (string | null)[]): string | null {
//     const counts = new Map<string, number>();
    
//     values.forEach(val => {
//       if (val) {
//         counts.set(val, (counts.get(val) || 0) + 1);
//       }
//     });
    
//     // 找出现次数最多的答案
//     let maxCount = 0;
//     let majorityAnswer: string | null = null;
    
//     counts.forEach((count, answer) => {
//       if (count > maxCount) {
//         maxCount = count;
//         majorityAnswer = answer;
//       } else if (count === maxCount && count > 1) {
//         // 如果有多个答案票数相同且都大于1，设为null表示没有明确多数
//         majorityAnswer = null;
//       }
//     });
    
//     // 只有2人及以上相同才算有效答案
//     return maxCount >= 2 ? majorityAnswer : null;
//   }

//   const correctDim0 = findMajorityAnswer(userDimensions.map(u => u.dim0));
//   const correctDim1 = findMajorityAnswer(userDimensions.map(u => u.dim1));

//   console.log(`[Check] 维度0正确答案: ${correctDim0 || '无多数答案'}`);
//   console.log(`[Check] 维度1正确答案: ${correctDim1 || '无多数答案'}`);

//   // 4. 判断每个用户的标注是否正确
//   const correctUserIds: string[] = [];
//   const incorrectUserIds: string[] = [];

//   userDimensions.forEach(user => {
//     const dim0Correct = correctDim0 !== null && user.dim0 === correctDim0;
//     const dim1Correct = correctDim1 !== null && user.dim1 === correctDim1;
    
//     // 两个维度都正确才算正确
//     const isCorrect = dim0Correct && dim1Correct;
    
//     if (isCorrect) {
//       correctUserIds.push(user.userId);
//     } else {
//       incorrectUserIds.push(user.userId);
//     }
    
//     console.log(`[Check] 用户 ${user.userName}: ${isCorrect ? '✓ 正确' : '✗ 错误'} (dim0: ${dim0Correct}, dim1: ${dim1Correct})`);
//   });

//   // 判断是否全员正确
//   const allCorrect = incorrectUserIds.length === 0;

//   // 5. 更新每个用户的 AnnotationResult.isCorrect
//   await Promise.all(
//     correctUserIds.map(userId => 
//       db.annotationResult.updateMany({
//         where: {
//           annotationId: annotationId,
//           annotatorId: userId,
//         },
//         data: { isCorrect: true }
//       })
//     )
//   );

//   await Promise.all(
//     incorrectUserIds.map(userId => 
//       db.annotationResult.updateMany({
//         where: {
//           annotationId: annotationId,
//           annotatorId: userId,
//         },
//         data: { isCorrect: false }
//       })
//     )
//   );

//   // 6. 更新用户能力向量（仅使用维度0）
//   await updateUserAbilities(taskId, correctUserIds, incorrectUserIds, correctDim0);

//   // 7. 标记 annotation 为已完成，如果不是全员正确则需要复审
//   await db.annotation.update({
//     where: { id: annotationId },
//     data: { 
//       status: 'COMPLETED',
//       needToReview: !allCorrect  // 不是全员正确则需要复审
//     }
//   });

//   console.log(`[Check] ✓ 标注检查完成，正确: ${correctUserIds.length}, 错误: ${incorrectUserIds.length}${!allCorrect ? ' (需要复审)' : ''}`);
// }

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
    if (enableDebugLogs) console.log(`[Ability] 没有有效的维度0正确答案，跳过能力更新`);
    return;
  }

  if (enableDebugLogs) console.log(`[Ability] 将更新分类: "${correctDim0}"`);

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
 * 按用户批量应用能力更新：每个用户只读一次、写一次，将多条 (correctDim0, isCorrect) 合并后一次性写入。
 * 用于 recheck 结束后统一写回，减少 DB 往返。
 */
async function applyBatchUserAbilityUpdates(
  taskId: string,
  updatesByUser: Map<string, { correctDim0: string; isCorrect: boolean }[]>
): Promise<void> {
  for (const [userId, list] of updatesByUser) {
    if (list.length === 0) continue;
    const ability = await db.userAnnotationTaskAbility.findUnique({
      where: { userId_taskId: { userId, taskId } },
    });
    if (!ability) {
      if (enableDebugLogs) console.error(`[Ability] 用户 ${userId} 在任务 ${taskId} 中没有能力记录`);
      continue;
    }
    const correctCounts = JSON.parse(JSON.stringify(ability.correctCounts)) as Record<string, number>;
    const totalCounts = JSON.parse(JSON.stringify(ability.totalCounts)) as Record<string, number>;
    const alphaValues = ability.alphaValues as Record<string, number>;
    const abilityVector = JSON.parse(JSON.stringify(ability.abilityVector)) as Record<string, number>;
    for (const { correctDim0: categoryName, isCorrect } of list) {
      totalCounts[categoryName] = (totalCounts[categoryName] ?? 0) + 1;
      if (isCorrect) {
        correctCounts[categoryName] = (correctCounts[categoryName] ?? 0) + 1;
      }
      const alpha = alphaValues[categoryName] ?? 1;
      const beta = 1;
      abilityVector[categoryName] =
        (alpha + (correctCounts[categoryName] ?? 0)) / (alpha + beta + (totalCounts[categoryName] ?? 0));
    }
    const scores = Object.values(abilityVector);
    const avgScore = scores.length > 0 ? scores.reduce((sum, v) => sum + v, 0) / scores.length : 0.5;
    const minScore = scores.length > 0 ? Math.min(...scores) : 0.5;
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0.5;
    const totalAnnotations = Object.values(totalCounts).reduce((sum, v) => sum + v, 0);
    await db.userAnnotationTaskAbility.update({
      where: { userId_taskId: { userId, taskId } },
      data: {
        abilityVector,
        correctCounts,
        totalCounts,
        avgScore,
        minScore,
        maxScore,
        totalAnnotations,
      },
    });
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
    if (enableDebugLogs) console.error(`[Ability] 用户 ${userId} 在任务 ${taskId} 中没有能力记录`);
    return;
  }

  // 深拷贝后再修改，避免直接改动 Prisma 返回对象；新分类用 0 初始化，alpha 缺省用 1
  const correctCounts = JSON.parse(JSON.stringify(ability.correctCounts)) as Record<string, number>;
  const totalCounts = JSON.parse(JSON.stringify(ability.totalCounts)) as Record<string, number>;
  const alphaValues = ability.alphaValues as Record<string, number>;
  const abilityVector = JSON.parse(JSON.stringify(ability.abilityVector)) as Record<string, number>;

  totalCounts[categoryName] = (totalCounts[categoryName] ?? 0) + 1;
  if (isCorrect) {
    correctCounts[categoryName] = (correctCounts[categoryName] ?? 0) + 1;
  }

  const alpha = alphaValues[categoryName] ?? 1;
  const beta = 1;
  abilityVector[categoryName] =
    (alpha + (correctCounts[categoryName] ?? 0)) / (alpha + beta + (totalCounts[categoryName] ?? 0));

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

  if (enableDebugLogs) console.log(`[Ability] 更新用户 ${userId} 分类"${categoryName}": 能力=${abilityVector[categoryName].toFixed(3)}, 正确=${correctCounts[categoryName]}/${totalCounts[categoryName]}`);
}

/**
 * 回滚单次能力更新（撤销时用）：totalCounts[category]-=1，若 isCorrect 则 correctCounts[category]-=1，重算 abilityVector 等
 */
async function rollbackSingleUserAbility(
  userId: string,
  taskId: string,
  categoryName: string,
  wasCorrect: boolean
): Promise<void> {
  const ability = await db.userAnnotationTaskAbility.findUnique({
    where: { userId_taskId: { userId, taskId } },
  });
  if (!ability) return;

  const correctCounts = { ...(ability.correctCounts as Record<string, number>) };
  const totalCounts = { ...(ability.totalCounts as Record<string, number>) };
  const alphaValues = ability.alphaValues as Record<string, number>;
  const abilityVector = { ...(ability.abilityVector as Record<string, number>) };

  if (totalCounts[categoryName] == null || totalCounts[categoryName] <= 0) return;
  totalCounts[categoryName] -= 1;
  if (wasCorrect && correctCounts[categoryName] != null && correctCounts[categoryName] > 0) {
    correctCounts[categoryName] -= 1;
  }

  const alpha = alphaValues[categoryName] ?? 1;
  const beta = 1;
  const correct = correctCounts[categoryName] ?? 0;
  const total = totalCounts[categoryName] ?? 0;
  abilityVector[categoryName] = total > 0 ? (alpha + correct) / (alpha + beta + total) : 0.5;

  const scores = Object.values(abilityVector);
  const avgScore = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : 0.5;
  const minScore = scores.length > 0 ? Math.min(...scores) : 0.5;
  const maxScore = scores.length > 0 ? Math.max(...scores) : 0.5;
  const totalAnnotations = Object.values(totalCounts).reduce((s, v) => s + v, 0);

  await db.userAnnotationTaskAbility.update({
    where: { userId_taskId: { userId, taskId } },
    data: {
      abilityVector,
      correctCounts,
      totalCounts,
      avgScore,
      minScore,
      maxScore,
      totalAnnotations,
    },
  });
}

/**
 * 撤销某用户在某天发放的标注结果（round=0）：清空完成状态与 selections，回滚 annotation.completedCount/status/needToReview，回滚用户能力。
 * 已下发复审的条目（该 annotation 已有 round=1 或 round=2 结果）、或最终结果已确定的条目会跳过，不参与回滚，避免状态错乱。
 * @param taskId 任务 ID
 * @param userId 用户 ID
 * @param date 日期 YYYY-MM-DD（按 AnnotationResult.createdAt 所在日筛选）
 */
export async function undoUserDayResults(
  taskId: string,
  userId: string,
  date: string
): Promise<{ undone: number; skippedSentToReview: number; skippedNotIncorrect: number }> {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) throw new Error("日期格式应为 YYYY-MM-DD");
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);

  // 仅回滚标注任务（round=0），不含复审 round=1
  const results = await db.annotationResult.findMany({
    where: {
      annotatorId: userId,
      annotation: { taskId },
      round: 0,
      createdAt: { gte: start, lt: end },
    },
    include: {
      annotation: { select: { id: true, requiredCount: true, completedCount: true, resultConfirmed: true } },
      selections: { orderBy: { dimensionIndex: "asc" } },
    },
  });

  // 已下发复审的条目（存在 round=1 或 round=2 结果）、或最终结果已确定的条目不参与按天回滚，避免状态错乱
  const sentToReviewAnnotationIds = new Set(
    (
      await db.annotationResult.findMany({
        where: { annotation: { taskId }, round: { in: [1, 2] } },
        select: { annotationId: true },
      })
    ).map((x) => x.annotationId)
  );

  let undone = 0;
  let skippedSentToReview = 0;
  let skippedNotIncorrect = 0;
  const annotationUpdates = new Map<string, { completedCount: number; requiredCount: number }>();

  for (const r of results) {
    if (sentToReviewAnnotationIds.has(r.annotation.id)) {
      skippedSentToReview += 1;
      continue;
    }
    if (r.annotation.resultConfirmed) {
      skippedSentToReview += 1;
      continue;
    }
    // 只回滚已判定为错误的 result（isCorrect === false），正确或未判定的不回滚
    if (r.isCorrect !== false) {
      skippedNotIncorrect += 1;
      continue;
    }

    const wasFinished = r.isFinished;
    let categoryName: string | null = null;
    if (r.selections.length > 0) {
      const dim0 = r.selections.find((s) => s.dimensionIndex === 0);
      if (dim0?.pathNames) {
        const names = JSON.parse(JSON.stringify(dim0.pathNames)) as string[];
        if (names[0]) categoryName = names[0];
      }
    }

    if (wasFinished && categoryName) {
      await rollbackSingleUserAbility(userId, taskId, categoryName, false);
    }

    await db.annotationSelection.deleteMany({ where: { resultId: r.id } });
    await db.annotationResult.update({
      where: { id: r.id },
      data: { isFinished: false, isCorrect: null, completedAt: null },
    });

    if (wasFinished) {
      undone += 1;
      const ann = r.annotation;
      const prev = annotationUpdates.get(ann.id) ?? {
        completedCount: ann.completedCount,
        requiredCount: ann.requiredCount,
      };
      annotationUpdates.set(ann.id, {
        ...prev,
        completedCount: prev.completedCount - 1,
      });
    }
  }

  for (const [annotationId, { completedCount: newCompleted, requiredCount }] of annotationUpdates) {
    await db.annotation.update({
      where: { id: annotationId },
      data: {
        completedCount: newCompleted,
        ...(newCompleted < requiredCount
          ? { status: "PENDING" as const, needToReview: false, needToReview2: false, needDistributeL1: false, needDistributeL2: false }
          : {}),
      },
    });
    if (newCompleted < requiredCount) {
      await db.annotationResult.updateMany({
        where: { annotationId },
        data: { isCorrect: null },
      });
    }
  }

  return { undone, skippedSentToReview, skippedNotIncorrect };
}

/**
 * 回滚某条 annotation 下某标注者的结果（用 taskId + rowIndex 定位 annotation）
 * @param taskId 任务 ID
 * @param rowIndex annotation 的 rowIndex
 * @param annotatorId 标注者用户 ID
 */
export async function undoSingleAnnotationResult(
  taskId: string,
  rowIndex: number,
  annotatorId: string
): Promise<{ undone: boolean; message?: string }> {
  const annotation = await db.annotation.findUnique({
    where: { taskId_rowIndex: { taskId, rowIndex } },
    select: { id: true, requiredCount: true, completedCount: true, resultConfirmed: true },
  });
  if (!annotation) throw new Error("该条目不存在");

  if (annotation.resultConfirmed) {
    return {
      undone: false,
      message: "该条目最终结果已确定，无法回滚。",
    };
  }

  // 标注员只能回滚「尚未下发复审」的条目（无 round=1 且无 round=2），否则会出现状态错乱
  const hasReviewAssigned = await db.annotationResult.count({
    where: { annotationId: annotation.id, round: { in: [1, 2] } },
  });
  if (hasReviewAssigned > 0) {
    return {
      undone: false,
      message: "该条目已下发一级或二级复审，无法回滚标注。仅可回滚尚未发放给复审员的条目。",
    };
  }

  const result = await db.annotationResult.findUnique({
    where: {
      annotationId_annotatorId_round: {
        annotationId: annotation.id,
        annotatorId,
        round: 0,
      },
    },
    include: {
      selections: { orderBy: { dimensionIndex: "asc" } },
    },
  });
  if (!result) throw new Error("该标注者在此条目下无标注结果");

  const wasFinished = result.isFinished;
  let categoryName: string | null = null;
  if (result.selections.length > 0) {
    const dim0 = result.selections.find((s) => s.dimensionIndex === 0);
    if (dim0?.pathNames) {
      const names = JSON.parse(JSON.stringify(dim0.pathNames)) as string[];
      if (names[0]) categoryName = names[0];
    }
  }

  if (wasFinished && categoryName) {
    await rollbackSingleUserAbility(
      annotatorId,
      taskId,
      categoryName,
      result.isCorrect === true
    );
  }

  await db.annotationSelection.deleteMany({ where: { resultId: result.id } });
  await db.annotationResult.update({
    where: { id: result.id },
    data: { isFinished: false, isCorrect: null, completedAt: null },
  });

  if (!wasFinished) return { undone: true };

  const newCompleted = annotation.completedCount - 1;
  await db.annotation.update({
    where: { id: annotation.id },
    data: {
      completedCount: newCompleted,
      ...(newCompleted < annotation.requiredCount
        ? { status: "PENDING" as const, needToReview: false, needToReview2: false, needDistributeL1: false, needDistributeL2: false }
        : {}),
    },
  });
  if (newCompleted < annotation.requiredCount) {
    await db.annotationResult.updateMany({
      where: { annotationId: annotation.id },
      data: { isCorrect: null },
    });
  }

  return { undone: true };
}

/**
 * 回滚某条 annotation 下某复审员的复审结果（round=1）
 * 仅清空该条 round=1 结果，不修改 annotation.completedCount（那是标注 round=0 的）
 * 若该条目最终结果已确定（resultConfirmed），则不允许回滚复审结果。
 */
export async function undoSingleReviewResult(
  taskId: string,
  rowIndex: number,
  annotatorId: string
): Promise<{ undone: boolean; message?: string }> {
  const annotation = await db.annotation.findUnique({
    where: { taskId_rowIndex: { taskId, rowIndex } },
    select: { id: true, resultConfirmed: true },
  });
  if (!annotation) throw new Error("该条目不存在");

  if (annotation.resultConfirmed) {
    return { undone: false, message: "该条目最终结果已确定，无法回滚复审结果。" };
  }

  const result = await db.annotationResult.findUnique({
    where: {
      annotationId_annotatorId_round: {
        annotationId: annotation.id,
        annotatorId,
        round: 1,
      },
    },
    include: {
      selections: { orderBy: { dimensionIndex: "asc" } },
    },
  });
  if (!result) throw new Error("该复审员在此条目下无复审结果");

  await db.annotationSelection.deleteMany({ where: { resultId: result.id } });
  await db.annotationResult.update({
    where: { id: result.id },
    data: { isFinished: false, isCorrect: null, completedAt: null },
  });

  return { undone: true };
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
  
  // 查询已经有 AnnotationResult 的用户（仅 round=0 标注员，排除已分配的标注员）
  const existingResults = await db.annotationResult.findMany({
    where: {
      annotationId: annotation.id,
      round: 0,
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
  
  // 统计每个用户在当前周期已接收的标注数量（仅 round=0，publishLimit 不包含复审任务）
  const userReceivedCounts = await db.annotationResult.groupBy({
    by: ['annotatorId'],
    where: {
      annotation: { taskId: taskId },
      round: 0,
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
        round: 0,
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
