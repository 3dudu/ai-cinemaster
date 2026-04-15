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
  systemSegmentOptimize?: string      //SYSTEM_SEGMENT_OPTIMIZE
  systemSegmentSplit?: string;        // SYSTEM_SEGMENT_SPLIT
  // 视觉提示词润色
  characterPrompt?: string;           // GENERATE_CHARACTER_PROMPT
  scenePrompt?: string;               // GENERATE_SCENE_PROMPT
  propPrompt?: string;                // GENERATE_PROP_PROMPT
  segmentPrompt?: string;             // GENERATE_SEGMENT_PROMPT
  segmentOptimizePrompt?: string;     // OPTIMIZE_SEGMENT_PROMPT
  characterVariationPrompt?: string;  // GENERATE_VARIATION_PROMPT
  propVariationPrompt?: string;  // GENERATE_PROP_VARIATION_PROMPT
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
  SYSTEM_SEGMENT_OPTIMIZE: 'systemSegmentOptimize',
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
  GENERATE_VARIATION_PROMPT: 'characterVariationPrompt',
  GENERATE_PROP_VARIATION_PROMPT: 'propVariationPrompt',
};

/** 组属性名 → 显示名称 */
export const GROUP_TEMPLATE_NAMES: Record<keyof GroupTemplates, string> = {
  systemCharacterDesigner: '角色系统提示词',
  systemSceneDesigner: '场景系统提示词',
  systemPropDesigner: '道具系统提示词',
  systemSegmentDesigner: '片段拆分系统提示词',
  systemSegmentSplit: '剧本直接分片系统提示词',
  systemSegmentOptimize: '片段文字分镜优化系统提示词',
  characterPrompt: '角色视觉提示词润色',
  scenePrompt: '场景视觉提示词润色',
  propPrompt: '道具视觉提示词润色',
  segmentPrompt: '片段视频视觉提示词润色',
  segmentOptimizePrompt: '片段描述优化提示词',
  characterImage: '角色图片生成',
  sceneImage: '场景图片生成',
  propImage: '道具图片生成',
  segmentVideoPrompt: '片段视频生成',
  characterVariationPrompt: '角色造型视觉提示词润色',
  propVariationPrompt: '道具造型视觉提示词润色',
};

/** 组内模版可用变量映射 */
export const GROUP_TEMPLATE_VARIABLES: Record<keyof GroupTemplates, string[]> = {
  systemCharacterDesigner: [],
  systemSceneDesigner: [],
  systemPropDesigner: [],
  systemSegmentDesigner: [],
  systemSegmentOptimize: [],
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
  characterVariationPrompt: ['{desc}', '{genre}', '{visualStyle}','{variation}','{variationDesc}'],
  propVariationPrompt: ['{desc}', '{genre}', '{visualStyle}','{variation}','{variationDesc}'],
};

/** localStorage key */
export const TEMPLATE_GROUPS_STORAGE_KEY = 'promptTemplateGroups';

/** 所有纳入模版组管理的模版 key 列表 */
export const GROUP_MANAGED_TEMPLATE_KEYS = [
  'SYSTEM_CHARA_DESIGNER',
  'SYSTEM_SCENE_DESIGNER',
  'SYSTEM_PROP_DESIGNER',
  'SYSTEM_SEGMENT_DESIGNER',
  'SYSTEM_SEGMENT_OPTIMIZE',
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
  'GENERATE_VARIATION_PROMPT',
  'GENERATE_PROP_VARIATION_PROMPT',
] as const;

export type GroupManagedTemplateKey = typeof GROUP_MANAGED_TEMPLATE_KEYS[number];

// ===== 模版编辑器数据定义 =====

/** 单模版信息 */
export interface TemplateInfo {
  key: string;
  name: string;
  description: string;
  content?: string;
  hasParams?: boolean;
}

/** 单模版列表（用于模版编辑器下拉选择） */
export const TEMPLATE_LIST: TemplateInfo[] = [
  { key: 'SYSTEM_SEGMENT_DESIGNER', name: '🤖 S1-片段模式-系统提示词-片段拆分系统设定', description: ' 系统设定，片段拆分系统设定', hasParams: true },
  { key: 'SYSTEM_SEGMENT_OPTIMIZE', name: '🤖 S1-片段模式-系统提示词-片段文字分镜优化', description: ' 系统设定，片段拆分系统设定', hasParams: true },
  { key: 'SYSTEM_SEGMENT_TRANSLATE', name: '🤖 S2-片段模式-导演提示词-片段视频转场设定', description: ' 为单个片段生成视频转场提示词', hasParams: true },
  { key: 'SYSTEM_SEGMENT_SPLIT', name: '🤖 S3-片段模式-系统提示词-直接剧本拆分片段提示词', description: ' 导演系统提示词-导演直接剧本拆分片段', hasParams: true },
  { key: 'SYSTEM_SCRIPT_ANALYZER', name: '🤖 S4-分镜模式-剧本分析员系统提示词-分析剧本', description: ' 用于剧本解析的系统提示词' },
  { key: 'SYSTEM_PHOTOGRAPHER', name: '🤖 S5-分镜模式-摄影师系统提示词-分镜', description: ' 用于镜头清单生成的系统提示词' },
  { key: 'SYSTEM_CHARA_DESIGNER', name: '🤖 S6分镜模式-角色设计师系统提示词', description: ' 用于角色提示词生成的系统提示词' },
  { key: 'SYSTEM_SCENE_DESIGNER', name: '🤖 S7-分镜模式-场景设计师系统提示词', description: ' 用于场景提示词生成的系统提示词' },
  { key: 'SYSTEM_VIDEO_DIRECTOR', name: '🤖 S8-分镜模式-导演系统提示词', description: ' 用于视频拍摄提示词生成的系统提示词' },
  { key: 'SYSTEM_SCRIPT_IMPORTER', name: '🤖 S9-导入模式-影视策划系统提示词', description: ' 用于规划拍摄场景角色的系统提示词' },
  { key: 'SYSTEM_SCREENWRITER', name: '🤖 S10-编剧系统提示词-写剧本', description: ' 用于剧本生成的系统提示词' },
  { key: 'SYSTEM_PROP_DESIGNER', name: '🤖 S11-S6分镜模式-道具计师系统提示词', description: ' 用于道具提示词生成的系统提示词' },
  { key: 'GENERATE_SEGMENT_PROMPT', name: '📋 O1-片段模式-导演-片段视频文字分镜提示词润色', description: ' 导演-片段视频文字分镜提示词润色', hasParams: true },
  { key: 'GENERATE_CHARACTER_PROMPT', name: '📋 O2-视觉设计师-角色提示词润色', description: ' 为图片模型生成角色提示词', hasParams: true },
  { key: 'GENERATE_VARIATION_PROMPT', name: '📋 O3-视觉设计师-角色造型提示词润色', description: ' 为角色图片模型生成造型提示词', hasParams: true },
  { key: 'GENERATE_SCENE_PROMPT', name: '📋 O4-视觉设计师-场景提示词润色', description: ' 为图片模型生成场景提示词', hasParams: true },
  { key: 'GENERATE_KEYFRAME_PROMPT', name: '📋 O5-视觉设计师-关键帧提示词生成提示词', description: ' 为关键帧生成连环画风格提示词', hasParams: true },
  { key: 'GENERATE_VIDEO_PROMPT', name: '📋 O6-导演-视频拍摄提示词生成提示词', description: ' 为单个镜头生成视频拍摄提示词', hasParams: true },
  { key: 'GENERATE_TRANSITION_VIDEO', name: '📋 O7-导演-转场视频提示词生成提示词', description: ' 生成镜头之间的转场视频提示词', hasParams: true },
  { key: 'GENERATE_SCRIPT', name: '📋 O8-编剧-剧本生成提示词', description: ' 根据提示词创作影视剧本', hasParams: true },
  { key: 'GENERATE_PROP_PROMPT', name: '📋 O9-视觉设计师-道具提示词润色', description: ' 为图片模型生成道具提示词', hasParams: true },
  { key: 'OPTIMIZE_SEGMENT_PROMPT', name: '📋 O10-视觉设计师-片段描述优化提示词', description: ' 片段描述优化提示词', hasParams: true },
  { key: 'GENERATE_PROP_VARIATION_PROMPT', name: '📋 O11-视觉设计师-道具造型提示词润色', description: ' 为道具图片模型生成造型提示词', hasParams: true },
  { key: 'GENERATE_SEGMENT_VIDEO_PROMPT', name: '🎨 V1-片段模式-导演-片段视频最终生成提示词', description: ' 导演-片段视频最终生成', hasParams: true },
  { key: 'GENERATE_CHARACTER_IMAGE', name: '🎨 V2-视觉设计师-角色图片生成提示词', description: ' 生成角色三视图加大头照', hasParams: true },
  { key: 'GENERATE_SCENE_IMAGE', name: '🎨 V3-视觉设计师-场景图片生成提示词', description: ' 生成场景图片', hasParams: true },
  { key: 'IMAGE_GENERATION_WITH_REFERENCE', name: '🎨 V4-视觉设计师-带参考图的图片生成提示词', description: ' 生成带参考图的角色图片', hasParams: true },
  { key: 'GENERATE_CHARACTER_VARIATION', name: '🎨 V5-视觉设计师-角色造型变体生成提示词', description: ' 生成角色的新造型', hasParams: true },
  { key: 'JOIN_IMAGES', name: '🎨 V6-视觉设计师-图片拼接提示词', description: ' 将多张图片拼接成宫格图', hasParams: true },
  { key: 'GENERATE_PROP_VARIATION', name: '🎨 V7-视觉设计师-道具造型变体生成提示词', description: ' 生成带参考图的道具图片', hasParams: true },
  { key: 'GENERATE_PROP_IMAGE', name: '🎨 V8-视觉设计师-场景图片生成提示词', description: ' 生成道具图片', hasParams: true },
  { key: 'GENERATE_SEGMENTS_FROM_SCRIPT', name: '✨ A1-片段模式-导演-剧本一键拆分片段-结构化输出', description: ' 导演-剧本一键拆分片段提示词，保持原样', hasParams: true },
  { key: 'AI_SPLIT_SEGMENTS', name: '✨ A2-片段模式-导演-结合分镜拆分片段提示词-结构化输出', description: ' 根据分镜自动拆分片段，加入AI加工', hasParams: true },
  { key: 'PARSE_SCRIPT', name: '✨ A3-剧本分析员-剧本解析提示词-结构化输出', description: ' 解析原始文本提取剧本信息，角色，场景，故事线', hasParams: true },
  { key: 'GENERATE_SHOTS', name: '✨ A4-摄影师-分镜-镜头清单生成提示词-结构化输出', description: ' 分镜-生成场景的镜头调度设计', hasParams: true },
  { key: 'IMPORT_SCRIPT', name: '✨ A5-导入模式-策划师-剧本导入提示词-结构化输出', description: ' 导入原始剧本，提取剧集基本信息', hasParams: true },
  { key: 'IMPORT_SHOTS', name: '✨ A6-导入模式-策划师-镜头清单导入提示词-结构化输出', description: ' 导入场景的镜头调度设计', hasParams: true },
  { key: 'IMPORT_SHOTS_FOR_SCENE', name: '✨ A7-导入模式-策划师-特定场景镜头清单导入提示词-结构化输出', description: ' 导入场景的镜头调度设计', hasParams: true },
];

/** 模版组模版选项（用于模版组管理下拉选择） */
export const GROUP_TEMPLATE_OPTIONS: { value: keyof GroupTemplates; label: string }[] = [
  { value: 'systemCharacterDesigner', label: '🤖 角色系统提示词' },
  { value: 'systemSceneDesigner', label: '🤖 场景系统提示词' },
  { value: 'systemPropDesigner', label: '🤖 道具系统提示词' },
  { value: 'systemSegmentDesigner', label: '🤖 片段拆分系统提示词' },
  { value: 'systemSegmentOptimize', label: '🤖 片段文字分镜优化系统提示词' },
  { value: 'systemSegmentSplit', label: '🤖 剧本直接分片系统提示词' },
  { value: 'characterPrompt', label: '📝 角色视觉提示词润色' },
  { value: 'characterVariationPrompt', label: '📝 角色造型视觉提示词润色' },
  { value: 'propVariationPrompt', label: '📝 道具造型视觉提示词润色' },
  { value: 'scenePrompt', label: '📝 场景视觉提示词润色' },
  { value: 'propPrompt', label: '📝 道具视觉提示词润色' },
  { value: 'segmentPrompt', label: '📝 片段视频视觉提示词润色' },
  { value: 'segmentOptimizePrompt', label: '📝 片段描述优化提示词' },
  { value: 'characterImage', label: '🎨 角色图片生成' },
  { value: 'sceneImage', label: '🎨 场景图片生成' },
  { value: 'propImage', label: '🎨 道具图片生成' },
  { value: 'segmentVideoPrompt', label: '🎬 片段视频生成' },
];

/** 单模版可用变量映射 */
export const TEMPLATE_VARIABLES: Record<string, string[]> = {
  'PARSE_SCRIPT': ['{text}', '{lang}', '{genre}','{story}','{targetDuration}'],
  'IMPORT_SCRIPT': ['{text}', '{lang}'],
  'GENERATE_SHOTS': ['{sceneIndex}', '{location}','{time}','{atmosphere}', '{paragraphs}', '{genre}', '{story}', '{characters}', '{lang}', '{imageCount}','{segmentDuration}','{properties}','{totalParagraphsDuration}'],
  'IMPORT_SHOTS': ['{scenes}', '{characters}', '{lang}', '{imageCount}','{scriptText}','{duration}','{segmentDuration}'],
  'IMPORT_SHOTS_FOR_SCENE': ['{scenes}', '{characters}', '{lang}', '{imageCount}','{scriptText}','{paragraphs}','{segmentDuration}','{props}','{totalParagraphsDuration}'],
  'GENERATE_SCRIPT': ['{prompt}', '{duration}', '{genre}', '{lang}','{story}'],
  'GENERATE_CHARACTER_PROMPT': ['{desc}', '{genre}', '{visualStyle}','{story}'],
  'GENERATE_VARIATION_PROMPT': ['{desc}', '{genre}', '{visualStyle}','{variation}','{variationDesc}'],
  'GENERATE_PROP_VARIATION_PROMPT': ['{desc}', '{genre}', '{visualStyle}','{variation}','{variationDesc}'],
  'OPTIMIZE_SEGMENT_PROMPT': ['{existingVideoPrompt}', '{segmentName}', '{segmentIndex}', '{segmentDuration}', '{videoRatio}', '{visualstyle}', '{genre}', '{story}','{scriptText}'],
  'GENERATE_SCENE_PROMPT': ['{desc}', '{genre}', '{visualStyle}','{story}'],
  'JOIN_IMAGES': ['{imageCount}', '{imageSize}'],
  'IMAGE_GENERATION_WITH_REFERENCE': ['{prompt}', '{visualStyle}'],
  'GENERATE_CHARACTER_VARIATION': ['{character}', '{visualStyle}', '{variationPrompt}', '{baseCharacterPrompt}'],
  'GENERATE_PROP_VARIATION': ['{prop}', '{visualStyle}', '{variationPrompt}', '{basePropPrompt}'],
  'GENERATE_KEYFRAME_PROMPT': ['{imageGridSpec}', '{imageCount}', '{imageRate}'],
  'GENERATE_CHARACTER_IMAGE': ['{prompt}', '{visualStyle}','{name}','{story}'],
  'GENERATE_PROP_IMAGE': ['{prompt}', '{visualStyle}','{name}','{story}'],
  'GENERATE_SCENE_IMAGE': ['{prompt}', '{visualStyle}','{location}','{time}','{atmosphere}','{story}'],
  'GENERATE_VIDEO_PROMPT': ['{shotSummary}', '{cameraMovement}', '{shotSize}', '{duration}', '{visualStyle}', '{characters}', '{startFrameVisualPrompt}', '{endFrameVisualPrompt}', '{dialogues}','{story}'],
  'GENERATE_TRANSITION_VIDEO': ['{currentShotSummary}', '{nextShotSummary}', '{currentShotSize}', '{nextShotSize}', '{visualStyle}', '{endFrameVisualPrompt}', '{startFrameVisualPrompt}'],
  'GENERATE_SEGMENT_PROMPT': ['{scriptText}','{storyParagraphs}','{shotDescriptions}', '{visualstyle}','{genre}','{segmentName}','{segmentIndex}','{segmentDuration}','{videoRatio','{story}'],
  'GENERATE_SEGMENT_VIDEO_PROMPT': ['{scenes}', '{segment}','{transitionFrom}','{transitionTo}','{story}','{visualStyle}'],
  'AI_SPLIT_SEGMENTS': ['{shotsJson}', '{charactersMap}','{scenesMap}','{visualStyle}','{genre}','{propsMap}'],
  'GENERATE_SEGMENTS_FROM_SCRIPT': ['{rawScript}', '{characters}','{scenes}','{visualStyle}','{genre}','{language}','{targetDuration}','{propsMap}','{segmentDuration}'],
  'SYSTEM_SEGMENT_SPLIT': ['{segmentDuration}'],
};
