"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  FileText,
  Tag,
  Settings,
  Layers,
  Cpu,
} from "lucide-react";

export function AdminNav() {
  const pathname = usePathname();

  const routes = [
    {
      href: "/admin/dashboard",
      label: "仪表盘",
      icon: LayoutDashboard,
      active: pathname === "/admin/dashboard",
    },
    {
      href: "/admin/users",
      label: "用户管理",
      icon: Users,
      active: pathname === "/admin/users",
    },
    {
      href: "/admin/tasks",
      label: "任务管理",
      icon: FileText,
      active: pathname === "/admin/tasks",
    },
    {
      href: "/admin/categories",
      label: "分类管理",
      icon: Tag,
      active: pathname === "/admin/categories",
    },
    {
      href: "/admin/task-types",
      label: "任务类型管理",
      icon: Layers,
      active: pathname === "/admin/task-types",
    },
    {
      href: "/admin/ai-configs",
      label: "AI 配置",
      icon: Cpu,
      active: pathname === "/admin/ai-configs",
    },
  ];

  return (
    <nav className="grid gap-2">
      {routes.map((route) => (
        <Button
          key={route.href}
          variant={route.active ? "default" : "ghost"}
          className={cn(
            "justify-start",
            route.active ? "bg-muted hover:bg-muted text-primary" : ""
          )}
          asChild
        >
          <Link href={route.href}>
            <route.icon className="mr-2 h-4 w-4" />
            {route.label}
          </Link>
        </Button>
      ))}
    </nav>
  );
}
