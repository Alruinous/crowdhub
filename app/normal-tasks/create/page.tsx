"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ListTodo, Loader2, Sparkles, Coins, Type, FileText } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function CreateNormalTaskPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [points, setPoints] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const p = Number(points);
    if (!title.trim()) {
      toast({ title: "缺少标题", description: "请填写任务标题", variant: "destructive" });
      return;
    }
    if (!description.trim()) {
      toast({ title: "缺少描述", description: "请填写任务描述（将用于 AI 拆分任务）", variant: "destructive" });
      return;
    }
    if (!Number.isInteger(p) || p < 1) {
      toast({ title: "积分不合法", description: "总积分必须是不小于1的整数", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/normal-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), points: p }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "创建失败");
      }
      toast({ title: "创建成功", description: "请前往任务详情发布并让 AI 拆分子任务" });
      router.push(`/normal-tasks/${data.task.id}`);
    } catch (error) {
      toast({
        title: "创建失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4 py-12">
      <Card className="w-full max-w-3xl shadow-lg">
        <CardHeader className="text-center space-y-3 pt-8 pb-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ListTodo className="h-8 w-8" />
          </div>
          <CardTitle className="text-3xl font-semibold tracking-tight">创建日常任务</CardTitle>
          <CardDescription className="text-base text-muted-foreground mx-auto max-w-md">
            填写任务信息，发布后由 AI 自动拆分为 1~5 个子任务，并为每个子任务分配价值分数
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 px-6 sm:px-12 pt-6">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-base font-medium">
              <span className="inline-flex items-center gap-1.5">
                <Type className="h-4 w-4 text-primary" /> 任务标题
              </span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：整理校园植物图鉴"
              className="h-12 text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-base font-medium">
              <span className="inline-flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-primary" /> 任务描述
              </span>
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="详细描述任务内容，AI 将据此拆分子任务"
              rows={6}
              className="text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="points" className="text-base font-medium">
              <span className="inline-flex items-center gap-1.5">
                <Coins className="h-4 w-4 text-primary" /> 总积分
              </span>
            </Label>
            <Input
              id="points"
              type="number"
              min={1}
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder="例如：100"
              className="h-12 text-base max-w-xs"
            />
            <p className="text-sm text-muted-foreground bg-muted/60 rounded-lg p-3">
              💡 AI 会为每个子任务分配价值分数（所有子任务分数之和 = 总积分），每个子任务的得分上限即其价值分数
            </p>
          </div>
        </CardContent>

        <CardFooter className="px-6 sm:px-12 pb-8 pt-4">
          <Button
            onClick={handleSubmit}
            disabled={loading}
            size="lg"
            className="w-full h-12 text-base gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
            {loading ? "创建中..." : "创建任务"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
