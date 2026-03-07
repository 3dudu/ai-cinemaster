export interface CharacterVariation {
  id: string;
  name: string; // e.g., "Casual", "Tactical Gear", "Injured"
  visualPrompt: string;
  referenceImage?: string;
}

export interface Character {
  id: string;
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
}

export interface ProjectState {
  id: string;
  title: string;
  createdAt: number;
  lastModified: number;
  stage: 'script' | 'assets' | 'director' | 'export' | 'images';

  // Script Phase Data
  rawScript: string;
  targetDuration: string;
  language: string;
  visualStyle: string;
  genre: string;
  imageSize: string;
  imageCount: number; // 组图数量：文生图一次生成的画面数 (0-9)

  scriptData: ScriptData | null;
  shots: Shot[];
  isParsingScript: boolean;

  // Export Phase Data
  mergedVideoUrl?: string;

  // AI Model Providers configuration (stores config IDs)
  modelProviders?: {
    llm?: string; // LLM model config ID
    text2image?: string; // Text-to-image model config ID
    image2video?: string; // Image-to-video model config ID
  };
}

export interface AIModelConfig {
  id: string;
  provider: 'doubao' | 'deepseek' | 'openai' | 'gemini' | 'yunwu' | 'minimax' | 'kling' | 'sora' | 'wan' | 'bigmore' | 'baidu' | 'skyreels';
  modelType: 'llm' | 'text2image' | 'image2video' | 'tts' | 'stt';
  model: string;
  apiKey: string;
  apiUrl: string;
  enabled: boolean;
  description: string;
}