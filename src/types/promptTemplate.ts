/**
 * 提示词模版组类型定义
 * 用于根据项目风格自动匹配合适的提示词模版
 */

/** 模版组匹配规则 */
export interface TemplateGroupMatchRules {
  visualStyle?: string[];     // 匹配的视觉风格关键词
  genre?: string[];           // 匹配的题材类型
  globalSettings?: string[];  // 匹配的全局设定关键词
  priority: number;           // 优先级（0最低，数值越高越优先）
}

/** 组内模版（14个可选项，未定义则降级到 default 组） */
export interface GroupTemplates {
  // 系统提示词
  systemCharacterDesigner?: string;   // SYSTEM_CHARA_DESIGNER
  systemSceneDesigner?: string;       // SYSTEM_SCENE_DESIGNER
  systemPropDesigner?: string;        // SYSTEM_PROP_DESIGNER
  systemSegmentDesigner?: string;     // SYSTEM_SEGMENT_DESIGNER
  systemSegmentSplit?: string;        // SYSTEM_SEGMENT_SPLIT
  // 视觉提示词润色
  characterPrompt?: string;           // GENERATE_CHARACTER_PROMPT
  scenePrompt?: string;               // GENERATE_SCENE_PROMPT
  propPrompt?: string;                // GENERATE_PROP_PROMPT
  segmentPrompt?: string;             // GENERATE_SEGMENT_PROMPT
  segmentOptimizePrompt?: string;     // OPTIMIZE_SEGMENT_PROMPT
  // 图片生成
  characterImage?: string;            // GENERATE_CHARACTER_IMAGE
  sceneImage?: string;                // GENERATE_SCENE_IMAGE
  propImage?: string;                 // GENERATE_PROP_IMAGE
  // 视频生成
  segmentVideoPrompt?: string;        // GENERATE_SEGMENT_VIDEO_PROMPT
}

/** 提示词模版组 */
export interface PromptTemplateGroup {
  id: string;
  name: string;
  description: string;
  isBuiltIn: boolean;                 // 是否内置（内置组不可删除）
  matchRules: TemplateGroupMatchRules;
  templates: GroupTemplates;
}

/** 用于匹配的项目上下文 */
export interface ProjectTemplateContext {
  visualStyle: string;
  genre: string;
  globalSettings?: string;
}

/** 模版 key → 组属性名 映射 */
export const TEMPLATE_KEY_TO_GROUP_PROP: Record<string, keyof GroupTemplates> = {
  SYSTEM_CHARA_DESIGNER: 'systemCharacterDesigner',
  SYSTEM_SCENE_DESIGNER: 'systemSceneDesigner',
  SYSTEM_PROP_DESIGNER: 'systemPropDesigner',
  SYSTEM_SEGMENT_DESIGNER: 'systemSegmentDesigner',
  SYSTEM_SEGMENT_SPLIT: 'systemSegmentSplit',
  GENERATE_CHARACTER_PROMPT: 'characterPrompt',
  GENERATE_SCENE_PROMPT: 'scenePrompt',
  GENERATE_PROP_PROMPT: 'propPrompt',
  GENERATE_SEGMENT_PROMPT: 'segmentPrompt',
  OPTIMIZE_SEGMENT_PROMPT: 'segmentOptimizePrompt',
  GENERATE_CHARACTER_IMAGE: 'characterImage',
  GENERATE_SCENE_IMAGE: 'sceneImage',
  GENERATE_PROP_IMAGE: 'propImage',
  GENERATE_SEGMENT_VIDEO_PROMPT: 'segmentVideoPrompt',
};

/** 组属性名 → 显示名称 */
export const GROUP_TEMPLATE_NAMES: Record<keyof GroupTemplates, string> = {
  systemCharacterDesigner: '角色系统提示词',
  systemSceneDesigner: '场景系统提示词',
  systemPropDesigner: '道具系统提示词',
  systemSegmentDesigner: '片段拆分系统提示词',
  systemSegmentSplit: '剧本直接分片系统提示词',
  characterPrompt: '角色视觉提示词润色',
  scenePrompt: '场景视觉提示词润色',
  propPrompt: '道具视觉提示词润色',
  segmentPrompt: '片段视频视觉提示词润色',
  segmentOptimizePrompt: '片段描述优化提示词',
  characterImage: '角色图片生成',
  sceneImage: '场景图片生成',
  propImage: '道具图片生成',
  segmentVideoPrompt: '片段视频生成',
};

/** 组内模版可用变量映射 */
export const GROUP_TEMPLATE_VARIABLES: Record<keyof GroupTemplates, string[]> = {
  systemCharacterDesigner: [],
  systemSceneDesigner: [],
  systemPropDesigner: [],
  systemSegmentDesigner: [],
  systemSegmentSplit: ['{segmentDuration}'],
  characterPrompt: ['{desc}', '{genre}', '{visualStyle}', '{story}'],
  scenePrompt: ['{desc}', '{genre}', '{visualStyle}', '{story}'],
  propPrompt: ['{desc}', '{genre}', '{visualStyle}', '{story}'],
  segmentPrompt: ['{scriptText}', '{storyParagraphs}', '{shotDescriptions}', '{visualstyle}', '{genre}', '{segmentName}', '{segmentIndex}', '{segmentDuration}', '{videoRatio}', '{story}'],
  segmentOptimizePrompt: ['{existingVideoPrompt}', '{segmentName}', '{segmentIndex}', '{segmentDuration}', '{videoRatio}', '{visualstyle}', '{genre}', '{story}','{scriptText}'],
  characterImage: ['{prompt}', '{visualStyle}', '{name}', '{story}'],
  sceneImage: ['{prompt}', '{visualStyle}', '{location}', '{time}', '{atmosphere}', '{story}'],
  propImage: ['{prompt}', '{visualStyle}', '{name}', '{story}'],
  segmentVideoPrompt: ['{scenes}', '{segment}', '{transitionFrom}', '{transitionTo}', '{story}', '{visualStyle}'],
};

/** localStorage key */
export const TEMPLATE_GROUPS_STORAGE_KEY = 'promptTemplateGroups';

/** 所有纳入模版组管理的模版 key 列表 */
export const GROUP_MANAGED_TEMPLATE_KEYS = [
  'SYSTEM_CHARA_DESIGNER',
  'SYSTEM_SCENE_DESIGNER',
  'SYSTEM_PROP_DESIGNER',
  'SYSTEM_SEGMENT_DESIGNER',
  'SYSTEM_SEGMENT_SPLIT',
  'GENERATE_CHARACTER_PROMPT',
  'GENERATE_SCENE_PROMPT',
  'GENERATE_PROP_PROMPT',
  'GENERATE_SEGMENT_PROMPT',
  'OPTIMIZE_SEGMENT_PROMPT',
  'GENERATE_CHARACTER_IMAGE',
  'GENERATE_SCENE_IMAGE',
  'GENERATE_PROP_IMAGE',
  'GENERATE_SEGMENT_VIDEO_PROMPT',
] as const;

export type GroupManagedTemplateKey = typeof GROUP_MANAGED_TEMPLATE_KEYS[number];
