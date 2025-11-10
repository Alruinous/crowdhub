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
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

const pointsFormSchema = z.object({
  amount: z
    .number()
    .min(10, { message: "最低充值10积分" })
    .max(10000, { message: "最高充值10000积分" }),
  paymentMethod: z.enum(["alipay", "wechat", "card"], {
    required_error: "请选择支付方式",
  }),
});

type PointsRechargeProps = {
  userId: string;
  currentPoints: number;
};

export function PointsRecharge({ userId, currentPoints }: PointsRechargeProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof pointsFormSchema>>({
    resolver: zodResolver(pointsFormSchema),
    defaultValues: {
      amount: 100,
      paymentMethod: "alipay",
    },
  });

  const predefinedAmounts = [50, 100, 200, 500, 1000];

  const handlePredefinedAmount = (amount: number) => {
    form.setValue("amount", amount);
  };

  async function onSubmit(values: z.infer<typeof pointsFormSchema>) {
    setIsLoading(true);

    try {
      // 这里是模拟的充值功能
      // 在实际应用中，这里应该调用支付API并处理支付流程

      await new Promise((resolve) => setTimeout(resolve, 1500)); // 模拟网络请求延迟

      // 模拟充值成功后更新用户积分
      const response = await fetch(`/api/users/${userId}/points`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ points: values.amount }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "充值失败");
      }

      toast({
        title: "充值成功",
        description: `成功充值 ${values.amount} 积分`,
      });

      // 模拟刷新页面以显示更新后的积分余额
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      toast({
        title: "充值失败",
        description: error.message || "处理充值请求时发生错误",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>积分充值</CardTitle>
        <CardDescription>
          当前积分余额: <span className="font-bold">{currentPoints}</span> 分
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label>选择充值金额</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {predefinedAmounts.map((amount) => (
                    <Button
                      key={amount}
                      type="button"
                      variant={
                        form.watch("amount") === amount ? "default" : "outline"
                      }
                      onClick={() => handlePredefinedAmount(amount)}
                      className="h-12"
                    >
                      {amount} 积分
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    className="col-span-3 h-12"
                    onClick={() => form.setFocus("amount")}
                  >
                    自定义金额
                  </Button>
                </div>
              </div>

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>自定义充值金额</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>选择支付方式</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1"
                      >
                        <div className="flex items-center space-x-2 border rounded-md p-3">
                          <RadioGroupItem value="alipay" id="alipay" />
                          <Label htmlFor="alipay" className="flex-1">
                            支付宝
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 border rounded-md p-3">
                          <RadioGroupItem value="wechat" id="wechat" />
                          <Label htmlFor="wechat" className="flex-1">
                            微信支付
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 border rounded-md p-3">
                          <RadioGroupItem value="card" id="card" />
                          <Label htmlFor="card" className="flex-1">
                            银行卡
                          </Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "处理中..." : "确认充值"}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex justify-center text-sm text-muted-foreground">
        充值说明：1元 = 10积分，充值金额将用于发布任务和奖励接单者。
      </CardFooter>
    </Card>
  );
}
