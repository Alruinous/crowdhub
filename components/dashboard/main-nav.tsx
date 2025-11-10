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

  const routes = [
    {
      href: "/dashboard",
      label: "仪表盘",
      active: pathname === "/dashboard",
    },
    {
      href: "/tasks",
      label: "任务列表",
      active: pathname === "/tasks" || pathname.startsWith("/tasks/"),
    },
    // {
    //   href: "/profile",
    //   label: "个人资料",
    //   active: pathname === "/profile",
    // },
  ]

  // Add admin routes if user is admin
  if (isAdmin) {
    routes.push({
      href: "/admin/dashboard",
      label: "管理后台",
      active: pathname.startsWith("/admin"),
    })
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
