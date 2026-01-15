"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { use } from "react";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft,
  ChevronRight,
  Save,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// AnnotationResult from API
interface AnnotationResultData {
  id: string;
  annotationId: string;
  annotation: {
    id: string;
    rowIndex: number;
    rowData: Record<string, any>;
    status: string;
  };
  isFinished: boolean;
  selections: AnnotationSelection[];
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
}

// 辅助函数：规范化分类数据
function normalizeCategories(
  nodes: any[],
  parentPath: string[] = [],
): LabelCategory[] {
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

// 分析分类树深度和层级标题
function analyzeCategoryTree(
  categories: LabelCategory[],
  currentLevel: number = 1,
  levelTitles: Record<number, string> = {},
): { maxDepth: number; levelTitles: Record<number, string> } {
  if (!categories?.length) return { maxDepth: 0, levelTitles };
  let maxDepth = currentLevel;
  for (const c of categories) {
    if (!levelTitles[currentLevel] && c.type?.trim())
      levelTitles[currentLevel] = c.type;
    if (c.children?.length) {
      const child = analyzeCategoryTree(c.children, currentLevel + 1, {
        ...levelTitles,
      });
      maxDepth = Math.max(maxDepth, child.maxDepth);
      Object.assign(levelTitles, child.levelTitles);
    }
  }
  return { maxDepth, levelTitles };
}

export default function AnnotationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // 功能开关
  const ENABLE_ADD_CATEGORY = false; //添加新的选择行
  const ENABLE_MULTI_LAST_LEVEL_FIRST_DIMENSION = true;

  // Hooks
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { id: taskId } = use(params);

  // 状态管理
  const [currentIndex, setCurrentIndex] = useState(0);
  const [annotationResults, setAnnotationResults] = useState<AnnotationResultData[]>([]);
  const [labelDimensions, setLabelDimensions] = useState<LabelDimension[]>([]);
  const [annotations, setAnnotations] = useState<
    Record<number, AnnotationData>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [taskInfo, setTaskInfo] = useState<{
    taskName: string;
    description?: string;
  }>({ taskName: "", description: "" });
  const [dimensionDepths, setDimensionDepths] = useState<
    Record<string, number>
  >({});
  const [dimensionLevelTitles, setDimensionLevelTitles] = useState<
    Record<string, Record<number, string>>
  >({});
  const [expandedSelections, setExpandedSelections] = useState<
    Record<number, boolean>
  >({});
  const [currentDimensionIndex, setCurrentDimensionIndex] = useState(0);
  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});
  const [openSelects, setOpenSelects] = useState<Record<string, boolean>>({});

  // 工具函数
  const getSearchKey = (dimensionName: string, selIdx: number, level: number) =>
    `${dimensionName}|${selIdx}|${level}`;

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      console.log("hello")
      try {
        const [dataRes, labelRes, taskRes] =
          await Promise.all([
            fetch(`/api/annotation-tasks/${taskId}/get-annotation-data`),
            fetch(`/api/annotation-tasks/${taskId}/labels`),
            fetch(`/api/annotation-tasks/${taskId}`)
          ]);
        
        
        if (!dataRes.ok || !labelRes.ok) throw new Error("无法加载标注数据");
        const dataJson = await dataRes.json();
        const labelJson = await labelRes.json();
        const taskJson = taskRes.ok
          ? await taskRes.json()
          : { title: "未知任务" };
        setAnnotationResults(dataJson.data || []);
        setTaskInfo({
          taskName: taskJson.title || "未知任务",
          description: taskJson.description || "",
        });

        // 处理标签数据
        let dims: LabelDimension[];
        if (Array.isArray(labelJson.dimensions)) {
          dims = labelJson.dimensions.map((d: any) => ({
            name: d.name,
            categories: normalizeCategories(d.categories || []),
          }));
          setLabelDimensions(dims);
          const depths: Record<string, number> = {};
          const titles: Record<string, Record<number, string>> = {};
          dims.forEach((dim) => {
            const { maxDepth, levelTitles } = analyzeCategoryTree(
              dim.categories,
            );
            depths[dim.name] = maxDepth;
            titles[dim.name] = levelTitles;
          });
          setDimensionDepths(depths);
          setDimensionLevelTitles(titles);
        } else {
          const normalized = normalizeCategories(labelJson.categories || []);
          const dimensionName = labelJson.name || "默认分类";
          dims = [{ name: dimensionName, categories: normalized }];
          setLabelDimensions(dims);
          const { maxDepth, levelTitles } = analyzeCategoryTree(normalized);
          setDimensionDepths({ [dimensionName]: maxDepth });
          setDimensionLevelTitles({ [dimensionName]: levelTitles });
        }

        // 使用局部变量 dims 而不是 state 中的 labelDimensions
        const initial: Record<number, AnnotationData> = {};
        
        (dataJson.data || []).forEach((result: any, index: number) => {
          const rowIndex = result.annotation.rowIndex;
          const rowData = result.annotation.rowData;
          
          // 如果有已保存的标注数据，使用它；否则初始化空选择项
          let selections: AnnotationSelection[];
          if (result.selections && result.selections.length > 0) {
            console.log("!!!正在加载，数据库中已有这一条的标注结果！！！")
            // 使用已保存的标注数据
            selections = result.selections;
            
            // 如果启用了第一维度多选，需要重建前缀行
            if (ENABLE_MULTI_LAST_LEVEL_FIRST_DIMENSION && dims.length > 0) {
              const firstDimName = dims[0].name;
              const depth = dimensionDepths[firstDimName] || 0;
              
              // 找出所有第一维度的完整路径
              const firstDimComplete = selections.filter(
                (s) => s.dimensionName === firstDimName && s.pathIds.length === depth
              );
              
              // 按前缀分组
              const prefixMap = new Map<string, boolean>();
              firstDimComplete.forEach((sel) => {
                const prefix = sel.pathIds.slice(0, depth - 1);
                const key = prefix.join("|");
                prefixMap.set(key, true);
              });
              
              // 为每个前缀添加一个前缀行（如果不存在）
              prefixMap.forEach((_, key) => {
                const prefix = key.split("|");
                const hasPrefixRow = selections.some(
                  (s) => s.dimensionName === firstDimName && 
                         s.pathIds.length === depth - 1 &&
                         s.pathIds.join("|") === key
                );
                
                if (!hasPrefixRow && prefix.length > 0) {
                  selections.unshift({
                    dimensionName: firstDimName,
                    pathIds: prefix,
                  });
                }
              });
            }
          } else {
            // 初始化空的选择项
            selections = dims.map((d) => ({
              dimensionName: d.name,
              pathIds: [],
            }));
          }
          
          initial[rowIndex] = {
            rowIndex,
            rowData,
            selections,
          };
        });

        setAnnotations(initial);
      } catch (e) {
        toast({
          title: "加载失败",
          description: "无法加载标注数据",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [taskId, toast]);

  // 当前数据和维度
  const currentResult = annotationResults[currentIndex];
  const currentAnnotation = currentResult
    ? annotations[currentResult.annotation.rowIndex]
    : undefined;
  const getCurrentDimension = () =>
    labelDimensions[currentDimensionIndex] || labelDimensions[0];

  // 确保当前维度有选择项
  useEffect(() => {
    if (!isLoading && currentResult && currentAnnotation) {
      const dim = getCurrentDimension();
      const dimSelections = currentAnnotation.selections.filter(
        (s) => s.dimensionName === dim?.name,
      );
      if (!dimSelections.length) {
        const rowKey = currentResult.annotation.rowIndex;
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
  }, [isLoading, currentResult, currentAnnotation, currentDimensionIndex]);

  // 导航函数
  const handleNext = () => {
    if (currentIndex < annotationResults.length - 1) {
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

  // 分类查找和处理函数
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

  const getCategoriesForLevel = (
    pathIds: string[],
    level: number,
    dimensionName?: string,
  ): LabelCategory[] => {
    if (level === 1) {
      const d = dimensionName
        ? labelDimensions.find((x) => x.name === dimensionName)
        : getCurrentDimension();
      return d?.categories || [];
    }
    const parentId = pathIds[level - 2];
    if (!parentId) return [];
    const parent = findCategoryById(parentId);
    return parent?.children || [];
  };

  const getCategoryTypeName = (
    level: number,
    dimensionName?: string,
  ): string => {
    const d = dimensionName
      ? labelDimensions.find((x) => x.name === dimensionName)
      : getCurrentDimension();
    const titles = d ? dimensionLevelTitles[d.name] || {} : {};
    return titles[level] || `第${level}级分类`;
  };

  // 维度切换处理
  const handleDimensionChange = (idx: number) => {
    setCurrentDimensionIndex(idx);
    if (currentResult && currentAnnotation) {
      const dim = labelDimensions[idx];
      const dimSelections = currentAnnotation.selections.filter(
        (s) => s.dimensionName === dim?.name,
      );
      if (!dimSelections.length) {
        const rowKey = currentResult.annotation.rowIndex;
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

  // 处理分类层级选择变化
  const handleLevelChange = (selIdx: number, level: number, value: string) => {
    if (!currentResult || !currentAnnotation) return;
    const rowKey = currentResult.annotation.rowIndex;
    setAnnotations((prev) => {
      const cur = prev[rowKey];
      if (!cur) return prev;
      const dimSelections = cur.selections.filter(
        (s) => s.dimensionName === getCurrentDimension()?.name,
      );
      const actualIndex = cur.selections.findIndex(
        (s) => s === dimSelections[selIdx],
      );
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
        const names = nextPath
          .map((id) => findCategoryById(id)?.name)
          .filter(Boolean) as string[];
        return {
          dimensionName: s.dimensionName,
          pathIds: nextPath,
          pathNames: names.length ? names : undefined,
        };
      });
      // 如果在首维度修改到了倒数第二级（或更上层），视为“修改而非新增”：清理旧前缀下的完整行和旧前缀行
      if (isFirstDim && level <= Math.max(depth - 1, 0)) {
        const filtered = nextSelections.filter((s, i) => {
          if (i === actualIndex) return true;
          if (s.dimensionName !== targetSel.dimensionName) return true;
          if (
            s.pathIds.length === depth &&
            arraysEqual(s.pathIds.slice(0, Math.max(depth - 1, 0)), oldPrefix)
          )
            return false;
          if (
            s.pathIds.length === Math.max(depth - 1, 0) &&
            arraysEqual(s.pathIds, oldPrefix)
          )
            return false;
          return true;
        });
        return { ...prev, [rowKey]: { ...cur, selections: filtered } };
      }
      return { ...prev, [rowKey]: { ...cur, selections: nextSelections } };
    });
  };

  // 添加新的选择行
  const addSelectionRow = () => {
    if (!currentResult || !currentAnnotation) return;
    const rowKey = currentResult.annotation.rowIndex;
    setAnnotations((prev) => {
      const cur = prev[rowKey];
      const dim = getCurrentDimension();
      const dimSelections = cur.selections.filter(
        (s) => s.dimensionName === dim?.name,
      );
      const newIdx = dimSelections.length;
      setExpandedSelections({ [newIdx]: true });
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
  };

  //删除某个选择行
  const removeSelectionRow = (selIdx: number) => {
    if (!currentResult || !currentAnnotation) return;
    const rowKey = currentResult.annotation.rowIndex;
    setAnnotations((prev) => {
      const cur = prev[rowKey];
      const dimSelections = cur.selections.filter(
        (s) => s.dimensionName === getCurrentDimension()?.name,
      );
      const actualIndex = cur.selections.findIndex(
        (s) => s === dimSelections[selIdx],
      );
      if (actualIndex === -1) return prev;
      const next = cur.selections.filter((_, i) => i !== actualIndex);
      return {
        ...prev,
        [rowKey]: {
          ...cur,
          selections: next.length
            ? next
            : [{ dimensionName: "默认分类", pathIds: [] }],
        },
      };
    });
  };

  const toggleSelectionExpanded = (selIdx: number) =>
    setExpandedSelections((prev) => ({ ...prev, [selIdx]: !prev[selIdx] }));

  const getSelectedCategoryPathNames = (
    pathIds: string[],
    dimensionName?: string,
  ): string[] => {
    const d = dimensionName
      ? labelDimensions.find((x) => x.name === dimensionName)
      : getCurrentDimension();
    if (!d) return [];
    const findIn = (
      id: string,
      nodes: LabelCategory[],
    ): LabelCategory | null => {
      for (const n of nodes) {
        if (String(n.id) === String(id)) return n;
        if (n.children?.length) {
          const r = findIn(id, n.children);
          if (r) return r;
        }
      }
      return null;
    };
    return pathIds
      .map((id) => findIn(id, d.categories)?.name)
      .filter(Boolean) as string[];
  };

  // 检查标注是否完成：所有维度都有完整的选择结果
  const isAnnotationComplete = (annotationData: AnnotationData): boolean => {
    // 获取所有维度名称
    const allDimensions = labelDimensions.map((d) => d.name);
    
    // 按维度分组 selections，只保留完整路径（过滤前缀行）
    const completeSelectionsByDimension = new Map<string, AnnotationSelection[]>();
    
    annotationData.selections.forEach((sel) => {
      const depth = dimensionDepths[sel.dimensionName] || 0;
      
      // 只统计完整路径（pathIds.length === depth）
      if (sel.pathIds.length === depth && sel.pathIds.length > 0) {
        if (!completeSelectionsByDimension.has(sel.dimensionName)) {
          completeSelectionsByDimension.set(sel.dimensionName, []);
        }
        completeSelectionsByDimension.get(sel.dimensionName)!.push(sel);
      }
    });
    
    // 检查每个维度是否都有至少一个完整的选择
    for (const dimName of allDimensions) {
      const completeSelections = completeSelectionsByDimension.get(dimName) || [];
      if (completeSelections.length === 0) {
        return false; // 该维度没有完整的选择
      }
    }
    
    return true; // 所有维度都有完整的选择
  };

  // 保存标注数据
  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      // 筛选出标注完整的条目，并过滤出完整路径的 selections
      const completeAnnotations = annotationResults
        .map((result) => {
          const rowIndex = result.annotation.rowIndex;
          const annotationData = annotations[rowIndex];
          
          // 检查该条目是否完整
          if (annotationData && isAnnotationComplete(annotationData)) {
            // 过滤出完整路径的 selections（排除前缀行）
            const completeSelections = annotationData.selections.filter((sel) => {
              const depth = dimensionDepths[sel.dimensionName] || 0;
              return sel.pathIds.length === depth && sel.pathIds.length > 0;
            });

            return {
              annotationResultId: result.id,
              selections: completeSelections,
            };
          }
          return null;
        })
        .filter(Boolean) as Array<{
          annotationResultId: string;
          selections: AnnotationSelection[];
        }>;

      if (completeAnnotations.length === 0) {
        setIsSaving(false);
        return;
      }

      // 批量发送所有完整标注到 API
      const response = await fetch(
        `/api/annotation-tasks/${taskId}/save-annotations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ annotations: completeAnnotations }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "保存标注失败");
      }

      const result = await response.json();

      toast({
        description: result.message,
      });

    } catch (error) {
      console.error("保存标注失败:", error);
      toast({
        title: "保存失败",
        description:
          error instanceof Error ? error.message : "保存标注时发生错误",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 多选终级：同步复选结果 -> selection rows
  const toggleFinalCategory = (prefixPath: string[], categoryId: string) => {
    if (!currentResult || !currentAnnotation) return;
    const rowKey = currentResult.annotation.rowIndex;
    setAnnotations((prev) => {
      const cur = prev[rowKey];
      if (!cur) return prev;
      const firstDimName = labelDimensions[0]?.name;
      const depth = dimensionDepths[firstDimName || ""] || 0;
      const samePrefixSelections = cur.selections.filter(
        (s) =>
          s.dimensionName === firstDimName &&
          s.pathIds.length === depth &&
          arraysEqual(s.pathIds.slice(0, -1), prefixPath),
      );
      const already = samePrefixSelections.some(
        (s) => s.pathIds[depth - 1] === categoryId,
      );
      let nextSelections = [...cur.selections];
      if (already) {
        nextSelections = nextSelections.filter(
          (s) =>
            !(
              s.dimensionName === firstDimName &&
              s.pathIds.length === depth &&
              arraysEqual(s.pathIds.slice(0, -1), prefixPath) &&
              s.pathIds[depth - 1] === categoryId
            ),
        );
      } else {
        const fullPath = [...prefixPath, categoryId];
        const names = fullPath
          .map((id) => findCategoryById(id)?.name)
          .filter(Boolean) as string[];
        nextSelections.push({
          dimensionName: firstDimName || "默认分类",
          pathIds: fullPath,
          pathNames: names.length ? names : undefined,
        });
      }
      return { ...prev, [rowKey]: { ...cur, selections: nextSelections } };
    });
  };

  const arraysEqual = (a: string[], b: string[]) =>
    a.length === b.length && a.every((v, i) => v === b[i]);

  // 加载中状态
  if (isLoading)
    return (
      <DashboardShell>
        <DashboardHeader
          heading={taskInfo.taskName || "数据标注"}
          text="加载中..."
        />
        <div className="flex items-center justify-center py-12">
          <p>加载数据中...</p>
        </div>
      </DashboardShell>
    );

  // 无数据状态
  if (!currentResult || !currentAnnotation)
    return (
      <DashboardShell>
        <DashboardHeader
          heading={taskInfo.taskName || "数据标注"}
          text="无数据"
        />
        <div className="flex items-center justify-center py-12">
          <p>暂无数据可标注</p>
        </div>
      </DashboardShell>
    );

  // 构建多选状态
  const firstDimName = labelDimensions[0]?.name;
  const firstDimDepth = firstDimName ? dimensionDepths[firstDimName] || 0 : 0;

  const buildFinalMultiSelectState = () => {
    const result: Record<
      string,
      { prefix: string[]; chosen: string[]; options: LabelCategory[] }
    > = {};
    if (!firstDimName || !ENABLE_MULTI_LAST_LEVEL_FIRST_DIMENSION)
      return result;
    const selections = currentAnnotation.selections.filter(
      (s) => s.dimensionName === firstDimName,
    );
    selections.forEach((s) => {
      if (s.pathIds.length >= firstDimDepth - 1) {
        const prefix = s.pathIds.slice(0, firstDimDepth - 1);
        const key = prefix.join("|");
        if (!result[key]) {
          const options = getCategoriesForLevel(
            prefix,
            firstDimDepth,
            firstDimName,
          );
          result[key] = { prefix, chosen: [], options };
        }
        if (s.pathIds.length === firstDimDepth) {
          const finalId = s.pathIds[firstDimDepth - 1];
          if (finalId) result[key].chosen.push(finalId);
        }
      }
    });
    return result;
  };

  const multiSelectState = buildFinalMultiSelectState();

  // 渲染主界面
  return (
    <DashboardShell>
      <div className="flex items-center justify-between px-2">
        <div className="grid gap-1">
          <h1 className="text-2xl font-bold tracking-wide">
            {taskInfo.taskName || "数据标注"}
          </h1>
          {taskInfo.description && (
            <p className="text-sm text-muted-foreground">
              {taskInfo.description}
            </p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>数据内容</CardTitle>
              {/* <CardDescription>
                当前条目 {currentIndex + 1} / {dataRows.length}
              </CardDescription> */}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentResult && Object.entries(currentResult.annotation.rowData).map(([k, v]) => {
                  const isUrl =
                    typeof v === "string" &&
                    (v.startsWith("http://") ||
                      v.startsWith("https://") ||
                      v.startsWith("file://") ||
                      v.startsWith("/") ||
                      (v.includes(".") &&
                        (v.includes("/") || v.includes("\\"))));
                  return (
                    <div key={k} className="space-y-1">
                      <h4 className="font-medium text-sm capitalize text-muted-foreground">
                        {k}:
                      </h4>
                      {isUrl ? (
                        <a
                          href={v}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 underline break-all"
                        >
                          {v}
                        </a>
                      ) : (
                        <p className="text-sm">
                          {typeof v === "string" ? v : JSON.stringify(v)}
                        </p>
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
              <CardTitle>分类标注</CardTitle>
              {labelDimensions.length > 1 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {labelDimensions.map((d, i) => (
                    <Button
                      key={d.name}
                      variant={
                        currentDimensionIndex === i ? "default" : "outline"
                      }
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
                const dimSelections = currentAnnotation.selections.filter(
                  (s) => s.dimensionName === dimName,
                );
                const seenPrefixes = new Set<string>();
                const hasPrefixByKey: Record<string, boolean> = {};
                // 先标记首维度中已有的前缀行（长度=depth-1）
                dimSelections.forEach((s) => {
                  const depthLocal = dimensionDepths[s.dimensionName] || 0;
                  if (
                    ENABLE_MULTI_LAST_LEVEL_FIRST_DIMENSION &&
                    s.dimensionName === firstDimName &&
                    depthLocal > 0 &&
                    s.pathIds.length === depthLocal - 1
                  ) {
                    const k = s.pathIds.slice(0, depthLocal - 1).join("|");
                    hasPrefixByKey[k] = true;
                  }
                });
                return dimSelections.map((sel, selIdx) => {
                  const depth = dimensionDepths[sel.dimensionName] || 0;
                  const isFirstDim = sel.dimensionName === firstDimName;
                  let shouldRender = true;
                  if (ENABLE_MULTI_LAST_LEVEL_FIRST_DIMENSION && isFirstDim) {
                    const key = sel.pathIds
                      .slice(0, Math.max(depth - 1, 0))
                      .join("|");
                    if (sel.pathIds.length === depth) {
                      // 若已有前缀行，则隐藏完整行
                      if (hasPrefixByKey[key]) shouldRender = false;
                    }
                    if (shouldRender) {
                      // 每个前缀只保留第一张卡
                      if (seenPrefixes.has(key)) shouldRender = false;
                      else seenPrefixes.add(key);
                    }
                  }
                  if (!shouldRender) return null;
                  const isExpanded = expandedSelections[selIdx] || false;
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
                    <div
                      key={`sel-${selIdx}`}
                      className="border rounded-md bg-muted/30"
                    >
                      <div
                        className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleSelectionExpanded(selIdx)}
                      >
                        <div className="flex-1">
                          {sel.pathIds.length > 0 ? (
                            <span className="text-sm text-muted-foreground">
                              {(() => {
                                const full = getSelectedCategoryPathNames(
                                  sel.pathIds,
                                  sel.dimensionName,
                                );
                                if (
                                  ENABLE_MULTI_LAST_LEVEL_FIRST_DIMENSION &&
                                  isFirstDim &&
                                  sel.pathIds.length === depth
                                )
                                  return (
                                    full.slice(0, -1).join(" → ") ||
                                    full[0] ||
                                    ""
                                  );
                                return full.join(" → ");
                              })()}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              未选择分类
                            </span>
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
                          {[
                            ...Array(
                              Math.max(
                                1,
                                depth -
                                  (ENABLE_MULTI_LAST_LEVEL_FIRST_DIMENSION &&
                                  isFirstDim
                                    ? 1
                                    : 0),
                              ),
                            ),
                          ].map((_, lvlIdx) => {
                            const level = lvlIdx + 1;
                            const allCats = getCategoriesForLevel(
                              sel.pathIds,
                              level,
                              sel.dimensionName,
                            );
                            const isFirstDimLevel = isFirstDim;
                            const searchKey = getSearchKey(
                              sel.dimensionName,
                              selIdx,
                              level,
                            );
                            const term = (searchQueries[searchKey] || "").toLowerCase();
                            const cats =
                              isFirstDimLevel && term
                                ? allCats.filter((c) =>
                                    c.name.toLowerCase().includes(term),
                                  )
                                : allCats;
                            const selected =
                              sel.pathIds[level - 1] || "unselected";
                            const disabled =
                              level > 1 &&
                              (!sel.pathIds[level - 2] ||
                                getCategoriesForLevel(
                                  sel.pathIds,
                                  level,
                                  sel.dimensionName,
                                ).length === 0);
                            return (
                              <div
                                key={`level-${selIdx}-${level}`}
                                className="space-y-2"
                              >
                                <div className="flex items-start justify-between gap-2 relative">
                                  <Badge variant="outline" className="text-xs mt-2">
                                    {getCategoryTypeName(level, sel.dimensionName)}
                                  </Badge>
                                  {isFirstDimLevel && (
                                    <div className="relative w-40 md:w-56">
                                      <input
                                        type="text"
                                        value={searchQueries[searchKey] || ""}
                                        onChange={(e) =>
                                          setSearchQueries((prev) => ({
                                            ...prev,
                                            [searchKey]: e.target.value,
                                          }))
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            e.preventDefault();
                                            // 展开当前选择卡并打开对应的 Select 下拉
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
                                <Select
                                  value={selected}
                                  onValueChange={(v) => {
                                    handleLevelChange(selIdx, level, v);
                                    // 选择后关闭下拉并清空搜索
                                    setOpenSelects((prev) => ({ ...prev, [searchKey]: false }));
                                    setSearchQueries((prev) => ({ ...prev, [searchKey]: "" }));
                                  }}
                                  disabled={disabled}
                                  open={openSelects[searchKey] || false}
                                  onOpenChange={(open) =>
                                    setOpenSelects((prev) => ({ ...prev, [searchKey]: open }))
                                  }
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue
                                      placeholder={
                                        disabled ? "无可用选项" : "请选择"
                                      }
                                    />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="unselected">
                                      未选择
                                    </SelectItem>
                                    {cats.map((c, i) => (
                                      <SelectItem
                                        key={`${String(c.id)}-${i}`}
                                        value={String(c.id)}
                                      >
                                        {c.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            );
                          })}
                          {showFinalMultiArea &&
                            (() => {
                              const prefix = sel.pathIds.slice(0, depth - 1);
                              const key = prefix.join("|");
                              let multi = multiSelectState[key];
                              if (!multi) {
                                const options = getCategoriesForLevel(
                                  prefix,
                                  depth,
                                  sel.dimensionName,
                                );
                                const chosen: string[] =
                                  currentAnnotation.selections
                                    .filter(
                                      (s) =>
                                        s.dimensionName === sel.dimensionName &&
                                        s.pathIds.length === depth &&
                                        s.pathIds
                                          .slice(0, depth - 1)
                                          .every((v, i) => v === prefix[i]),
                                    )
                                    .map((s) => s.pathIds[depth - 1])
                                    .filter(Boolean) as string[];
                                multi = { prefix, options, chosen };
                              }
                              const title =
                                getCategoryTypeName(depth, sel.dimensionName) ||
                                "终级分类";
                              const finalSearchKey = getSearchKey(
                                sel.dimensionName,
                                selIdx,
                                depth,
                              );
                              const finalTerm = (searchQueries[finalSearchKey] || "").toLowerCase();
                              const finalOptions = finalTerm
                                ? multi.options.filter((opt) =>
                                    opt.name.toLowerCase().includes(finalTerm),
                                  )
                                : multi.options;
                              return (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <Badge variant="outline" className="text-xs">
                                      {title}
                                    </Badge>
                                    <input
                                      type="text"
                                      value={searchQueries[finalSearchKey] || ""}
                                      onChange={(e) =>
                                        setSearchQueries((prev) => ({
                                          ...prev,
                                          [finalSearchKey]: e.target.value,
                                        }))
                                      }
                                      placeholder={`搜索${title}`}
                                      className="h-9 px-3 py-1 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-input w-40 md:w-56"
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    {finalOptions.map((opt) => {
                                      const checked = multi!.chosen.includes(
                                        opt.id,
                                      );
                                      return (
                                        <button
                                          type="button"
                                          key={opt.id}
                                          onClick={() =>
                                            toggleFinalCategory(
                                              multi!.prefix,
                                              opt.id,
                                            )
                                          }
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
                <Button
                  variant="outline"
                  onClick={addSelectionRow}
                  className="w-full"
                >
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
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="w-full justify-center"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                上一条
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNext}
                disabled={currentIndex === annotationResults.length - 1}
                className="w-full justify-center"
              >
                下一条
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "保存中..." : "保存标注"}
              </Button>
              <div className="flex justify-center">
                <Badge variant="secondary" className="select-none text-xs">
                  {currentIndex + 1} / {annotationResults.length}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        <p className="text-xs text-orange-600 text-center mt-2">
          离开时记得点"保存标注"哦！
        </p>
      </div>
    </DashboardShell>
  );
}
