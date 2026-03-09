// services/modelproviders/bigmoreService.ts
// BigMore AI 视频生成服务

import { fetchWithRetry, pollTask } from '../../utils/apiHelper';

const BIGMORE_CONFIG = {
  // 视频生成模型
  VIDEO_MODEL: "veo3_fast",

  // API 端点
  API_ENDPOINT: "https://bigmoreai.com",
};
/**
 * 必填，模型选择：veo2_fast、veo2_quality、veo3_fast、veo3_quality、veo31_fast、veo31_quality、veo31_fast_ingredients。
 */

// Module-level variable to store key at runtime
let runtimeApiKey: string = "";
let runtimeApiUrl: string = BIGMORE_CONFIG.API_ENDPOINT;

// Runtime model name (can be overridden by config)
let runtimeVideoModel: string = BIGMORE_CONFIG.VIDEO_MODEL;

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
  runtimeApiUrl = url || BIGMORE_CONFIG.API_ENDPOINT;
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
  runtimeVideoModel = modelName || BIGMORE_CONFIG.VIDEO_MODEL;
}

/**
 * 获取当前模型名称
 */
export function getModel(): string {
  return runtimeVideoModel;
}

/**
 * 生成视频（图生视频/文生视频）
 * @param prompt - 视频提示词
 * @param startImageBase64 - 起始图片的URL或base64（可选，用于图生视频）
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
  fullFrame: boolean = false,
  imageSize: string = "2560x1440",
): Promise<string> {
  if (!runtimeApiKey) {
    throw new Error('BigMore API Key 未设置');
  }

    const [width, height] = imageSize.split('x').map(Number);
    const isLandscape = width > height;
    const size = isLandscape ? '1280x720' : '720x1280';
  try {
    // 构建请求参数
    const requestBody: any = {
      model: runtimeVideoModel,
      prompt: prompt,
    };
    if(runtimeVideoModel.includes('sora')){
      requestBody.orientation = isLandscape?'landscape':'portrait';
      requestBody.duration = duration>10?15:10;
      requestBody.removeWatermark = true;
    }else{
      requestBody.action = startImageBase64 ? 'image2video' : 'text2video';
      requestBody.aspectRatio = isLandscape?'16:9':'9:16';
      requestBody.translation = false;
    }
    // 处理起始图片（图生视频）
    const refImages: string[] = [];

    if (startImageBase64) {
      if (startImageBase64.startsWith('http')) {
        // URL 格式
        refImages.push(startImageBase64);
      }
    }
    if (endImageBase64 && !fullFrame) {
      if (endImageBase64.startsWith('http')) {
        // URL 格式
        refImages.push(endImageBase64);
      }
    }
    if(refImages.length > 0){
      if(runtimeVideoModel.includes('sora')){
        requestBody.imageList = refImages;
      }else{
        requestBody.images = refImages;
      }
    }

    // console.log('调用 BigMore 视频生成:', requestBody);

    // 发送生成请求
    let endpoint = '/ai/gemini/video/generate';
    if(runtimeVideoModel.includes('sora')){
      endpoint = '/ai/sora/video/generate';
    }
    const aikey = runtimeApiKey.split(':')[0];
    const generateData = await fetchWithRetry(runtimeApiUrl+endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'AIKey': aikey
      },
      body: JSON.stringify(requestBody)
    });

    // 根据响应格式获取任务ID
    if (generateData.code !== 0) {
      throw new Error(`BigMore 生成请求失败: ${generateData.info || '未知错误'}`);
    }

    const taskId = generateData.result?.taskCode;

    if (!taskId) {
      throw new Error('BigMore 未返回任务ID');
    }

    // console.log('BigMore 任务ID:', taskId);

    // 轮询任务状态
    return await pollTaskStatus(taskId);

  } catch (error) {
    console.error('BigMore 视频生成失败:', error);
    throw error;
  }
}

/**
 * 查询任务状态
 * @param taskId - 任务ID
 * @returns 任务状态
 */
async function getTaskStatus(taskId: string): Promise<any> {
  // BigMore 查询接口 - 根据实际接口调整
  let endpoint = '/ai/gemini/result';
  if(runtimeVideoModel.includes('sora')){
    endpoint = '/ai/sora/result';
  }
  const accountPass = runtimeApiKey.split(':')[1];
  const aikey = runtimeApiKey.split(':')[0];

  const statusUrl = `${runtimeApiUrl}${endpoint}?accountPass=${accountPass}&code=${taskId}`;

  return fetchWithRetry(statusUrl, {
    method: 'GET',
    headers: {
      'AIKey': aikey
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
    (data) => {
      if (data.code !== 0) {
        throw new Error(`BigMore 查询失败: ${data.info || '未知错误'}`);
      }
      const status = data.result?.status;
      return status === 1 ? 'success' : 'pending';
    },
    (data) => data.result?.videoUrl,
    (data) => {
      if (data.code !== 0) {
        return data.info || '未知错误';
      }
      return data.result?.error || '未知错误';
    },
    {
      maxAttempts: 300,
      pollInterval: 10000,
      successStatuses: ['success'],
      failedStatuses: [],
      pendingStatuses: ['pending']
    }
  );

  if (videoUrl) {
    return videoUrl;
  }

  throw new Error('BigMore 视频生成失败，无法获取视频URL');
}
