"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PlusCircle, FileText, Database } from "lucide-react"
import { useRouter } from "next/navigation"

interface TaskTypeSelectorProps {
  children?: React.ReactNode
}

export function TaskTypeSelector({ children }: TaskTypeSelectorProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const handleTaskTypeSelect = (type: "general" | "annotation") => {
    setOpen(false)
    if (type === "general") {
      router.push("/tasks/create")
    } else {
      router.push("/annotation-tasks/create")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            发布任务
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>选择任务类型</DialogTitle>
          <DialogDescription>
            请选择您要发布的任务类型
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 gap-4">
          <Card 
            className="cursor-pointer hover:bg-accent transition-colors"
            onClick={() => handleTaskTypeSelect("general")}
          >
            <CardHeader className="flex flex-row items-center space-y-0 pb-2">
              <FileText className="h-6 w-6 mr-2 text-blue-600" />
              <CardTitle className="text-base">科普任务</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                创建普通的科普任务，包含任务描述、积分设置和子任务分解
              </CardDescription>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:bg-accent transition-colors"
            onClick={() => handleTaskTypeSelect("annotation")}
          >
            <CardHeader className="flex flex-row items-center space-y-0 pb-2">
              <Database className="h-6 w-6 mr-2 text-green-600" />
              <CardTitle className="text-base">数据标注任务</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                创建数据标注任务，需要上传数据文件和标签体系，支持批量标注
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}
