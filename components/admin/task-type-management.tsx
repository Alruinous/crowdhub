"use client";

import type React from "react";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash } from "lucide-react";

interface TaskTypeManagementProps {
  taskTypes: any[];
}

export function TaskTypeManagement({ taskTypes }: TaskTypeManagementProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [newTaskType, setNewTaskType] = useState("");
  const [editTaskType, setEditTaskType] = useState({ id: "", name: "" });
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // Add task type
  const addTaskType = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newTaskType.trim()) return;

    setLoadingId("new");
    try {
      const response = await fetch("/api/task-types", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newTaskType }),
      });

      if (!response.ok) {
        throw new Error("Failed to add task type");
      }

      toast({
        title: "任务类型已添加",
        description: "任务类型已成功添加",
      });

      setNewTaskType("");
      setIsAddOpen(false);
      router.refresh();
    } catch (error) {
      toast({
        title: "操作失败",
        description: "添加任务类型时发生错误",
        variant: "destructive",
      });
    } finally {
      setLoadingId(null);
    }
  };

  // Update task type
  const updateTaskType = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editTaskType.name.trim()) return;

    setLoadingId(editTaskType.id);
    try {
      const response = await fetch(`/api/task-types/${editTaskType.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: editTaskType.name }),
      });

      if (!response.ok) {
        throw new Error("Failed to update task type");
      }

      toast({
        title: "任务类型已更新",
        description: "任务类型已成功更新",
      });

      setEditTaskType({ id: "", name: "" });
      setIsEditOpen(false);
      router.refresh();
    } catch (error) {
      toast({
        title: "操作失败",
        description: "更新任务类型时发生错误",
        variant: "destructive",
      });
    } finally {
      setLoadingId(null);
    }
  };

  // Delete task type
  const deleteTaskType = async (taskTypeId: string) => {
    setLoadingId(taskTypeId);
    try {
      const response = await fetch(`/api/task-types/${taskTypeId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete task type");
      }

      toast({
        title: "任务类型已删除",
        description: "任务类型已成功删除",
      });

      router.refresh();
    } catch (error) {
      toast({
        title: "操作失败",
        description: "删除任务类型时发生错误",
        variant: "destructive",
      });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              添加任务类型
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={addTaskType}>
              <DialogHeader>
                <DialogTitle>添加任务类型</DialogTitle>
                <DialogDescription>添加新的任务类型</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">任务类型名称</Label>
                  <Input
                    id="name"
                    value={newTaskType}
                    onChange={(e) => setNewTaskType(e.target.value)}
                    placeholder="输入任务类型名称"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddOpen(false)}
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  disabled={loadingId === "new" || !newTaskType.trim()}
                >
                  {loadingId === "new" ? "添加中..." : "添加类型"}
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
              <TableHead>类型名称</TableHead>
              <TableHead>任务数量</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {taskTypes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8">
                  暂无任务类型
                </TableCell>
              </TableRow>
            ) : (
              taskTypes.map((taskType) => (
                <TableRow key={taskType.id}>
                  <TableCell className="font-medium">{taskType.name}</TableCell>
                  <TableCell>{taskType._count?.tasks || 0}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Dialog
                        open={isEditOpen && editTaskType.id === taskType.id}
                        onOpenChange={(open) => {
                          setIsEditOpen(open);
                          if (open) {
                            setEditTaskType({
                              id: taskType.id,
                              name: taskType.name,
                            });
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <form onSubmit={updateTaskType}>
                            <DialogHeader>
                              <DialogTitle>编辑任务类型</DialogTitle>
                              <DialogDescription>
                                修改任务类型名称
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                              <div className="grid gap-2">
                                <Label htmlFor="edit-name">类型名称</Label>
                                <Input
                                  id="edit-name"
                                  value={editTaskType.name}
                                  onChange={(e) =>
                                    setEditTaskType({
                                      ...editTaskType,
                                      name: e.target.value,
                                    })
                                  }
                                  placeholder="输入任务类型名称"
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsEditOpen(false)}
                              >
                                取消
                              </Button>
                              <Button
                                type="submit"
                                disabled={
                                  loadingId === taskType.id ||
                                  !editTaskType.name.trim()
                                }
                              >
                                {loadingId === taskType.id
                                  ? "更新中..."
                                  : "更新类型"}
                              </Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={taskType._count?.tasks > 0}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>确认删除</AlertDialogTitle>
                            <AlertDialogDescription>
                              您确定要删除此任务类型吗？此操作无法撤销。
                              {taskType._count?.tasks > 0 && (
                                <p className="text-red-500 mt-2">
                                  此任务类型下有关联的任务，无法删除。
                                </p>
                              )}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteTaskType(taskType.id)}
                              disabled={
                                taskType._count?.tasks > 0 ||
                                loadingId === taskType.id
                              }
                            >
                              {loadingId === taskType.id
                                ? "删除中..."
                                : "确认删除"}
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
  );
}
