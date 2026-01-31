"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Undo2 } from "lucide-react";

interface Worker {
  userId: string;
  name: string;
}

interface UndoAnnotationFormProps {
  taskId: string;
  workers: Worker[];
}

export function UndoAnnotationForm({ taskId, workers }: UndoAnnotationFormProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [date, setDate] = useState("");
  const [rowIndex, setRowIndex] = useState<string>("");
  const [loadingDay, setLoadingDay] = useState(false);
  const [loadingRow, setLoadingRow] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleUndoDay = async () => {
    if (!selectedUserId || !date) {
      toast({
        title: "请选择标注员并填写日期",
        variant: "destructive",
      });
      return;
    }
    setLoadingDay(true);
    try {
      const res = await fetch(`/api/annotation-tasks/${taskId}/undo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, date }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "回滚失败");
      toast({
        title: "回滚成功",
        description: data.message,
      });
      router.refresh();
    } catch (err) {
      toast({
        title: "回滚失败",
        description: err instanceof Error ? err.message : "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setLoadingDay(false);
    }
  };

  const handleUndoRow = async () => {
    if (!selectedUserId || rowIndex === "") {
      toast({
        title: "请选择标注员并填写条目序号",
        variant: "destructive",
      });
      return;
    }
    const idx = parseInt(rowIndex, 10);
    if (Number.isNaN(idx) || idx < 0) {
      toast({
        title: "条目序号须为非负整数",
        variant: "destructive",
      });
      return;
    }
    setLoadingRow(true);
    try {
      const res = await fetch(`/api/annotation-tasks/${taskId}/undo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, rowIndex: idx }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "回滚失败");
      toast({
        title: "回滚成功",
        description: data.message,
      });
      router.refresh();
    } catch (err) {
      toast({
        title: "回滚失败",
        description: err instanceof Error ? err.message : "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setLoadingRow(false);
    }
  };

  if (workers.length === 0) return null;

  return (
    <div className="rounded-md border p-4 space-y-4">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Undo2 className="h-4 w-4" />
        回滚标注结果
      </h4>
      <p className="text-xs text-muted-foreground">
        撤销某标注者的某天或某条结果后，该用户可重新标注，正确性将重新计算。
      </p>
      <div className="space-y-2">
        <Label>选择标注员</Label>
        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
          <SelectTrigger>
            <SelectValue placeholder="请选择标注员" />
          </SelectTrigger>
          <SelectContent>
            {workers.map((w) => (
              <SelectItem key={w.userId} value={w.userId}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>回滚某天（按发放日期）</Label>
          <div className="flex gap-2">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleUndoDay}
              disabled={loadingDay}
            >
              {loadingDay ? "回滚中…" : "回滚该日"}
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>回滚某条（条目序号 rowIndex）</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              min={0}
              placeholder="0"
              value={rowIndex}
              onChange={(e) => setRowIndex(e.target.value)}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleUndoRow}
              disabled={loadingRow}
            >
              {loadingRow ? "回滚中…" : "回滚该条"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
