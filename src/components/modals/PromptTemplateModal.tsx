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
  const [selectedKey, setSelectedKey] = useState<string>('SYSTEM_SEGMENT_DESIGNER');
  const [customContent, setCustomContent] = useState<Record<string, string>>({});
  const [currentContent, setCurrentContent] = useState('');

  // 模板列表
  const templates: Template[] = useMemo(() => [
    { key: 'SYSTEM_SEGMENT_DESIGNER', name: '🤖 S1-片段模式-系统提示词-片段拆分系统设定', description: ' 系统设定，片段拆分系统设定', hasParams: true },
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
    { key: 'GENERATE_VARIATION_PROMPT', name: '📋 O3-视觉设计师-造型提示词润色', description: ' 为图片模型生成造型提示词', hasParams: true },
    { key: 'GENERATE_SCENE_PROMPT', name: '📋 O4-视觉设计师-场景提示词润色', description: ' 为图片模型生成场景提示词', hasParams: true },
    { key: 'GENERATE_KEYFRAME_PROMPT', name: '📋 O5-视觉设计师-关键帧提示词生成提示词', description: ' 为关键帧生成连环画风格提示词', hasParams: true },
    { key: 'GENERATE_VIDEO_PROMPT', name: '📋 O6-导演-视频拍摄提示词生成提示词', description: ' 为单个镜头生成视频拍摄提示词', hasParams: true },
    { key: 'GENERATE_TRANSITION_VIDEO', name: '📋 O7-导演-转场视频提示词生成提示词', description: ' 生成镜头之间的转场视频提示词', hasParams: true },
    { key: 'GENERATE_SCRIPT', name: '📋 O8-编剧-剧本生成提示词', description: ' 根据提示词创作影视剧本', hasParams: true },
    { key: 'GENERATE_PROP_PROMPT', name: '📋 O9-视觉设计师-道具提示词润色', description: ' 为图片模型生成道具提示词', hasParams: true },
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

  // 获取默认内容（直接从 PROMPT_TEMPLATES 获取字符串模板）
  const getDefaultContent = (key: string): string => {
    const defaultTemplates: Record<string, any> = PROMPT_TEMPLATES;
    const value = defaultTemplates[key];
    return typeof value === 'string' ? value : '';
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
    'PARSE_SCRIPT': ['{text}', '{lang}', '{genre}','{story}'],
    'IMPORT_SCRIPT': ['{text}', '{lang}'],
    'GENERATE_SHOTS': ['{sceneIndex}', '{location}','{time}','{atmosphere}', '{paragraphs}', '{genre}', '{duration}', '{characters}', '{lang}', '{imageCount}','{segmentDuration}','{properties}'],
    'IMPORT_SHOTS': ['{scenes}', '{characters}', '{lang}', '{imageCount}','{scriptText}','{duration}','{segmentDuration}'],
    'IMPORT_SHOTS_FOR_SCENE': ['{scenes}', '{characters}', '{lang}', '{imageCount}','{scriptText}','{duration}','{segmentDuration}','{props}'],
    'GENERATE_SCRIPT': ['{prompt}', '{duration}', '{genre}', '{lang}','{story}'],
    'GENERATE_CHARACTER_PROMPT': ['{desc}', '{genre}', '{visualStyle}','{story}'],
    'GENERATE_VARIATION_PROMPT': ['{desc}', '{genre}', '{visualStyle}','{variation}','{variationDesc}'],
    'GENERATE_SCENE_PROMPT': ['{desc}', '{genre}', '{visualStyle}','{story}'],
    'JOIN_IMAGES': ['{imageCount}', '{imageSize}'],
    'IMAGE_GENERATION_WITH_REFERENCE': ['{prompt}', '{visualStyle}'],
    'GENERATE_CHARACTER_VARIATION': ['{character}', '{visualStyle}', '{variationPrompt}', '{baseCharacterPrompt}'],
    'GENERATE_PROP_VARIATION': ['{prop}', '{visualStyle}', '{variationPrompt}', '{basePropPrompt}'],
    'GENERATE_KEYFRAME_PROMPT': ['{imageGridSpec}', '{imageCount}', '{imageRate}'],
    'GENERATE_CHARACTER_IMAGE': ['{prompt}', '{visualStyle}','{name}'],
    'GENERATE_SCENE_IMAGE': ['{prompt}', '{visualStyle}','{location}','{time}','{atmosphere}'],
    'GENERATE_VIDEO_PROMPT': ['{shotSummary}', '{cameraMovement}', '{shotSize}', '{duration}', '{visualStyle}', '{characters}', '{startFrameVisualPrompt}', '{endFrameVisualPrompt}', '{dialogues}','{story}'],
    'GENERATE_TRANSITION_VIDEO': ['{currentShotSummary}', '{nextShotSummary}', '{currentShotSize}', '{nextShotSize}', '{visualStyle}', '{endFrameVisualPrompt}', '{startFrameVisualPrompt}'],
    'GENERATE_SEGMENT_PROMPT': ['{scriptText}','{storyParagraphs}','{shotDescriptions}', '{visualstyle}','{genre}','{segmentName}','{segmentIndex}','{segmentDuration}','{videoRatio','{story}'],
    'GENERATE_SEGMENT_VIDEO_PROMPT': ['{scenes}', '{segment}','{transitionFrom}','{transitionTo}'],
    'AI_SPLIT_SEGMENTS': ['{shotsJson}', '{charactersMap}','{scenesMap}','{visualStyle}','{genre}','{propsMap}'],
    'GENERATE_SEGMENTS_FROM_SCRIPT': ['{rawScript}', '{characters}','{scenes}','{visualStyle}','{genre}','{language}','{targetDuration}','{propsMap}'],
    'SYSTEM_SEGMENT_SPLIT': ['{segmentDuration}'],
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
              className="select-text w-full h-full bg-slate-800 text-slate-100 p-2 md:p-6 font-mono text-sm resize-none focus:border-slate-500 focus:outline-none transition-all"
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
