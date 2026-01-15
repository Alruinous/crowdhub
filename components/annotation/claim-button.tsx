"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus, Play } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ClaimStartButtonProps {
  taskId: string;
  hasClaimed: boolean;
  isWorker: boolean;
  status: string; // "OPEN" | "IN_PROGRESS" | "COMPLETED"
  labelFileData?: {
    dimensions?: Array<{
      name: string;
      schema: Array<{
        type: string;
        name: string;
        [key: string]: any;
      }>;
    }>;
  };
}

export function ClaimButton({ taskId, hasClaimed, isWorker, status, labelFileData }: ClaimStartButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

  // 如果不是worker，不显示按钮
  if (!isWorker) {
    return null;
  }

  // 获取第一个维度第一个分类的所有选项
  const getFirstCategoryOptions = () => {
    if (!labelFileData?.dimensions || labelFileData.dimensions.length === 0) {
      return [];
    }
    const firstDimension = labelFileData.dimensions[0];
    if (!firstDimension.schema || firstDimension.schema.length === 0) {
      return [];
    }
    return firstDimension.schema.map(item => item.name);
  };

  const options = getFirstCategoryOptions();

  // 处理选项选择
  const handleOptionToggle = (optionName: string) => {
    setSelectedOptions(prev => {
      if (prev.includes(optionName)) {
        return prev.filter(name => name !== optionName);
      } else {
        // 最多选择3个
        if (prev.length >= 3) {
          toast({
            title: "选择已达上限",
            description: "最多只能选择3个擅长的领域",
            variant: "destructive",
          });
          return prev;
        }
        return [...prev, optionName];
      }
    });
  };

  // 已认领的情况
  if (hasClaimed) {
    // status 为 OPEN：显示"已认领，等待任务开始"
    if (status === "OPEN") {
      return (
        <Button disabled size="lg">
          已认领，等待任务开始
        </Button>
      );
    }
    
    // status 为 IN_PROGRESS：显示"开始标注"，可以点击跳转
    if (status === "IN_PROGRESS") {
      const handleStartAnnotation = () => {
        router.push(`/annotation-tasks/${taskId}/annotate`);
      };

      return (
        <Button onClick={handleStartAnnotation} size="lg" className="gap-2">
          <Play className="h-4 w-4" />
          开始标注
        </Button>
      );
    }
    
    // status 为 COMPLETED：显示"已完成"
    if (status === "COMPLETED") {
      return (
        <Button disabled size="lg">
          已完成
        </Button>
      );
    }
  }

  // 未认领的情况：只有当 status 为 OPEN 时才显示认领按钮
  if (status !== "OPEN") {
    return null;
  }

  // 未认领：显示"认领"按钮
  const handleClaimClick = () => {
    // 如果有标签数据，显示弹窗选择
    if (options.length > 0) {
      setShowDialog(true);
    } else {
      // 没有标签数据，直接认领
      handleClaim();
    }
  };

  const handleClaim = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/annotation-tasks/${taskId}/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          expertiseAreas: selectedOptions.length > 0 ? selectedOptions : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "认领失败");
      }

      toast({
        title: "认领成功",
        description: "已成功认领该标注任务",
      });

      setShowDialog(false);
      setSelectedOptions([]);
      
      // 刷新页面以更新状态
      router.refresh();
    } catch (error) {
      toast({
        title: "认领失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button onClick={handleClaimClick} disabled={isLoading} size="lg" className="gap-2">
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            认领中...
          </>
        ) : (
          <>
            <UserPlus className="h-4 w-4" />
            认领
          </>
        )}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>选择您擅长的领域</DialogTitle>
            <DialogDescription>
              请从以下选项中选择最多3个您擅长的领域，这将帮助我们为您分配更合适的标注任务。
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[400px] pr-4">
            <div className="grid grid-cols-1 gap-3">
              {options.map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <Checkbox
                    id={option}
                    checked={selectedOptions.includes(option)}
                    onCheckedChange={() => handleOptionToggle(option)}
                  />
                  <Label
                    htmlFor={option}
                    className="text-sm font-normal cursor-pointer flex-1"
                  >
                    {option}
                  </Label>
                </div>
              ))}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDialog(false);
                setSelectedOptions([]);
              }}
              disabled={isLoading}
            >
              取消
            </Button>
            <Button onClick={handleClaim} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  认领中...
                </>
              ) : (
                `确认认领${selectedOptions.length > 0 ? ` (已选${selectedOptions.length}个)` : ''}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
