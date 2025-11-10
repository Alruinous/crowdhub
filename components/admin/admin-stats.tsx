import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, FileText, Clock, CheckCircle } from "lucide-react"

interface AdminStatsProps {
  stats: {
    totalUsers: number
    totalTasks: number
    pendingTasks: number
    completedTasks: number
  }
}

export function AdminStats({ stats }: AdminStatsProps) {
  const items = [
    {
      title: "总用户数",
      value: stats.totalUsers,
      icon: Users,
    },
    {
      title: "总任务数",
      value: stats.totalTasks,
      icon: FileText,
    },
    {
      title: "待审批任务",
      value: stats.pendingTasks,
      icon: Clock,
    },
    {
      title: "已完成任务",
      value: stats.completedTasks,
      icon: CheckCircle,
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {items.map((item, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
            <item.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{item.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
