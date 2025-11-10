import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { AdminShell } from "@/components/admin/admin-shell";
import { db } from "@/lib/db";
import { UserManagement } from "@/components/admin/user-management";
import { AddUserDialog } from "@/components/admin/add-user-dialog";

export default async function AdminUsersPage({ searchParams }) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  // Parse search params
  const role = searchParams.role || "ALL";
  const search = searchParams.search || "";
  const page = Number.parseInt(searchParams.page || "1");
  const limit = 10;
  const skip = (page - 1) * limit;

  // Build filter conditions
  const where = {
    role: role !== "ALL" ? role : undefined,
    OR: search
      ? [{ name: { contains: search } }, { email: { contains: search } }]
      : undefined,
  };

  // Get users
  const users = await db.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip,
    take: limit,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      points: true,
      createdAt: true,
      _count: {
        select: {
          publishedTasks: true,
          claimedTasks: true,
        },
      },
    },
  });

  // Get total count for pagination
  const totalUsers = await db.user.count({ where });
  const totalPages = Math.ceil(totalUsers / limit);

  return (
    <AdminShell>
      <DashboardHeader heading="用户管理" text="管理系统用户">
        <AddUserDialog />
      </DashboardHeader>
      <UserManagement
        users={users}
        pagination={{
          currentPage: page,
          totalPages,
        }}
      />
    </AdminShell>
  );
}
