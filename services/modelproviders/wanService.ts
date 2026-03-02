// services/modelproviders/wanService.ts
// Wan 视频生成服务 (通义万象)

import { fetchWithRetry, pollTask } from '../../utils/apiHelper';

const WAN_CONFIG = {
  // 视频生成模型
  VIDEO_MODEL: "wan2.5-i2v-preview",

  // API 端点
  API_ENDPOINT: "https://yunwu.ai/alibailian/api/v1/services/aigc/video-generation/video-synthesis",
};

// Module-level variable to store key at runtime
let runtimeApiKey: string = "";
let runtimeApiUrl: string = WAN_CONFIG.API_ENDPOINT;

// Runtime model name (can be overridden by config)
let runtimeVideoModel: string = WAN_CONFIG.VIDEO_MODEL;

/**
 * 设置 API Key
 */
export function setApiKey(key: string): void {
  runtimeApiKey = key ? key : "";
}

/**
 * 设置 API URL
 */
export function setApiUrl(url: string): void {
  runtimeApiUrl = url || WAN_CONFIG.API_ENDPOINT;
}

/**
 * 获取 API Key
 */
export function getApiKey(): string {
  return runtimeApiKey;
}

/**
 * 获取 API URL
 */
export function getApiUrl(): string {
  return runtimeApiUrl;
}

/**
 * 设置模型名称
 */
export function setModel(modelName: string): void {
  runtimeVideoModel = modelName || WAN_CONFIG.VIDEO_MODEL;
}

/**
 * 获取当前模型名称
 */
export function getModel(): string {
  return runtimeVideoModel;
}

/**
 * 生成视频（图生视频）
 * @param prompt - 视频提示词
 * @param startImageBase64 - 起始图片的URL或base64
 * @param endImageBase64 - 结束图片的URL或base64（可选）
 * @param duration - 视频时长（秒）
 * @param fullFrame - 是否为完整宫格模式
 * @returns 视频URL
 */
export async function generateVideo(
  prompt: string,
  startImageBase64?: string,
  endImageBase64?: string,
  duration: number = 5,
  fullFrame: boolean = false
): Promise<string> {
  if (!runtimeApiKey) {
    throw new Error('Wan API Key 未设置');
  }

  try {
    // 构建请求参数
    const requestBody: any = {
      model: runtimeVideoModel,
      input: {
        prompt: prompt,
      },
      parameters: {
        resolution: '720P',
        prompt_extend: false,
        audio: false
      }
    };
    if (runtimeVideoModel.includes('wan2.5-i2v-preview')){
      requestBody.parameters.audio = true;
    }
    // 处理起始图片
    if (startImageBase64) {
        requestBody.input.img_url = startImageBase64;
    }

    // 设置时长（如果 API 支持）
    if (duration) {
      requestBody.parameters.duration = duration >= 10 ? 10 : 5;
    }

    // console.log('调用 Wan 视频生成:', requestBody);

    // 发送生成请求
    const generateData = await fetchWithRetry(runtimeApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${runtimeApiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    const taskId = generateData.output?.task_id;

    if (!taskId) {
      throw new Error('Wan 未返回任务ID');
    }

    // console.log('Wan 任务ID:', taskId);

    // 轮询任务状态
    return await pollTaskStatus(taskId);

  } catch (error) {
    console.error('Wan 视频生成失败:', error);
    throw error;
  }
}

/**
 * 查询任务状态
 * @param taskId - 任务ID
 * @returns 任务状态
 */
async function getTaskStatus(taskId: string): Promise<any> {
  const statusUrl = `${runtimeApiUrl.replace('/services/aigc/video-generation/video-synthesis', '')}/tasks/${taskId}`;

  return fetchWithRetry(statusUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${runtimeApiKey}`
    }
  });
}

/**
 * 轮询任务状态直到完成
 * @param taskId - 任务ID
 * @returns 视频URL
 */
async function pollTaskStatus(taskId: string): Promise<string> {
  const videoUrl = await pollTask(
    () => getTaskStatus(taskId),
    (data) => data.output?.task_status || data.task_status,
    (data) => data.output?.video_url || data.output?.url || data.video_url || data.url,
    (data) => data.message || data.error?.message || '未知错误',
    {
      maxAttempts: 120,
      pollInterval: 10000,
      successStatuses: ['SUCCEEDED', 'SUCCESS', 'Success'],
      failedStatuses: ['FAILED', 'Failed', 'CANCELLED', 'Cancelled'],
      pendingStatuses: ['PENDING', 'RUNNING', 'Pending', 'Running']
    }
  );

  if (videoUrl) {
    return videoUrl;
  }

  throw new Error('Wan 视频生成失败，无法获取视频URL');
}
