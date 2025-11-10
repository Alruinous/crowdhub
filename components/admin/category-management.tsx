"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Plus, Pencil, Trash } from "lucide-react"

interface CategoryManagementProps {
  categories: any[]
}

export function CategoryManagement({ categories }: CategoryManagementProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [newCategory, setNewCategory] = useState("")
  const [editCategory, setEditCategory] = useState({ id: "", name: "" })
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  // Add category
  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newCategory.trim()) return

    setLoadingId("new")
    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newCategory }),
      })

      if (!response.ok) {
        throw new Error("Failed to add category")
      }

      toast({
        title: "分类已添加",
        description: "分类已成功添加",
      })

      setNewCategory("")
      setIsAddOpen(false)
      router.refresh()
    } catch (error) {
      toast({
        title: "操作失败",
        description: "添加分类时发生错误",
        variant: "destructive",
      })
    } finally {
      setLoadingId(null)
    }
  }

  // Update category
  const updateCategory = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!editCategory.name.trim()) return

    setLoadingId(editCategory.id)
    try {
      const response = await fetch(`/api/categories/${editCategory.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: editCategory.name }),
      })

      if (!response.ok) {
        throw new Error("Failed to update category")
      }

      toast({
        title: "分类已更新",
        description: "分类已成功更新",
      })

      setEditCategory({ id: "", name: "" })
      setIsEditOpen(false)
      router.refresh()
    } catch (error) {
      toast({
        title: "操作失败",
        description: "更新分类时发生错误",
        variant: "destructive",
      })
    } finally {
      setLoadingId(null)
    }
  }

  // Delete category
  const deleteCategory = async (categoryId: string) => {
    setLoadingId(categoryId)
    try {
      const response = await fetch(`/api/categories/${categoryId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete category")
      }

      toast({
        title: "分类已删除",
        description: "分类已成功删除",
      })

      router.refresh()
    } catch (error) {
      toast({
        title: "操作失败",
        description: "删除分类时发生错误",
        variant: "destructive",
      })
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              添加分类
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={addCategory}>
              <DialogHeader>
                <DialogTitle>添加分类</DialogTitle>
                <DialogDescription>添加新的任务分类</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">分类名称</Label>
                  <Input
                    id="name"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="输入分类名称"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={loadingId === "new" || !newCategory.trim()}>
                  {loadingId === "new" ? "添加中..." : "添加分类"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>分类名称</TableHead>
              <TableHead>任务数量</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8">
                  暂无分类
                </TableCell>
              </TableRow>
            ) : (
              categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell>{category._count.tasks}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Dialog
                        open={isEditOpen && editCategory.id === category.id}
                        onOpenChange={(open) => {
                          setIsEditOpen(open)
                          if (open) {
                            setEditCategory({ id: category.id, name: category.name })
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <form onSubmit={updateCategory}>
                            <DialogHeader>
                              <DialogTitle>编辑分类</DialogTitle>
                              <DialogDescription>修改分类名称</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                              <div className="grid gap-2">
                                <Label htmlFor="edit-name">分类名称</Label>
                                <Input
                                  id="edit-name"
                                  value={editCategory.name}
                                  onChange={(e) => setEditCategory({ ...editCategory, name: e.target.value })}
                                  placeholder="输入分类名称"
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                                取消
                              </Button>
                              <Button type="submit" disabled={loadingId === category.id || !editCategory.name.trim()}>
                                {loadingId === category.id ? "更新中..." : "更新分类"}
                              </Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" disabled={category._count.tasks > 0}>
                            <Trash className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>确认删除</AlertDialogTitle>
                            <AlertDialogDescription>
                              您确定要删除此分类吗？此操作无法撤销。
                              {category._count.tasks > 0 && (
                                <p className="text-red-500 mt-2">此分类下有关联的任务，无法删除。</p>
                              )}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteCategory(category.id)}
                              disabled={category._count.tasks > 0 || loadingId === category.id}
                            >
                              {loadingId === category.id ? "删除中..." : "确认删除"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
