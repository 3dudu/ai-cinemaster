import { ChevronDown, Download, NotebookPen, RotateCcw, Save, Upload, X } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PROMPT_TEMPLATES } from '../services/promptTemplates';
import { useDialog } from './dialog';

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
  const [selectedKey, setSelectedKey] = useState<string>('SYSTEM_SCRIPT_ANALYZER');
  const [customContent, setCustomContent] = useState<Record<string, string>>({});
  const [currentContent, setCurrentContent] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);

  // 模板列表
  const templates: Template[] = useMemo(() => [
    { key: 'SYSTEM_SCRIPT_ANALYZER', name: '剧本分析员系统提示词', description: '用于剧本解析的系统提示词' },
    { key: 'SYSTEM_PHOTOGRAPHER', name: '摄影师系统提示词', description: '用于镜头清单生成的系统提示词' },
    { key: 'SYSTEM_SCREENWRITER', name: '编剧系统提示词', description: '用于剧本生成的系统提示词' },
    { key: 'SYSTEM_VISUAL_DESIGNER', name: '视觉设计师系统提示词', description: '用于视觉提示词生成的系统提示词' },
    { key: 'SYSTEM_VIDEO_DIRECTOR', name: '导演系统提示词', description: '用于视频拍摄提示词生成的系统提示词' },
    { key: 'PARSE_SCRIPT', name: '剧本分析员-剧本解析提示词', description: '解析原始文本提取剧本信息', hasParams: true },
    { key: 'GENERATE_SHOTS', name: '摄影师-镜头清单生成提示词', description: '生成场景的镜头调度设计', hasParams: true },
    { key: 'GENERATE_SCRIPT', name: '编剧-剧本生成提示词', description: '根据提示词创作影视剧本', hasParams: true },
    { key: 'GENERATE_VISUAL_PROMPT', name: '视觉设计师-角色/场景视觉提示词生成提示词', description: '为角色和场景生成图像提示词', hasParams: true },
    { key: 'GENERATE_CHARACTER_IMAGE', name: '视觉设计师-角色图片生成提示词', description: '生成角色三视图加大头照', hasParams: true },
    { key: 'GENERATE_SCENE_IMAGE', name: '视觉设计师-场景图片生成提示词', description: '生成场景图片', hasParams: true },
    { key: 'IMAGE_GENERATION_WITH_REFERENCE', name: '视觉设计师-带参考图的图片生成提示词', description: '生成带参考图的角色图片', hasParams: true },
    { key: 'GENERATE_CHARACTER_VARIATION', name: '视觉设计师-角色造型变体生成提示词', description: '生成角色的新造型', hasParams: true },
    { key: 'GENERATE_KEYFRAME_PROMPT', name: '视觉设计师-关键帧提示词生成提示词', description: '为关键帧生成连环画风格提示词', hasParams: true },
    { key: 'GENERATE_VIDEO_PROMPT', name: '导演-视频拍摄提示词生成提示词', description: '为单个镜头生成视频拍摄提示词', hasParams: true },
    { key: 'GENERATE_TRANSITION_VIDEO', name: '导演-转场视频提示词生成提示词', description: '生成镜头之间的转场视频提示词', hasParams: true },
    { key: 'JOIN_IMAGES', name: '视觉设计师-图片拼接提示词', description: '将多张图片拼接成宫格图', hasParams: true },
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

  // 点击外部关闭下拉列表
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      // 滚动到选中项
      setTimeout(() => {
        if (selectedItemRef.current) {
          selectedItemRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
          });
        }
      }, 0);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

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
      'PARSE_SCRIPT': `分析输入的故事或剧本，构思制作一部 {genre} 类型的视频，并输出一个 JSON 对象，字段值以 {lang} 语言呈现。

## 任务：
提取title:标题、genre:类型、logline:故事梗概（以 {lang} 语言呈现）。
提取characters:角色信息（id:编号、name:姓名、gender:性别、age:年龄、personality:性格）。
提取scenes:场景信息（id:编号、location:地点、time:时间、atmosphere:氛围）。
storyParagraphs:故事段落（id:编号、sceneRefId:引用场景编号、text:内容）。

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
剧本整体目标时长: {duration || "30s"}

## 角色:
{characters}

## 说明：
1. 设计一组覆盖全部情节动作的镜头序列。
2. 重要提示：每场戏镜头数量上限为 2-8 个，每个镜头时长为 4-12 秒，避免出现 JSON 截断错误。
3. 镜头运动：请使用专业术语（如：前推、右摇、固定、手持、跟拍）。
4. 景别：明确取景范围（如：大特写、中景、全景）。
5. 镜头情节概述：详细描述该镜头内发生的情节（使用 {lang} 语言描述）。
6. 视觉提示语：用于图像生成的详细{lang}描述，字数控制在 120 词以内。
7. 转场动画：包含起始帧，结束帧，时长，运动强度（取值为 0-100）。
8. 关键帧提示词：visualPrompt, 使用 {lang} 语言描述，遵循下面表述方式：主体+行为+环境，可补充：风格、色彩、光影、构图等美学元素。

## 输出格式：JSON 数组，数组内对象包含以下字段：
- id（字符串类型）
- sceneId（字符串类型）
- actionSummary（字符串类型）
- dialogue（对象数组类型）
- cameraMovement（字符串类型）
- shotSize（字符串类型）
- characters（字符串数组类型）
- keyframes（对象数组类型）
- interval（对象类型）`,
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
      'GENERATE_VISUAL_PROMPT': `为 {genre} 类视频中的 {type} 生成高还原度图像提示词，图像风格必须为：{visualStyle}。
{type} 的描述信息如下: {desc}
  - 角色要体现出年龄、性别、性格、外貌、动作、衣着、神态等，不要出现场景。
  - 场景要描述时间、地点、景色、光线、氛围等，不要出现角色。
中文输出提示词，以逗号分隔，聚焦视觉细节（光线、质感、外观）。`,
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
      'GENERATE_CHARACTER_VARIATION': `生成角色：{character} 的新造型图，画面风格必须为：{visualStyle}，符合下面描述。
造型描述：
    {variationPrompt}
要求：
    - 画面尺寸为：1728x2304
    - 画面风为：{visualStyle}
    - 画面内容为角色的一张图
    - 如果有参考图，参考图为角色的三视图加大头照，必须保持面部特征与参考图一致。
    - 如果没有，角色原来是这样的：{baseCharacterPrompt}`,
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
图片内容：{prompt}

如果只有一个角色，则生成角色三视图加大头照，在同一张图中生成丰富细节的角色展示风格图片，图片比例3:4，具体要求：排版布局左上1/4为从头部到肩膀的清晰正面大头照，右上1/4为人物站立的全身正视图， 下部左边人物的站立全身侧视图，右边人物的站立全身背视图；所有视图必须为同一角色，五官、发型、服装、体型、风格、比例与细节完全一致，不改变人物特征；三视图比例统一、姿态自然；纯白色背景、无阴影、无道具、无文字。`,
      'GENERATE_SCENE_IMAGE': `生成符合下面要求的场景图片，图片风格必须为：{visualStyle}。
图片内容：{prompt}

图片比例16:9，具体要求：图中无角色、无文字。`,
      'GENERATE_TRANSITION_VIDEO': `视频风格：{visualStyle}；故事从 {currentShotSummary} 过渡到 {nextShotSummary}。景别变化：从 {currentShotSize} 到 {nextShotSize}；制作转场视频：保持画面风格一致。转场时长 5 秒，运动强度适中。
镜头开始：{endFrameVisualPrompt}；
镜头结束：{startFrameVisualPrompt}；
按照上面描述生成 {visualStyle} 风格的转场视频！`,
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
    await dialog.alert({ title: '保存成功', message: '提示词模板已保存', type: 'success' });
  };

  // 重置为默认
  const handleReset = async () => {
    setCurrentContent(getDefaultContent(selectedKey));
    const newCustomContent = { ...customContent };
    delete newCustomContent[selectedKey];
    setCustomContent(newCustomContent);
    localStorage.setItem('promptTemplates', JSON.stringify(newCustomContent));
    await dialog.alert({ title: '重置成功', message: '模板已重置为默认值', type: 'success' });
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
          await dialog.alert({ title: '导入成功', message: '模板导入成功', type: 'success' });
        } else {
          await dialog.alert({ title: '导入失败', message: '无效的模板文件格式', type: 'error' });
        }
      } catch (e) {
        console.error('Failed to import templates:', e);
        await dialog.alert({ title: '导入失败', message: '导入失败：文件格式错误', type: 'error' });
      }
    };
    input.click();
  };

  // 检查是否有自定义修改
  const isCustomized = currentContent !== getDefaultContent(selectedKey);

  // 变量提示
  const variables: Record<string, string[]> = {
    'PARSE_SCRIPT': ['{text}', '{lang}', '{genre}'],
    'GENERATE_SHOTS': ['{scenendex}', '{location}','{time}','{atmosphere}', '{paragraphs}', '{genre}', '{duration}', '{characters}', '{lang}'],
    'GENERATE_SCRIPT': ['{prompt}', '{duration}', '{genre}', '{lang}'],
    'GENERATE_VISUAL_PROMPT': ['{type}', '{desc}', '{genre}', '{visualStyle}'],
    'JOIN_IMAGES': ['{imageCount}', '{imageSize}'],
    'IMAGE_GENERATION_WITH_REFERENCE': ['{prompt}', '{visualStyle}'],
    'GENERATE_CHARACTER_VARIATION': ['{character}', '{visualStyle}', '{variationPrompt}', '{baseCharacterPrompt}'],
    'GENERATE_KEYFRAME_PROMPT': ['{imageGridSpec}', '{imageCount}', '{imageRate}'],
    'GENERATE_CHARACTER_IMAGE': ['{prompt}', '{visualStyle}'],
    'GENERATE_SCENE_IMAGE': ['{prompt}', '{visualStyle}'],
    'GENERATE_VIDEO_PROMPT': ['{shotSummary}', '{cameraMovement}', '{shotSize}', '{duration}', '{visualStyle}', '{characters}', '{startFrameVisualPrompt}', '{endFrameVisualPrompt}', '{dialogues}'],
    'GENERATE_TRANSITION_VIDEO': ['{currentShotSummary}', '{nextShotSummary}', '{currentShotSize}', '{nextShotSize}', '{visualStyle}', '{endFrameVisualPrompt}', '{startFrameVisualPrompt}'],
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-700/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 select-text">
      <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl overflow-hidden w-full max-w-4xl h-[80vh] flex flex-col">
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
          <div className="px-2 py-2 md:py-4 md:px-6 bg-slate-600/80 border-t border-slate-600 shrink-0">
            <div className="flex gap-2 items-center flex-col md:flex-row">
              {/* 模板选择器 */}
              <div className="relative flex-1 w-full" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-left text-slate-100 flex items-center justify-between hover:border-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span className="font-medium">{currentTemplate?.name}</span>
                  <ChevronDown className={`w-4 h-4 ml-2 flex-shrink-0 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showDropdown && (
                  <div className="absolute z-10 w-full mt-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                    {templates.map((template) => (
                      <button
                        key={template.key}
                        ref={selectedKey === template.key ? selectedItemRef : null}
                        onClick={() => {
                          setSelectedKey(template.key);
                          setShowDropdown(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-sm transition-colors cursor-pointer ${
                          selectedKey === template.key
                            ? 'bg-slate-700 text-slate-100'
                            : 'text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        <div className="font-medium">{template.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{template.description}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

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
                    className="px-4 py-2 bg-slate-700 text-slate-300 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    重置
                  </button>
                )}
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium cursor-pointer"
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
              className="w-full h-full bg-slate-800 text-slate-100 p-2 md:p-6 font-mono text-sm resize-none focus:outline-none"
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
