// services/modelproviders/deepseekService.ts

import { Scene, ScriptData, Shot } from "../../types";
import { fetchWithRetry as apiFetchWithRetry, cleanJsonString, LogContext } from "../../utils/apiHelper";
import { MODEL_GENERATION_CONFIG, renderTemplate } from "../promptTemplates";

// DeepSeek 配置
const DEEPSEEK_CONFIG = {
  // 文本生成模型
  TEXT_MODEL: "deepseek-chat",
  // API 端点（默认使用官方 API）
  API_ENDPOINT: "https://api.deepseek.com/v1",
};

// Module-level variable to store key at runtime
let runtimeApiKey: string = "";
let runtimeApiUrl: string = DEEPSEEK_CONFIG.API_ENDPOINT;
let runtimeTextModel: string = DEEPSEEK_CONFIG.TEXT_MODEL;

export const setApiKey = (key: string) => {
  runtimeApiKey = key;
};

export const setApiUrl = (url: string) => {
  runtimeApiUrl = url || DEEPSEEK_CONFIG.API_ENDPOINT;
};

export const setModel = (modelName: string) => {
  runtimeTextModel = modelName || DEEPSEEK_CONFIG.TEXT_MODEL;
};

// Helper for authentication headers
const getAuthHeaders = () => {
  return {
    "Authorization": `Bearer ${runtimeApiKey}`,
    "Content-Type": "application/json",
  };
};

// Helper to make HTTP requests to DeepSeek API
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
 * DeepSeek: Script Structuring & Breakdown
 * 分析剧本并结构化数据
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

/**
 * DeepSeek: Shot List Generation
 * 为剧本生成镜头清单
 */
/**
 * DeepSeek: 为单个场景生成镜头清单
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
 * DeepSeek: Script Generation from simple prompt
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
 * DeepSeek: Visual Design (Prompt Generation)
 * 生成视觉提示词
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
    return shots;
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
