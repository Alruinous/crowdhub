import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { db } from "@/lib/db";
import { Separator } from "@/components/ui/separator";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { CategorySettings } from "@/components/settings/category-settings";
import { PointsRecharge } from "@/components/settings/points-recharge";

export default async function SettingsPage() {
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

  // 获取所有类别，用于Worker选择擅长领域
  const categories = await db.category.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <DashboardShell>
      <DashboardHeader heading="账户设置" text="管理您的账户信息和偏好设置" />

      <div className="grid gap-6">
        {/* 个人信息设置 */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold">个人信息</h2>
          <Separator />
          <ProfileSettings user={user} />
        </div>

        {/* 根据角色显示不同设置 */}
        {user.role === "WORKER" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">擅长领域设置</h2>
            <Separator />
            <CategorySettings
              userId={user.id}
              existingCategories={user.categories.map((uc) => uc.category)}
              allCategories={categories}
            />
          </div>
        )}

        {user.role === "PUBLISHER" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">积分充值</h2>
            <Separator />
            <PointsRecharge userId={user.id} currentPoints={user.points} />
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
