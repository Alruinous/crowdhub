import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CircleUser, FileText, CheckCircle, Coins } from "lucide-react"

interface UserStatsProps {
  user: any
  completedTasksCount?: number
}

export function UserStats({ user, completedTasksCount = 0 }: UserStatsProps) {
  if (!user) return null

  const stats = [
    {
      title: "用户角色",
      value:
        user.role === "PUBLISHER"
          ? "发布者"
          : user.role === "WORKER"
            ? "接单者"
            : user.role === "ADMIN"
              ? "管理员"
              : user.role,
      icon: CircleUser,
    },
    {
      title: "积分",
      value: user.points || 0,
      icon: Coins,
    },
    {
      title: user.role === "PUBLISHER" ? "已发布任务" : "已认领任务",
      value: user.role === "PUBLISHER" 
        ? (user._count?.publishedTasks || 0) + (user._count?.publishedAnnotationTasks || 0)
        : (user._count?.claimedTasks || 0) + (user._count?.claimedAnnotationTasks || 0),
      icon: FileText,
    },
    {
      title: "已完成任务",
      value: completedTasksCount,
      icon: CheckCircle,
    },
  ]

  return (
    <>
      {stats.map((stat, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
          </CardContent>
        </Card>
      ))}
    </>
  )
}
