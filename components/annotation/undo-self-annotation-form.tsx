"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Undo2 } from "lucide-react";

interface UndoSelfAnnotationFormProps {
  taskId: string;
  currentUserId: string;
}

export function UndoSelfAnnotationForm({
  taskId,
  currentUserId,
}: UndoSelfAnnotationFormProps) {
  const [rowIndex, setRowIndex] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleUndoRow = async () => {
    if (rowIndex === "") {
      toast({
        title: "请填写条目序号",
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
    setLoading(true);
    try {
      const res = await fetch(`/api/annotation-tasks/${taskId}/undo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, rowIndex: idx }),
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
      setLoading(false);
    }
  };

  return (
    <div className="rounded-md border p-4 space-y-3">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Undo2 className="h-4 w-4" />
        回滚我的某条标注
      </h4>
      <p className="text-xs text-muted-foreground">
        撤销指定条目的标注结果后，可重新标注该条。
      </p>
      <div className="space-y-2">
        <Label>条目序号</Label>
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
            disabled={loading}
          >
            {loading ? "回滚中…" : "回滚该条"}
          </Button>
        </div>
      </div>
    </div>
  );
}
