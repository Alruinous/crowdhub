"use client"

import Link from "next/link"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { MoreHorizontal, Ban, UserCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface UserManagementProps {
  users: any[]
  pagination: {
    currentPage: number
    totalPages: number
  }
}

export function UserManagement({ users, pagination }: UserManagementProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">暂无用户</p>
      </div>
    )
  }

  // Ban user
  const banUser = async (userId: string) => {
    setLoadingId(userId)
    try {
      const response = await fetch(`/api/users/${userId}/ban`, {
        method: "PATCH",
      })

      if (!response.ok) {
        throw new Error("Failed to ban user")
      }

      toast({
        title: "用户已禁用",
        description: "用户账号已被禁用",
      })

      router.refresh()
    } catch (error) {
      toast({
        title: "操作失败",
        description: "禁用用户时发生错误",
        variant: "destructive",
      })
    } finally {
      setLoadingId(null)
    }
  }

  // Unban user
  const unbanUser = async (userId: string) => {
    setLoadingId(userId)
    try {
      const response = await fetch(`/api/users/${userId}/unban`, {
        method: "PATCH",
      })

      if (!response.ok) {
        throw new Error("Failed to unban user")
      }

      toast({
        title: "用户已启用",
        description: "用户账号已被启用",
      })

      router.refresh()
    } catch (error) {
      toast({
        title: "操作失败",
        description: "启用用户时发生错误",
        variant: "destructive",
      })
    } finally {
      setLoadingId(null)
    }
  }

  // Get role badge color
  const getRoleBadge = (role: string) => {
    switch (role) {
      case "ADMIN":
        return <Badge className="bg-red-500">管理员</Badge>
      case "PUBLISHER":
        return <Badge className="bg-blue-500">发布者</Badge>
      case "WORKER":
        return <Badge className="bg-green-500">接单者</Badge>
      default:
        return <Badge>{role}</Badge>
    }
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>用户名</TableHead>
            <TableHead>邮箱</TableHead>
            <TableHead>角色</TableHead>
            <TableHead>积分</TableHead>
            <TableHead>注册时间</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.name}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{getRoleBadge(user.role)}</TableCell>
              <TableCell>{user.points}</TableCell>
              <TableCell>
                {formatDistanceToNow(new Date(user.createdAt), {
                  addSuffix: true,
                  locale: zhCN,
                })}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>操作</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {user.banned ? (
                      <DropdownMenuItem
                        onClick={() => unbanUser(user.id)}
                        disabled={loadingId === user.id || user.role === "ADMIN"}
                      >
                        <UserCheck className="mr-2 h-4 w-4" />
                        启用账号
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={() => banUser(user.id)}
                        disabled={loadingId === user.id || user.role === "ADMIN"}
                      >
                        <Ban className="mr-2 h-4 w-4" />
                        禁用账号
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 p-4">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
            <Button key={page} variant={page === pagination.currentPage ? "default" : "outline"} size="sm" asChild>
              <Link
                href={{
                  query: { page },
                }}
              >
                {page}
              </Link>
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
