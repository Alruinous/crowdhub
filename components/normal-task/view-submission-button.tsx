"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Eye } from "lucide-react";

/** 发布者查看 worker 提交的子任务内容（点击弹出） */
export function ViewSubmissionButton({ content, workerName }: { content: string; workerName?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1">
          <Eye className="h-4 w-4" />
          查看提交内容
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>提交内容</DialogTitle>
          {workerName && (
            <p className="text-sm text-muted-foreground pt-1">认领人：{workerName}</p>
          )}
        </DialogHeader>
        <div className="whitespace-pre-line border rounded-md bg-muted p-5 text-sm leading-relaxed max-h-[65vh] overflow-y-auto">
          {content}
        </div>
      </DialogContent>
    </Dialog>
  );
}
