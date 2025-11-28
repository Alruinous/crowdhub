"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Save, CheckCircle2, XCircle, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DataRow {
  id: string;
  index: number;
  data: Record<string, any>;
}
interface LabelCategory {
  id: string;
  type: string;
  name: string;
  children?: LabelCategory[];
}
interface LabelDimension {
  name: string;
  categories: LabelCategory[];
}
interface AnnotationSelection {
  dimensionName: string;
  pathIds: string[];
  pathNames?: string[];
}
interface AnnotationData {
  rowIndex: number;
  rowData: Record<string, any>;
  selections: AnnotationSelection[];
  status: string; // PENDING | APPROVED | REJECTED
}

function normalizeCategories(nodes: any[], parentPath: string[] = []): LabelCategory[] {
  return (nodes || []).map((n: any) => {
    const seg = `${String(n.type ?? "")}:${String(n.name ?? "")}`;
    const path = [...parentPath, seg];
    return {
      id: path.join(">"),
      type: String(n.type ?? ""),
      name: String(n.name ?? ""),
      children: normalizeCategories(n.children || [], path),
    };
  });
}
function analyzeCategoryTree(
  categories: LabelCategory[],
  currentLevel: number = 1,
  levelTitles: Record<number, string> = {}
): { maxDepth: number; levelTitles: Record<number, string> } {
  if (!categories?.length) return { maxDepth: 0, levelTitles };
  let maxDepth = currentLevel;
  for (const c of categories) {
    if (!levelTitles[currentLevel] && c.type?.trim()) levelTitles[currentLevel] = c.type;
    if (c.children?.length) {
      const child = analyzeCategoryTree(c.children, currentLevel + 1, { ...levelTitles });
      maxDepth = Math.max(maxDepth, child.maxDepth);
      Object.assign(levelTitles, child.levelTitles);
    }
  }
  return { maxDepth, levelTitles };
}

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const isEditMode = (searchParams?.get("mode") || "") === "edit";
  const { toast } = useToast();
  const [subtaskId, setSubtaskId] = useState<string>("");
  const [taskId, setTaskId] = useState<string>("");
  const [subtaskInfo, setSubtaskInfo] = useState<{ points: number } | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [dataRows, setDataRows] = useState<DataRow[]>([]);
  const [labelDimensions, setLabelDimensions] = useState<LabelDimension[]>([]);
  const [annotations, setAnnotations] = useState<Record<number, AnnotationData>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dimensionDepths, setDimensionDepths] = useState<Record<string, number>>({});
  const [dimensionLevelTitles, setDimensionLevelTitles] = useState<Record<string, Record<number, string>>>({});
  const [expandedSelections, setExpandedSelections] = useState<Record<number, boolean>>({});
  const [currentDimensionIndex, setCurrentDimensionIndex] = useState(0);
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});
  const [openSelects, setOpenSelects] = useState<Record<string, boolean>>({});
  const [taskInfo, setTaskInfo] = useState<{ taskName: string; subtaskName: string }>({ taskName: "", subtaskName: "" });
  const [submitOpen, setSubmitOpen] = useState(false);
  const [pointsInput, setPointsInput] = useState<string>("");
  const approvedCount = Object.values(annotations).filter((a) => a.status === "APPROVED").length;
  const totalCount = dataRows.length;

  const ENABLE_MULTI_LAST_LEVEL_FIRST_DIMENSION = true;
  const ENABLE_ADD_CATEGORY = false;

  const getSearchKey = (dimensionName: string, selIdx: number, level: number) => `${dimensionName}|${selIdx}|${level}`;

  useEffect(() => {
    const init = async () => {
      const { id } = await params;
      setSubtaskId(id);
      setIsLoading(true);
      try {
        // 获取子任务以取得 taskId
        const stRes = await fetch(`/api/annotation-subtasks/${id}`);
        if (!stRes.ok) throw new Error("无法获取子任务信息");
        const st = await stRes.json();
        if (!st.taskId) throw new Error("子任务缺少任务信息");
        setTaskId(st.taskId);

        const [dataRes, labelRes, annRes, taskRes, subtaskRes] = await Promise.all([
          fetch(`/api/annotation-subtasks/${id}/data`),
          fetch(`/api/annotation-tasks/${st.taskId}/labels`),
          fetch(`/api/annotation-subtasks/${id}/annotations`),
          fetch(`/api/annotation-tasks/${st.taskId}`),
          fetch(`/api/annotation-subtasks/${id}`),
        ]);
        if (!dataRes.ok || !labelRes.ok) throw new Error("无法加载审核数据");
        const dataJson = await dataRes.json();
        const labelJson = await labelRes.json();
        const annJson = annRes.ok ? await annRes.json() : { annotations: [] };
        const taskJson = taskRes.ok ? await taskRes.json() : { title: "" };
        const subtaskJson = subtaskRes.ok ? await subtaskRes.json() : { title: "", points: 0 };

        setDataRows(dataJson.data || []);
        setTaskInfo({ taskName: taskJson.title || "数据标注", subtaskName: subtaskJson.title || "" });
        setSubtaskInfo({ points: Number(subtaskJson.points || 0) });

        if (Array.isArray(labelJson.dimensions)) {
          const dims: LabelDimension[] = labelJson.dimensions.map((d: any) => ({
            name: d.name,
            categories: normalizeCategories(d.categories || []),
          }));
          setLabelDimensions(dims);
          const depths: Record<string, number> = {};
          const titles: Record<string, Record<number, string>> = {};
          dims.forEach((dim) => {
            const { maxDepth, levelTitles } = analyzeCategoryTree(dim.categories);
            depths[dim.name] = maxDepth;
            titles[dim.name] = levelTitles;
          });
          setDimensionDepths(depths);
          setDimensionLevelTitles(titles);
        } else {
          const normalized = normalizeCategories(labelJson.categories || []);
          const dimensionName = "默认分类";
          setLabelDimensions([{ name: dimensionName, categories: normalized }]);
          const { maxDepth, levelTitles } = analyzeCategoryTree(normalized);
          setDimensionDepths({ [dimensionName]: maxDepth });
          setDimensionLevelTitles({ [dimensionName]: levelTitles });
        }

        const initial: Record<number, AnnotationData> = {};
        (dataJson.data || []).forEach((row: DataRow) => {
          const existing = annJson.annotations?.find((a: any) => a.rowIndex === row.index);
          let selections: AnnotationSelection[] = [];
          if (existing?.selections?.length) {
            selections = existing.selections.map((s: any) => ({
              dimensionName: s.dimensionName || "默认分类",
              pathIds: s.pathIds || [],
              pathNames: s.pathNames,
            }));
          }
          initial[row.index] = {
            rowIndex: row.index,
            rowData: row.data,
            selections,
            status: existing?.status || "PENDING",
          };
        });
        setAnnotations(initial);
      } catch (e) {
        toast({ title: "加载失败", description: e instanceof Error ? e.message : "无法加载审核数据", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [params, toast]);

  const currentRow = dataRows[currentIndex];
  const currentAnnotation = currentRow ? annotations[currentRow.index] : undefined;
  const getCurrentDimension = () => labelDimensions[currentDimensionIndex] || labelDimensions[0];

  const setCurrentStatus = (status: "APPROVED" | "REJECTED" | "PENDING") => {
    if (!currentRow) return;
    setAnnotations((prev) => ({
      ...prev,
      [currentRow.index]: { ...prev[currentRow.index], status },
    }));
    // 设置状态后自动跳到下一条
    if (status === "APPROVED" || status === "REJECTED") {
      setTimeout(() => {
        if (currentIndex < dataRows.length - 1) {
          setCurrentIndex((i) => i + 1);
          setCurrentDimensionIndex(0);
        }
      }, 0);
    }
  };

  const handleNext = () => {
    if (currentIndex < dataRows.length - 1) {
      setCurrentIndex((i) => i + 1);
      setCurrentDimensionIndex(0);
    }
  };
  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setCurrentDimensionIndex(0);
    }
  };

  useEffect(() => {
    if (!isLoading && currentRow && currentAnnotation) {
      const dim = getCurrentDimension();
      const dimSelections = currentAnnotation.selections.filter((s) => s.dimensionName === dim?.name);
      if (!dimSelections.length) {
        const rowKey = currentRow.index;
        setAnnotations((prev) => {
          const cur = prev[rowKey];
          return {
            ...prev,
            [rowKey]: {
              ...cur,
              selections: [
                ...cur.selections,
                { dimensionName: dim?.name || "默认分类", pathIds: [] },
              ],
            },
          };
        });
        setExpandedSelections({ 0: true });
      }
    }
  }, [isLoading, currentRow, currentAnnotation, currentDimensionIndex]);

  const findCategoryById = (id: string): LabelCategory | null => {
    const dfs = (nodes: LabelCategory[]): LabelCategory | null => {
      for (const n of nodes) {
        if (String(n.id) === String(id)) return n;
        if (n.children?.length) {
          const r = dfs(n.children);
          if (r) return r;
        }
      }
      return null;
    };
    for (const d of labelDimensions) {
      const f = dfs(d.categories);
      if (f) return f;
    }
    return null;
  };
  const getCategoriesForLevel = (pathIds: string[], level: number, dimensionName?: string): LabelCategory[] => {
    if (level === 1) {
      const d = dimensionName ? labelDimensions.find((x) => x.name === dimensionName) : getCurrentDimension();
      return d?.categories || [];
    }
    const parentId = pathIds[level - 2];
    if (!parentId) return [];
    const parent = findCategoryById(parentId);
    return parent?.children || [];
  };
  const getCategoryTypeName = (level: number, dimensionName?: string): string => {
    const d = dimensionName ? labelDimensions.find((x) => x.name === dimensionName) : getCurrentDimension();
    const titles = d ? dimensionLevelTitles[d.name] || {} : {};
    return titles[level] || `第${level}级分类`;
  };
  const handleDimensionChange = (idx: number) => {
    setCurrentDimensionIndex(idx);
    if (currentRow && currentAnnotation) {
      const dim = labelDimensions[idx];
      const dimSelections = currentAnnotation.selections.filter((s) => s.dimensionName === dim?.name);
      if (!dimSelections.length) {
        const rowKey = currentRow.index;
        setAnnotations((prev) => {
          const cur = prev[rowKey];
          return {
            ...prev,
            [rowKey]: {
              ...cur,
              selections: [
                ...cur.selections,
                { dimensionName: dim?.name || "默认分类", pathIds: [] },
              ],
            },
          };
        });
        setExpandedSelections({ 0: true });
      }
    }
  };
  const arraysEqual = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);
  const handleLevelChange = (selIdx: number, level: number, value: string) => {
    if (!currentRow || !currentAnnotation) return;
    const rowKey = currentRow.index;
    setAnnotations((prev) => {
      const cur = prev[rowKey];
      if (!cur) return prev;
      const dimName = getCurrentDimension()?.name;
      const dimSelections = cur.selections.filter((s) => s.dimensionName === dimName);
      const actualIndex = cur.selections.findIndex((s) => s === dimSelections[selIdx]);
      if (actualIndex === -1) return prev;
      const targetSel = cur.selections[actualIndex];
      const isFirstDim = targetSel.dimensionName === labelDimensions[0]?.name;
      const depth = dimensionDepths[targetSel.dimensionName] || 0;
      const oldPrefix = targetSel.pathIds.slice(0, Math.max(depth - 1, 0));
      const nextSelections = cur.selections.map((s, i) => {
        if (i !== actualIndex) return s;
        const nextPath = [...s.pathIds];
        if (value === "unselected") {
          nextPath.splice(level - 1);
        } else {
          nextPath[level - 1] = value;
          nextPath.splice(level);
        }
        const names = nextPath.map((id) => findCategoryById(id)?.name).filter(Boolean) as string[];
        return {
          dimensionName: s.dimensionName,
          pathIds: nextPath,
          pathNames: names.length ? names : undefined,
        };
      });
      if (isFirstDim && level <= Math.max(depth - 1, 0)) {
        const filtered = nextSelections.filter((s, i) => {
          if (i === actualIndex) return true;
          if (s.dimensionName !== targetSel.dimensionName) return true;
          if (s.pathIds.length === depth && arraysEqual(s.pathIds.slice(0, Math.max(depth - 1, 0)), oldPrefix)) return false;
          if (s.pathIds.length === Math.max(depth - 1, 0) && arraysEqual(s.pathIds, oldPrefix)) return false;
          return true;
        });
        return { ...prev, [rowKey]: { ...cur, selections: filtered } };
      }
      return { ...prev, [rowKey]: { ...cur, selections: nextSelections } };
    });
  };
  const addSelectionRow = () => {
    if (!currentRow || !currentAnnotation) return;
    const rowKey = currentRow.index;
    setAnnotations((prev) => {
      const cur = prev[rowKey];
      const dim = getCurrentDimension();
      const dimSelections = cur.selections.filter((s) => s.dimensionName === dim?.name);
      const newIdx = dimSelections.length;
      setExpandedSelections({ [newIdx]: true });
      return {
        ...prev,
        [rowKey]: {
          ...cur,
          selections: [...cur.selections, { dimensionName: dim?.name || "默认分类", pathIds: [] }],
        },
      };
    });
  };
  const removeSelectionRow = (selIdx: number) => {
    if (!currentRow || !currentAnnotation) return;
    const rowKey = currentRow.index;
    setAnnotations((prev) => {
      const cur = prev[rowKey];
      const dimSelections = cur.selections.filter((s) => s.dimensionName === getCurrentDimension()?.name);
      const actualIndex = cur.selections.findIndex((s) => s === dimSelections[selIdx]);
      if (actualIndex === -1) return prev;
      const next = cur.selections.filter((_, i) => i !== actualIndex);
      return {
        ...prev,
        [rowKey]: {
          ...cur,
          selections: next.length ? next : [{ dimensionName: "默认分类", pathIds: [] }],
        },
      };
    });
  };
  const toggleSelectionExpanded = (selIdx: number) =>
    setExpandedSelections((prev) => ({ ...prev, [selIdx]: !(prev[selIdx] ?? true) }));
  const getSelectedCategoryPathNames = (pathIds: string[], dimensionName?: string): string[] => {
    const d = dimensionName ? labelDimensions.find((x) => x.name === dimensionName) : getCurrentDimension();
    if (!d) return [];
    const findIn = (id: string, nodes: LabelCategory[]): LabelCategory | null => {
      for (const n of nodes) {
        if (String(n.id) === String(id)) return n;
        if (n.children?.length) {
          const r = findIn(id, n.children);
          if (r) return r;
        }
      }
      return null;
    };
    return pathIds.map((id) => findIn(id, d.categories)?.name).filter(Boolean) as string[];
  };
  const toggleFinalCategory = (prefixPath: string[], categoryId: string) => {
    if (!currentRow || !currentAnnotation) return;
    const rowKey = currentRow.index;
    setAnnotations((prev) => {
      const cur = prev[rowKey];
      if (!cur) return prev;
      const firstDimName = labelDimensions[0]?.name;
      const depth = dimensionDepths[firstDimName || ""] || 0;
      const samePrefixSelections = cur.selections.filter(
        (s) => s.dimensionName === firstDimName && s.pathIds.length === depth && arraysEqual(s.pathIds.slice(0, -1), prefixPath)
      );
      const already = samePrefixSelections.some((s) => s.pathIds[depth - 1] === categoryId);
      let nextSelections = [...cur.selections];
      if (already) {
        nextSelections = nextSelections.filter(
          (s) => !(s.dimensionName === firstDimName && s.pathIds.length === depth && arraysEqual(s.pathIds.slice(0, -1), prefixPath) && s.pathIds[depth - 1] === categoryId)
        );
      } else {
        nextSelections.push({ dimensionName: firstDimName || "默认分类", pathIds: [...prefixPath, categoryId] });
      }
      return { ...prev, [rowKey]: { ...cur, selections: nextSelections } };
    });
  };

  const handleSaveReview = async (): Promise<boolean> => {
    if (!subtaskId) return false;
    setIsSaving(true);
    try {
      const payload = {
        annotations: Object.values(annotations).map((a) => ({
          rowIndex: a.rowIndex,
          status: a.status,
          selections: (a.selections || [])
            .filter((s) => Array.isArray(s.pathIds) && s.pathIds.length > 0)
            .map((s) => ({
              dimensionName: s.dimensionName,
              pathIds: s.pathIds,
              pathNames: s.pathNames ?? getSelectedCategoryPathNames(s.pathIds, s.dimensionName),
            })),
        })),
      };
      const res = await fetch(`/api/annotation-subtasks/${subtaskId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "保存失败");
      }
      toast({ title: "保存成功", description: "审核修改已保存" });
      return true;
    } catch (e) {
      toast({ title: "保存失败", description: e instanceof Error ? e.message : "无法保存审核修改", variant: "destructive" });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // 全局通过/不通过入口已移除，保留单条的通过/不通过操作与保存

  if (isLoading) {
    return (
      <DashboardShell>
        <DashboardHeader heading="标注审核" text="加载中..." />
        <div className="flex items-center justify-center py-12">加载数据中...</div>
      </DashboardShell>
    );
  }
  if (!currentRow || !currentAnnotation) {
    return (
      <DashboardShell>
        <DashboardHeader heading="标注审核" text="无数据" />
        <div className="flex items-center justify-center py-12">暂无可审核数据</div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="flex items-center justify-between px-2">
        <div className="grid gap-1">
          <h1 className="text-2xl font-bold tracking-wide">{taskInfo.taskName || "数据标注"}</h1>
          <div className="space-y-1">
            {taskInfo.subtaskName && (
              <p className="text-muted-foreground font-medium">{taskInfo.subtaskName}</p>
            )}
            <p className="text-sm text-muted-foreground">处理数据行 {currentIndex + 1} / {dataRows.length}</p>
          </div>
        </div>
      </div>
      {/* 提交审核按钮（编辑模式隐藏） */}
      {!isEditMode && (
        <div className="fixed bottom-6 right-6 z-40">
          <Button
            onClick={async () => {
              const allReviewed = Object.values(annotations).every((a) => a.status && a.status !== "PENDING");
              if (!allReviewed) {
                toast({ title: "未完成审核", description: "请先将所有条目标记为通过或不通过。", variant: "destructive" });
                return;
              }
              setPointsInput(String(subtaskInfo?.points ?? 0));
              setSubmitOpen(true);
            }}
          >
            提交审核
          </Button>
        </div>
      )}

      {/* 美化的提交审核弹窗 */}
      <AlertDialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>提交审核</AlertDialogTitle>
            <AlertDialogDescription>
              请确认审核结果无误后提交。       
              审核通过：<span className="font-medium text-foreground">{approvedCount} / {totalCount}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">积分</label>
            <input
              type="number"
              min={0}
              value={pointsInput}
              onChange={(e) => setPointsInput(e.target.value)}
              className="h-9 px-3 py-1 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-input w-full"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                // 先保存当前逐条审核状态
                const saved = await handleSaveReview();
                if (!saved) return; // 保存失败则终止
                const n = Number(pointsInput);
                const payload = !Number.isNaN(n) && n >= 0 ? { points: n } : {};
                try {
                  const res = await fetch(`/api/annotation-subtasks/${subtaskId}/approve-review`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                  });
                  if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.message || "提交审核失败");
                  }
                  toast({ title: "已提交审核"});
                  setSubmitOpen(false);
                  if (taskId) {
                    router.push(`/annotation-tasks/${taskId}`);
                  }
                } catch (e) {
                  toast({ title: "提交失败", description: e instanceof Error ? e.message : "提交审核失败", variant: "destructive" });
                }
              }}
            >
              确认提交
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>数据内容</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(currentRow.data).map(([k, v]) => {
                  const isUrl =
                    typeof v === "string" &&
                    (v.startsWith("http://") ||
                      v.startsWith("https://") ||
                      v.startsWith("file://") ||
                      v.startsWith("/") ||
                      (v.includes(".") && (v.includes("/") || v.includes("\\"))));
                  return (
                    <div key={k} className="space-y-1">
                      <h4 className="font-medium text-sm capitalize text-muted-foreground">{k}:</h4>
                      {isUrl ? (
                        <a
                          href={v as string}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 underline break-all"
                        >
                          {v as string}
                        </a>
                      ) : (
                        <p className="text-sm">{typeof v === "string" ? v : JSON.stringify(v)}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>标注结果</CardTitle>
              {labelDimensions.length > 1 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {labelDimensions.map((d, i) => (
                    <Button
                      key={d.name}
                      variant={currentDimensionIndex === i ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleDimensionChange(i)}
                      className="flex-1 min-w-0"
                    >
                      {d.name}
                    </Button>
                  ))}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-5">
              {(() => {
                const dimName = getCurrentDimension()?.name;
                const dimSelections = currentAnnotation.selections.filter((s) => s.dimensionName === dimName);
                const seenPrefixes = new Set<string>();
                const hasPrefixByKey: Record<string, boolean> = {};
                dimSelections.forEach((s) => {
                  const depthLocal = dimensionDepths[s.dimensionName] || 0;
                  if (
                    ENABLE_MULTI_LAST_LEVEL_FIRST_DIMENSION &&
                    s.dimensionName === labelDimensions[0]?.name &&
                    depthLocal > 0 &&
                    s.pathIds.length === depthLocal - 1
                  ) {
                    const k = s.pathIds.slice(0, depthLocal - 1).join("|");
                    hasPrefixByKey[k] = true;
                  }
                });
                return dimSelections.map((sel, selIdx) => {
                  const depth = dimensionDepths[sel.dimensionName] || 0;
                  const isFirstDim = sel.dimensionName === labelDimensions[0]?.name;
                  let shouldRender = true;
                  if (ENABLE_MULTI_LAST_LEVEL_FIRST_DIMENSION && isFirstDim) {
                    const key = sel.pathIds.slice(0, Math.max(depth - 1, 0)).join("|");
                    if (sel.pathIds.length === depth) {
                      if (hasPrefixByKey[key]) shouldRender = false;
                    }
                    if (shouldRender) {
                      if (seenPrefixes.has(key)) shouldRender = false;
                      else seenPrefixes.add(key);
                    }
                  }
                  if (!shouldRender) return null;
                  const isExpanded = expandedSelections[selIdx] ?? true;
                  const isPrefixForMulti =
                    ENABLE_MULTI_LAST_LEVEL_FIRST_DIMENSION &&
                    isFirstDim &&
                    depth > 0 &&
                    sel.pathIds.length === depth - 1;
                  const showFinalMultiArea =
                    ENABLE_MULTI_LAST_LEVEL_FIRST_DIMENSION &&
                    isFirstDim &&
                    depth > 0 &&
                    sel.pathIds.length >= depth - 1;
                  return (
                    <div key={`sel-${selIdx}`} className="border rounded-md bg-muted/30">
                      <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50" onClick={() => toggleSelectionExpanded(selIdx)}>
                        <div className="flex-1">
                          {sel.pathIds.length > 0 ? (
                            <span className="text-sm text-muted-foreground">
                              {(() => {
                                const full = getSelectedCategoryPathNames(sel.pathIds, sel.dimensionName);
                                if (
                                  ENABLE_MULTI_LAST_LEVEL_FIRST_DIMENSION &&
                                  isFirstDim &&
                                  sel.pathIds.length === depth
                                )
                                  return full.slice(0, -1).join(" → ") || full[0] || "";
                                return full.join(" → ");
                              })()}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">未选择分类</span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          {ENABLE_ADD_CATEGORY && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeSelectionRow(selIdx);
                              }}
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="p-3 space-y-3 border-t bg-muted/40">
                          {[...Array(Math.max(1, depth - (ENABLE_MULTI_LAST_LEVEL_FIRST_DIMENSION && isFirstDim ? 1 : 0)))].map((_, lvlIdx) => {
                            const level = lvlIdx + 1;
                            const allCats = getCategoriesForLevel(sel.pathIds, level, sel.dimensionName);
                            const isFirstDimLevel = isFirstDim;
                            const searchKey = getSearchKey(sel.dimensionName, selIdx, level);
                            const term = (searchQueries[searchKey] || "").toLowerCase();
                            const cats = isFirstDimLevel && term ? allCats.filter((c) => c.name.toLowerCase().includes(term)) : allCats;
                            const selected = sel.pathIds[level - 1] ?? "unselected";
                            const disabled = level > 1 && (!sel.pathIds[level - 2] || getCategoriesForLevel(sel.pathIds, level, sel.dimensionName).length === 0);
                            return (
                              <div key={`level-${selIdx}-${level}`} className="space-y-2">
                                <div className="flex items-start justify-between gap-2 relative">
                                  <Badge variant="outline" className="text-xs mt-2">{getCategoryTypeName(level, sel.dimensionName)}</Badge>
                                  {isFirstDimLevel && (
                                    <div className="relative w-40 md:w-56">
                                      <input
                                        type="text"
                                        value={searchQueries[searchKey] || ""}
                                        onChange={(e) => setSearchQueries((prev) => ({ ...prev, [searchKey]: e.target.value }))}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            e.preventDefault();
                                            setExpandedSelections((prev) => ({ ...prev, [selIdx]: true }));
                                            setOpenSelects((prev) => ({ ...prev, [searchKey]: true }));
                                          }
                                        }}
                                        placeholder={`搜索${getCategoryTypeName(level, sel.dimensionName)}`}
                                        className="h-9 px-3 py-1 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-input w-full"
                                      />
                                    </div>
                                  )}
                                </div>
                                <select
                                  value={selected}
                                  onChange={(e) => {
                                    handleLevelChange(selIdx, level, e.target.value);
                                    setOpenSelects((prev) => ({ ...prev, [searchKey]: false }));
                                    setSearchQueries((prev) => ({ ...prev, [searchKey]: "" }));
                                  }}
                                  disabled={disabled}
                                  className="w-full h-9 border rounded-md px-3 text-sm bg-white"
                                >
                                  <option value="unselected">未选择</option>
                                  {cats.map((c, i) => (
                                    <option key={`${String(c.id)}-${i}`} value={String(c.id)}>
                                      {c.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            );
                          })}
                          {showFinalMultiArea && (() => {
                            const firstDimName = labelDimensions[0]?.name;
                            const depth = dimensionDepths[sel.dimensionName] || 0;
                            const prefix = sel.pathIds.slice(0, depth - 1);
                            const key = prefix.join("|");
                            const options = getCategoriesForLevel(prefix, depth, sel.dimensionName);
                            const chosen: string[] = currentAnnotation.selections
                              .filter(
                                (s) =>
                                  s.dimensionName === sel.dimensionName &&
                                  s.pathIds.length === depth &&
                                  s.pathIds.slice(0, depth - 1).every((v, i) => v === prefix[i])
                              )
                              .map((s) => s.pathIds[depth - 1])
                              .filter(Boolean) as string[];
                            return (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <Badge variant="outline" className="text-xs">{getCategoryTypeName(depth, sel.dimensionName) || "终级分类"}</Badge>
                                  <input
                                    type="text"
                                    value={searchQueries[getSearchKey(sel.dimensionName, selIdx, depth)] || ""}
                                    onChange={(e) => setSearchQueries((prev) => ({ ...prev, [getSearchKey(sel.dimensionName, selIdx, depth)]: e.target.value }))}
                                    placeholder={`搜索${getCategoryTypeName(depth, sel.dimensionName)}`}
                                    className="h-9 px-3 py-1 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-input w-40 md:w-56"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  {options
                                    .filter((opt) => {
                                      const term = (searchQueries[getSearchKey(sel.dimensionName, selIdx, depth)] || "").toLowerCase();
                                      return term ? opt.name.toLowerCase().includes(term) : true;
                                    })
                                    .map((opt) => {
                                      const checked = chosen.includes(opt.id);
                                      return (
                                        <button
                                          type="button"
                                          key={opt.id}
                                          onClick={() => toggleFinalCategory(prefix, opt.id)}
                                          className={`text-left rounded border px-2 py-1 text-sm transition-colors ${checked ? "bg-primary/20 text-primary border-primary/50 hover:bg-primary/25" : "text-muted-foreground hover:bg-muted border-input"}`}
                                        >
                                          {opt.name}
                                        </button>
                                      );
                                    })}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
              {ENABLE_ADD_CATEGORY && (
                <Button variant="outline" onClick={addSelectionRow} className="w-full">
                  <Plus className="h-4 w-4 mr-2" /> 新增一个分类
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="fixed right-6 top-1/2 -translate-y-1/2 w-48 px-2 z-40">
        <Card className="shadow-md">
          <CardContent className="p-4">
            <div className="flex flex-col gap-2">
              <div className="text-center">
                <Badge className={currentAnnotation.status === "APPROVED" ? "bg-green-600" : currentAnnotation.status === "REJECTED" ? "bg-red-600" : "bg-gray-500"}>
                  {currentAnnotation.status === "APPROVED" ? "本条：通过" : currentAnnotation.status === "REJECTED" ? "本条：不通过" : "本条：待定"}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handlePrev} disabled={currentIndex === 0} className="justify-center flex-1">
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  
                </Button>
                <Button variant="outline" size="sm" onClick={handleNext} disabled={currentIndex === dataRows.length - 1} className="justify-center flex-1">
                  
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
              {!isEditMode && (
                <div className="flex flex-col gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentStatus("APPROVED")} className="w-full">
                    <CheckCircle2 className="h-4 w-4 mr-1" /> 通过
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setCurrentStatus("REJECTED")} className="w-full">
                    <XCircle className="h-4 w-4 mr-1" /> 不通过
                  </Button>
                </div>
              )}
              <Button onClick={handleSaveReview} disabled={isSaving} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "保存中..." : "保存"}
              </Button>
              {/* 已移除：全部通过 / 全部不通过 */}
            </div>
          </CardContent>
        </Card>
        <div className="flex justify-center mt-2">
          <Badge variant="secondary" className="select-none text-xs">
            {currentIndex + 1} / {dataRows.length}
          </Badge>
        </div>
        <p className="text-[11px] text-orange-600 text-center mt-1">离开时别忘了点“保存”哦！</p>
      </div>
    </DashboardShell>
  );
}
