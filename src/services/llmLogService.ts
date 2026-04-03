// LLM API 调用日志服务
import { LLMCallLog } from '../types';
import {
  saveLLMLog,
  getLLMLog,
  queryLLMLogs,
  countLLMLogs,
  deleteLLMLog,
  clearLLMLogs,
  clearOldLLMLogs,
  getLLMLogStats,
  LLMLogFilter,
  LLMLogStats
} from './storageService';

// 生成唯一ID
const generateLogId = (): string => {
  return `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

// 日志记录参数
export interface LogParams {
  // 关联信息
  seriesId?: string;
  projectId?: string;
  shotId?: string;
  
  // 模型信息
  modelType: LLMCallLog['modelType'];
  provider: string;
  apiUrl: string;
  modelId: string;
  
  // 请求响应
  requestParams: any;
  response?: any;
  
  // 状态
  success: boolean;
  errorMessage?: string;
  
  // 异步任务相关
  isAsyncTask?: boolean;
  taskId?: string;
}

// 更新日志参数（用于更新异步任务状态）
export interface UpdateLogParams {
  id: string;
  response?: any;
  success?: boolean;
  errorMessage?: string;
  taskStatus?: LLMCallLog['taskStatus'];
  pollCount?: number;
}

/**
 * LLM 调用日志服务
 */
export class LLMLogService {
  /**
   * 记录一次 API 调用
   */
  static async log(params: LogParams): Promise<string> {
    const requestTime = Date.now();
    const logId = generateLogId();
    
    const log: LLMCallLog = {
      id: logId,
      requestTime,
      responseTime: requestTime,
      duration: 0,
      
      seriesId: params.seriesId,
      projectId: params.projectId,
      shotId: params.shotId,
      
      modelType: params.modelType,
      provider: params.provider,
      apiUrl: params.apiUrl,
      modelId: params.modelId,
      
      requestParams: params.requestParams,
      response: params.response,
      
      success: params.success,
      errorMessage: params.errorMessage,
      
      isAsyncTask: params.isAsyncTask || false,
      taskId: params.taskId,
      taskStatus: params.isAsyncTask ? 'pending' : undefined,
      pollCount: params.isAsyncTask ? 0 : undefined,
      pollStartTime: params.isAsyncTask ? requestTime : undefined
    };
    
    await saveLLMLog(log);
    return logId;
  }
  
  /**
   * 记录同步 API 调用（带响应时间）
   */
  static async logSyncCall(
    params: Omit<LogParams, 'success' | 'response' | 'errorMessage'>,
    startTime: number,
    result: { success: boolean; response?: any; error?: string }
  ): Promise<string> {
    const responseTime = Date.now();
    const logId = generateLogId();
    
    const log: LLMCallLog = {
      id: logId,
      requestTime: startTime,
      responseTime,
      duration: responseTime - startTime,
      
      seriesId: params.seriesId,
      projectId: params.projectId,
      shotId: params.shotId,
      
      modelType: params.modelType,
      provider: params.provider,
      apiUrl: params.apiUrl,
      modelId: params.modelId,
      
      requestParams: params.requestParams,
      response: result.response,
      
      success: result.success,
      errorMessage: result.error,
      
      isAsyncTask: false
    };
    
    await saveLLMLog(log);
    return logId;
  }
  
  /**
   * 记录异步任务开始
   */
  static async logAsyncTaskStart(params: LogParams & { taskId: string }): Promise<string> {
    const requestTime = Date.now();
    const logId = generateLogId();
    
    const log: LLMCallLog = {
      id: logId,
      requestTime,
      responseTime: requestTime,
      duration: 0,
      
      seriesId: params.seriesId,
      projectId: params.projectId,
      shotId: params.shotId,
      
      modelType: params.modelType,
      provider: params.provider,
      apiUrl: params.apiUrl,
      modelId: params.modelId,
      
      requestParams: params.requestParams,
      response: params.response,
      
      success: params.success,
      errorMessage: params.errorMessage,
      
      isAsyncTask: true,
      taskId: params.taskId,
      taskStatus: 'pending',
      pollCount: 0,
      pollStartTime: requestTime
    };
    
    await saveLLMLog(log);
    return logId;
  }
  
  /**
   * 更新异步任务状态
   */
  static async updateAsyncTask(params: UpdateLogParams): Promise<void> {
    const existingLog = await getLLMLog(params.id);
    if (!existingLog) {
      console.warn(`Log ${params.id} not found for update`);
      return;
    }
    
    const updatedLog: LLMCallLog = {
      ...existingLog,
      response: params.response ?? existingLog.response,
      success: params.success ?? existingLog.success,
      errorMessage: params.errorMessage ?? existingLog.errorMessage,
      taskStatus: params.taskStatus ?? existingLog.taskStatus,
      pollCount: params.pollCount ?? existingLog.pollCount
    };
    
    // 如果任务完成或失败，更新结束时间
    if (params.taskStatus === 'completed' || params.taskStatus === 'failed') {
      updatedLog.pollEndTime = Date.now();
      if (updatedLog.pollStartTime) {
        updatedLog.duration = updatedLog.pollEndTime - updatedLog.pollStartTime;
      }
    }
    
    await saveLLMLog(updatedLog);
  }
  
  /**
   * 根据 ID 获取日志
   */
  static async getById(id: string): Promise<LLMCallLog | undefined> {
    return getLLMLog(id);
  }

  /**
   * 根据 taskId 获取日志
   */
  static async getByTaskId(taskId: string): Promise<LLMCallLog | undefined> {
    const logs = await queryLLMLogs({ taskId });
    return logs[0];
  }

  /**
   * 获取所有 pending 状态的异步任务日志
   */
  static async getPendingAsyncTasks(): Promise<LLMCallLog[]> {
    const logs = await queryLLMLogs({
      isAsyncTask: true,
      taskStatus: 'pending'
    });
    return logs;
  }

  /**
   * 获取所有处理中的异步任务日志
   */
  static async getProcessingAsyncTasks(): Promise<LLMCallLog[]> {
    const logs = await queryLLMLogs({
      isAsyncTask: true,
      taskStatus: 'processing'
    });
    return logs;
  }

  /**
   * 查询日志
   */
  static async query(filter: LLMLogFilter = {}): Promise<LLMCallLog[]> {
    return queryLLMLogs(filter);
  }
  
  /**
   * 统计日志数量
   */
  static async count(filter: LLMLogFilter = {}): Promise<number> {
    return countLLMLogs(filter);
  }
  
  /**
   * 删除单条日志
   */
  static async delete(id: string): Promise<void> {
    return deleteLLMLog(id);
  }
  
  /**
   * 清空所有日志
   */
  static async clearAll(): Promise<void> {
    return clearLLMLogs();
  }
  
  /**
   * 清理指定天数前的旧日志
   */
  static async clearOld(beforeDays: number): Promise<number> {
    const beforeTime = Date.now() - beforeDays * 24 * 60 * 60 * 1000;
    return clearOldLLMLogs(beforeTime);
  }
  
  /**
   * 获取统计数据
   */
  static async getStats(filter: LLMLogFilter = {}): Promise<LLMLogStats> {
    return getLLMLogStats(filter);
  }
}

// 导出便捷函数
export const logLLMCall = LLMLogService.log;
export const logSyncCall = LLMLogService.logSyncCall;
export const logAsyncTaskStart = LLMLogService.logAsyncTaskStart;
export const updateAsyncTask = LLMLogService.updateAsyncTask;
export const queryLogs = LLMLogService.query;
export const getLogStats = LLMLogService.getStats;
export const clearOldLogs = LLMLogService.clearOld;
export const clearAllLogs = LLMLogService.clearAll;
export const getLogByTaskId = LLMLogService.getByTaskId;
export const getPendingAsyncTasks = LLMLogService.getPendingAsyncTasks;
export const getProcessingAsyncTasks = LLMLogService.getProcessingAsyncTasks;
