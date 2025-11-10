"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import SelectBox from "@/components/form/SelectBox";

const categoryFormSchema = z.object({
  categories: z.array(z.string()).min(1, { message: "请至少选择一个擅长领域" }),
});

type CategorySettingsProps = {
  userId: string;
  existingCategories: {
    id: string;
    name: string;
  }[];
  allCategories: {
    id: string;
    name: string;
  }[];
};

export function CategorySettings({
  userId,
  existingCategories,
  allCategories,
}: CategorySettingsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof categoryFormSchema>>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      categories: existingCategories.map((cat) => cat.id),
    },
  });

  async function onSubmit(values: z.infer<typeof categoryFormSchema>) {
    setIsLoading(true);

    try {
      // 发送更新请求到API
      const response = await fetch(`/api/users/${userId}/categories`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "更新擅长领域失败");
      }

      toast({
        title: "更新成功",
        description: "您的擅长领域已成功更新",
      });
    } catch (error) {
      toast({
        title: "更新失败",
        description: error.message || "更新擅长领域时发生错误",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="categories"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>擅长领域</FormLabel>
                  <FormControl>
                    <SelectBox
                      options={allCategories.map((category) => ({
                        value: category.id,
                        label: category.name,
                      }))}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="选择您擅长的领域"
                      inputPlaceholder="搜索领域..."
                      emptyPlaceholder="未找到相关领域"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "保存中..." : "保存更改"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
