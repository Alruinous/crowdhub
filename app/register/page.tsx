import { RegisterForm } from "@/components/register-form";
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

export default async function RegisterPage() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
      <Card className="w-full max-w-md mx-auto shadow-lg border-t-4 border-t-blue-500">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">注册账号</CardTitle>
          <CardDescription>创建您的账号以开始使用系统</CardDescription>
        </CardHeader>
        <CardContent>
          <RegisterForm />
          <div className="mt-4 text-center text-sm">
            已有账号？{" "}
            <Link
              href="/login"
              className="text-primary underline underline-offset-4 hover:opacity-80"
            >
              登录
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
