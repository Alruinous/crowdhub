import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  CheckCircle2,
  Users,
  BookOpen,
  Award,
  MessageCircle,
  ArrowRight,
  FileText,
  LogInIcon,
} from "lucide-react";
import Image from "next/image";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session) {
    // Redirect based on user role
    if (session.user.role === "ADMIN") {
      redirect("/admin/dashboard");
    } else {
      redirect("/dashboard");
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-between bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Hero Section */}
      <div className="w-full py-12 md:py-24 lg:py-32 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="container max-w-6xl mx-auto px-4 grid md:grid-cols-2 gap-8 items-center">
          <div className="flex flex-col items-start space-y-4">
            <span className="inline-block px-3 py-1 bg-blue-800 bg-opacity-50 rounded-full text-sm font-medium mb-2">
              科普内容协作新方式
            </span>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
              科普众包协作平台
            </h1>
            <p className="text-xl text-blue-100 max-w-2xl">
              连接科普内容创作者与专业人才，高效完成科普内容的创作、审核与传播
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button
                asChild
                size="lg"
                className="px-8 bg-white text-blue-700 hover:bg-blue-50"
              >
                <Link href="/register">
                  立即加入
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                className="px-8 bg-white text-blue-700 hover:bg-blue-50"
              >
                <Link href="/login">
                  登录系统
                  <LogInIcon className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="hidden md:flex justify-end">
            <div className="relative w-full h-[400px]">
              {/* 这里可以放置一个科普相关的插图 */}
              <div className="absolute inset-0 bg-white bg-opacity-10 backdrop-blur-sm rounded-lg border border-white border-opacity-20 flex items-center justify-center">
                <BookOpen size={120} className="text-white opacity-50" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* What We Offer */}
      <div className="container max-w-6xl mx-auto py-16 px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">科普众包，人人参与</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            我们致力于通过众包模式提高科普内容的创作效率和质量
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="border-t-4 border-t-blue-500">
            <CardHeader>
              <div className="mb-2 flex flex-row gap-2">
                <FileText size={24} className=" text-blue-500" />
                <CardTitle>科普任务发布</CardTitle>
              </div>
              <CardDescription>创建并发布您的科普内容任务</CardDescription>
            </CardHeader>
            <CardContent>
              <p>
                作为发布者，您可以创建科普任务，基于大语言模型智能分解为子任务，设置奖励，并指定质量要求。
              </p>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-green-500">
            <CardHeader>
              <div className="mb-2 flex flex-row gap-2">
                <CheckCircle2 size={24} className="text-green-500" />
                <CardTitle>专业接单</CardTitle>
              </div>
              <CardDescription>根据专长浏览并认领科普任务</CardDescription>
            </CardHeader>
            <CardContent>
              <p>
                作为接单者，您可以根据自己的专业领域，参与科普内容创作、科普志愿服务，获得相应奖励。
              </p>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-purple-500">
            <CardHeader>
              <div className="mb-2 flex flex-row gap-2">
                <MessageCircle size={24} className="text-purple-500" />
                <CardTitle>专家沟通</CardTitle>
              </div>
              <CardDescription>发布者与接单者直接交流</CardDescription>
            </CardHeader>
            <CardContent>
              <p>
                通过内置沟通系统，发布者与接单者可以进行实时交流，确保科普内容的准确性和可读性。
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Stats Section */}
      <div className="w-full bg-slate-900 text-white py-16">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="flex flex-col items-center">
              <span className="text-4xl font-bold text-blue-400">x+</span>
              <span className="text-slate-300 mt-2">科普任务类型</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-4xl font-bold text-green-400">xxxx+</span>
              <span className="text-slate-300 mt-2">专业协作者</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-4xl font-bold text-purple-400">xx%</span>
              <span className="text-slate-300 mt-2">任务完成率</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-4xl font-bold text-yellow-400">10+</span>
              <span className="text-slate-300 mt-2">科普领域</span>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="container max-w-6xl mx-auto py-16 px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">科普众包工作流程</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            我们简化了科普内容的协作流程，让专业人才高效参与
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
              <span className="text-blue-600 text-xl font-bold">1</span>
            </div>
            <h3 className="text-xl font-medium mb-2">任务发布与分解</h3>
            <p className="text-muted-foreground">
              发布者创建科普任务，设定目标和奖励，可选择分解为子任务
            </p>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
              <span className="text-blue-600 text-xl font-bold">2</span>
            </div>
            <h3 className="text-xl font-medium mb-2">专业人才认领</h3>
            <p className="text-muted-foreground">
              接单者根据专业领域认领适合的科普任务或子任务
            </p>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
              <span className="text-blue-600 text-xl font-bold">3</span>
            </div>
            <h3 className="text-xl font-medium mb-2">协作与完成</h3>
            <p className="text-muted-foreground">
              通过平台沟通工具交流，完成高质量科普内容
            </p>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="w-full bg-slate-50 dark:bg-slate-900 py-16">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">常见问题</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              关于科普众包平台的常见问题解答
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">什么是科普众包？</CardTitle>
              </CardHeader>
              <CardContent>
                <p>
                  科普众包是通过众包模式，将科普内容创作、编辑、审核等任务分解并分配给专业人才，共同完成高质量科普内容的创作和传播。
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  我可以参与哪些类型的任务？
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p>
                  您可以根据自己的专业背景参与科普内容创作、图表制作、科学验证、内容审核、科普翻译等多种类型任务。
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  如何保证科普内容的质量？
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p>
                  平台采用多层次审核机制，任务完成后需经过同行评审和专家验证，确保科普内容的准确性和可读性。
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">如何计算任务奖励？</CardTitle>
              </CardHeader>
              <CardContent>
                <p>
                  任务奖励基于任务难度、所需专业水平和工作量计算，以积分形式发放，可兑换现金或其他奖励。
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="container max-w-6xl mx-auto py-16 px-4">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 md:p-12 text-white text-center">
          <h2 className="text-3xl font-bold mb-4">加入科普众包平台</h2>
          <p className="text-xl text-blue-100 max-w-2xl mx-auto mb-8">
            无论您是科普内容创作者，还是专业领域人才，都可以在这里找到参与科普事业的方式
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              asChild
              size="lg"
              className="px-8 bg-white text-blue-700 hover:bg-blue-50"
            >
              <Link href="/register">
                立即注册
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="px-8 bg-white text-blue-700 hover:bg-blue-50"
            >
              <Link href="/login">
                登录平台
                <LogInIcon className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
