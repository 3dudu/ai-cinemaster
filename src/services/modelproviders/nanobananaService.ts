// services/modelproviders/nanobananaService.ts
// Nanobanana 图片生成服务

import { fetchWithRetry } from '../../utils/apiHelper';

const NANOBANANA_CONFIG = {
  // 图片生成模型
  IMAGE_MODEL: "gemini-3-pro-image-preview",

  // API 端点
  API_ENDPOINT: "https://api.nanobananaapi.dev",
};

// Module-level variable to store key at runtime
let runtimeApiKey: string = "";
let runtimeApiUrl: string = NANOBANANA_CONFIG.API_ENDPOINT;

// Runtime model name (can be overridden by config)
let runtimeImageModel: string = NANOBANANA_CONFIG.IMAGE_MODEL;

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
  runtimeApiUrl = url || NANOBANANA_CONFIG.API_ENDPOINT;
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
  runtimeImageModel = modelName || NANOBANANA_CONFIG.IMAGE_MODEL;
}

/**
 * 获取当前模型名称
 */
export function getModel(): string {
  return runtimeImageModel;
}

/**
 * 生成图片（图生图）
 * @param prompt - 图片提示词
 * @param imageUrl - 参考图片URL
 * @param imageSize - 图片尺寸比例 (如 "16:9", "9:16", "1:1")
 * @param num - 生成图片数量
 * @returns 生成图片的URL
 */
export async function generateImage(
  prompt: string,
  referenceImages: string[] = [],
  imageType: string = "character",
  localStyle: string = "真人写实",
  imageSize: string = "2560x1440",
  imageCount: number = 1,
  seed: number = 0,
): Promise<string> {
  if (!runtimeApiKey) {
    throw new Error('Nanobanana API Key 未设置');
  }
  let endpoint = `${runtimeApiUrl}/v1/images/generate`;

  try {
    // 构建请求体
    const requestBody: any = {
      prompt: prompt,
      num: 1,
      model: runtimeImageModel,
      image_size: "16:9"
    };

    const [width, height] = imageSize.split('x').map(Number);
    const isLandscape = width > height;
    if (isLandscape) {
      requestBody.image_size = "16:9";
    } else {
      requestBody.image_size = "9:16";
    }

    // 如果有参考图片，添加到请求体
    if (referenceImages && referenceImages.length > 0) {
      requestBody.image = referenceImages;
      endpoint = `${runtimeApiUrl}/v1/images/edit`;
    }

    // 发送生成请求
    const response = await fetchWithRetry(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${runtimeApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    }, 1, false);

    const data = await response.json();

    // 检查响应状态
    if (data.code !== 0) {
      throw new Error(data.message || 'Nanobanana 图片生成失败');
    }

    // 获取图片URL
    const imageUrlResult = data.data?.url;
    if (!imageUrlResult) {
      throw new Error('Nanobanana 未返回图片URL');
    }

    return imageUrlResult;

  } catch (error) {
    console.error('Nanobanana 图片生成失败:', error);
    throw error;
  }
}
