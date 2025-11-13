"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useSession } from "next-auth/react"

export function MainNav() {
  const pathname = usePathname()
  const { data: session } = useSession()

  const isAdmin = session?.user?.role === "ADMIN"
  const isPublisher = session?.user?.role === "PUBLISHER"

  let routes = []

  if (isAdmin) {
    // 管理员只显示管理后台
    routes = [
      {
        href: "/admin/dashboard",
        label: "管理后台",
        active: pathname.startsWith("/admin"),
      },
    ]
  } else {
    // 普通用户显示仪表盘和任务列表
    routes = [
      {
        href: "/dashboard",
        label: "仪表盘",
        active: pathname === "/dashboard",
      },
      {
        href: "/tasklist",
        label: "任务列表",
        active: pathname === "/tasklist" || pathname.startsWith("/tasklist/"),
      },
      // {
      //   href: "/profile",
      //   label: "个人资料",
      //   active: pathname === "/profile",
      // },
    ]
  }

  return (
    <nav className="flex items-center space-x-4 lg:space-x-6">
      {routes.map((route) => (
        <Link
          key={route.href}
          href={route.href}
          className={cn(
            "text-sm font-medium transition-colors hover:text-primary",
            route.active ? "text-primary" : "text-muted-foreground",
          )}
        >
          {route.label}
        </Link>
      ))}
    </nav>
  )
}
