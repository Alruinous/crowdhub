"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReviewerItem {
  userId: string;
  name: string;
}

interface AddReviewerFormProps {
  taskId: string;
  reviewers: ReviewerItem[];
  candidateUsers: { id: string; name: string }[];
}

const LEVEL_L1 = 1;

export function AddReviewerForm({
  taskId,
  reviewers,
  candidateUsers,
}: AddReviewerFormProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const reviewerIds = new Set(reviewers.map((r) => r.userId));
  const options = useMemo(
    () => candidateUsers.filter((u) => !reviewerIds.has(u.id)),
    [candidateUsers, reviewerIds]
  );
  const selectedName = selectedUserId
    ? options.find((u) => u.id === selectedUserId)?.name ?? ""
    : "";

  const handleAdd = async () => {
    if (!selectedUserId) {
      toast({
        title: "请选择要添加的用户",
        variant: "destructive",
      });
      return;
    }
    setAdding(true);
    try {
      const res = await fetch(`/api/annotation-tasks/${taskId}/reviewers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, level: LEVEL_L1 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "添加失败");
      toast({
        title: "添加成功",
        description: data.message,
      });
      setSelectedUserId("");
      router.refresh();
    } catch (err) {
      toast({
        title: "添加失败",
        description: err instanceof Error ? err.message : "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <UserPlus className="h-4 w-4" />
        一级复审员
      </h4>
      {options.length > 0 ? (
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className={cn(
                    "w-full justify-between font-normal",
                    !selectedUserId && "text-muted-foreground"
                  )}
                >
                  {selectedName || "选择用户（可按姓名搜索）"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command
                  filter={(value, search) => {
                    if (!search.trim()) return 1;
                    const text = (value || "").toLowerCase();
                    const q = search.trim().toLowerCase();
                    return text.includes(q) ? 1 : 0;
                  }}
                >
                  <CommandInput placeholder="按姓名搜索用户…" />
                  <CommandList>
                    <CommandEmpty>未找到匹配用户</CommandEmpty>
                    <CommandGroup>
                      {options.map((u) => (
                        <CommandItem
                          key={u.id}
                          value={u.name}
                          onSelect={() => {
                            setSelectedUserId(u.id);
                            setOpen(false);
                          }}
                        >
                          {u.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={handleAdd}
            disabled={adding || !selectedUserId}
          >
            {adding ? "添加中…" : "添加"}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          暂无可添加的用户（候选用户为 WORKER 角色且未在本任务中担任一级复审员）。
        </p>
      )}
    </div>
  );
}
