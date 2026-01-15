import cron, { ScheduledTask } from "node-cron";
import { processAnnotationTasks } from "./annotation-scheduler";

// 使用 global 对象存储定时任务，防止 HMR 重置
declare global {
  var schedulerJob: ScheduledTask | undefined;
}

/**
 * 启动定时任务
 * 每天北京时间0点自动执行
 */
export function startCronJobs() {
  // 防止重复启动（使用全局变量）
  if (global.schedulerJob) {
    console.log("[Cron] ⚠️  定时任务已经在运行中");
    return;
  }

  // 立即设置占位符，防止竞态条件
  global.schedulerJob = {} as ScheduledTask;

  // cron表达式: 秒 分 时 日 月 周
  // '0 0 0 * * *' = 每天0点0分0秒
  global.schedulerJob = cron.schedule(
    "0 0 0 * * *",
    async () => {
      console.log("[Cron] 🕐 定时任务自动触发");
      console.log(`[Cron] 北京时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
      
      try {
        const results = await processAnnotationTasks();
        
        console.log("[Cron] ✅ 定时任务执行完成");
        console.log(`[Cron] 处理成功: ${results.processed}/${results.total}`);
      } catch (error) {
        console.error("[Cron] ❌ 定时任务执行失败:", error);
      }
    },
    {
      timezone: "Asia/Shanghai", // 设置为北京时间
    }
  );

  console.log("[Cron] ========================================");
  console.log("[Cron] ✅ 定时任务已启动");
  console.log("[Cron] 📅 执行计划: 每天北京时间 00:00");
  console.log(`[Cron] 🇨🇳 当前北京时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
  console.log("[Cron] ========================================\n");
}

/**
 * 停止定时任务
 */
export function stopCronJobs() {
  if (global.schedulerJob) {
    global.schedulerJob.stop();
    global.schedulerJob = undefined;
    console.log("[Cron] ⏹️  定时任务已停止");
  }
}

/**
 * 获取定时任务状态
 */
export function getCronJobStatus() {
  return {
    isRunning: global.schedulerJob !== undefined,
    schedule: "每天北京时间 00:00",
    timezone: "Asia/Shanghai",
    nextRun: global.schedulerJob ? "下次执行时间取决于当前时间" : "未启动",
  };
}
