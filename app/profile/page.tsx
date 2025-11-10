import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { db } from "@/lib/db";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TaskList } from "@/components/dashboard/task-list";
import { format } from "date-fns";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  // 获取用户详细信息，包括关联的类别
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      categories: {
        include: {
          category: true,
        },
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  // 获取相关任务信息
  let publishedTasks: string | any[] = [];
  let claimedTasks: any[] = [];

  if (user.role === "PUBLISHER") {
    publishedTasks = await db.task.findMany({
      where: { publisherId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        category: true,
        publisher: {
          select: { name: true },
        },
        _count: {
          select: { subtasks: true },
        },
      },
    });
  } else if (user.role === "WORKER") {
    claimedTasks = await db.subtask.findMany({
      where: { workerId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        task: {
          include: {
            category: true,
            publisher: {
              select: { name: true },
            },
          },
        },
      },
    });
  }

  // 角色显示名称映射
  const roleNames = {
    ADMIN: "管理员",
    PUBLISHER: "发布者",
    WORKER: "接单者",
  };

  // 获取用户积分排名
  const userRank =
    (await db.user.count({
      where: {
        points: {
          gt: user.points,
        },
      },
    })) + 1;

  return (
    <DashboardShell>
      <DashboardHeader heading="个人资料" text="查看和管理您的账户信息" />

      <div className="grid gap-6">
        {/* 基本信息卡片 */}
        <Card>
          <CardHeader>
            <CardTitle>账户信息</CardTitle>
            <CardDescription>您的基本账户详情</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium">姓名</h3>
                <p className="text-sm text-muted-foreground">{user.name}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium">邮箱</h3>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium">角色</h3>
                <div className="text-sm text-muted-foreground">
                  <Badge variant="outline">
                    {roleNames[user.role] || user.role}
                  </Badge>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium">积分</h3>
                <p className="text-sm text-muted-foreground">
                  {user.points} 分（排名第 {userRank} 位）
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium">注册时间</h3>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(user.createdAt), "yyyy年MM月dd日")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 如果是工作者，显示擅长领域 */}
        {user.role === "WORKER" && (
          <Card>
            <CardHeader>
              <CardTitle>擅长领域</CardTitle>
              <CardDescription>您所选择的专业技能领域</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {user.categories.length > 0 ? (
                  user.categories.map((userCategory) => (
                    <Badge key={userCategory.categoryId} variant="secondary">
                      {userCategory.category.name}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    您尚未选择擅长领域
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 显示任务信息 */}
        {user.role === "PUBLISHER" && (
          <Card>
            <CardHeader>
              <CardTitle>我发布的任务</CardTitle>
              <CardDescription>您已发布的所有任务</CardDescription>
            </CardHeader>
            <CardContent>
              {publishedTasks.length > 0 ? (
                <TaskList
                  tasks={publishedTasks}
                  userRole={user.role}
                  pagination={{ currentPage: 1, totalPages: 1 }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  您尚未发布任何任务
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {user.role === "WORKER" && (
          <Card>
            <CardHeader>
              <CardTitle>我接受的任务</CardTitle>
              <CardDescription>您已接受的所有子任务</CardDescription>
            </CardHeader>
            <CardContent>
              {claimedTasks.length > 0 ? (
                <div className="space-y-4">
                  {claimedTasks.map((subtask) => (
                    <div key={subtask.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium">{subtask.title}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {subtask.description}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <Badge variant="outline">
                              {subtask.task.category.name}
                            </Badge>
                            <Badge
                              variant={
                                subtask.status === "COMPLETED"
                                  ? "default"
                                  : subtask.status === "PENDING_APPROVAL"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {subtask.status === "OPEN"
                                ? "待处理"
                                : subtask.status === "IN_PROGRESS"
                                ? "进行中"
                                : subtask.status === "PENDING_APPROVAL"
                                ? "待审核"
                                : subtask.status === "COMPLETED"
                                ? "已完成"
                                : subtask.status}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {subtask.points} 积分
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(subtask.createdAt), "yyyy-MM-dd")}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        主任务: {subtask.task.title} (发布者:{" "}
                        {subtask.task.publisher.name})
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  您尚未接受任何任务
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}
