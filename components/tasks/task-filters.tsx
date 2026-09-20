"use client"

import type React from "react"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

interface TaskFiltersProps {
  categories: any[]
}

export function TaskFilters({ categories }: TaskFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // 本地开关：是否启用分类筛选（无需环境变量）
  const ENABLE_CATEGORY_FILTER = false

  // Get current filter values
  const taskType = searchParams.get("taskType") || "ALL"
  const category = ENABLE_CATEGORY_FILTER ? (searchParams.get("category") || "ALL") : "ALL"
  const search = searchParams.get("search") || ""

  // Create query string
  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("page", "1") // 任何筛选变化重置到第一页
      params.delete("status") // 状态筛选已移除，清理旧链接中遗留的参数

      if (value) {
        params.set(name, value)
      } else {
        params.delete(name)
      }

      // 如果分类筛选被禁用，则强制移除 category 参数
      if (!ENABLE_CATEGORY_FILTER) {
        params.delete("category")
      }
      return params.toString()
    },
    [searchParams],
  )

  // Handle task type change
  const handleTaskTypeChange = (value: string) => {
    router.push(`?${createQueryString("taskType", value)}`)
  }

  // Handle category change
  const handleCategoryChange = (value: string) => {
    if (!ENABLE_CATEGORY_FILTER) {
      // 禁用时始终移除 category 参数
      const params = new URLSearchParams(searchParams.toString())
      params.delete("category")
      params.set("page", "1")
      router.push(`?${params.toString()}`)
      return
    }
    router.push(`?${createQueryString("category", value)}`)
  }

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.target as HTMLFormElement)
    const searchValue = formData.get("search") as string
    console.log("Searching for:", searchValue)
    router.push(`?${createQueryString("search", searchValue)}`)
  }

  // Clear all filters
  const clearFilters = () => {
    router.push("/tasklist")
  }

  return (
    <div className="bg-muted/40 p-4 rounded-lg mb-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">任务类型</label>
          <Select value={taskType} onValueChange={handleTaskTypeChange}>
            <SelectTrigger>
              <SelectValue placeholder="所有类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">所有类型</SelectItem>
              <SelectItem value="annotationTask">标注任务</SelectItem>
              <SelectItem value="normalTask">日常任务</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {ENABLE_CATEGORY_FILTER && (
          <div>
            <label className="text-sm font-medium mb-1 block">分类</label>
            <Select value={category} onValueChange={handleCategoryChange}>
              <SelectTrigger>
                <SelectValue placeholder="所有分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">所有分类</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="md:col-span-2">
          <label className="text-sm font-medium mb-1 block">搜索</label>
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <Input
              name="search"
              placeholder="搜索任务标题或描述"
              defaultValue={search}
              className="flex-1"
            />
            <Button type="submit" size="icon" aria-label="搜索">
              <Search className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearFilters}
              className="whitespace-nowrap"
            >
              清除筛选
            </Button>
          </form>
        </div>
      </div>

      {/* 已合并清除筛选按钮到搜索行，底部区域移除 */}
    </div>
  )
}
