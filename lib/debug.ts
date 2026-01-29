/**
 * 全局调试输出开关
 * 环境变量 ENABLE_DEBUG_LOGS：设为 "false" 或 "0" 时关闭所有调试 log，不设或为其他值时开启。
 * 全项目统一使用此变量控制 console 输出，便于生产环境关闭日志。
 */
export const enableDebugLogs =
  process.env.ENABLE_DEBUG_LOGS !== "false" && process.env.ENABLE_DEBUG_LOGS !== "0";
