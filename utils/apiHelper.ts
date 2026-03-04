// services/apiHelper.ts
// API请求通用工具模块

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
 * 带重试的HTTP请求
 */
export const fetchWithRetry = async (
  endpoint: string,
  options: RequestInit,
  retries: number = 1,
  returnJson: boolean = true
): Promise<any> => {
  return retryOperation(async () => {
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
};

/**
 * 带认证的HTTP请求
 */
export const fetchWithAuth = async (
  endpoint: string,
  options: RequestInit,
  apiKey: string,
  retries: number = 1,
  returnJson: boolean = true
): Promise<any> => {
  const headers = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    ...options.headers,
  };

  return fetchWithRetry(endpoint, {
    ...options,
    headers,
  }, retries, returnJson);
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
 * 轮询任务状态
 */
export const pollTask = async <T>(
  taskFetcher: () => Promise<T>,
  statusGetter: (data: T) => string | undefined,
  resultGetter: (data: T) => string | undefined,
  errorGetter?: (data: T) => string | undefined,
  config: Partial<PollTaskConfig> = {}
): Promise<string> => {
  const finalConfig: PollTaskConfig = {
    maxAttempts: 120,
    pollInterval: 5000,
    successStatuses: ["completed", "succeeded", "Success", "SUCCEEDED", "SUCCESS"],
    failedStatuses: ["failed", "error", "Error", "FAILED", "FAILED", "failed"],
    pendingStatuses: ["pending", "processing", "queued", "running", "PENDING", "RUNNING"],
    ...config
  };

  for (let i = 0; i < finalConfig.maxAttempts; i++) {
    try {
      const data = await taskFetcher();
      const status = statusGetter(data);

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
        throw new Error(errorMsg || "任务失败");
      }

      // 继续等待
      await new Promise((resolve) => setTimeout(resolve, finalConfig.pollInterval));

    } catch (error: any) {
      if (i === finalConfig.maxAttempts - 1) {
        throw error;
      }
      console.warn(`查询任务状态失败 (尝试 ${i + 1}/${finalConfig.maxAttempts}):`, error);
      await new Promise((resolve) => setTimeout(resolve, finalConfig.pollInterval));
    }
  }

  throw new Error("任务轮询超时");
};
