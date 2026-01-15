import { startCronJobs } from "./cron-jobs";

// 使用 global 对象存储初始化状态，防止 HMR 重置
declare global {
  var isAppInitialized: boolean | undefined;
}

/**
 * 应用启动初始化
 * 通过 instrumentation.ts 在服务器启动时调用一次
 */
export function initializeApp() {
  // 防止重复初始化（使用全局变量，避免 HMR 重置）
  if (global.isAppInitialized) {
    console.log("[Startup] ⚠️  应用已初始化，跳过重复初始化");
    return;
  }

  // 立即设置标志，防止竞态条件
  global.isAppInitialized = true;

  console.log("🚀 CrowdHub 应用初始化开始");
  
  try {
    // 启动定时任务
    console.log("[Startup] 初始化定时任务...");
    startCronJobs();
    
    console.log("✅ CrowdHub 应用初始化完成");
  } catch (error) {
    console.error("❌ 应用初始化失败:", error);
    // 如果初始化失败，重置标志以便重试
    global.isAppInitialized = false;
    throw error;
  }
}

/**
 * 获取初始化状态
 */
export function getInitializationStatus() {
  return {
    isInitialized: global.isAppInitialized || false,
  };
}
