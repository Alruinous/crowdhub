"use client";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Zap } from "lucide-react";

interface AIConfig {
  id: string;
  key: string;
  value: string;
  label: string;
  createdAt: Date;
  updatedAt: Date;
}

interface AIManagementProps {
  configs: AIConfig[];
}

export function AIManagement({ configs }: AIManagementProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [editConfig, setEditConfig] = useState<{
    id: string;
    key: string;
    value: string;
    label: string;
  }>({
    id: "",
    key: "",
    value: "",
    label: "",
  });
  const [isEditOpen, setIsEditOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // Update AI config
  const updateConfig = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editConfig.value.trim()) return;

    setLoadingId(editConfig.id);
    try {
      const response = await fetch(`/api/ai-configs/${editConfig.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ value: editConfig.value }),
      });

      if (!response.ok) {
        throw new Error("Failed to update AI configuration");
      }

      toast({
        title: "配置已更新",
        description: "AI配置已成功更新",
      });

      setEditConfig({ id: "", key: "", value: "", label: "" });
      setIsEditOpen(false);
      router.refresh();
    } catch (error) {
      toast({
        title: "操作失败",
        description: "更新AI配置时发生错误",
        variant: "destructive",
      });
    } finally {
      setLoadingId(null);
    }
  };

  // Test AI connection
  const testConnection = async () => {
    setLoadingId("test");
    try {
      const response = await fetch("/api/ai-configs/test", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to connect to AI service");
      }

      const data = await response.json();

      toast({
        title: "连接成功",
        description: `成功连接到AI服务: ${data.model}`,
      });
    } catch (error) {
      toast({
        title: "连接失败",
        description: "无法连接到AI服务，请检查配置",
        variant: "destructive",
      });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={testConnection} disabled={loadingId === "test"}>
          <Zap className="mr-2 h-4 w-4" />
          {loadingId === "test" ? "测试中..." : "测试连接"}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>键名</TableHead>
              <TableHead>值</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {configs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  暂无配置
                </TableCell>
              </TableRow>
            ) : (
              configs.map((config) => (
                <TableRow key={config.id}>
                  <TableCell className="font-medium">{config.label}</TableCell>
                  <TableCell>{config.key}</TableCell>
                  <TableCell>
                    <span className="max-w-[300px] truncate inline-block">
                      {config.value}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <Dialog
                        open={isEditOpen && editConfig.id === config.id}
                        onOpenChange={(open) => {
                          setIsEditOpen(open);
                          if (open) {
                            setEditConfig({
                              id: config.id,
                              key: config.key,
                              value: config.value,
                              label: config.label,
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
                          <form onSubmit={updateConfig}>
                            <DialogHeader>
                              <DialogTitle>编辑 AI 配置</DialogTitle>
                              <DialogDescription>
                                修改 {config.label} 的配置值
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                              <div className="grid gap-2">
                                <Label htmlFor="edit-value">配置值</Label>
                                <Input
                                  id="edit-value"
                                  value={editConfig.value}
                                  onChange={(e) =>
                                    setEditConfig({
                                      ...editConfig,
                                      value: e.target.value,
                                    })
                                  }
                                  placeholder="输入配置值"
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
                                  loadingId === config.id ||
                                  !editConfig.value.trim()
                                }
                              >
                                {loadingId === config.id
                                  ? "更新中..."
                                  : "更新配置"}
                              </Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>
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
