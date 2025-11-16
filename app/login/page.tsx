import { LoginForm } from "@/components/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);

  if (session) {
    // 根据用户角色跳转到不同页面
    if (session.user.role === "ADMIN") {
      redirect("/admin/dashboard");
    } else {
      redirect("/dashboard");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
      <Card className="w-full max-w-md mx-auto shadow-lg border-t-4 border-t-blue-500">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">登录</CardTitle>
          <CardDescription>输入您的邮箱和密码登录系统</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
          <div className="mt-4 text-center text-sm">
            还没有账号？{" "}
            <Link
              href="/register"
              className="text-primary underline underline-offset-4 hover:opacity-80"
            >
              注册账号
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
