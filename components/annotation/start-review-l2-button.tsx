"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ClipboardCheck } from "lucide-react";

interface StartReviewL2ButtonProps {
  taskId: string;
}

export function StartReviewL2Button({ taskId }: StartReviewL2ButtonProps) {
  const router = useRouter();

  const handleStartReviewL2 = () => {
    router.push(`/annotation-tasks/${taskId}/annotate?round=2`);
  };

  return (
    <Button
      onClick={handleStartReviewL2}
      size="lg"
      variant="secondary"
      className="gap-2 bg-zinc-300 hover:bg-zinc-400 text-zinc-900 dark:bg-zinc-600 dark:hover:bg-zinc-500 dark:text-zinc-100"
    >
      <ClipboardCheck className="h-4 w-4" />
      开始二级复审
    </Button>
  );
}
