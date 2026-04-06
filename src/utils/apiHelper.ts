// services/apiHelper.ts
// API请求通用工具模块

import { getLLMLog, saveLLMLog } from '../services/storageService';
import { LLMCallLog } from '../types';

// 日志上下文接口
export interface LogContext {
  modelType: LLMCallLog['modelType'];
  provider: string;
  apiUrl: string;
  modelId: string;
  seriesId?: string;
  projectId?: string;
  shotId?: string;
  isAsyncTask?: boolean;
  taskId?: string;
}

// 生成日志ID
const generateLogId = (): string => {
  return `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * 重试操作 - 通用方法
 * 处理429错误并进行指数退避重试
 */
export const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 1,
  baseDelay: number = 2000
): Promise<T> => {
  let lastError: Error | null = null;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (e: any) {
      lastError = e;
      // Check for quota/rate limit errors (429)
      if (
        e.status === 429 ||
        e.code === 429 ||
        e.message?.includes("429") ||
        e.message?.includes("quota") ||
        e.message?.includes("RATE_LIMIT")
      ) {
        const delay = baseDelay * Math.pow(2, i);
        console.warn(
          `Hit rate limit, retrying in ${delay}ms... (Attempt ${
            i + 1
          }/${maxRetries})`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw e;
    }
  }
  throw lastError;
};

/**
 * 带重试的HTTP请求（带日志记录）
 */
export const fetchWithRetry = async (
  endpoint: string,
  options: RequestInit,
  retries: number = 1,
  returnJson: boolean = true,
  logContext?: LogContext
): Promise<any> => {
  const startTime = Date.now();
  const logId = logContext ? generateLogId() : null;
  
  // 解析请求体
  let requestBody: any = null;
  try {
    if (options.body && typeof options.body === 'string') {
      requestBody = JSON.parse(options.body);
    } else if (options.body) {
      requestBody = options.body;
    }
  } catch {
    requestBody = options.body;
  }

  try {
    const result = await retryOperation(async () => {
      const requestOptions: RequestInit = {
        ...options,
        headers: {
          ...options.headers,
        },
      };

      // GET 请求不应该有 body
      if (options.method === "GET") {
        delete requestOptions.body;
      }

      const response = await fetch(endpoint, requestOptions);

      if (!response.ok) {
        let errorMessage = `API Error (${response.status})`;
        try {
          const error = await response.json();
          errorMessage += `: ${error.error?.message || error.message || error.error || JSON.stringify(error)}`;
        } catch {
          errorMessage += `: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      return returnJson ? response.json() : response;
    }, retries);

    // 记录成功日志
    if (logContext && logId) {
      const responseTime = Date.now();
      const log: LLMCallLog = {
        id: logId,
        requestTime: startTime,
        responseTime,
        duration: responseTime - startTime,
        seriesId: logContext.seriesId,
        projectId: logContext.projectId,
        shotId: logContext.shotId,
        modelType: logContext.modelType,
        provider: logContext.provider,
        apiUrl: endpoint,
        modelId: logContext.modelId,
        requestParams: requestBody,
        response: result,
        success: true,
        isAsyncTask: logContext.isAsyncTask || false,
        taskId: logContext.taskId,
        taskStatus: logContext.isAsyncTask ? 'pending' : undefined,
        pollCount: logContext.isAsyncTask ? 0 : undefined,
        pollStartTime: logContext.isAsyncTask ? startTime : undefined
      };
      saveLLMLog(log).catch(err => console.warn('Failed to save log:', err));
    }

    return result;
  } catch (error: any) {
    // 记录失败日志
    if (logContext && logId) {
      const responseTime = Date.now();
      const log: LLMCallLog = {
        id: logId,
        requestTime: startTime,
        responseTime,
        duration: responseTime - startTime,
        seriesId: logContext.seriesId,
        projectId: logContext.projectId,
        shotId: logContext.shotId,
        modelType: logContext.modelType,
        provider: logContext.provider,
        apiUrl: endpoint,
        modelId: logContext.modelId,
        requestParams: requestBody,
        response: null,
        success: false,
        errorMessage: error.message || String(error),
        isAsyncTask: logContext.isAsyncTask || false,
        taskId: logContext.taskId,
        taskStatus: logContext.isAsyncTask ? 'failed' : undefined
      };
      saveLLMLog(log).catch(err => console.warn('Failed to save log:', err));
    }
    throw error;
  }
};

/**
 * 带认证的HTTP请求（带日志记录）
 */
export const fetchWithAuth = async (
  endpoint: string,
  options: RequestInit,
  apiKey: string,
  retries: number = 1,
  returnJson: boolean = true,
  logContext?: LogContext
): Promise<any> => {
  const headers = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    ...options.headers,
  };

  return fetchWithRetry(endpoint, {
    ...options,
    headers,
  }, retries, returnJson, logContext);
};

/**
 * 清理JSON字符串，移除Markdown标记和思考模式内容
 */
export const cleanJsonString = (str: string): string => {
  if (!str) return "{}";

  // 移除 ```json ... ``` 或 ``` ... ``` Markdown 标记
  let cleaned = str.replace(/```json\n?/g, "").replace(/```/g, "");

  // 移除  标签及其内容（思考模式）
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, "");

  return cleaned.trim();
};

/**
 * 视频任务轮询配置
 */
export interface PollTaskConfig {
  maxAttempts: number;
  pollInterval: number;
  successStatuses: string[];
  failedStatuses: string[];
  pendingStatuses: string[];
}

/**
 * 轮询任务状态（带日志记录）
 */
export const pollTask = async <T>(
  taskFetcher: () => Promise<T>,
  statusGetter: (data: T) => string | undefined,
  resultGetter: (data: T) => string | undefined,
  errorGetter?: (data: T) => string | undefined,
  config: Partial<PollTaskConfig> = {},
  logContext?: LogContext & { logId?: string }
): Promise<string> => {
  const finalConfig: PollTaskConfig = {
    maxAttempts: 120,
    pollInterval: 5000,
    successStatuses: ["completed", "succeeded", "Success", "SUCCEEDED", "SUCCESS"],
    failedStatuses: ["failed", "error", "Error", "FAILED", "FAILED", "failed"],
    pendingStatuses: ["pending", "processing", "queued", "running", "PENDING", "RUNNING"],
    ...config
  };

  const startTime = Date.now();
  let pollCount = 0;
  let lastData: T | null = null;
  let lastStatus: string | undefined;

  for (let i = 0; i < finalConfig.maxAttempts; i++) {
    try {
      const data = await taskFetcher();
      lastData = data;
      const status = statusGetter(data);
      lastStatus = status;
      pollCount++;

      if (!status) {
        throw new Error("无法获取任务状态");
      }

      // 检查是否成功
      const isSuccess = finalConfig.successStatuses.some(s =>
        status.toLowerCase().includes(s.toLowerCase())
      );
      if (isSuccess) {
        const result = resultGetter(data);
        if (result) {
          // 更新日志为完成状态
          if (logContext && logContext.logId) {
            const endTime = Date.now();
            updatePollLog(logContext.logId, {
              taskStatus: 'completed',
              pollCount,
              response: data,
              success: true,
              pollEndTime: endTime,
              duration: endTime - startTime,
              resultUrl: result  // 记录视频/图片URL
            }).catch(err => console.warn('Failed to update poll log:', err));
          }
          return result;
        }
        throw new Error("任务完成但无法获取结果");
      }

      // 检查是否失败
      const isFailed = finalConfig.failedStatuses.some(s =>
        status.toLowerCase().includes(s.toLowerCase())
      );
      if (isFailed) {
        const errorMsg = errorGetter ? errorGetter(data) : "任务失败";
        // 更新日志为失败状态
        if (logContext && logContext.logId) {
          const endTime = Date.now();
          updatePollLog(logContext.logId, {
            taskStatus: 'failed',
            pollCount,
            response: data,
            success: false,
            errorMessage: errorMsg,
            pollEndTime: endTime,
            duration: endTime - startTime
          }).catch(err => console.warn('Failed to update poll log:', err));
          return null;
        }
        throw new Error(errorMsg || "任务失败");
      }else{
        // 继续等待
        await new Promise((resolve) => setTimeout(resolve, finalConfig.pollInterval));
      }
    } catch (error: any) {
      if (i === finalConfig.maxAttempts - 1) {
        // 更新日志为超时/失败状态
        if (logContext && logContext.logId) {
          const endTime = Date.now();
          updatePollLog(logContext.logId, {
            taskStatus: 'failed',
            pollCount,
            response: lastData,
            success: false,
            errorMessage: error.message || '任务轮询超时',
            pollEndTime: endTime,
            duration: endTime - startTime
          }).catch(err => console.warn('Failed to update poll log:', err));
        }
        i=i+10;
        throw error;
      }
      //console.warn(`查询任务状态失败 (尝试 ${i + 1}/${finalConfig.maxAttempts}):`, error);
      await new Promise((resolve) => setTimeout(resolve, finalConfig.pollInterval));
    }
  }

  // 超时
  if (logContext && logContext.logId) {
    const endTime = Date.now();
    updatePollLog(logContext.logId, {
      taskStatus: 'failed',
      pollCount,
      response: lastData,
      success: false,
      errorMessage: '任务轮询超时',
      pollEndTime: endTime,
      duration: endTime - startTime
    }).catch(err => console.warn('Failed to update poll log:', err));
  }

  throw new Error("任务轮询超时");
};

// 更新轮询日志
interface PollLogUpdate {
  taskStatus: 'completed' | 'failed' | 'processing';
  pollCount: number;
  response: any;
  success: boolean;
  errorMessage?: string;
  pollEndTime?: number;
  duration?: number;
  resultUrl?: string;  // 结果URL（视频URL、图片URL等）
}

const updatePollLog = async (logId: string, update: PollLogUpdate): Promise<void> => {
  const existingLog = await getLLMLog(logId);
  if (!existingLog) return;
  
  const updatedLog: LLMCallLog = {
    ...existingLog,
    taskStatus: update.taskStatus,
    pollCount: update.pollCount,
    response: update.response,
    success: update.success,
    errorMessage: update.errorMessage,
    pollEndTime: update.pollEndTime,
    responseTime: update.pollEndTime,
    duration: update.duration,
    resultUrl: update.resultUrl ?? existingLog.resultUrl
  };
  
  await saveLLMLog(updatedLog);
};

/**
 * 创建异步任务日志（在任务开始时调用）
 */
export const createAsyncTaskLog = async (
  logContext: LogContext & { taskId: string },
  requestParams: any,
  initialResponse?: any
): Promise<string> => {
  const logId = generateLogId();
  const startTime = Date.now();

  const log: LLMCallLog = {
    id: logId,
    requestTime: startTime,
    responseTime: startTime,
    duration: 0,
    seriesId: logContext.seriesId,
    projectId: logContext.projectId,
    shotId: logContext.shotId,
    modelType: logContext.modelType,
    provider: logContext.provider,
    apiUrl: logContext.apiUrl,
    modelId: logContext.modelId,
    requestParams,
    response: initialResponse,
    success: true, // 初始提交成功
    isAsyncTask: true,
    taskId: logContext.taskId,
    taskStatus: 'pending',
    pollCount: 0,
    pollStartTime: startTime
  };

  await saveLLMLog(log);
  return logId;
};

/**
 * 手动查询异步任务状态（单次查询，不轮询）
 */
export const fetchTaskStatus = async <T>(
  taskFetcher: () => Promise<T>,
  statusGetter: (data: T) => string | undefined,
  resultGetter: (data: T) => string | undefined,
  errorGetter?: (data: T) => string | undefined,
  logContext?: LogContext & { logId?: string }
): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: string;
  error?: string;
  rawData: T;
}> => {
  const data = await taskFetcher();
  const status = statusGetter(data);

  if (!status) {
    throw new Error("无法获取任务状态");
  }

  // 判断状态
  const successStatuses = ["completed", "succeeded", "Success", "SUCCEEDED", "SUCCESS","video_generation_completed"];
  const failedStatuses = ["failed", "error", "Error", "FAILED"];

  const isSuccess = successStatuses.some(s => status.toLowerCase().includes(s.toLowerCase()));
  const isFailed = failedStatuses.some(s => status.toLowerCase().includes(s.toLowerCase()));

  let resultStatus: 'pending' | 'processing' | 'completed' | 'failed' = 'pending';
  let result: string | undefined;
  let error: string | undefined;

  if (isSuccess) {
    resultStatus = 'completed';
    result = resultGetter(data);

    // 更新日志为完成状态
    if (logContext && logContext.logId) {
      const endTime = Date.now();
      const existingLog = await getLLMLog(logContext.logId);
      const pollCount = (existingLog?.pollCount || 0) + 1;
      await updatePollLog(logContext.logId, {
        taskStatus: 'completed',
        pollCount,
        response: data,
        success: true,
        pollEndTime: endTime,
        duration: endTime - (existingLog?.pollStartTime || existingLog?.requestTime || endTime),
        resultUrl: result  // 记录视频/图片URL
      });
    }
  } else if (isFailed) {
    resultStatus = 'failed';
    error = errorGetter ? errorGetter(data) : "任务失败";

    // 更新日志为失败状态
    if (logContext && logContext.logId) {
      const endTime = Date.now();
      const existingLog = await getLLMLog(logContext.logId);
      const pollCount = (existingLog?.pollCount || 0) + 1;
      await updatePollLog(logContext.logId, {
        taskStatus: 'failed',
        pollCount,
        response: data,
        success: false,
        errorMessage: error,
        pollEndTime: endTime
      });
    }
  } else {
    resultStatus = 'processing';

    // 更新日志为处理中状态
    if (logContext && logContext.logId) {
      const existingLog = await getLLMLog(logContext.logId);
      if (existingLog) {
        await updatePollLog(logContext.logId, {
          taskStatus: 'processing',
          pollCount: (existingLog.pollCount || 0) + 1,
          response: data,
          success: existingLog.success
        });
      }
    }
  }

  return {
    status: resultStatus,
    result,
    error,
    rawData: data
  };
};
