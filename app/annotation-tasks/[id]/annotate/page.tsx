"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { use } from "react"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { ChevronLeft, ChevronRight, Save, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react"

interface DataRow {
  id: string
  index: number
  data: Record<string, any>
}

interface LabelCategory {
  id: string
  type: string
  name: string
  children?: LabelCategory[]
}

interface LabelDimension {
  name: string
  categories: LabelCategory[]
}

interface AnnotationSelection {
  dimensionName: string  // 维度名称
  pathIds: string[]
  pathNames?: string[]
}

interface AnnotationData {
  rowIndex: number
  rowData: Record<string, any>
  selections: AnnotationSelection[]     // 每个维度一个分类
  status: string
}

// ...existing code...
function normalizeCategories(nodes: any[], parentPath: string[] = []): LabelCategory[] {
  return (nodes || []).map((n: any) => {
    const seg = `${String(n.type ?? "")}:${String(n.name ?? "")}`
    const path = [...parentPath, seg]
    // 为所有分类节点生成一致的ID格式：使用路径作为唯一标识符
    const idStr = path.join(">")
    return {
      id: idStr,
      type: String(n.type ?? ""),
      name: String(n.name ?? ""),
      children: normalizeCategories(n.children || [], path),
    }
  })
}

function analyzeCategoryTree(categories: LabelCategory[], currentLevel: number = 1, levelTitles: Record<number, string> = {}): { maxDepth: number; levelTitles: Record<number, string> } {
  if (!categories || categories.length === 0) {
    return { maxDepth: 0, levelTitles }
  }
  let maxDepth = currentLevel
  for (const category of categories) {
    if (!levelTitles[currentLevel] && category.type && category.type.trim()) {
      levelTitles[currentLevel] = category.type
    }
    if (category.children && category.children.length > 0) {
      const childResult = analyzeCategoryTree(category.children, currentLevel + 1, { ...levelTitles })
      maxDepth = Math.max(maxDepth, childResult.maxDepth)
      Object.assign(levelTitles, childResult.levelTitles)
    }
  }
  return { maxDepth, levelTitles }
}

export default function AnnotationPage({ params }: { params: Promise<{ id: string }> }) {
  // 本地开关：是否允许“新增一个分类”操作
  const ENABLE_ADD_CATEGORY = true

  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const subtaskId = searchParams.get("subtaskId")
  const { id: taskId } = use(params)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [dataRows, setDataRows] = useState<DataRow[]>([])
  const [labelDimensions, setLabelDimensions] = useState<LabelDimension[]>([])
  const [annotations, setAnnotations] = useState<Record<number, AnnotationData>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [taskInfo, setTaskInfo] = useState<{ taskName: string; subtaskName: string; subtaskDescription?: string }>({ taskName: "", subtaskName: "" })
  const [dimensionDepths, setDimensionDepths] = useState<Record<string, number>>({})
  const [dimensionLevelTitles, setDimensionLevelTitles] = useState<Record<string, Record<number, string>>>({})
  const [expandedSelections, setExpandedSelections] = useState<Record<number, boolean>>({})
  const [currentDimensionIndex, setCurrentDimensionIndex] = useState(0)

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        if (!subtaskId) {
          throw new Error("缺少子任务ID")
        }

        const [dataResponse, labelResponse, existingAnnotationsResponse, taskInfoResponse, subtaskInfoResponse] = await Promise.all([
          fetch(`/api/annotation-subtasks/${subtaskId}/data`),
          fetch(`/api/annotation-tasks/${taskId}/labels`),
          fetch(`/api/annotation-subtasks/${subtaskId}/annotations`),
          fetch(`/api/annotation-tasks/${taskId}`),
          fetch(`/api/annotation-subtasks/${subtaskId}`)
        ])

        if (!dataResponse.ok || !labelResponse.ok) {
          throw new Error("无法加载标注数据")
        }

        const dataResult = await dataResponse.json()
        const labelResult = await labelResponse.json()
        const existingAnnotationsResult = existingAnnotationsResponse.ok
          ? await existingAnnotationsResponse.json()
          : { annotations: [] }

        const taskInfoResult = taskInfoResponse.ok ? await taskInfoResponse.json() : { title: "未知任务" }
        const subtaskInfoResult = subtaskInfoResponse.ok ? await subtaskInfoResponse.json() : { title: "未知子任务", description: "" }

        setDataRows(dataResult.data || [])
        setTaskInfo({
          taskName: taskInfoResult.title || "未知任务",
          subtaskName: subtaskInfoResult.title || "未知子任务",
          subtaskDescription: subtaskInfoResult.description || ""
        })

        // 处理多维度标签数据
        if (labelResult.dimensions && Array.isArray(labelResult.dimensions)) {
          // 多维度格式
          const dimensions: LabelDimension[] = labelResult.dimensions.map((dim: any) => ({
            name: dim.name,
            categories: normalizeCategories(dim.categories || [])
          }))
          setLabelDimensions(dimensions)
          
          // 为每个维度计算深度和标题
          const depths: Record<string, number> = {}
          const titles: Record<string, Record<number, string>> = {}
          
          dimensions.forEach(dimension => {
            const { maxDepth: depth, levelTitles } = analyzeCategoryTree(dimension.categories)
            depths[dimension.name] = depth
            titles[dimension.name] = levelTitles
          })
          
          setDimensionDepths(depths)
          setDimensionLevelTitles(titles)
        } else {
          // 旧的单维度格式（向后兼容）
          const normalized = normalizeCategories(labelResult.categories || [])
          const dimensionName = "默认分类"
          setLabelDimensions([{
            name: dimensionName,
            categories: normalized
          }])
          const { maxDepth: depth, levelTitles } = analyzeCategoryTree(normalized)
          setDimensionDepths({ [dimensionName]: depth })
          setDimensionLevelTitles({ [dimensionName]: levelTitles })
        }

        // 初始化或恢复标注数据（按 row.index 作为键）
        const initial: Record<number, AnnotationData> = {}
        const data: DataRow[] = dataResult.data || []

        data.forEach((row) => {
          const existing = existingAnnotationsResult.annotations?.find((ann: any) => ann.rowIndex === row.index)
          
          // 处理多维度标注数据
          let selections: AnnotationSelection[] = []
          
          if (existing) {
            // 新格式：支持多维度
            if (Array.isArray(existing.selections) && existing.selections.length > 0) {
              selections = existing.selections.map((s: any) => ({
                dimensionName: s?.dimensionName || "默认分类",
                pathIds: (s?.pathIds || []) as string[],
                pathNames: (s?.pathNames || undefined) as string[] | undefined,
              }))
            }
          }
          
          // 如果没有找到已有标注，为每个维度创建一个空白分类选择
          if (selections.length === 0) {
            selections = labelDimensions.map(dimension => ({
              dimensionName: dimension.name,
              pathIds: []
            }))
          }

          // 允许同一维度存在多条选择：仅在缺少该维度时补一条空白
          const mergedSelections: AnnotationSelection[] = [...selections]
          labelDimensions.forEach(dimension => {
            const hasThisDimension = mergedSelections.some(sel => sel.dimensionName === dimension.name)
            if (!hasThisDimension) {
              mergedSelections.push({
                dimensionName: dimension.name,
                pathIds: []
              })
            }
          })

          initial[row.index] = {
            rowIndex: row.index,
            rowData: row.data,
            selections: mergedSelections,
            status: existing?.status || "PENDING",
          }
        })

        setAnnotations(initial)
      } catch (error) {
        toast({
          title: "加载失败",
          description: "无法加载标注数据",
          variant: "destructive"
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [taskId, subtaskId, toast])

  const currentRow = dataRows[currentIndex]
  const currentAnnotation = currentRow ? annotations[currentRow.index] : undefined

  // 获取当前维度的分类
  const getCurrentDimension = () => {
    return labelDimensions[currentDimensionIndex] || labelDimensions[0]
  }

  // 确保当前维度至少有一个分类条
  useEffect(() => {
    if (!isLoading && currentRow && currentAnnotation) {
      const currentDimension = getCurrentDimension()
      const currentDimensionSelections = currentAnnotation.selections.filter(sel => sel.dimensionName === currentDimension?.name)
      
      if (currentDimensionSelections.length === 0) {
        // 当前维度没有分类条，自动创建一个
        const rowKey = currentRow.index
        setAnnotations((prev) => {
          const cur = prev[rowKey]
          return {
            ...prev,
            [rowKey]: { 
              ...cur, 
              selections: [...cur.selections, { 
                dimensionName: currentDimension?.name || "默认分类",
                pathIds: [] 
              }] 
            },
          }
        })
        
        // 展开新创建的分类条
        setExpandedSelections({ 0: true })
      }
    }
  }, [isLoading, currentRow, currentAnnotation, getCurrentDimension])

  const handleNext = () => {
    if (currentIndex < dataRows.length - 1) {
      setCurrentIndex((i) => i + 1)
    }
  }
  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1)
    }
  }

  // 根据ID查找分类
  const findCategoryById = (id: string): LabelCategory | null => {
    const dfs = (nodes: LabelCategory[]): LabelCategory | null => {
      for (const n of nodes) {
        if (String(n.id) === String(id)) return n
        if (n.children?.length) {
          const res = dfs(n.children)
          if (res) return res
        }
      }
      return null
    }
    
    // 在所有维度中查找
    for (const dimension of labelDimensions) {
      const found = dfs(dimension.categories)
      if (found) return found
    }
    return null
  }

  // 获取某一行选择的第 level 级可选项
  const getCategoriesForLevel = (pathIds: string[], level: number, dimensionName?: string): LabelCategory[] => {
    if (level === 1) {
      // 根据维度名称或当前维度索引返回分类
      const targetDimension = dimensionName 
        ? labelDimensions.find(d => d.name === dimensionName)
        : getCurrentDimension()
      return targetDimension?.categories || []
    }
    const parentId = pathIds[level - 2]
    if (!parentId) return []
    const parent = findCategoryById(parentId)
    return parent?.children || []
  }

  // 获取当前维度的分类类型名称
  const getCategoryTypeName = (level: number, dimensionName?: string): string => {
    // 根据维度名称获取对应的分类树
    const targetDimension = dimensionName 
      ? labelDimensions.find(d => d.name === dimensionName)
      : getCurrentDimension()
    
    if (targetDimension) {
      const levelTitles = dimensionLevelTitles[targetDimension.name] || {}
      return levelTitles[level] || `第${level}级分类`
    }
    return `第${level}级分类`
  }

  // 切换维度
  const handleDimensionChange = (dimensionIndex: number) => {
    setCurrentDimensionIndex(dimensionIndex)
    
    // 检查新维度是否有分类条，如果没有则自动创建一个
    if (currentRow && currentAnnotation) {
      const newDimension = labelDimensions[dimensionIndex]
      const currentDimensionSelections = currentAnnotation.selections.filter(sel => sel.dimensionName === newDimension?.name)
      
      if (currentDimensionSelections.length === 0) {
        // 当前维度没有分类条，自动创建一个
        const rowKey = currentRow.index
        setAnnotations((prev) => {
          const cur = prev[rowKey]
          return {
            ...prev,
            [rowKey]: { 
              ...cur, 
              selections: [...cur.selections, { 
                dimensionName: newDimension?.name || "默认分类",
                pathIds: [] 
              }] 
            },
          }
        })
        
        // 展开新创建的分类条
        setExpandedSelections({ 0: true })
      }
    }
  }

  // 修改某一行某级选择
  const handleLevelChange = (selIdx: number, level: number, value: string) => {
    if (!currentRow || !currentAnnotation) return
    const rowKey = currentRow.index
    setAnnotations((prev) => {
      const cur = prev[rowKey]
      if (!cur) return prev
      
      // 找到当前维度下的所有选择，然后找到对应的实际索引
      const currentDimensionSelections = cur.selections.filter(sel => sel.dimensionName === getCurrentDimension()?.name)
      const actualIndex = cur.selections.findIndex(sel => sel === currentDimensionSelections[selIdx])
      
      if (actualIndex === -1) return prev
      
      const nextSelections = cur.selections.map((s, idx) => {
        if (idx !== actualIndex) return s
        const nextPath = [...(s.pathIds || [])]
        if (value === "unselected") {
          // 清空当前级及后续
          nextPath.splice(level - 1)
        } else {
          nextPath[level - 1] = value
          nextPath.splice(level) // 清除后续级
        }
        // 同步 names（可选）
        const nextNames = nextPath
          .map((id) => findCategoryById(id)?.name)
          .filter(Boolean) as string[]
        return { 
          dimensionName: s.dimensionName, // 保留维度名称
          pathIds: nextPath, 
          pathNames: nextNames.length ? nextNames : undefined 
        }
      })
      return {
        ...prev,
        [rowKey]: { ...cur, selections: nextSelections },
      }
    })
  }

  const addSelectionRow = () => {
    if (!currentRow || !currentAnnotation) return
    const rowKey = currentRow.index
    setAnnotations((prev) => {
      const cur = prev[rowKey]
      const currentDimension = getCurrentDimension()
      
      // 获取当前维度下的选择数量，用于确定新分类的索引
      const currentDimensionSelections = cur.selections.filter(sel => sel.dimensionName === getCurrentDimension()?.name)
      const newSelectionIndex = currentDimensionSelections.length
      
      // 收起所有分类条
      const newExpandedSelections: Record<number, boolean> = {}
      
      // 展开新创建的分类条
      newExpandedSelections[newSelectionIndex] = true
      
      setExpandedSelections(newExpandedSelections)
      
      return {
        ...prev,
        [rowKey]: { ...cur, selections: [...cur.selections, { 
          dimensionName: currentDimension?.name || "默认分类", // 使用当前维度名称
          pathIds: [] 
        }] },
      }
    })
  }

  const removeSelectionRow = (selIdx: number) => {
    if (!currentRow || !currentAnnotation) return
    const rowKey = currentRow.index
    setAnnotations((prev) => {
      const cur = prev[rowKey]
      // 找到当前维度下的所有选择，然后删除对应的索引
      const currentDimensionSelections = cur.selections.filter(sel => sel.dimensionName === getCurrentDimension()?.name)
      const actualIndex = cur.selections.findIndex(sel => sel === currentDimensionSelections[selIdx])
      
      if (actualIndex === -1) return prev
      
      const next = cur.selections.filter((_, i) => i !== actualIndex)
      return {
        ...prev,
        [rowKey]: { ...cur, selections: next.length ? next : [{ 
          dimensionName: "默认分类", // 添加维度名称
          pathIds: [] 
        }] },
      }
    })
  }

  // 获取当前维度下的选择索引映射
  const getCurrentDimensionSelectionIndex = (displayIndex: number): number => {
    if (!currentAnnotation) return displayIndex
    const currentDimensionSelections = currentAnnotation.selections.filter(sel => sel.dimensionName === getCurrentDimension()?.name)
    if (displayIndex >= currentDimensionSelections.length) return displayIndex
    return currentAnnotation.selections.findIndex(sel => sel === currentDimensionSelections[displayIndex])
  }

  // 切换分类折叠状态
  const toggleSelectionExpanded = (selIdx: number) => {
    setExpandedSelections(prev => ({
      ...prev,
      [selIdx]: !prev[selIdx]
    }))
  }

  // 检查分类是否完成（所有级别都有选择）
  const isSelectionComplete = (selection: AnnotationSelection) => {
    const dimensionDepth = dimensionDepths[selection.dimensionName] || 0
    return selection.pathIds.length === dimensionDepth && selection.pathIds.every(id => id && id !== "unselected")
  }

  const getSelectedCategoryPathNames = (pathIds: string[], dimensionName?: string): string[] => {
    // 根据维度名称获取对应的分类树
    const targetDimension = dimensionName 
      ? labelDimensions.find(d => d.name === dimensionName)
      : getCurrentDimension()
    
    if (!targetDimension) return []
    
    // 在指定维度的分类树中查找
    const findCategoryInDimension = (id: string, categories: LabelCategory[]): LabelCategory | null => {
      for (const category of categories) {
        if (String(category.id) === String(id)) return category
        if (category.children && category.children.length > 0) {
          const found = findCategoryInDimension(id, category.children)
          if (found) return found
        }
      }
      return null
    }
    
    return pathIds
      .map((id) => findCategoryInDimension(id, targetDimension.categories)?.name)
      .filter(Boolean) as string[]
  }

  const handleSave = async () => {
    if (!subtaskId) {
      toast({ title: "保存失败", description: "缺少子任务信息", variant: "destructive" })
      return
    }
    setIsSaving(true)
    try {
      // 构建符合后端期望的数据格式
      const payload = {
        annotations: Object.values(annotations).map((a) => {
          // 过滤掉空的分类选择（pathIds为空数组的）
          const validSelections = a.selections.filter(s => 
            Array.isArray(s.pathIds) && s.pathIds.length > 0 && s.pathIds.some(id => id && id !== "unselected")
          )
          
          return {
            rowIndex: a.rowIndex,
            rowData: a.rowData,
            status: a.status,
            selections: validSelections.map((s) => ({
              dimensionName: s.dimensionName, // 保存维度名称
              pathIds: s.pathIds,
              pathNames: s.pathNames ?? getSelectedCategoryPathNames(s.pathIds),
            })),
          }
        }),
      }

      console.log("发送的标注数据:", JSON.stringify(payload, null, 2))

      const response = await fetch(`/api/annotation-subtasks/${subtaskId}/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        toast({ title: "保存成功", description: "标注数据已保存" })
        console.log(`跳转到路径: /annotation-tasks/${taskId}`)
        
        // 使用 setTimeout 确保路由跳转在下一个事件循环中执行
        setTimeout(() => {
          router.push(`/annotation-tasks/${taskId}`)
        }, 100)
      } else {
        const errorData = await response.json()
        console.error("保存失败响应:", errorData)
        throw new Error(errorData.message || "保存失败")
      }
    } catch (e) {
      console.error("保存标注数据异常:", e)
      toast({ 
        title: "保存失败", 
        description: e instanceof Error ? e.message : "无法保存标注数据", 
        variant: "destructive" 
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <DashboardShell>
        <DashboardHeader heading={taskInfo.taskName || "数据标注"} text="加载中..." />
        <div className="flex items-center justify-center py-12">
          <p>加载数据中...</p>
        </div>
      </DashboardShell>
    )
  }

  if (!currentRow || !currentAnnotation) {
    return (
      <DashboardShell>
        <DashboardHeader heading={taskInfo.taskName || "数据标注"} text="无数据" />
        <div className="flex items-center justify-center py-12">
          <p>暂无数据可标注</p>
        </div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <div className="flex items-center justify-between px-2">
        <div className="grid gap-1">
          <h1 className="text-2xl font-bold tracking-wide">{taskInfo.taskName || "数据标注"}</h1>
          <div className="space-y-1">
            <p className="text-muted-foreground font-medium">{taskInfo.subtaskName}</p>
            {taskInfo.subtaskDescription && (
              <p className="text-sm text-muted-foreground">{taskInfo.subtaskDescription}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧数据 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>数据内容</CardTitle>
              <CardDescription>当前条目 {currentIndex + 1} / {dataRows.length}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(currentRow.data).map(([key, value]) => {
                  // 检查是否是URL或文件路径
                  const isUrl = typeof value === 'string' && (
                    value.startsWith('http://') || 
                    value.startsWith('https://') ||
                    value.startsWith('file://') ||
                    value.startsWith('/') ||
                    value.includes('.') && (value.includes('/') || value.includes('\\'))
                  )
                  
                  return (
                    <div key={key} className="space-y-1">
                      <h4 className="font-medium text-sm capitalize text-muted-foreground">{key}:</h4>
                      {isUrl ? (
                        <a 
                          href={value} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 underline break-all"
                        >
                          {value}
                        </a>
                      ) : (
                        <p className="text-sm">
                          {typeof value === 'string' ? value : JSON.stringify(value)}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右侧分类选择（多行） */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>分类标注</CardTitle>
              {labelDimensions.length > 1 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {labelDimensions.map((dimension, index) => (
                    <Button
                      key={dimension.name}
                      variant={currentDimensionIndex === index ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleDimensionChange(index)}
                      className="flex-1 min-w-0"
                    >
                      {dimension.name}
                    </Button>
                  ))}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-5">
              {/* 只显示当前维度的分类选择 */}
              {currentAnnotation.selections
                .filter(sel => sel.dimensionName === getCurrentDimension()?.name)
                .map((sel, selIdx) => {
                  const isExpanded = expandedSelections[selIdx] || false
                  const isComplete = isSelectionComplete(sel)
                  
                  return (
                    <div key={`sel-${selIdx}`} className="border rounded-md">
                      {/* 分类头部 - 可点击折叠 */}
                      <div 
                        className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => toggleSelectionExpanded(selIdx)}
                      >
                        <div className="flex-1">
                          {sel.pathIds.length > 0 && (
                            <span className="text-sm text-muted-foreground">
                              {getSelectedCategoryPathNames(sel.pathIds, sel.dimensionName).join(" → ")}
                            </span>
                          )}
                          {sel.pathIds.length === 0 && (
                            <span className="text-sm text-muted-foreground">未选择分类</span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation()
                              removeSelectionRow(selIdx)
                            }}
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      {/* 分类内容 - 可折叠 */}
                      {isExpanded && (
                        <div className="p-3 space-y-3 border-t">
                          {/* 动态级联 */}
                          {[...Array(Math.max(1, dimensionDepths[sel.dimensionName] || 0))].map((_, levelIdx) => {
                            const level = levelIdx + 1
                            const categories = getCategoriesForLevel(sel.pathIds, level, sel.dimensionName)
                            const selected = sel.pathIds[level - 1] ?? "unselected"
                            const disabled = level > 1 && (!sel.pathIds[level - 2] || getCategoriesForLevel(sel.pathIds, level, sel.dimensionName).length === 0)

                            return (
                              <div key={`level-${selIdx}-${level}`} className="space-y-2">
                                <Badge variant="outline" className="text-xs">{getCategoryTypeName(level, sel.dimensionName)}</Badge>
                                <Select
                                  value={selected}
                                  onValueChange={(value) => handleLevelChange(selIdx, level, value)}
                                  disabled={disabled}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder={disabled ? "无可用选项" : "请选择"} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="unselected">未选择</SelectItem>
                                    {categories.map((c, i) => (
                                      <SelectItem key={`${String(c.id)}-${i}`} value={String(c.id)}>
                                        {c.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )
                          })}

                        </div>
                      )}
                    </div>
                  )
                })}

              {ENABLE_ADD_CATEGORY && (
                <Button variant="outline" onClick={addSelectionRow} className="w-full">
                  <Plus className="h-4 w-4 mr-2" /> 新增一个分类
                </Button>
              )}
            </CardContent>
          </Card>

          {/* 操作 */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-3">
                <div className="flex justify-between">
                  <Button variant="outline" size="sm" onClick={handlePrev} disabled={currentIndex === 0}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> 上一条
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleNext} disabled={currentIndex === dataRows.length - 1}>
                    下一条 <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
                <div className="text-center">
                  <Badge variant="secondary">{currentIndex + 1} / {dataRows.length}</Badge>
                </div>
                <Button onClick={handleSave} disabled={isSaving} className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? "保存中..." : "保存标注"}
                </Button>
                <Button variant="outline" onClick={() => router.back()} className="w-full">返回任务详情</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  )
}
