import { db } from "@/lib/db";

type FinalResultItem = {
  dimensionIndex: number;
  pathNames?: unknown;
};

function jsonToStringArray(v: unknown): string[] | null {
  if (v == null) return null;
  const arr = JSON.parse(JSON.stringify(v)) as unknown;
  if (!Array.isArray(arr)) return null;
  if (!arr.every((x) => typeof x === "string")) return null;
  return arr as string[];
}

function arrEq(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function prefixOf(a: string[]): string[] {
  if (a.length <= 1) return [];
  return a.slice(0, -1);
}

function buildFinalSpec(finalRaw: unknown): { dims: number[]; n: number; finalByDim: Map<number, string[]> } | null {
  if (finalRaw == null) return null;
  const finalArr = JSON.parse(JSON.stringify(finalRaw)) as unknown;
  if (!Array.isArray(finalArr)) return null;
  const finalItems = finalArr as FinalResultItem[];
  const dims = [
    ...new Set(finalItems.map((x) => x.dimensionIndex).filter((x) => typeof x === "number")),
  ].sort((a, b) => a - b);
  const n = dims.length;
  if (n === 0) return null;
  const finalByDim = new Map<number, string[]>();
  for (const item of finalItems) {
    if (finalByDim.has(item.dimensionIndex)) continue;
    const names = jsonToStringArray(item.pathNames);
    if (names) finalByDim.set(item.dimensionIndex, names);
  }
  return { dims, n, finalByDim };
}

function computeCorrectPointWithSpec(
  spec: { dims: number[]; n: number; finalByDim: Map<number, string[]> },
  selections: Array<{ dimensionIndex: number; pathNames: unknown }>
): number {
  const selectionsByDim = new Map<number, string[]>();
  for (const s of selections) {
    if (selectionsByDim.has(s.dimensionIndex)) continue;
    const names = jsonToStringArray(s.pathNames);
    if (names) selectionsByDim.set(s.dimensionIndex, names);
  }

  let x = 0;
  for (const dim of spec.dims) {
    const sel = selectionsByDim.get(dim);
    const fin = spec.finalByDim.get(dim);
    if (!sel || !fin) continue;
    if (dim === 0) {
      if (arrEq(prefixOf(sel), prefixOf(fin))) x += 1;
    } else {
      if (arrEq(sel, fin)) x += 1;
    }
  }
  return x / spec.n;
}

/**
 * 按你的论文规则，计算并写回单条 AnnotationResult.correctPoint。
 *
 * 评分规则：
 * - n = 标准答案(finalResult)中 dimensionIndex 的种类数（去重）
 * - x = 在这些维度上判定“正确”的维度数
 * - score = x / n
 *
 * 判定：
 * - dim != 0：selection.pathNames 与 finalResult 对应 dim 的 pathNames 完全一致则正确
 * - dim == 0：只取任意一条 selection(dim0)；比较 pathNames 前缀（去掉最后一个元素）与 finalResult(dim0) 任意一条的前缀是否一致
 *
 * 注意：
 * - 若 annotation.finalResult 为空/无法解析，返回 null 并写回 null
 * - 只按 finalResult 出现的维度集合计入 n；某维度缺少 selection 视为该维度不正确
 */
export async function computeAndPersistAnnotationResultCorrectPoint(
  annotationResultId: string
): Promise<number | null> {
  const r = await db.annotationResult.findUnique({
    where: { id: annotationResultId },
    select: {
      id: true,
      annotationId: true,
      selections: {
        select: { dimensionIndex: true, pathNames: true },
        orderBy: { dimensionIndex: "asc" },
      },
      annotation: { select: { finalResult: true } },
    },
  });
  if (!r) throw new Error("annotationResult 不存在");

  const spec = buildFinalSpec(r.annotation.finalResult);
  if (!spec) {
    await db.annotationResult.update({
      where: { id: r.id },
      data: { correctPoint: null },
    });
    return null;
  }

  const score = computeCorrectPointWithSpec(spec, r.selections);
  await db.annotationResult.update({
    where: { id: r.id },
    data: { correctPoint: score },
  });
  return score;
}

/**
 * 批量计算某条 annotation 下所有 AnnotationResult 的 correctPoint 并写回。
 * @returns 本次更新的 result 条数
 */
export async function computeAndPersistCorrectPointsForAnnotation(
  annotationId: string
): Promise<{ updated: number }> {
  const annotation = await db.annotation.findUnique({
    where: { id: annotationId },
    select: { id: true, finalResult: true },
  });
  if (!annotation) throw new Error("annotation 不存在");
  const spec = buildFinalSpec(annotation.finalResult);
  if (!spec) {
    await db.annotationResult.updateMany({
      where: { annotationId },
      data: { correctPoint: null },
    });
    return { updated: 0 };
  }

  const results = await db.annotationResult.findMany({
    where: { annotationId },
    select: {
      id: true,
      selections: {
        select: { dimensionIndex: true, pathNames: true },
        orderBy: { dimensionIndex: "asc" },
      },
    },
  });

  let updated = 0;
  for (const r of results) {
    const score = computeCorrectPointWithSpec(spec, r.selections);
    await db.annotationResult.update({
      where: { id: r.id },
      data: { correctPoint: score },
    });
    updated += 1;
  }

  return { updated };
}

/**
 * 批量计算某个任务下所有 AnnotationResult.correctPoint 并写回。
 * - 仅对 annotation.finalResult 可用的条目计算；否则对应 result 写回 null
 * - 可选只统计某一轮/只处理已完成结果（避免把未完成结果也算分）
 */
export async function computeAndPersistCorrectPointsForTask(
  taskId: string,
  opts?: { round?: number; onlyFinished?: boolean }
): Promise<{ updated: number; nulled: number; scannedAnnotations: number; scannedResults: number }> {
  const round = opts?.round;
  const onlyFinished = opts?.onlyFinished ?? true;

  let updated = 0;
  let nulled = 0;
  let scannedResults = 0;
  const annotationIds = new Set<string>();
  const specCache = new Map<string, { dims: number[]; n: number; finalByDim: Map<number, string[]> } | null>();

  // 分页读取 + 分批写回：
  // - 分页避免一次性加载过多 results 占用内存
  // - 分批事务避免单次 transaction 太大
  const PAGE_SIZE = 2000;
  const BATCH = 200;
  let pending: Array<ReturnType<typeof db.annotationResult.update>> = [];
  const flush = async () => {
    if (pending.length === 0) return;
    await db.$transaction(pending);
    pending = [];
  };

  let cursorId: string | undefined;
  for (;;) {
    const page = await db.annotationResult.findMany({
      where: {
        annotation: { taskId },
        ...(typeof round === "number" ? { round } : {}),
        ...(onlyFinished ? { isFinished: true } : {}),
      },
      orderBy: { id: "asc" },
      take: PAGE_SIZE,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      select: {
        id: true,
        annotationId: true,
        selections: { select: { dimensionIndex: true, pathNames: true } },
        annotation: { select: { finalResult: true } },
      },
    });

    if (page.length === 0) break;
    scannedResults += page.length;

    for (const r of page) {
      annotationIds.add(r.annotationId);

      let spec = specCache.get(r.annotationId);
      if (spec === undefined) {
        spec = buildFinalSpec(r.annotation.finalResult);
        specCache.set(r.annotationId, spec);
      }

      if (!spec) {
        pending.push(
          db.annotationResult.update({
            where: { id: r.id },
            data: { correctPoint: null },
          })
        );
        nulled += 1;
      } else {
        const score = computeCorrectPointWithSpec(spec, r.selections);
        pending.push(
          db.annotationResult.update({
            where: { id: r.id },
            data: { correctPoint: score },
          })
        );
        updated += 1;
      }

      if (pending.length >= BATCH) await flush();
    }

    await flush();
    cursorId = page[page.length - 1].id;
  }

  return {
    updated,
    nulled,
    scannedAnnotations: annotationIds.size,
    scannedResults,
  };
}
