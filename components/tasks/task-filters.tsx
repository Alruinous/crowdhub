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

  // Get current filter values
  const status = searchParams.get("status") || "ALL"
  const category = searchParams.get("category") || "ALL"
  const search = searchParams.get("search") || ""

  // Create query string
  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("page", "1") // Reset to first page on filter change

      if (value) {
        params.set(name, value)
      } else {
        params.delete(name)
      }

      return params.toString()
    },
    [searchParams],
  )

  // Handle status change
  const handleStatusChange = (value: string) => {
    router.push(`?${createQueryString("status", value)}`)
  }

  // Handle category change
  const handleCategoryChange = (value: string) => {
    router.push(`?${createQueryString("category", value)}`)
  }

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.target as HTMLFormElement)
    const searchValue = formData.get("search") as string
    router.push(`?${createQueryString("search", searchValue)}`)
  }

  // Clear all filters
  const clearFilters = () => {
    router.push("/tasklist")
  }

  return (
    <div className="bg-muted/40 p-4 rounded-lg mb-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="text-sm font-medium mb-1 block">状态</label>
          <Select value={status} onValueChange={handleStatusChange}>
            <SelectTrigger>
              <SelectValue placeholder="所有状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">所有状态</SelectItem>
              <SelectItem value="OPEN">招募中</SelectItem>
              <SelectItem value="IN_PROGRESS">进行中</SelectItem>
              <SelectItem value="COMPLETED">已完成</SelectItem>
            </SelectContent>
          </Select>
        </div>

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

        <div className="md:col-span-2">
          <label className="text-sm font-medium mb-1 block">搜索</label>
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input name="search" placeholder="搜索任务标题或描述" defaultValue={search} />
            <Button type="submit" size="icon">
              <Search className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <Button variant="outline" size="sm" onClick={clearFilters}>
          清除筛选
        </Button>
      </div>
    </div>
  )
}
