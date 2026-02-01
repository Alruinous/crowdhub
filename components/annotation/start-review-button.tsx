"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ClipboardCheck } from "lucide-react";

interface StartReviewButtonProps {
  taskId: string;
}

export function StartReviewButton({ taskId }: StartReviewButtonProps) {
  const router = useRouter();

  const handleStartReview = () => {
    router.push(`/annotation-tasks/${taskId}/annotate?round=1`);
  };

  return (
    <Button
      onClick={handleStartReview}
      size="lg"
      variant="secondary"
      className="gap-2 bg-zinc-300 hover:bg-zinc-400 text-zinc-900 dark:bg-zinc-600 dark:hover:bg-zinc-500 dark:text-zinc-100"
    >
      <ClipboardCheck className="h-4 w-4" />
      开始复审
    </Button>
  );
}
