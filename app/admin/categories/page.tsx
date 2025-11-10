import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { AdminShell } from "@/components/admin/admin-shell"
import { db } from "@/lib/db"
import { CategoryManagement } from "@/components/admin/category-management"

export default async function AdminCategoriesPage() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "ADMIN") {
    redirect("/login")
  }

  // Get categories with task count
  const categories = await db.category.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { tasks: true },
      },
    },
  })

  return (
    <AdminShell>
      <DashboardHeader heading="分类管理" text="管理任务分类" />

      <CategoryManagement categories={categories} />
    </AdminShell>
  )
}
