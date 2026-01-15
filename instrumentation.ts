/**
 * Next.js Instrumentation Hook
 * 在服务器启动时执行一次，用于初始化任务
 * 
 * 文档: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // 只在 Node.js 运行时执行（不在 Edge Runtime 中执行）
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeApp } = await import('./lib/startup');
    initializeApp();
  }
}
