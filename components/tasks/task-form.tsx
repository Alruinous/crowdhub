"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash, Plus } from "lucide-react";
import { splitTasksWithAI } from "@/hooks/use-llm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const formSchema = z.object({
  title: z.string().min(5, { message: "标题至少需要5个字符" }),
  description: z.string().min(10, { message: "描述至少需要10个字符" }),
  categoryId: z.string({ required_error: "请选择分类" }),
  typeId: z.string({ required_error: "请选择任务类型" }),
  points: z.coerce.number().min(1, { message: "积分至少为1" }),
  maxWorkers: z.coerce.number().min(1, { message: "至少需要1名接单者" }),
  subtasks: z
    .array(
      z.object({
        title: z.string().min(3, { message: "子任务标题至少需要3个字符" }),
        description: z
          .string()
          .min(5, { message: "子任务描述至少需要5个字符" }),
        points: z.coerce.number().min(0, { message: "积分不能为负数" }),
      })
    )
    .min(1, { message: "至少需要1个子任务" }),
});

interface TaskFormProps {
  categories: any[];
  taskTypes: any[];
  task?: any; // 添加可选的任务参数，用于编辑
}

export function TaskForm({ categories, taskTypes, task }: TaskFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiThinking, setAiThinking] = useState("");
  const [showThinking, setShowThinking] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  // 判断是否为编辑模式
  const isEditing = !!task;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: task?.title || "",
      description: task?.description || "",
      categoryId: task?.categoryId || "",
      typeId: task?.typeId || "",
      points: task?.points || 10,
      maxWorkers: task?.maxWorkers || 1,
      subtasks: task?.subtasks?.length
        ? task.subtasks.map((st: any) => ({
            title: st.title,
            description: st.description,
            points: st.points,
          }))
        : [{ title: "", description: "", points: 5 }],
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);

    try {
      const url = isEditing ? `/api/tasks/${task.id}` : "/api/tasks";
      const method = isEditing ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (!response.ok) {
        toast({
          title: isEditing ? "更新失败" : "发布失败",
          description:
            data.message || `${isEditing ? "更新" : "发布"}过程中发生错误`,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: isEditing ? "更新成功" : "发布成功",
        description: isEditing
          ? "任务已成功更新"
          : "任务已提交，等待管理员审核",
      });

      // 更新完成后返回到任务详情页
      router.push(isEditing ? `/tasks/${task.id}` : "/dashboard");
      router.refresh();
    } catch (error) {
      toast({
        title: "发生错误",
        description: `${isEditing ? "更新" : "发布"}过程中发生错误，请稍后再试`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Add a new subtask
  const addSubtask = () => {
    const subtasks = form.getValues("subtasks");
    form.setValue("subtasks", [
      ...subtasks,
      { title: "", description: "", points: 5 },
    ]);
  };

  // Remove a subtask
  const removeSubtask = (index: number) => {
    const subtasks = form.getValues("subtasks");
    if (subtasks.length > 1) {
      form.setValue(
        "subtasks",
        subtasks.filter((_, i) => i !== index)
      );
    }
  };

  const handleAutoSplit = async () => {
    setAiLoading(true);
    const toastId = toast({
      title: "科普任务分析中",
      description: "正在使用大语言模型分析任务需求中，请稍候...",
      duration: 100000, // 长时间显示，直到我们手动关闭
    }).id;

    try {
      const formData = form.getValues();
      const result = await splitTasksWithAI(formData, formData.maxWorkers);

      // 保存思考过程，并更新表单
      if (result.thinking) {
        setAiThinking(result.thinking);
      }

      //更新表单数据
      form.reset(result.data); // 使用AI返回的结果重置表单

      toast({
        id: toastId,
        title: "成功",
        description: "已使用AI自动切分子任务",
        duration: 3000,
      });

      // 如果有思考过程，显示查看按钮
      if (result.thinking) {
        toast({
          title: "AI分析完成",
          description: (
            <div className="flex flex-col space-y-2">
              <span>任务已切分完成</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowThinking(true)}
              >
                查看AI思考过程
              </Button>
            </div>
          ),
          duration: 5000,
        });
      }
    } catch (error) {
      toast({
        id: toastId,
        title: "错误",
        description: "使用AI切分子任务失败，请稍后重试",
        variant: "destructive",
      });
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>任务信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>任务标题</FormLabel>
                    <FormControl>
                      <Input placeholder="输入任务标题" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>任务描述</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="详细描述任务内容和要求"
                        className="min-h-[120px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>学科分类</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择学科分类" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="typeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>任务类型</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择任务类型" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {taskTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="points"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>总积分</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} />
                      </FormControl>
                      <FormDescription>任务完成后支付的总积分</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="maxWorkers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>最大接单人数</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} />
                      </FormControl>
                      <FormDescription>可以接单的最大人数</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button
                type="button"
                onClick={handleAutoSplit}
                disabled={aiLoading}
              >
                {aiLoading ? "分析中..." : "智能分析任务需求"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>子任务</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSubtask}
              >
                <Plus className="mr-2 h-4 w-4" />
                添加子任务
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {form.watch("subtasks").map((_, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-medium">子任务 #{index + 1}</h3>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSubtask(index)}
                      disabled={form.watch("subtasks").length <= 1}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                  <FormField
                    control={form.control}
                    name={`subtasks.${index}.title`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>标题</FormLabel>
                        <FormControl>
                          <Input placeholder="子任务标题" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`subtasks.${index}.description`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>描述</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="子任务描述"
                            className="min-h-[80px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`subtasks.${index}.points`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>积分</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} {...field} />
                        </FormControl>
                        <FormDescription>
                          子任务完成后获得的积分
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              取消
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? isEditing
                  ? "更新中..."
                  : "提交中..."
                : isEditing
                ? "更新任务"
                : "发布任务"}
            </Button>
          </div>
        </form>
      </Form>

      <Dialog open={showThinking} onOpenChange={setShowThinking}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI思考过程</DialogTitle>
          </DialogHeader>
          <div className="whitespace-pre-wrap bg-muted p-4 rounded-md text-sm">
            {aiThinking}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
