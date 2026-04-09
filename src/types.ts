export interface CharacterVariation {
  id: string;
  name: string; // e.g., "Casual", "Tactical Gear", "Injured"
  visualPrompt: string;
  referenceImage?: string;
}

export interface Character {
  id: string;
  refId?: string; // Reference to SeriesRecord.library.characters (for series episodes)
  name: string;
  gender: string;
  age: string;
  personality: string;
  visualPrompt?: string;
  referenceImage?: string; // Base URL
  variations: CharacterVariation[]; // Added: List of alternative looks
  ttsParams?: TtsParams;
  voiceUrl?: string;
}

export interface TtsParams {
    spd: number,      // 语速 0-15，默认5
    pit: number,      // 音调 0-15，默认5
    vol: number,      // 音量，基础音库0-9，精品音库0-15，默认5
    per: number,      // 发音人，默认0（度小美）
}

export interface Scene {
  id: string;
  refId?: string; // Reference to SeriesRecord.library.scenes (for series episodes)
  location: string;
  time: string;
  atmosphere: string;
  visualPrompt?: string;
  referenceImage?: string; // URL
}

export interface Keyframe {
  id: string;
  type: 'start' | 'end' | 'full';
  visualPrompt: string;
  imageUrl?: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
}

export interface VideoInterval {
  id: string;
  startKeyframeId: string;
  endKeyframeId: string;
  duration: number;
  motionStrength: number;
  videoUrl?: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  videoPrompt?: string;
}

export interface Shot {
  id: string;
  sceneId: string;
  actionSummary: string;
  dialogue?: Dialogue[];
  cameraMovement: string;
  shotSize?: string;
  characters: string[]; // Character IDs
  characterVariations?: { [characterId: string]: string }; // Added: Map char ID to variation ID for this shot
  keyframes: Keyframe[];
  interval?: VideoInterval;
  audioUrl?: string; // 语音合成音频 URL
  transitionUrl?: string; // 视频转场 URL
  // AI Model Providers configuration (stores config IDs)
  modelProviders?: {
    text2image?: string; // Text-to-image model config ID
    image2video?: string; // Image-to-video model config ID
  };
  //道具
  properties: string[];  // Properties Name
  propVariations?: { [propId: string]: string }; // Map prop name to variation ID for this shot
}

export interface Props {
  shot: Shot;
  characters: Character[];
  onSave: (updatedShot: Partial<Shot>) => void;
  onClose: () => void;
  imageCount: number;
  scriptData?: ScriptData | null;
  visualStyle?: string;
}

export interface Dialogue {
  character: string;
  value: string;
}

export interface ScriptData {
  title: string;
  genre: string;
  logline: string;
  targetDuration?: string;
  language?: string; 
  characters: Character[];
  scenes: Scene[];
  storyParagraphs: { id: number; text: string; sceneRefId: string }[];
  props: Properties[];
}

export interface ProjectState {
  id: string;
  title: string;
  createdAt: number;
  lastModified: number;
  stage: 'script' | 'assets' | 'director' | 'segments' | 'export' | 'images';
  seed?: number;
  seriesRefId?: string; // Reference to SeriesRecord.id (if this project is an episode of a series)
  // Script Phase Data
  rawScript: string;
  targetDuration: string;
  language: string;
  visualStyle: string;
  genre: string;
  imageSize: string;
  imageCount: number; // 组图数量：文生图一次生成的画面数 (0-9)
  segmentDuration: number; // 片段时长（秒）
  globalSettings?: string; // 全局设定（画面风格、历史年代等）

  scriptData: ScriptData | null;
  shots: Shot[];
  isParsingScript: boolean;

  // Segment Mode Data
  isSegmentMode: boolean; // 是否为片段模式
  scriptSourceMode?: 'generate' | 'import' | 'segment'; // 分镜来源模式
  segments: Segment[]; // 片段数组
  initSegment?: boolean;

  // Export Phase Data
  mergedVideoUrl?: string;

  // AI Model Providers configuration (stores config IDs)
  modelProviders?: {
    llm?: string; // LLM model config ID
    text2image?: string; // Text-to-image model config ID
    image2video?: string; // Image-to-video model config ID
  };
}

export interface Segment {
  id: string;
  name: string; // 片段名
  shotIds: string[]; // 包含的分镜ID数组
  sceneIds: string[]; // 涉及的场景ID列表（去重）
  characterIds: string[]; // 涉及的角色ID列表（去重）
  characterVariations?: { [characterId: string]: string }; // Added: Map char ID to variation ID for this shot
  description?: string; // 片段描述（由LLM生成）
  videoPrompt?: string;  // 视频提示词
  transitionFrom?: string; // 转场描述：从上一个片段到此片段（由LLM生成）
  transitionTo?: string; // 转场描述：从此片段到下一个片段（由LLM生成）
  estimatedDuration: number; // 预估时长（秒），不超过15秒
  motionIntensity?: number; // 运动强度 0-10
  emotionCurve?: string; // 情绪曲线描述
  dialogueRhythm?: string; // 台词与节奏描述
  createdAt: number;
  lastModified: number;
  videoUrl?: string; 
  propIds: string[];  //涉及的道具ID列表（去重）
  propVariations?: { [propId: string]: string }; // Map prop name to variation ID for this shot
}

export interface AIModelConfig {
  id: string;
  provider: 'doubao' | 'deepseek' | 'openai' | 'gemini' | 'yunwu' | 'minimax' | 'kling' | 'sora' | 'wan' | 'bigmore' | 'baidu' | 'skyreels' | 'nanobanana';
  modelType: 'llm' | 'text2image' | 'image2video' | 'tts' | 'stt';
  model: string;
  apiKey: string;
  apiUrl: string;
  enabled: boolean;
  description: string;
}

// ==================== Series Types (Plan B) ====================

export interface SeriesLibrary {
  characters: Character[];
  scenes: Scene[];
  props: Properties[];
}

export interface SeriesRecord {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  rawScript: string;
  targetDuration: string;
  language: string;
  visualStyle: string;
  genre: string;
  imageSize: string;
  imageCount: number;
  modelProviders?: {
    llm?: string; // LLM model config ID
    text2image?: string; // Text-to-image model config ID
    image2video?: string; // Image-to-video model config ID
  };
  library: SeriesLibrary;
  episodeOrder: string[]; // Array of ProjectState.id in order
  currentEpisodeId: string;
  version: 1;
  globalSettings?: string; // 全局设定（画面风格、历史年代等）
}

// Unified export bundle format (v2)
export interface ExportBundle {
  version: 2;
  exportedAt: number;
  type: 'standalone' | 'series';
  // For standalone projects
  project?: ProjectState;
  // For series
  series?: SeriesRecord;
  projects?: ProjectState[]; // Episodes of the series
}

// Legacy v1 export format (for backward compatibility)
export interface ExportBundleV1 extends ProjectState {
  // No additional fields - this is just ProjectState itself
}

// ==================== LLM Call Log Types ====================

export interface LLMCallLog {
  id: string;
  
  // 时间信息
  requestTime: number;          // 请求时间戳
  responseTime: number;         // 响应时间戳
  duration: number;             // 耗时
  
  // 关联信息
  seriesId?: string;            // 连续剧ID
  projectId?: string;           // 单剧ID/剧集ID
  shotId?: string;              // 镜头ID (可选)
  
  // 模型信息
  modelType: 'llm' | 'text2image' | 'image2video' | 'tts' | 'stt';
  provider: string;             // 供应商：doubao, deepseek, kling 等
  apiUrl: string;               // API地址
  modelId: string;              // 模型ID/名称
  
  // 请求响应
  requestParams: any;           // 请求参数
  response: any;                // 响应数据
  resultUrl?: string;           // 结果URL（视频URL、图片URL等）
  
  // 状态
  success: boolean;
  errorMessage?: string;
  
  // 异步任务相关
  isAsyncTask: boolean;         // 是否为异步任务
  taskId?: string;              // 异步任务ID
  taskStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  pollCount?: number;           // 轮询次数
  pollStartTime?: number;       // 开始轮询时间
  pollEndTime?: number;         // 结束轮询时间
}
//道具
export interface Properties {
  id: string;
  refId?: string; // Reference to SeriesRecord.library.props (for series episodes)
  name: string;
  shape: string;
  material: string;
  color: string;
  size: string;
  structural: string;
  effects: string;
  description: string;
  variations: PropertieVariation[]; // Added: List of alternative looks
  visualPrompt?: string;
  referenceImage?: string; // Base URL
}

//道具变形
export interface PropertieVariation {
  id: string;
  name: string; // e.g., "Casual", "Tactical Gear", "Injured"
  visualPrompt: string;
  referenceImage?: string;
}


// Electron API types
declare global {
  interface Window {
    electron?: {
      send: (channel: string, data?: any) => void;
      on: (channel: string, func: (...args: any[]) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
    platform?: {
      isElectron: boolean;
      platform: string;
      arch: string;
    };
  }
}