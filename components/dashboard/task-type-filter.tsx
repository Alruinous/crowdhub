"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function TaskTypeFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentTaskType = searchParams.get("taskType") || "ALL"

  const handleTaskTypeChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (value && value !== "ALL") {
      params.set("taskType", value)
    } else {
      params.delete("taskType")
    }
    
    // Reset to page 1 when filter changes
    params.delete("page")
    
    router.push(`?${params.toString()}`)
  }

  return (
    <Select value={currentTaskType} onValueChange={handleTaskTypeChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="任务类型" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">全部类型</SelectItem>
        <SelectItem value="task">科普任务</SelectItem>
        <SelectItem value="annotationTask">标注任务</SelectItem>
      </SelectContent>
    </Select>
  )
}
