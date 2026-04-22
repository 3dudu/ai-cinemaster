// services/modelproviders/yunwuService.ts

import { MODEL_GENERATION_CONFIG, renderTemplate } from "../../prompt/promptTemplates";
import { Scene, ScriptData, Shot } from "../../types";
import { fetchWithRetry as apiFetchWithRetry, cleanJsonString, createAsyncTaskLog, fetchTaskStatus, LogContext, pollTask } from "../../utils/apiHelper";

// 云雾API配置
const YUNWU_CONFIG = {
  // 文本生成模型
  TEXT_MODEL: "gemini-2.5-pro",

  // 图片生成模型（待添加）
  IMAGE_MODEL: "gemini-2.5-flash-image",

  // 视频生成模型（待添加）
  VIDEO_MODEL: "veo-3.1-fast-generate-preview",

  // API 端点
  API_ENDPOINT: "https://yunwu.ai",
};

// Module-level variable to store the key at runtime
let runtimeApiKey: string = process.env.YUNWU_API_KEY || "";
let runtimeApiUrl: string = YUNWU_CONFIG.API_ENDPOINT;

// Runtime model names (can be overridden by config)
let runtimeTextModel: string = YUNWU_CONFIG.TEXT_MODEL;
let runtimeImageModel: string = YUNWU_CONFIG.IMAGE_MODEL;
let runtimeVideoModel: string = YUNWU_CONFIG.VIDEO_MODEL;

export const setApiKey = (key: string) => {
  runtimeApiKey = key ? key : process.env.YUNWU_API_KEY;
};

export const setApiUrl = (url: string) => {
  runtimeApiUrl = url || YUNWU_CONFIG.API_ENDPOINT;
};

export const setModel = (modelType: 'text' | 'image' | 'video', modelName: string) => {
  switch (modelType) {
    case 'text':
      runtimeTextModel = modelName || YUNWU_CONFIG.TEXT_MODEL;
      break;
    case 'image':
      runtimeImageModel = modelName || YUNWU_CONFIG.IMAGE_MODEL;
      break;
    case 'video':
      runtimeVideoModel = modelName || YUNWU_CONFIG.VIDEO_MODEL;
      break;
  }
};

// Helper for authentication headers
const getAuthHeaders = () => {
  return {
    "Authorization": `Bearer ${runtimeApiKey}`,
    "Content-Type": "application/json",
  };
};

// Helper to make HTTP requests to Yunwu API
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
    provider: logContext.provider || 'yunwu',
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
 * 使用云雾API的Gemini模型进行剧本结构化分析
 */
export const parseScriptToData = async (
  rawText: string,
  language: string = "中文",
  projectId?: string,
  seriesId?: string
): Promise<ScriptData> => {
  const endpoint = `${runtimeApiUrl}/v1beta/models/${runtimeTextModel}:generateContent`;
  const requestBody = {
    systemInstruction: {
      parts: [
        {
          text: renderTemplate('SYSTEM_SCRIPT_ANALYZER'),
        },
      ],
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      ...MODEL_GENERATION_CONFIG.PARSE_SCRIPT,
    },
  };

  const response = await fetchWithRetry(endpoint, {
    method: "POST",
    body: JSON.stringify(requestBody),
  }, 1, {
    modelType: 'llm',
    modelId: runtimeTextModel,
    projectId,
    seriesId
  });

  // 从云雾API的响应格式中提取内容
  const content =
    response.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

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
 * Agent 8: Video Generation
 * 使用云雾API生成视频
 * 支持图生视频和首尾帧视频
 */
export const generateVideo = async (
  prompt: string,
  startImageBase64?: string,
  endImageBase64?: string,
  duration: number = 5,
  full_frame: boolean = false,
  imageSize: string = '720x1280',
  projectId?: string,
  seriesId?: string,
  shotId?: string,
): Promise<string> => {
  const endpoint = `${runtimeApiUrl}/v1/video/create`;

  // 构建请求体
  const requestBody: any = {
    model: runtimeVideoModel || "veo3-fast-frames",
    prompt: prompt,
    duration: duration,
    images: [],
  };

  // 根据 imageSize 判断横竖屏
  const [width, height] = imageSize.split('x').map(Number);
  const isLandscape = width > height;
  const size = isLandscape ? '1280x720' : '720x1280';

  if(runtimeVideoModel.indexOf("veo") !== -1) {
    requestBody.enhance_prompt=true;
    requestBody.enable_upsample=true;
    requestBody.aspect_ratio=isLandscape?"16:9":"9:16";
  }
  if(runtimeVideoModel.indexOf("sora") !== -1) {
    requestBody.size = "small";
    requestBody.orientation=isLandscape?"portrait":"landscape";
    requestBody.watermark=false;
  }
  if(runtimeVideoModel.indexOf("grok") !== -1) {
    requestBody.size = "720P";
    requestBody.aspect_ratio=isLandscape?"3:2":"2:3";
  }

  // 处理起始图片
  if (startImageBase64) {
    requestBody.images.push(startImageBase64);;
  }

  // 处理结束图片（云雾API支持首尾帧）
  if (endImageBase64 && !full_frame && runtimeVideoModel.indexOf("grok") === -1) {
    requestBody.images.push(endImageBase64);
  }

  const response = await fetchWithRetry(endpoint, {
    method: "POST",
    body: JSON.stringify(requestBody),
  }, 1, {
    modelType: 'image2video',
    modelId: runtimeVideoModel,
    projectId,
    seriesId,
    shotId
  });

  // 获取任务ID
  const taskId = response.id;
  if (!taskId) {
    throw new Error("视频生成失败 (No task ID returned)");
  }

  //console.log(`视频任务已创建: ${taskId}, 状态: ${response.status}`);

  // 轮询任务状态直到完成
  //const videoUrl = await pollVideoTask(taskId);
  //return videoUrl;

   // 2. 创建异步任务日志
    const taskendpoint = `${runtimeApiUrl}/v1/video/query?id=${taskId}`;
    const logId = await createAsyncTaskLog({
      modelType: 'image2video',
      provider: 'yunwu',
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
      (data) => data.detail?.video_url || data.content?.video_url || data.video_url,
      // errorGetter: 从响应中提取错误信息
      (data) => data.error,
      // config: 轮询配置（可选）
      {
        maxAttempts: 240,    // 最多轮询 240 次
        pollInterval: 5000,  // 每 5 秒轮询一次
        successStatuses: ['completed', 'succeeded','video_upsampling','video_generation_completed'],
        failedStatuses: ['failed', 'error']
      },
      
      // logContext: 日志上下文（传入 logId 用于更新日志）
      {
        modelType: 'image2video',
        provider: 'yunwu',
        apiUrl: taskendpoint,
        modelId: runtimeVideoModel,
        logId  // 传入 logId 以便更新日志状态
      }
    );
    return videoUrl;
};

export const fetchVideoTaskStatus = async (
  taskId: string,
  logId?: string
): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}> => {
  const endpoint = `${runtimeApiUrl}/v1/video/query?id=${taskId}`;

  const logContext: LogContext & { logId?: string } = {
    modelType: 'image2video',
    modelId: runtimeVideoModel,
    provider: 'yunwu',
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
    (data) => data.detail?.video_url || data.content?.video_url || data.video_url,
    // errorGetter: 从响应中提取错误信息
    (data) => data.error,
    // logContext
    logContext
  );

  return {
    status: result.status,
    videoUrl: result.result,
    error: result.error
  };
};

/**
 * 轮询视频生成任务
 * @param taskId - 任务ID
 * @returns - 视频URL
 */
const pollVideoTask = async (taskId: string): Promise<string> => {
  const endpoint = `${runtimeApiUrl}/v1/video/query`;
  const maxAttempts = 120; // 最多轮询10分钟（每5秒一次）
  const pollInterval = 10000; // 5秒

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    const response =  await fetchWithRetry(`${endpoint}?id=${taskId}`, {
      method: "GET",
    });

    const status = response.status;

    if (status === "completed" || status === "succeeded" || status === "video_upsampling" || status === "video_generation_completed") {
      //console.log(`视频生成完成: ${taskId}`);
      return response.video_url || response.content?.video_url || response.detail?.video_url || "";
    } else if (status === "failed") {
      throw new Error(`视频生成失败: ${response.error || "未知错误"}`);
    } else if (status === "pending" || status === "processing" || status === "video_generating" || status === "image_downloading" || status === "queued") {
      //console.log(`视频生成中... (${i + 1}/${maxAttempts})`);
      continue;
    } else {
      throw new Error(`未知任务状态: ${status}`);
    }
  }

  throw new Error("视频生成超时");
};

/**
 * Agent 4 & 6: Image Generation
 * 使用云雾API的Gemini图片生成模型
 */
export const generateImage = async (
  prompt: string,
  referenceImages: string[] = [],
  ischaracter: string = "character",
  localStyle: string = "真人写实",
  imageSize: string = "2560x1440",
  imageCount: number = 1,
  projectId?: string,
  seriesId?: string,
  shotId?: string,
): Promise<string> => {
  const endpoint = `${runtimeApiUrl}/v1beta/models/${runtimeImageModel}:generateContent`;

  // 构建提示词
  let finalPrompt = prompt;

  const parts: any[] = [{ text: finalPrompt }];

  // 添加参考图片
  referenceImages.forEach((imgUrl) => {
    const match = imgUrl.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
    if (match) {
      parts.push({
        inline_data: {
          mime_type: match[1],
          data: match[2]
        }
      });
    }
  });

  const [width, height] = imageSize.split('x').map(Number);
  let isLandscape = width > height;
  if (ischaracter==="character") {
    isLandscape = true;
  }

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: parts
      }
    ],
    generationConfig:{
      imageConfig:{
        aspectRatio:isLandscape?"16:9":"9:16"
      }
    }
  };

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

  // 提取图片 base64 数据
  // 云雾 API 返回的格式可能使用驼峰命名或下划线命名
  const responseParts = response.candidates?.[0]?.content?.parts || [];
  for (const part of responseParts) {
    // 兼容两种命名格式: inlineData (驼峰) 或 inline_data (下划线)
    const inlineData = part.inlineData || part.inline_data;
    if (inlineData) {
      const mimeType = inlineData.mime_type || inlineData.mimeType || 'image/png';
      return `data:${mimeType};base64,${inlineData.data}`;
    }
  }
  throw new Error("图片生成失败 (No image data returned)");
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
  const endpoint = `${runtimeApiUrl}/v1beta/models/${runtimeTextModel}:generateContent`;

  const requestBody = {
    systemInstruction: {
      parts: [
        {
          text: renderTemplate('SYSTEM_SCRIPTWRITER'),
        },
      ],
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      ...MODEL_GENERATION_CONFIG.GENERATE_SCRIPT,
    },
  };

  const response = await fetchWithRetry(endpoint, {
    method: "POST",
    body: JSON.stringify(requestBody),
  }, 1, {
    modelType: 'llm',
    modelId: runtimeTextModel,
    projectId,
    seriesId
  });

  const content = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
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
  const endpoint = `${runtimeApiUrl}/v1beta/models/${runtimeTextModel}:generateContent`;
  const requestBody = {
    systemInstruction: {
      parts: [
        {
          text: systemPrompt,
        },
      ],
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      ...modelconfig,
    },
  };

  const response =  await fetchWithRetry(endpoint, {
    method: "POST",
    body: JSON.stringify(requestBody),
  }, 1, {
    modelType: 'llm',
    modelId: runtimeTextModel,
    projectId,
    seriesId
  });

  return response.candidates?.[0]?.content?.parts?.[0]?.text || "";
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
    const endpoint = `${runtimeApiUrl}/v1beta/models/${runtimeTextModel}:generateContent`;
    const requestBody = {
      systemInstruction: {
        parts: [
          {
            text: renderTemplate('SYSTEM_PHOTOGRAPHER'),
          },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        ...MODEL_GENERATION_CONFIG.GENERATE_SHOTS,
      },
    };

    const response =  await fetchWithRetry(endpoint, {
      method: "POST",
      body: JSON.stringify(requestBody),
    }, 1, {
    modelType: 'llm',
    modelId: runtimeTextModel,
    projectId,
    seriesId
  });

    const content = response.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
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
 * DeepSeek: Script Structuring & Breakdown
 * 分析剧本并结构化数据
 */
export const importScriptToData = async (
  prompt: string,
  language: string = "中文",
  projectId?: string,
  seriesId?: string
): Promise<ScriptData> => {
  const endpoint = `${runtimeApiUrl}/v1beta/models/${runtimeTextModel}:generateContent`;
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
    const endpoint = `${runtimeApiUrl}/v1beta/models/${runtimeTextModel}:generateContent`;
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
    const endpoint = `${runtimeApiUrl}/v1beta/models/${runtimeTextModel}:generateContent`;
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



