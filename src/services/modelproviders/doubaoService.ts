// services/modelproviders/doubaoService.ts

import { MODEL_GENERATION_CONFIG, renderTemplate } from "../../prompt/promptTemplates";
import { Scene, ScriptData, Shot } from "../../types";
import { fetchWithRetry as apiFetchWithRetry, cleanJsonString, createAsyncTaskLog, fetchTaskStatus, LogContext, pollTask } from "../../utils/apiHelper";

// 火山引擎配置
const DOUBAO_CONFIG = {
  // 文本生成模型（替代 gemini-2.5-flash）
  TEXT_MODEL: "doubao-seed-1-8-251228", // 或 "doubao-pro-128k"

  // 图片生成模型（替代 gemini-2.5-flash-image）
  IMAGE_MODEL: "doubao-seedream-4-5-251128", // 火山引擎的图片生成模型

  // 视频生成模型（替代 veo-3.1-fast-generate-preview）
  //VIDEO_MODEL: "doubao-seedance-1-5-pro-251215", // 火山引擎的视频生成模型
  //VIDEO_MODEL: "doubao-seedance-1-0-pro-250528", // 火山引擎的视频生成模型
  VIDEO_MODEL: "doubao-seedance-1-0-pro-250528", // 火山引擎的视频生成模型

  // API 端点
  API_ENDPOINT: "https://ark.cn-beijing.volces.com/api/v3",
};

// Module-level variable to store the key at runtime
let runtimeApiKey: string = process.env.VOLCENGINE_API_KEY || "";
let runtimeApiUrl: string = DOUBAO_CONFIG.API_ENDPOINT;
let region: string = process.env.VOLCENGINE_REGION || "cn-beijing";

// Runtime model names (can be overridden by config)
let runtimeTextModel: string = DOUBAO_CONFIG.TEXT_MODEL;
let runtimeImageModel: string = DOUBAO_CONFIG.IMAGE_MODEL;
let runtimeVideoModel: string = DOUBAO_CONFIG.VIDEO_MODEL;

export const setApiKey = (key: string) => {
  runtimeApiKey = key?key : process.env.VOLCENGINE_API_KEY;
};
export const setGlobalApiKey = (key: string) => {
  runtimeApiKey = key?key : process.env.VOLCENGINE_API_KEY;
};

export const setRegion = (r: string) => {
  region = r;
};

export const setApiUrl = (url: string) => {
  runtimeApiUrl = url || DOUBAO_CONFIG.API_ENDPOINT;
};

export const setModel = (modelType: 'text' | 'image' | 'video', modelName: string) => {
  switch (modelType) {
    case 'text':
      runtimeTextModel = modelName || DOUBAO_CONFIG.TEXT_MODEL;
      break;
    case 'image':
      runtimeImageModel = modelName || DOUBAO_CONFIG.IMAGE_MODEL;
      break;
    case 'video':
      runtimeVideoModel = modelName || DOUBAO_CONFIG.VIDEO_MODEL;
      break;
  }
};

// Helper for authentication headers
const getAuthHeaders = () => {
  if (!runtimeApiKey || runtimeApiKey.trim() === "") {
    throw new Error("API Key 未配置或为空，请先设置有效的 API Key");
  }

  return {
    "Authorization": `Bearer ${runtimeApiKey}`,
    "Content-Type": "application/json",
  };
};

// Helper to make HTTP requests to Volcengine API (with logging support)
const fetchWithRetry = async (
  endpoint: string,
  options: RequestInit,
  retries: number = 1,
  logContext?: Partial<LogContext>
): Promise<any> => {
  const requestOptions: RequestInit = {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  };
  
  // 构建完整的日志上下文
  const fullLogContext: LogContext | undefined = logContext ? {
    modelType: logContext.modelType || 'llm',
    provider: logContext.provider || 'doubao',
    apiUrl: endpoint,
    modelId: logContext.modelId || runtimeTextModel,
    seriesId: logContext.seriesId,
    projectId: logContext.projectId,
    shotId: logContext.shotId,
    isAsyncTask: logContext.isAsyncTask,
    taskId: logContext.taskId
  } : undefined;
  
  return apiFetchWithRetry(endpoint, requestOptions, retries, true, fullLogContext);
};

/**
 * Agent 1 & 2: Script Structuring & Breakdown
 * Uses Doubao for fast, structured text generation.
 */
export const parseScriptToData = async (
  prompt: string,
  language: string = "中文",
  projectId?: string,
  seriesId?: string
): Promise<ScriptData> => {
    const endpoint = `${runtimeApiUrl}/chat/completions`;
    const response = await fetchWithRetry(endpoint, {
    method: "POST",
    body: JSON.stringify({
      model: runtimeTextModel,
      messages: [
        {
          role: "system",
          content: renderTemplate('SYSTEM_SCRIPT_ANALYZER'),
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      ...MODEL_GENERATION_CONFIG.PARSE_SCRIPT,
    }),
  }, 1, {
    modelType: 'llm',
    modelId: runtimeTextModel,
    projectId,
    seriesId
  });

  const content = response.choices?.[0]?.message?.content || "{}";

  let parsed: any = {};
  try {
    const text = cleanJsonString(content);
    //console.log("Parsed JSON:", text);
    parsed = JSON.parse(text);
    if(Array.isArray(parsed)){
      parsed = parsed[0];
    }
  } catch (e) {
    console.error("Failed to parse script data JSON:", e);
    parsed = {};
  }

  // Enforce String IDs for consistency and init variations
  const characters = Array.isArray(parsed.characters)
    ? parsed.characters.map((c: any) => ({
        ...c,
        id: String(c.id),
        variations: [],
      }))
    : [];
  const scenes = Array.isArray(parsed.scenes)
    ? parsed.scenes.map((s: any) => ({ ...s, id: String(s.id) }))
    : [];
  const storyParagraphs = Array.isArray(parsed.storyParagraphs)
    ? parsed.storyParagraphs.map((p: any) => ({
        ...p,
        sceneRefId: String(p.sceneRefId),
      }))
    : [];
  const props = Array.isArray(parsed.props)
    ? parsed.props.map((c: any) => ({
        ...c,
        id: String(c.id),
        variations: [],
      }))
    : [];
  return {
    title: parsed.title || "未命名剧本",
    genre: parsed.genre || "",
    logline: parsed.logline || "",
    language: language,
    characters,
    scenes,
    props,
    storyParagraphs,
  };
};

/**
 * 为单个场景生成镜头清单
 * @param scriptData - 剧本数据
 * @param scene - 场景数据
 * @param index - 场景索引
 */
export const generateShotListForScene = async (
  scene: any,
  prompt: string,
  projectId?: string,
  seriesId?: string
): Promise<Shot[]> => {
  try {
    const endpoint = `${runtimeApiUrl}/chat/completions`;
    const response = await fetchWithRetry(endpoint, {
      method: "POST",
      body: JSON.stringify({
        model: runtimeTextModel,
        messages: [
          {
            role: "system",
            content: renderTemplate('SYSTEM_PHOTOGRAPHER'),
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        ...MODEL_GENERATION_CONFIG.GENERATE_SHOTS,
      }),
    }, 1, {
    modelType: 'llm',
    modelId: runtimeTextModel,
    projectId,
    seriesId
  });

    const content = response.choices?.[0]?.message?.content || "[]";
    const shots = JSON.parse(cleanJsonString(content));

    const validShots = Array.isArray(shots) ? shots : [];
    return validShots.map((s: any) => ({
      ...s,
      sceneId: String(scene.id),
    }));
  } catch (e) {
    console.error(`Failed to generate shots for scene ${scene.id}`, e);
    return [];
  }
};

/**
 * Agent 0: Script Generation from simple prompt
 * 根据简单提示词生成完整剧本
 */
export const generateScript = async (
  prompt: string,
  genre: string = "剧情片",
  targetDuration: string = "60s",
  language: string = "中文",
  projectId?: string,
  seriesId?: string
): Promise<string> => {
  const endpoint = `${runtimeApiUrl}/chat/completions`;

  const response = await fetchWithRetry(endpoint, {
    method: "POST",
    body: JSON.stringify({
      model: runtimeTextModel,
      messages: [
        {
          role: "system",
          content: renderTemplate('SYSTEM_SCREENWRITER'),
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      ...MODEL_GENERATION_CONFIG.GENERATE_SCRIPT,
    }),
  }, 1, {
    modelType: 'llm',
    modelId: runtimeTextModel,
    projectId,
    seriesId
  });

  const content = response.choices?.[0]?.message?.content || "";
  return content.trim();
};

/**
 * Agent 3: Visual Design (Prompt Generation)
 */
export const generateCommonPrompts = async (
  prompt: string,
  systemPrompt: string = "视觉设计师",
  modelconfig:any=MODEL_GENERATION_CONFIG.GENERATE_VISUAL_PROMPT,
  projectId?: string,
  seriesId?: string
): Promise<string> => {
  const endpoint = `${runtimeApiUrl}/chat/completions`;
  const response = await fetchWithRetry(endpoint, {
    method: "POST",
    body: JSON.stringify({
      model: runtimeTextModel,
      messages: [
        {
            role: "system",
            content: systemPrompt,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      ...modelconfig,
    }),
  }, 1, {
    modelType: 'llm',
    modelId: runtimeTextModel,
    projectId,
    seriesId
  });

  return response.choices?.[0]?.message?.content || "";
};

/**
 * Agent 4 & 6: Image Generation
 * 使用火山引擎的 Seedream 模型
 */
export const generateImage = async (
  prompt: string,
  referenceImages: string[] = [],
  imageType: string = "character",
  localStyle: string = "真人写实",
  imageSize: string = "2560x1440",
  imageCount: number = 1,
  seed: number = 0,
  projectId?: string,
  seriesId?: string,
  shotId?: string,
): Promise<string> => {
  const endpoint = `${runtimeApiUrl}/images/generations`;
  const requestBody: any = {
    model: runtimeImageModel,
    size: imageType=="character"?"2560x1440":imageSize,
    //sequential_image_generation: ischaracter?"disabled":"auto",
    watermark: false
  };

  if(seed>0){
    requestBody.seed = seed;
  }

  /*
  if (imageCount > 1) {
    requestBody.sequential_image_generation_options = {
      max_images: imageCount
    };
  }
  */
  // 如果有参考图片，火山引擎可能需要不同的处理方式
  // 具体实现需要参考火山引擎的图片生成 API 文档
  let finalPrompt = prompt;
  if (referenceImages.length > 0) {
    // 这里需要根据实际 API 调整
    // 可能需要使用 image_url 参数或其他方式
    requestBody.image = referenceImages;
  }

  requestBody.prompt = finalPrompt;

  const response = await fetchWithRetry(endpoint, {
    method: "POST",
    body: JSON.stringify(requestBody),
  }, 1, {
    modelType: 'text2image',
    modelId: runtimeImageModel,
    projectId,
    seriesId,
    shotId
  });

  // 提取图片 URL 或 base64 数据
  if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
    throw new Error("图片生成失败: 无效的响应数据");
  }

  if (response.data.length > 1) {
    const imagesGroup = response.data
      .filter((item: any) => item && item.url)
      .map((item: any) => item.url);
    
    if (imagesGroup.length === 0) {
      throw new Error("图片生成失败: 没有有效的图片URL");
    }
    
    return joinImage(imagesGroup, imageSize, imageCount);
  } else {
    if (!response.data[0] || !response.data[0].url) {
      throw new Error("图片生成失败: 缺少图片URL");
    }
    return response.data[0].url;
  }
};

/**
 * Agent 4 & 6: Image Generation
 * 使用火山引擎的 Seedream 模型
 */
export const joinImage = async (
  referenceImages: string[] = [],
  imageSize: string = "2560x1440",
  imageCount: number = 1
): Promise<string> => {
  const endpoint = `${runtimeApiUrl}/images/generations`;
  
  // 验证输入参数
  if (!Array.isArray(referenceImages) || referenceImages.length === 0) {
    throw new Error("参考图片列表不能为空");
  }
  
  if (imageCount === 1) {
    const url = referenceImages[0];
    if (!url || typeof url !== 'string') {
      throw new Error("无效的图片URL");
    }
    return url;
  }
  const requestBody: any = {
    model: runtimeImageModel,
    prompt: renderTemplate('JOIN_IMAGES', imageCount, imageSize),
    size: imageSize,
    watermark: false
  };

  if (referenceImages.length > 0) {
    // 这里需要根据实际 API 调整
    // 可能需要使用 image_url 参数或其他方式
    requestBody.image = referenceImages;
  }

  const response = await fetchWithRetry(endpoint, {
    method: "POST",
    body: JSON.stringify(requestBody),
  });

  // 提取图片 URL 或 base64 数据
  const imageUrl = response.data?.[0]?.url;
  if (!imageUrl) {
    throw new Error("图片生成失败");
  }

  // 如果返回的是 URL，可以转换为 base64 或者直接返回 URL
  return imageUrl;
};

/**
 * Agent 8: Video Generation
 * 使用火山引擎的 Seedream 视频生成模型
 */
export const generateVideo = async (
  prompt: string,
  startImageBase64?: string,
  endImageBase64?: string,
  duration: number = 5,
  full_frame: boolean = false,
  generate_audio: boolean = false,
  imageSize: string = "2560x1440",
  seed: number = 0,
  referenceImages: string[] = [],
  projectId?: string,
  seriesId?: string,
  shotId?: string,
  processedVoiceUrls: string[] = [],
): Promise<string> => {
  const endpoint = `${runtimeApiUrl}/contents/generations/tasks`;

  let p_duration = duration;
  if(duration<4){
    p_duration = 4;
  }else if(duration>15){
    p_duration = 15;
  }
  const requestBody: any = {
    model: runtimeVideoModel,
    duration: p_duration,
    watermark: false,
    content: [{
      type: "text",
      text: prompt
    }]
  };
  if(seed>0){
    requestBody.seed = seed;
  }
  const [width, height] = imageSize.split('x').map(Number);
  const isLandscape = width > height;
  if (isLandscape) {
    requestBody.ratio = "16:9";
  } else {
    requestBody.ratio = "9:16";
  }

  requestBody.generate_audio = generate_audio;
  // 处理起始图片
  if (startImageBase64) {
    requestBody.content.push({
            "type": "image_url",
            "image_url": {
                "url": startImageBase64
            },
            "role": full_frame?"reference_image":"first_frame"
    });
  }

  // 处理结束图片（如果火山引擎支持）
  if (endImageBase64 && !full_frame) {
    requestBody.content.push({
            "type": "image_url",
            "image_url": {
                "url": endImageBase64
            },
            "role": "last_frame"
    });
  }

  if (referenceImages && referenceImages.length > 0){
    referenceImages.forEach((imageUrl) => {
      requestBody.content.push({
        "type": "image_url",
        "image_url": {
          "url": imageUrl
        },
        "role": "reference_image"
      });
    });
  }
  if(processedVoiceUrls && processedVoiceUrls.length>0){
    processedVoiceUrls.forEach((voiceUrl) => {
      requestBody.content.push({
        "type": "audio_url",
        "audio_url": {
          "url": voiceUrl
        },
        "role": "reference_audio"
      });
    });
  }
  
  const response = await fetchWithRetry(endpoint, {
    method: "POST",
    body: JSON.stringify(requestBody),
  }, 1, {
    modelType: 'image2video',
    modelId: runtimeImageModel,
    projectId,
    seriesId,
    shotId
  });

  // 火山引擎可能返回异步任务 ID，需要轮询获取结果
  const taskId = response.id;
  if (!taskId) {
    throw new Error("视频生成失败");
  }

  // 轮询任务状态
  //const videoUrl = await pollVideoTask(taskId, projectId, seriesId, shotId);


   // 2. 创建异步任务日志
  const taskendpoint = `${runtimeApiUrl}/contents/generations/tasks/${taskId}`;
  const logId = await createAsyncTaskLog({
    modelType: 'image2video',
    provider: 'doubao',
    apiUrl: taskendpoint,
    modelId: runtimeVideoModel,
    taskId,
    projectId,
    seriesId,
    shotId
  },  requestBody , response);

    // 3. 使用 pollTask 轮询任务状态
  const videoUrl = await pollTask(
    // taskFetcher: 获取任务状态的函数
    () => fetchWithRetry(taskendpoint, { method: 'GET' }),
    // statusGetter: 从响应中提取状态
    (data) => data.status,
    // resultGetter: 从响应中提取视频URL
    (data) => data.content?.video_url,
    // errorGetter: 从响应中提取错误信息
    (data) => data.error?.message,
    // config: 轮询配置（可选）
    {
      maxAttempts: 240,    // 最多轮询 240 次
      pollInterval: 5000,  // 每 5 秒轮询一次
      successStatuses: ['completed', 'succeeded'],
      failedStatuses: ['failed', 'error']
    },
    
    // logContext: 日志上下文（传入 logId 用于更新日志）
    {
      modelType: 'image2video',
      provider: 'doubao',
      apiUrl: taskendpoint,
      modelId: runtimeVideoModel,
      logId  // 传入 logId 以便更新日志状态
    }
  );
  return videoUrl;
};

/**
 * 手动查询视频任务状态（单次查询）
 * 用于用户手动刷新异步任务状态
 */
export const fetchVideoTaskStatus = async (
  taskId: string,
  logId?: string
): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}> => {
  const endpoint = `${runtimeApiUrl}/contents/generations/tasks/${taskId}`;

  const logContext: LogContext & { logId?: string } = {
    modelType: 'image2video',
    modelId: runtimeVideoModel,
    provider: 'doubao',
    apiUrl: endpoint,
    taskId,
    isAsyncTask: false,  // 这是查询请求，不是新的异步任务
    logId
  };

  const result = await fetchTaskStatus(
    // taskFetcher: 获取任务状态的函数
    () => fetchWithRetry(endpoint, { method: 'GET' }),
    // statusGetter: 从响应中提取状态
    (data) => data.status,
    // resultGetter: 从响应中提取视频URL
    (data) => data.content?.video_url,
    // errorGetter: 从响应中提取错误信息
    (data) => data.error?.message,
    // logContext
    logContext
  );

  return {
    status: result.status,
    videoUrl: result.result,
    error: result.error
  };
};

// 轮询视频生成任务
const pollVideoTask = async (
  taskId: string,
  projectId?: string,
  seriesId?: string,
  shotId?: string
): Promise<string> => {
  const endpoint = `${runtimeApiUrl}/contents/generations/tasks/${taskId}`;

  let attempts = 0;
  const maxAttempts = 240; // 最多轮询 5 分钟

  while (attempts < maxAttempts) {
    const response = await fetchWithRetry(endpoint, {
      method: "GET",
    }, 1, {
      modelType: 'image2video',
      modelId: runtimeVideoModel,
      projectId,
      seriesId,
      shotId,
      isAsyncTask: false,
      taskId
    });

    const status = response.status;
    if (status === "completed" || status === "succeeded") {
      return response.video_url || response.content?.video_url;
    } else if (status === "failed") {
      throw new Error(`视频生成失败: ${response.error?.message || response.error?.code || response.error}`);
    }

    // 等待 5 秒后继续轮询
    await new Promise((resolve) => setTimeout(resolve, 5000));
    attempts++;
  }

  throw new Error("视频生成超时");
};


/**
 * DeepSeek: Script Structuring & Breakdown
 * 分析剧本并结构化数据
 */
export const importScriptToData = async (
  prompt: string,
  language: string = "中文",
  projectId?: string,
  seriesId?: string
): Promise<ScriptData> => {
  const endpoint = `${runtimeApiUrl}/chat/completions`;
  const response = await fetchWithRetry(endpoint, {
    method: "POST",
    body: JSON.stringify({
      model: runtimeTextModel,
      messages: [
        {
          role: "system",
          content: renderTemplate('SYSTEM_SCRIPT_IMPORTER'),
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      ...MODEL_GENERATION_CONFIG.IMPORT_SCRIPT,
    }),
  }, 1, {
    modelType: 'llm',
    modelId: runtimeTextModel,
    projectId,
    seriesId
  });

  const content = response.choices?.[0]?.message?.content || "{}";

  let parsed: any = {};
  try {
    const text = cleanJsonString(content);
    //console.log("Parsed JSON:", text);
    parsed = JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse script data JSON:", e);
    parsed = {};
  }

  // Enforce String IDs for consistency and init variations
  const characters = Array.isArray(parsed.characters)
    ? parsed.characters.map((c: any) => ({
        ...c,
        id: String(c.id),
        variations: [],
      }))
    : [];
  const scenes = Array.isArray(parsed.scenes)
    ? parsed.scenes.map((s: any) => ({ ...s, id: String(s.id) }))
    : [];
  const storyParagraphs = Array.isArray(parsed.storyParagraphs)
    ? parsed.storyParagraphs.map((p: any) => ({
        ...p,
        sceneRefId: String(p.sceneRefId),
      }))
    : [];

  return {
    title: parsed.title || "未命名剧本",
    genre: parsed.genre || "",
    logline: parsed.logline || "",
    language: language,
    characters,
    scenes,
    storyParagraphs,
  };
};

export const importShotList = async (
  prompt: string,
  projectId?: string,
  seriesId?: string
): Promise<Shot[]> => {

  try {
    const endpoint = `${runtimeApiUrl}/chat/completions`;
    const response = await fetchWithRetry(endpoint, {
      method: "POST",
      body: JSON.stringify({
        model: runtimeTextModel,
        messages: [
          {
            role: "system",
            content: renderTemplate('SYSTEM_SCRIPT_IMPORTER'),
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        ...MODEL_GENERATION_CONFIG.IMPORT_SCRIPT,
      }),
    }, 1, {
    modelType: 'llm',
    modelId: runtimeTextModel,
    projectId,
    seriesId
  });

    const content = response.choices?.[0]?.message?.content || "[]";
    const shots = JSON.parse(cleanJsonString(content));
    const validShots = Array.isArray(shots) ? shots : [];
    return validShots;
  } catch (e) {
    console.error(`Failed to import shots`, e);
    return [];
  }
};

export const importShotListForScene = async (
  scene:Scene,
  prompt: string,
  projectId?: string,
  seriesId?: string
): Promise<Shot[]> => {

  try {
    const endpoint = `${runtimeApiUrl}/chat/completions`;
    const response = await fetchWithRetry(endpoint, {
      method: "POST",
      body: JSON.stringify({
        model: runtimeTextModel,
        messages: [
          {
            role: "system",
            content: renderTemplate('SYSTEM_SCRIPT_IMPORTER'),
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        ...MODEL_GENERATION_CONFIG.IMPORT_SCRIPT,
      }),
    }, 1, {
    modelType: 'llm',
    modelId: runtimeTextModel,
    projectId,
    seriesId
  });

    const content = response.choices?.[0]?.message?.content || "[]";
    const shots = JSON.parse(cleanJsonString(content));
    const validShots = Array.isArray(shots) ? shots : [];
    return validShots.map((s: any) => ({
      ...s,
      sceneId: String(scene.id),
    }));
  } catch (e) {
    console.error(`Failed to import shots`, e);
    return [];
  }
};
