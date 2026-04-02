import { Download, NotebookPen, RotateCcw, Save, Upload, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { PROMPT_TEMPLATES } from '../../services/promptTemplates';
import CustomSelect from '../common/CustomSelect';
import { useDialog } from '../dialog';

interface Template {
  key: string;
  name: string;
  description: string;
  content?: string;
  hasParams?: boolean;
}

const PromptTemplateModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const dialog = useDialog();
  const [selectedKey, setSelectedKey] = useState<string>('PARSE_SCRIPT');
  const [customContent, setCustomContent] = useState<Record<string, string>>({});
  const [currentContent, setCurrentContent] = useState('');

  // 模板列表
  const templates: Template[] = useMemo(() => [
    { key: 'GENERATE_SEGMENT_PROMPT', name: '📋 片段模式-导演-片段视频提示词润色', description: ' 导演-片段视频提示词润色', hasParams: true },
    { key: 'GENERATE_SEGMENT_VIDEO_PROMPT', name: '🎨 片段模式-导演-片段视频生成提示词', description: ' 导演-片段视频生成', hasParams: true },
    { key: 'GENERATE_SEGMENTS_FROM_SCRIPT', name: '✨ 片段模式-导演-剧本一键分段', description: ' 导演-剧本一键分段提示词', hasParams: true },
    { key: 'AI_SPLIT_SEGMENTS', name: '✨ 片段模式-导演-分段提示词', description: ' 根据分镜自动拆分片段', hasParams: true },
    { key: 'SYSTEM_SEGMENT_DESIGNER', name: '🤖 片段模式-系统提示词-片段视频转场设定', description: ' 系统设定，为单个片段生成视频拍摄提示词', hasParams: true },
    { key: 'SYSTEM_SEGMENT_TRANSLATE', name: '🤖 片段模式-导演提示词-片段视频转场设定', description: ' 为单个片段生成视频转场提示词', hasParams: true },
    { key: 'SYSTEM_SEGMENT_SPLIT', name: '🤖 片段模式-系统提示词-导演分段设定提示词', description: ' 导演系统提示词-导演分段设定提示词', hasParams: true },
    { key: 'PARSE_SCRIPT', name: '✨ 剧本分析员-剧本解析提示词', description: ' 解析原始文本提取剧本信息', hasParams: true },
    { key: 'GENERATE_SHOTS', name: '✨ 摄影师-镜头清单生成提示词', description: ' 生成场景的镜头调度设计', hasParams: true },
    { key: 'GENERATE_CHARACTER_IMAGE', name: '🎨 视觉设计师-角色图片生成提示词', description: ' 生成角色三视图加大头照', hasParams: true },
    { key: 'GENERATE_SCENE_IMAGE', name: '🎨 视觉设计师-场景图片生成提示词', description: ' 生成场景图片', hasParams: true },
    { key: 'IMAGE_GENERATION_WITH_REFERENCE', name: '🎨 视觉设计师-带参考图的图片生成提示词', description: ' 生成带参考图的角色图片', hasParams: true },
    { key: 'GENERATE_CHARACTER_VARIATION', name: '🎨 视觉设计师-角色造型变体生成提示词', description: ' 生成角色的新造型', hasParams: true },
    { key: 'GENERATE_KEYFRAME_PROMPT', name: '📋 视觉设计师-关键帧提示词生成提示词', description: ' 为关键帧生成连环画风格提示词', hasParams: true },
    { key: 'GENERATE_CHARACTER_PROMPT', name: '📋 视觉设计师-角色提示词润色', description: ' 为图片模型生成角色提示词', hasParams: true },
    { key: 'GENERATE_VARIATION_PROMPT', name: '📋 视觉设计师-造型提示词润色', description: ' 为图片模型生成造型提示词', hasParams: true },
    { key: 'GENERATE_SCENE_PROMPT', name: '📋 视觉设计师-场景提示词润色', description: ' 为图片模型生成场景提示词', hasParams: true },
    { key: 'GENERATE_VIDEO_PROMPT', name: '📋 导演-视频拍摄提示词生成提示词', description: ' 为单个镜头生成视频拍摄提示词', hasParams: true },
    { key: 'GENERATE_TRANSITION_VIDEO', name: '📋 导演-转场视频提示词生成提示词', description: ' 生成镜头之间的转场视频提示词', hasParams: true },
    { key: 'GENERATE_SCRIPT', name: '✨ 编剧-剧本生成提示词', description: ' 根据提示词创作影视剧本', hasParams: true },
    { key: 'JOIN_IMAGES', name: '🎨 视觉设计师-图片拼接提示词', description: ' 将多张图片拼接成宫格图', hasParams: true },
    { key: 'SYSTEM_SCRIPT_ANALYZER', name: '🤖 剧本分析员系统提示词', description: ' 用于剧本解析的系统提示词' },
    { key: 'SYSTEM_PHOTOGRAPHER', name: '🤖 摄影师系统提示词', description: ' 用于镜头清单生成的系统提示词' },
    { key: 'SYSTEM_SCREENWRITER', name: '🤖 编剧系统提示词', description: ' 用于剧本生成的系统提示词' },
    { key: 'SYSTEM_CHARA_DESIGNER', name: '🤖 角色设计师系统提示词', description: ' 用于角色提示词生成的系统提示词' },
    { key: 'SYSTEM_SCENE_DESIGNER', name: '🤖 场景设计师系统提示词', description: ' 用于场景提示词生成的系统提示词' },
    { key: 'SYSTEM_VIDEO_DIRECTOR', name: '🤖 导演系统提示词', description: ' 用于视频拍摄提示词生成的系统提示词' },
    { key: 'SYSTEM_SCRIPT_IMPORTER', name: '🤖 导入模式-影视策划系统提示词', description: ' 用于规划拍摄场景角色的系统提示词' },
    { key: 'IMPORT_SCRIPT', name: '✨ 导入模式-策划师-剧本导入提示词', description: ' 导入原始剧本，提取剧集基本信息', hasParams: true },
    { key: 'IMPORT_SHOTS', name: '✨ 导入模式-策划师-镜头清单导入提示词', description: ' 导入场景的镜头调度设计', hasParams: true },
    { key: 'IMPORT_SHOTS_FOR_SCENE', name: '✨ 导入模式-策划师-特定场景镜头清单导入提示词', description: ' 导入场景的镜头调度设计', hasParams: true },
  ], []);

  // 从 localStorage 加载自定义内容
  useEffect(() => {
    const saved = localStorage.getItem('promptTemplates');
    if (saved) {
      try {
        setCustomContent(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load custom templates:', e);
      }
    }
  }, []);

  // 更新当前内容
  useEffect(() => {
    const content = customContent[selectedKey] || getDefaultContent(selectedKey);
    setCurrentContent(content);
  }, [selectedKey, customContent]);

  // 获取默认内容
  const getDefaultContent = (key: string): string => {
    const template = templates.find(t => t.key === key);
    if (!template) return '';

    // 从 PROMPT_TEMPLATES 获取默认值
    const defaultTemplates: Record<string, any> = PROMPT_TEMPLATES;
    const value = defaultTemplates[key];

    // 如果是函数，返回示例模板（带变量占位符）
    if (typeof value === 'function') {
      return getFunctionTemplatePreview(key);
    }

    return value || '';
  };

  // 获取函数类型模板的预览（带变量占位符）
  const getFunctionTemplatePreview = (key: string): string => {
    const previews: Record<string, string> = {
      'IMPORT_SCRIPT':`
      读取输入的剧本大纲/分镜脚本，提取关键信息，并输出一个 JSON 对象。

    ## 任务：
    分析大纲：提取title:标题、genre:类型
    分析具体剧集：
    提取 logline:故事梗概。
    提取 characters:角色信息（id:编号、name:姓名、gender:性别、age:年龄、personality:性格）。
    提取 scenes:场景信息（id:编号、location:地点、time:时间（大的时间概念：清晨，白天，正午，夜晚，凌晨，春，夏，秋，冬，远古，古代，近代，现代，未来..）、atmosphere:氛围）。
    提取 storyParagraphs:故事段落（id:编号、sceneRefId:引用场景编号、text:内容）。

    ## 说明：
    1. 剧本标题，角色姓名：直接使用原文内容，不需要翻译，只取一种语言，优先 {lang}。
    2. 场景：只提取具体剧集中用到的场景

    ## 剧本大纲/分镜脚本原文：
    {text}
    `,
      'PARSE_SCRIPT': `分析输入的故事或剧本，构思制作一部 {genre} 类型的视频，并输出一个 JSON 对象，字段值以 {lang} 语言呈现。

## 任务：
提取title:标题、genre:类型、logline:故事梗概（以 {lang} 语言呈现）。
提取characters:角色信息（id:编号、name:姓名、gender:性别、age:年龄、personality:性格）。
提取scenes:场景信息（id:编号、location:地点、time:时间（大的时间概念：清晨，白天，正午，夜晚，凌晨，春，夏，秋，冬，远古，古代，近代，现代，未来..）、atmosphere:氛围）。
storyParagraphs:故事段落（id:编号、sceneRefId:引用场景编号、text:内容）。

## 任务约束
- 如果故事或剧本已设定情节顺序，则不要随意改变，按照设定分镜故事段落
- 故事或剧本背景、简介，作为理解分析当前剧本的依据，不要直接作为当前故事段落内容

## 输入：
{text}`,
      'GENERATE_SHOTS': `担任专业摄影师，为第{sceneindex}场戏制作一份详尽的镜头清单（镜头调度设计）。
## 文本输出语言: {lang}。

## 场景细节:
地点: {location}
时间: {time}
氛围: {atmosphere}

## 场景动作:
{paragraphs}

## 创作背景:
题材类型: {genre}
剧本整体目标时长: {duration}

## 角色 (格式: ID: 名字: 性格描述):
{characters}

## 详细说明：
1. 设计一组覆盖全部情节动作的镜头序列。
2. 重要提示：每场戏镜头数量上限为 2-8 个，每个镜头时长为 4-12 秒，避免出现 JSON 截断错误。
3. 镜头运动：请使用专业术语（如：前推、右摇、固定、手持、跟拍）。
4. 景别：明确取景范围（如：大特写、中景、全景）。
5. 镜头情节概述：详细描述该镜头内发生的情节（使用 {lang} 语言描述）。
6. 视觉提示语：用于图像生成的详细{lang}描述，字数控制在 120 词以内。
7. 转场动画：包含起始帧，结束帧，时长，运动强度（取值为 0-100）。
8. 对话：如果需要，为每个角色生成对话，包含角色名字、内容。
9. 关键帧：现在令 imageCount={imageCount}，生成关键帧时：如果imageCount是 0，则不生成关键帧；如果imageCount是 1，则必须生成一个起始帧和一个结束帧；如果imageCount大于 1 则是一张完整连环画帧。
10. 关键帧提示词：visualPrompt, 使用 {lang} 语言描述，遵循下面表述方式： 主体+行为+环境，可补充： 风格、色彩、光影、构图 等美学元素。

## 输出格式：JSON 数组，数组内对象包含以下字段：
- id（字符串类型）
- sceneId（字符串类型）
- actionSummary（字符串类型）
- dialogue（对象数组类型，对象包含 character（角色名字）、value（对话内容），每个角色一条记录。可选）
- cameraMovement（字符串类型）
- shotSize（字符串类型）
- characters（字符串数组类型，**必须是角色ID**，参考上方角色列表中的ID）
- keyframes（对象数组类型，对象包含 id、type（取值为 ["start", "end", 'full']）、visualPrompt（使用 {lang} 语言描述） 字段）
- interval（对象类型，包含 id、startKeyframeId、endKeyframeId、duration(不超过15s)、motionStrength、status（取值为 ["pending", "completed"]） 字段）`,
      'GENERATE_SCRIPT': `你是一名专业的编剧。请根据以下提示词创作一个完整的影视剧本。

## 创作要求：
1. 剧本时长：{duration}
2. 题材类型：{genre}
3. 输出语言：{lang}
4. 剧本结构清晰，包含剧本标题、场景标题、时间、地点、天气、角色、动作描述、对白
5. 情节紧凑，画面感强
6. 角色性格鲜明，对话自然

## 用户提示词：
"{prompt}"

请以Markdown格式输出剧本结构，不要使用 JSON 格式，直接输出可阅读的剧本文本。`,
      'GENERATE_SCENE_PROMPT': `为 {genre} 类视频中的场景生成高还原度的场景设计，
    场景的描述信息如下: {desc}
     - 图像风格必须为：{visualStyle}。
     - 要描述场景的时间、地点、景色、光线、氛围等，不要出现角色。
     - 聚焦视觉细节（光线、空间关系，质感、外观）。`,
      'GENERATE_CHARACTER_PROMPT': `为 {genre} 类视频中的角色生成高还原度的角色设计。
    角色的描述信息如下，包含年龄，性别，性格: {desc}

## 要求
  - 图像风格必须为：{visualStyle}。
  - 要着重描写角色的年龄、性别、性格、外貌、动作、衣着、神态等。
  - 聚焦视觉细节（光线、材质、质感、外观），突出人物性格。
  - 不要出现场景`,
      'GENERATE_VARIATION_PROMPT': `    为 {genre} 类视频中的角色设计造型: {variation} ，结合角色基本信息和造型描述，扩展完善新的造型描述。
    - 角色的基本信息: {desc}
    - 角色的造型描述: {variationDesc}

    核心主题: 在原有基本形象的基础上，为角色设计造型: {variation} ，着重描述新造型的变化，特征。
     - 图像风格必须为：{visualStyle}
     - 人物五官特征要与基本形象一致，或具有延续性
     - 为新造型设计新的服装，饰品，动作，表情等
     - 重点描述新造型的变化和特征，角色的基本信息不要过多描述
     - 要体现出年龄、性别、性格、外貌、动作、衣着、神态等，不要出现场景。
     - 聚焦视觉细节（光线、材质、质感、外观）。`,
      'JOIN_IMAGES': `请将这些图片拼成一张{imageCount}宫格图片，图片之间留有1个像素的间隔，最终图片大小为{imageSize}。`,
      'IMAGE_GENERATION_WITH_REFERENCE': `生成符合下面描述的图画，画面风格必须为：{visualStyle}。
图像描述：
  {prompt}

如果有参考图像：
- 所提供的第一张图片为场景 / 环境参考图。
- 后续所有图片均为角色参考图（例如：基础形象，或特定变体造型）。

要求：
- 画面风格必须为：{visualStyle}。
- 严格保持与场景参考图一致的视觉风格、光影效果和环境氛围。
- 若画面中出现角色，必须与所提供的角色参考图高度相似。`,
      'GENERATE_CHARACTER_VARIATION': `核心主题: 根据参考图生成角色：{character} 的新造型图，为：{visualStyle} 风格的角色完整设定图，包含三视图、服装拆分、饰品拆分、全身立绘与表情集，专业游戏 / 影视角色设计规范

【造型描述】
        {variationPrompt}
【角色基础形象】
 - 有参考图，必须保持面部特征与参考图一致。
 - 没有参考图，角色按如下描述设定：{baseCharacterPrompt}


【画面布局与构图】
整体为角色设定表版式，分模块排版：
- 左上：三视图（正面 / 侧面 / 背面，纯白背景，站姿标准）
- 中上：服装拆分（4 件单品独立展示）+ 饰品拆分（4件饰品带编号标注）
- 右上：完整全身立绘（动态站姿，衣袂飘飘，背景纯白）
- 左下：表情集（4 个面部特写：开心 / 惊讶 / 生气 / 害羞，统一发型与饰品）
所有模块均为白底，黑色细框分隔，文字标注清晰（中文）
【光影与渲染】
冷白柔和打光，突出布料纹理、金属光泽与刺绣细节
写实 PBR 渲染，皮肤通透，布料垂感自然，金属饰品有高光反射
无环境干扰，纯展示向，根据 {visualStyle} 风格适合作为游戏 / 动画角色原画，或者作为影视角色参定妆照
【负面提示词】
模糊、低分辨率、噪点、水印、文字冗余、2D 平面插画、动漫线稿、3D 建模感过强、卡通比例、畸形肢体、色彩杂乱、背景杂乱、多余装饰`,
      'GENERATE_VIDEO_PROMPT': `为单个镜头创作详细的视频拍摄提示词。

镜头信息：
- 镜头情节概述：{shotSummary}
- 镜头运动：{cameraMovement}
- 景别：{shotSize}
- 视频时长：{duration}s
- 画面风格：{visualStyle}
- 出场角色：{characters}
- 对白：
     {dialogues}
- 起始帧视觉描述：{startFrameVisualPrompt}
- 结束帧视觉描述：{endFrameVisualPrompt}

要求：
1. 提示词应详细描述视频中需要呈现的视觉效果
2. 包含主体运动方式、运镜方式、光影变化、氛围营造等元素
3. 描述要符合镜头运动和景别要求
4. 可以按秒级时长分别描述画面的变化
5. 提示词长度控制在200-300字以内
6. 输出纯文本提示词，无任何解释或注释

请输出视频拍摄提示词：`,
      'GENERATE_KEYFRAME_PROMPT': `连环画规格：{imageGridSpec} 连环画图，包含 {imageCount} 张连续且风格统一的图片，每张长宽比 {imageRate}，白色背景，铺满整张图。`,
      'GENERATE_CHARACTER_IMAGE': `生成符合下面要求的角色图片，图片风格必须为：{visualStyle}。
角色名：{name}
角色描述：
{prompt}

核心主题: {visualStyle} 风格角色完整设定图，包含三视图、服装拆分、饰品拆分、全身立绘与表情集，专业游戏 / 影视角色设计规范
【画面布局与构图】
整体为角色设定表版式，分模块排版：
- 左上：三视图（正面 / 侧面 / 背面，纯白背景，站姿标准）
- 中上：服装拆分（4 件单品独立展示）+ 饰品拆分（4件饰品带编号标注）
- 右上：完整全身立绘（动态站姿，衣袂飘飘，背景纯白）
- 左下：表情集（4 个面部特写：开心 / 惊讶 / 生气 / 害羞，统一发型与饰品）
所有模块均为白底，黑色细框分隔，文字标注清晰（中文）
【光影与渲染】
冷白柔和打光，突出布料纹理、金属光泽与刺绣细节
写实 PBR 渲染，皮肤通透，布料垂感自然，金属饰品有高光反射
无环境干扰，纯展示向，根据 {visualStyle} 风格适合作为游戏 / 动画角色原画，或者作为影视角色参定妆照
【负面提示词】
模糊、低分辨率、噪点、水印、文字冗余、2D 平面插画、动漫线稿、3D 建模感过强、卡通比例、畸形肢体、色彩杂乱、背景杂乱、多余装饰`,
      'GENERATE_SCENE_IMAGE': `生成符合下面要求的场景图片

- 场景名称：{name}
- 画风风格：{visualStyle}
- 场景详细描述：{prompt}
---
[核心要求]
根据用户提供的场景描述绘制场景/环境。重要：场景必须完全空旷，不得出现任何人物、角色、人形轮廓或剪影。
[艺术风格]
严格按照用户提供的画风风格进行渲染。输出必须清晰体现该艺术风格，不得输出普通照片或未经处理的写实图像。
[布局规范 — 严格遵守]
整个图像由一条从上到下的实线黑色竖线分为左右两半。
左侧区域（占40%宽度）：
- 场景的高细节广角全景图，展示整体建筑、比例、光照和氛围
- 绝对不得出现人物或角色
- 右侧边缘有一条实线黑色竖线，将其与右侧分隔
右侧区域（占60%宽度）：
  同一场景的三个不同视角：
  1) 鸟瞰俯视图，展示完整布局
  2) 平视角度的另一视角
  3) 关键区域或焦点的特写细节图
  三个视图必须描绘同一地点，保持一致的光照和色彩。所有视图均不得出现人物。整齐排列，视图之间可有或无细黑线分隔。
  
[关键布局规则]
1. 必须有一条实线黑色竖线分隔左右两半
[质量与约束]
- 高分辨率，所有视图的细节和色彩保持一致，纯白色背景
- 图像中不得有其他文字、标签、标题、水印或签名
- 不得添加任何UI元素、注释覆盖层或额外标签
- 保持所有插图视图简洁。让视觉效果自己说话
请严格按照系统规范生成标准场景图。
[负面提示词]
模糊、低分辨率、噪点、水印、文字冗余、2D 平面插画、动漫线稿、3D 建模感过强、畸形比例`,
      'GENERATE_TRANSITION_VIDEO': `视频风格：{visualStyle}；故事从 {currentShotSummary} 过渡到 {nextShotSummary}。景别变化：从 {currentShotSize} 到 {nextShotSize}；制作转场视频：保持画面风格一致。转场时长 5 秒，运动强度适中。
镜头开始：{endFrameVisualPrompt}；
镜头结束：{startFrameVisualPrompt}；
按照上面描述生成 {visualStyle} 风格的转场视频！`,
'IMPORT_SHOTS': `担任专业摄影师，从分镜脚本原文中读取分镜头清单。

## 场景列表:
{scenes}

## 角色列表:
{characters}

## 说明：
### 提取内容
1. 提取分镜脚本中全部的镜头序列。
2. 镜头画面描述actionSummary：详细描述该镜头内发生的情节。
3. 场景id：镜头所属的场景id，在提供的场景列表数据中。
3. 角色：镜头中出现的角色名，要在提供的角色列表中存在
4. 对话：如果存在，为每个角色生成对话，包含角色名字、内容。

### 生成内容
1. 镜头时长：按照镜头的内容合理设定有效时长，每个镜头时长为 1-12 秒，使整部剧的时长控制在 {duration} 左右。
2. 镜头运动：请使用专业术语（如：前推、右摇、固定、手持、跟拍）。
3. 景别：明确取景范围（如：大特写、中景、全景）。
4. 视觉提示语：用于图像生成的详细{lang}描述，字数控制在 120 词以内。
5. 转场动画：包含起始帧，结束帧，时长，运动强度（取值为 0-100）。
6. 关键帧：生成规则 现在令 imageCount={imageCount}，生成关键帧时：如果imageCount是 0，则不生成关键帧；如果imageCount是 1，则必须生成一个起始帧；如果imageCount是 2，则必须生成一个起始帧和一个结束帧；如果imageCount大于 2 则是一张完整连环画帧。
7. 关键帧提示词：visualPrompt, 使用 {lang} 语言描述，遵循下面表述方式： 主体+行为+环境，可补充： 风格、色彩、光影、构图 等美学元素。

## 输出格式：JSON 数组，数组内对象包含以下字段，避免出现 JSON 截断错误：
- id（字符串类型）
- sceneId（场景id，字符串类型）
- actionSummary（字符串类型）
- dialogue（对象数组类型，对象包含 character（角色名字）、value（对话内容），每个角色一条记录。可选）
- cameraMovement（字符串类型）
- shotSize（字符串类型）
- characters（字符串数组类型，**必须是角色ID**，参考上方角色列表中的ID）
- keyframes（对象数组类型，对象包含 id、type（取值为 ["start", "end", 'full']）、visualPrompt（使用 {lang} 语言描述） 字段）
- interval（对象类型，包含 id、startKeyframeId、endKeyframeId、duration(不超过15s)、motionStrength、status（取值为 ["pending", "completed"]） 字段）
  
## 脚本原文：
    {scriptText}`,
    'IMPORT_SHOTS_FOR_SCENE': `担任专业摄影师，从分镜脚本原文中读取分镜头清单。

## 场景列表:
{scenes}

## 角色列表:
{characters}

## 说明：
### 提取内容
1. 提取分镜脚本中全部的镜头序列。
2. 镜头画面描述actionSummary：详细描述该镜头内发生的情节。
3. 场景id：镜头所属的场景id，在提供的场景列表数据中。
3. 角色：镜头中出现的角色名，要在提供的角色列表中存在
4. 对话：如果存在，为每个角色生成对话，包含角色名字、内容。

### 生成内容
1. 镜头时长：按照镜头的内容合理设定有效时长，每个镜头时长为 1-12 秒，使整部剧的时长控制在 {duration} 左右。
2. 镜头运动：请使用专业术语（如：前推、右摇、固定、手持、跟拍）。
3. 景别：明确取景范围（如：大特写、中景、全景）。
4. 视觉提示语：用于图像生成的详细{lang}描述，字数控制在 120 词以内。
5. 转场动画：包含起始帧，结束帧，时长，运动强度（取值为 0-100）。
6. 关键帧：生成规则 现在令 imageCount={imageCount}，生成关键帧时：如果imageCount是 0，则不生成关键帧；如果imageCount是 1，则必须生成一个起始帧；如果imageCount是 2，则必须生成一个起始帧和一个结束帧；如果imageCount大于 2 则是一张完整连环画帧。
7. 关键帧提示词：visualPrompt, 使用 {lang} 语言描述，遵循下面表述方式： 主体+行为+环境，可补充： 风格、色彩、光影、构图 等美学元素。

## 输出格式：JSON 数组，数组内对象包含以下字段，避免出现 JSON 截断错误：
- id（字符串类型）
- sceneId（场景id，字符串类型）
- actionSummary（字符串类型）
- dialogue（对象数组类型，对象包含 character（角色名字）、value（对话内容），每个角色一条记录。可选）
- cameraMovement（字符串类型）
- shotSize（字符串类型）
- characters（字符串数组类型，**必须是角色ID**，参考上方角色列表中的ID）
- keyframes（对象数组类型，对象包含 id、type（取值为 ["start", "end", 'full']）、visualPrompt（使用 {lang} 语言描述） 字段）
- interval（对象类型，包含 id、startKeyframeId、endKeyframeId、duration(不超过15s)、motionStrength、status（取值为 ["pending", "completed"]） 字段）
  
## 脚本原文：
    {scriptText}`,
    'GENERATE_SEGMENT_PROMPT':`任务设定：
根据提供的剧本原文和当前片段故事段落，设计一个不超过 15s 的视频片段，用高超的电影手法分析拍摄方案，运动强度，情绪曲线，台词与节奏。
以时间轴的方式叙事故事的发展，保留剧本里的场景，角色，台词。如果有分镜表，可参考分镜表。
时间轴的描述必须使用自然语言，以连贯讲故事的方式描述这个时段内：场景的氛围，角色的神态、动作、对话，镜头运动等

## 剧本原文：
{scriptText}

## 片段故事：
{storyParagraphs}

## 分镜表：
{shotDescriptions}

## 要求：

1. 说明总体画面风格和类型，可加以补充。基本风格和类型：{visualstyle}, {genres}
2. 运动强度：（文戏3-5 / 正常5-7 / 冲突7-10）
3. 说明故事情节曲线，情绪曲线：（贴合剧情，2-3种情绪递进）
4  设计高超的构图，不同分镜的构图可以保持一致，也可进行变化，可选构图类型：中心构图，对称构图，三分线构图，框构框架，引导线构图，三角线构图，黄金螺旋构图，水平构图，对角构图。
5. 自动识别：人物、场景、关键物品、情绪、动作节奏，输出为 "片段要素"。
6. 描述中的角色称谓要用角色名直接表示，场景要用场景名直接表示
7. 台词与节奏：台词数量与语速需适配15秒时长，确保每句台词完整、问答间有自然停顿，避免语速过快或超时说不完，台词前需描述角色语气，台词用「」包围。
8. 时间轴分段灵活：按剧情节奏自然划分，不强制按分镜时间设定，可自行调整，总时长不超过15s。
9. 描述要自然流畅，符合电影叙事逻辑和拍摄手法，不改变分镜原意，不添加额外内容。
10. 所有描述文字必须符合即梦seedance2.0模型要求，不得出现敏感词、暴力、血腥、政治、色情等内容。

## 正确示例：

画面风格和类型: {visualstyle}, {genres}
构图类型：三分线构图

情绪曲线：屈辱 → 隐忍 → 杀意 → 复仇决心
运动强度：7
分镜1: 时长 3s 时间：日，林尘 衣衫褴褛，正用尽全力将一块沉重的生锈废铁拖向近处的简易掩体，动作吃力，步履蹒跚。林尘 的面部朝向掩体方向，视线也聚焦于此。镜头静止。
分镜2: 时长 4s 时间：日，林尘 林尘缓缓起身，摊开的掌心中，一枚丹药正散发着柔和金光。满堂的讥笑声瞬间凝固。林尘 仰头服下丹药，一股金色气浪猛然自体内爆发，衣发狂舞。镜头从他光芒四射的背影拉远，映出赵灵儿惊惶后退的身影。

`,
'GENERATE_SEGMENT_VIDEO_PROMPT':
`生成一个由以下拍摄方案设计的视频片段:
## 场景:
{scenes}

## 片段拍摄方案和时间轴：
{segment}

## 片段过度：
- 入场: {transitionFrom}
- 出场: {transitionTo}

## 禁止内容（不允许出现）
字幕

`,
'AI_SPLIT_SEGMENTS':`
## 任务
请根据以下分镜数据，智能拆分成多个视频片段。

## 分镜数据（JSON格式）
\`\`\`json
{shotsJson}
\`\`\`

## 角色信息（id: 名称）
{charactersMap}

## 场景信息（id: 位置）
{scenesMap}

## 项目风格
- 视觉风格：{visualStyle}
- 题材类型：{genre}

## 输出要求
请返回 JSON 格式的拆分方案：
\`\`\`json
{
  "segments": [
    {
      "name": "片段名称（简洁概括，如：相遇、告别、冲突）",
      "motionIntensity": "运动强度",
      "emotionCurve": "情绪曲线描述",
      "dialogueRhythm": "台词与节奏描述"
      "shotIds": ["分镜id数组，按顺序排列"],
      "sceneIds": ["场景id数组，按顺序排列"],
      "characterIds": ["角色id数组，按顺序排列"],
      "estimatedDuration": 预估时长（秒），纯数字
    }
  ]
}
\`\`\`
`,
'GENERATE_SEGMENTS_FROM_SCRIPT':`
## 具体任务
按照你的能力设定，先拆分剧本，设计拍摄片段，然后提取关键信息，按下面要求输出具体内容。

# 输入
## 剧本原文
{rawScript}

## 角色信息（id: 名称）
{characters}

## 场景信息（id: 位置）
{scenes}

## 项目配置
- 视觉风格：{visualStyle}
- 题材类型：{genre}
- 输出语言：{language}
- 总时长：{targetDuration}

## 输出要求
请输出 JSON 格式的片段数组，个如下：
\`\`\`json
{
  "segments": [
    {
      "name": "片段名称（简洁概括，如：相遇、告别、冲突）",
      "sceneIds": ["片段出现的场景id数组"],
      "characterIds": ["片段出现的角色id数组"],
      "description": "片段的分时描述，保留剧本中的对话",
      "estimatedDuration": 预估时长（秒），纯数字,
      "motionIntensity": "运动强度",
      "emotionCurve": "情绪曲线描述",
      "dialogueRhythm": "台词与节奏描述"
    }
  ]
}
\`\`\`

## 特别说明
- 片段的分时描述，按照设计拍摄片段的原始内容输出，不要出现角色id，场景id
`
};

    return previews[key] || '';
  };

  // 获取当前模板信息
  const currentTemplate = templates.find(t => t.key === selectedKey);

  // 保存当前模板
  const handleSave = async () => {
    const newCustomContent = { ...customContent };
    if (currentContent === getDefaultContent(selectedKey)) {
      delete newCustomContent[selectedKey];
    } else {
      newCustomContent[selectedKey] = currentContent;
    }
    setCustomContent(newCustomContent);
    localStorage.setItem('promptTemplates', JSON.stringify(newCustomContent));
    dialog.toast({ message: '提示词模板已保存', type: 'success' });
  };

  // 重置为默认
  const handleReset = async () => {
    setCurrentContent(getDefaultContent(selectedKey));
    const newCustomContent = { ...customContent };
    delete newCustomContent[selectedKey];
    setCustomContent(newCustomContent);
    localStorage.setItem('promptTemplates', JSON.stringify(newCustomContent));
    dialog.toast({ message: '模板已重置为默认值', type: 'success' });
  };

  // 导出所有模板
  const handleExport = () => {
    const exportData = {
      customContent,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt-templates-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 导入模板
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.customContent) {
          setCustomContent(data.customContent);
          localStorage.setItem('promptTemplates', JSON.stringify(data.customContent));
          setCurrentContent(customContent[selectedKey] || getDefaultContent(selectedKey));
          dialog.toast({ message: '模板导入成功', type: 'success' });
        } else {
          dialog.toast({ message: '无效的模板文件格式', type: 'error' });
        }
      } catch (e) {
        console.error('Failed to import templates:', e);
        dialog.toast({ message: '导入失败：文件格式错误', type: 'error' });
      }
    };
    input.click();
  };

  // 检查是否有自定义修改
  const isCustomized = currentContent !== getDefaultContent(selectedKey);

  // 变量提示
  const variables: Record<string, string[]> = {
    'PARSE_SCRIPT': ['{text}', '{lang}', '{genre}'],
    'IMPORT_SCRIPT': ['{text}', '{lang}'],
    'GENERATE_SHOTS': ['{sceneindex}', '{location}','{time}','{atmosphere}', '{paragraphs}', '{genre}', '{duration}', '{characters}', '{lang}', '{imageCount}'],
    'IMPORT_SHOTS': ['{scenes}', '{characters}', '{lang}', '{imageCount}','{scriptText}','{duration}'],
    'IMPORT_SHOTS_FOR_SCENE': ['{scenes}', '{characters}', '{lang}', '{imageCount}','{scriptText}','{duration}'],
    'GENERATE_SCRIPT': ['{prompt}', '{duration}', '{genre}', '{lang}'],
    'GENERATE_CHARACTER_PROMPT': ['{desc}', '{genre}', '{visualStyle}'],
    'GENERATE_VARIATION_PROMPT': ['{desc}', '{genre}', '{visualStyle}','{variation}','{variationDesc}'],
    'GENERATE_SCENE_PROMPT': ['{desc}', '{genre}', '{visualStyle}'],
    'JOIN_IMAGES': ['{imageCount}', '{imageSize}'],
    'IMAGE_GENERATION_WITH_REFERENCE': ['{prompt}', '{visualStyle}'],
    'GENERATE_CHARACTER_VARIATION': ['{character}', '{visualStyle}', '{variationPrompt}', '{baseCharacterPrompt}'],
    'GENERATE_KEYFRAME_PROMPT': ['{imageGridSpec}', '{imageCount}', '{imageRate}'],
    'GENERATE_CHARACTER_IMAGE': ['{prompt}', '{visualStyle}','{name}'],
    'GENERATE_SCENE_IMAGE': ['{prompt}', '{visualStyle}','{name}'],
    'GENERATE_VIDEO_PROMPT': ['{shotSummary}', '{cameraMovement}', '{shotSize}', '{duration}', '{visualStyle}', '{characters}', '{startFrameVisualPrompt}', '{endFrameVisualPrompt}', '{dialogues}'],
    'GENERATE_TRANSITION_VIDEO': ['{currentShotSummary}', '{nextShotSummary}', '{currentShotSize}', '{nextShotSize}', '{visualStyle}', '{endFrameVisualPrompt}', '{startFrameVisualPrompt}'],
    'GENERATE_SEGMENT_PROMPT': ['{scriptText}','{storyParagraphs}','{shotDescriptions}', '{visualstyle}','{genre}'],
    'GENERATE_SEGMENT_VIDEO_PROMPT': ['{scenes}', '{segment}','{shotnum}','{transitionFrom}','{transitionTo}'],
    'AI_SPLIT_SEGMENTS': ['{shotsJson}', '{charactersMap}','{scenesMap}','{visualStyle}','{genre}'],
    'GENERATE_SEGMENTS_FROM_SCRIPT': ['{rawScript}', '{characters}','{scenes}','{visualStyle}','{genre}','language','targetDuration'],
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 select-text">
      <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl overflow-hidden w-full max-w-6xl h-[80vh] flex flex-col">
        {/* 标题栏 */}
        <div className="h-16 px-6 border-b border-slate-600 flex items-center justify-between bg-slate-600/80 shrink-0">
          <h3 className="text-lg font-bold text-slate-50 flex items-center gap-2">
            <NotebookPen className="w-5 h-5 text-slate-400" />
            提示词模板编辑器
          </h3>
          <button
            onClick={onClose}
            className="p-2 bg-slate-700 hover:bg-slate-800 rounded-full text-slate-500 hover:text-slate-50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-hidden flex flex-col bg-slate-700">
          {/* 工具栏 */}
          <div className="px-2 py-2 md:py-4 md:px-6 bg-slate-700 border-t border-slate-600 shrink-0">
            <div className="flex gap-2 items-center flex-col md:flex-row">
              {/* 模板选择器 */}
              <CustomSelect
                className="flex-1 min-w-0 w-full"
                options={templates.map(t => ({
                  value: t.key,
                  label: t.name,
                  description: t.description,
                }))}
                value={selectedKey}
                onChange={setSelectedKey}
                placeholder="选择模板"
                maxheight= 'max-h-120'
              />

              {/* 操作按钮 */}
              <div className="flex w-full md:w-auto gap-2 items-center justify-end"> 
                {/* 状态指示 */}
                {isCustomized && (
                  <div className="flex items-center gap-2 text-sm text-green-600 bg-slate-900/20 px-3 py-2 rounded-lg border border-green-600">
                    <div className="w-2 h-2 bg-green-600 rounded-full" />
                    <span>已修改</span>
                  </div>
                )}
                {isCustomized && (
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 bg-slate-600 text-slate-300 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    重置
                  </button>
                )}
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-600 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  保存
                </button>
              </div>
            </div>

            {/* 变量提示 */}
            {variables[selectedKey] && variables[selectedKey].length > 0 && (
              <div className="text-xs text-slate-400 pt-2">
                <span className="font-medium">可用变量：</span>
                <span className="font-mono ml-1">
                  {variables[selectedKey].map(v => `${v}`).join(', ')}
                </span>
              </div>
            )}
          </div>

          {/* 编辑器 */}
          <div className="flex-1 overflow-hidden">
            <textarea
              value={currentContent}
              onChange={(e) => setCurrentContent(e.target.value)}
              className="w-full h-full bg-slate-800 text-slate-100 p-2 md:p-6 font-mono text-sm resize-none  focus:border-slate-500 focus:outline-none transition-all"
              placeholder="在此编辑提示词模板..."
              spellCheck={false}
            />
          </div>
        </div>

        {/* 底部信息 */}
        <div className="p-4 border-t border-slate-700 flex justify-between items-center text-sm text-slate-400 bg-slate-600/80 shrink-0">
          <div className="flex items-center ajustify-between gap-2">
            <button
              onClick={handleExport}
              className="flex items-center p-1 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded transition-colors cursor-pointer"
              title="导出模板"
              >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={handleImport}
              className="flex items-center p-1 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded transition-colors cursor-pointer"
              title="导入模板"
              >
              <Upload className="w-4 h-4" />
            </button>
            <span>变量使用 {`{var}`} 格式</span>
          </div>
            <div className='flex items-center justify-end'>
            <span>字符数：{currentContent.length}</span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default PromptTemplateModal;
