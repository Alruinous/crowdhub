"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
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
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Shield, Briefcase, Hammer } from "lucide-react";

const formSchema = z.object({
  email: z.string().email({ message: "请输入有效的邮箱地址" }),
  password: z.string().min(6, { message: "密码至少需要6个字符" }),
});

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);

    try {
      const response = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      });

      if (response?.error) {
        toast({
          title: "登录失败",
          description: "邮箱或密码错误",
          variant: "destructive",
        });
        return;
      }

      // 获取用户信息以确定角色
      const userResponse = await fetch("/api/users/me");
      const userData = await userResponse.json();

      router.refresh();
      // 使用 setTimeout 确保路由跳转在下一个事件循环中执行
      setTimeout(() => {
        // 根据用户角色跳转到不同页面
        if (userData.role === "ADMIN") {
          console.log('管理员跳转到: /admin/dashboard')
          router.push("/admin/dashboard");
        } else {
          console.log('普通用户跳转到: /dashboard')
          router.push("/dashboard");
        }
      }, 100)
    } catch (error) {
      toast({
        title: "发生错误",
        description: "登录过程中发生错误，请稍后再试",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  // 快捷登录函数
  const loginAsExample = async (role: "admin" | "publisher" | "worker") => {
    setIsLoading(true);

    const emailMap = {
      admin: "admin@raids.io",
      publisher: "publisher@raids.io",
      worker: "worker@raids.io",
    };

    try {
      const response = await signIn("credentials", {
        email: emailMap[role],
        password: "000000",
        redirect: false,
      });

      if (response?.error) {
        toast({
          title: "登录失败",
          description: "示例账号登录失败，请联系管理员",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "登录成功",
        description: `已使用${
          role === "admin"
            ? "管理员"
            : role === "publisher"
            ? "发布者"
            : "接单者"
        }账号登录`,
        variant: "default",
      });

      router.refresh();
      // 使用 setTimeout 确保路由跳转在下一个事件循环中执行
      setTimeout(() => {
        if (role === "admin") {
          console.log('管理员跳转到: /admin/dashboard')
          router.push("/admin/dashboard");
        } else {
          console.log(`${role} 跳转到: /dashboard`)
          router.push("/dashboard");
        }
      }, 100)
    } catch (error) {
      toast({
        title: "发生错误",
        description: "登录过程中发生错误，请稍后再试",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="space-y-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>邮箱</FormLabel>
                  <FormControl>
                    <Input placeholder="your@email.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>密码</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="******" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "登录中..." : "登录"}
            </Button>
          </form>
        </Form>

        {/* <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <Separator />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              示例账号快捷登录
            </span>
          </div>
        </div> */}

        {/* <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            className="flex flex-col items-center justify-center h-20 space-y-1 hover:bg-blue-50 hover:text-blue-600 transition-colors"
            onClick={() => loginAsExample("admin")}
            disabled={isLoading}
          >
            <Shield className="h-6 w-6 text-blue-500" />
            <span className="text-xs">管理员</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center justify-center h-20 space-y-1 hover:bg-green-50 hover:text-green-600 transition-colors"
            onClick={() => loginAsExample("publisher")}
            disabled={isLoading}
          >
            <Briefcase className="h-6 w-6 text-green-500" />
            <span className="text-xs">发布者</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center justify-center h-20 space-y-1 hover:bg-purple-50 hover:text-purple-600 transition-colors"
            onClick={() => loginAsExample("worker")}
            disabled={isLoading}
          >
            <Hammer className="h-6 w-6 text-purple-500" />
            <span className="text-xs">接单者</span>
          </Button>
        </div> */}
      </div>
    </div>
  );
}
