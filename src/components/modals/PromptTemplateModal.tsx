import { Download, Layers, NotebookPen, RotateCcw, Save, Upload, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { BUILT_IN_TEMPLATE_GROUPS } from '../../config/templateGroups';
import { PROMPT_TEMPLATES } from '../../services/promptTemplates';
import { TemplateGroupService } from '../../services/templateGroupService';
import {
  GROUP_TEMPLATE_VARIABLES,
  GroupTemplates,
  PromptTemplateGroup
} from '../../types/promptTemplate';
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
  const [activeTab, setActiveTab] = useState<'single' | 'group'>('single');

  // ===== 单模版编辑状态 =====
  const [selectedKey, setSelectedKey] = useState<string>('SYSTEM_SEGMENT_DESIGNER');
  const [customContent, setCustomContent] = useState<Record<string, string>>({});
  const [currentContent, setCurrentContent] = useState('');

  // ===== 模版组管理状态 =====
  const [selectedGroupId, setSelectedGroupId] = useState<string>('default');
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<keyof GroupTemplates>('characterImage');
  const [groupTemplateContent, setGroupTemplateContent] = useState('');
  const [groups, setGroups] = useState<PromptTemplateGroup[]>([]);

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
    { key: 'OPTIMIZE_SEGMENT_PROMPT', name: '📋 10-视觉设计师-片段描述优化提示词', description: ' 片段描述优化提示词', hasParams: true },
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

  // ===== 模版组管理：模版 key 选项 =====
  const groupTemplateOptions: { value: keyof GroupTemplates; label: string }[] = useMemo(() => [
    { value: 'systemCharacterDesigner', label: '🤖 角色系统提示词' },
    { value: 'systemSceneDesigner', label: '🤖 场景系统提示词' },
    { value: 'systemPropDesigner', label: '🤖 道具系统提示词' },
    { value: 'systemSegmentDesigner', label: '🤖 片段拆分系统提示词' },
    { value: 'systemSegmentSplit', label: '🤖 剧本直接分片系统提示词' },
    { value: 'characterPrompt', label: '📝 角色视觉提示词润色' },
    { value: 'scenePrompt', label: '📝 场景视觉提示词润色' },
    { value: 'propPrompt', label: '📝 道具视觉提示词润色' },
    { value: 'segmentPrompt', label: '📝 片段视频视觉提示词润色' },
    { value: 'segmentOptimizePrompt', label: '📝 片段描述优化提示词' },
    { value: 'characterImage', label: '🎨 角色图片生成' },
    { value: 'sceneImage', label: '🎨 场景图片生成' },
    { value: 'propImage', label: '🎨 道具图片生成' },
    { value: 'segmentVideoPrompt', label: '🎬 片段视频生成' },
  ], []);

  // ===== 单模版编辑逻辑 =====

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
    'PARSE_SCRIPT': ['{text}', '{lang}', '{genre}','{story}','{targetDuration}'],
    'IMPORT_SCRIPT': ['{text}', '{lang}'],
    'GENERATE_SHOTS': ['{sceneIndex}', '{location}','{time}','{atmosphere}', '{paragraphs}', '{genre}', '{story}', '{characters}', '{lang}', '{imageCount}','{segmentDuration}','{properties}','{totalParagraphsDuration}'],
    'IMPORT_SHOTS': ['{scenes}', '{characters}', '{lang}', '{imageCount}','{scriptText}','{duration}','{segmentDuration}'],
    'IMPORT_SHOTS_FOR_SCENE': ['{scenes}', '{characters}', '{lang}', '{imageCount}','{scriptText}','{paragraphs}','{segmentDuration}','{props}','{totalParagraphsDuration}'],
    'GENERATE_SCRIPT': ['{prompt}', '{duration}', '{genre}', '{lang}','{story}'],
    'GENERATE_CHARACTER_PROMPT': ['{desc}', '{genre}', '{visualStyle}','{story}'],
    'GENERATE_VARIATION_PROMPT': ['{desc}', '{genre}', '{visualStyle}','{variation}','{variationDesc}'],
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

  // ===== 模版组管理逻辑 =====

  // 加载模版组列表
  useEffect(() => {
    if (activeTab === 'group') {
      reloadGroups();
    }
  }, [activeTab]);

  const reloadGroups = () => {
    setGroups(TemplateGroupService.getAllGroups());
  };

  // 获取当前选中的组
  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  // 当组选择变化时，更新模版内容
  useEffect(() => {
    if (activeTab === 'group' && selectedGroup) {
      const content = TemplateGroupService.getGroupTemplateRaw(selectedTemplateKey as string, selectedGroup);
      setGroupTemplateContent(content);
    }
  }, [activeTab, selectedGroup, selectedTemplateKey]);

  // 保存组模版
  const handleSaveGroupTemplate = () => {
    if (!selectedGroupId || !selectedTemplateKey) return;

    TemplateGroupService.updateGroupTemplate(selectedGroupId, selectedTemplateKey as string, groupTemplateContent);
    dialog.toast({ message: '模版已保存', type: 'success' });
    reloadGroups();
  };

  // 重置组模版
  const handleResetGroupTemplate = () => {
    if (!selectedGroupId) return;

    // 使用服务获取原始模版内容
    const builtInGroup = BUILT_IN_TEMPLATE_GROUPS.find(g => g.id === selectedGroupId) || BUILT_IN_TEMPLATE_GROUPS[0];
    const content = TemplateGroupService.getGroupTemplateRaw(selectedTemplateKey, builtInGroup);
    if (content) {
      setGroupTemplateContent(content);
    }

    // 删除自定义覆盖
    TemplateGroupService.resetGroup(selectedGroupId);
    dialog.toast({ message: '模版已重置为默认值', type: 'success' });
    reloadGroups();
  };

  // 新建模版组
  const handleCreateGroup = () => {
    const newId = `custom-${Date.now()}`;
    const newGroup: PromptTemplateGroup = {
      id: newId,
      name: '新建模版组',
      description: '自定义模版组',
      isBuiltIn: false,
      matchRules: {
        priority: 10,
      },
      templates: {},
    };

    TemplateGroupService.addCustomGroup(newGroup);
    dialog.toast({ message: '模版组已创建', type: 'success' });
    reloadGroups();
    setSelectedGroupId(newId);
  };

  // 删除模版组
  const handleDeleteGroup = async () => {
    if (!selectedGroup || selectedGroup.isBuiltIn) {
      dialog.toast({ message: '内置模版组不可删除', type: 'warning' });
      return;
    }

    const confirmed = await dialog.confirm({
      title: '确认删除',
      message: `确定要删除模版组"${selectedGroup.name}"吗？`,
      type: 'warning',
    });

    if (confirmed) {
      TemplateGroupService.deleteCustomGroup(selectedGroupId);
      dialog.toast({ message: '模版组已删除', type: 'success' });
      reloadGroups();
      setSelectedGroupId('default');
    }
  };

  // 更新组基本信息
  const handleUpdateGroupInfo = (field: 'name' | 'description', value: string) => {
    if (!selectedGroup) return;

    TemplateGroupService.updateCustomGroup({
      ...selectedGroup,
      [field]: value,
    });
    reloadGroups();
  };

  // 更新匹配规则
  const handleUpdateMatchRule = (field: 'visualStyle' | 'genre' | 'globalSettings' | 'priority', value: string | number) => {
    if (!selectedGroup) return;

    const newRules = { ...selectedGroup.matchRules };
    if (field === 'priority') {
      newRules.priority = value as number;
    } else {
      // 字符串数组处理
      const strValue = value as string;
      newRules[field] = strValue ? strValue.split(',').map(s => s.trim()): undefined;
    }

    TemplateGroupService.updateCustomGroup({
      ...selectedGroup,
      matchRules: newRules,
    });
    reloadGroups();
  };

  // 导出模版组
  const handleExportGroups = () => {
    const json = TemplateGroupService.exportGroups();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template-groups-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 导入模版组
  const handleImportGroups = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const result = TemplateGroupService.importGroups(text);
        if (result.success) {
          dialog.toast({ message: result.message, type: 'success' });
          reloadGroups();
        } else {
          dialog.toast({ message: result.message, type: 'error' });
        }
      } catch (e) {
        console.error('Import failed:', e);
        dialog.toast({ message: '导入失败', type: 'error' });
      }
    };
    input.click();
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

        {/* Tab 切换 */}
        <div className="flex border-b border-slate-600 bg-slate-700">
          <button
            onClick={() => setActiveTab('single')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'single'
                ? 'bg-slate-800 text-slate-50 border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <NotebookPen className="w-4 h-4" />
            单模版编辑
          </button>
          <button
            onClick={() => setActiveTab('group')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'group'
                ? 'bg-slate-800 text-slate-50 border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            模版组管理
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-hidden flex flex-col bg-slate-700">
          {activeTab === 'single' ? (
            <>
              {/* 单模版编辑 - 工具栏 */}
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
            </>
          ) : (
            <>
              {/* 模版组管理 - 左右布局 */}
              <div className="flex-1 overflow-hidden flex">
                {/* 左侧：模版组列表 */}
                <div className="w-64 border-r border-slate-600 flex flex-col bg-slate-800">
                  <div className="p-3 border-b border-slate-600 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-300">模版组列表</span>
                    <button
                      onClick={handleCreateGroup}
                      className="p-1.5 bg-green-600 hover:bg-green-500 rounded text-slate-50 text-xs"
                      title="新建模版组"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {groups.map(group => (
                      <div
                        key={group.id}
                        onClick={() => setSelectedGroupId(group.id)}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedGroupId === group.id
                            ? 'bg-blue-600/20 border border-blue-500'
                            : 'hover:bg-slate-700 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            group.isBuiltIn ? 'bg-blue-400' : 'bg-green-400'
                          }`} />
                          <span className="text-sm font-medium text-slate-200 truncate">{group.name}</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1 truncate">
                          {group.description || '无描述'}
                        </div>
                        {group.matchRules.priority > 0 && (
                          <div className="text-xs text-slate-500 mt-1">
                            优先级: {group.matchRules.priority}
                            {group.matchRules.visualStyle && ` | ${group.matchRules.visualStyle.join(', ')}`}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 右侧：模版组详情 */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  {selectedGroup ? (
                    <>
                      {/* 组信息编辑 */}
                      <div className="p-4 border-b border-slate-600 space-y-3 bg-slate-800">
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <label className="text-xs text-slate-400 mb-1 block">组名称</label>
                            <input
                              type="text"
                              value={selectedGroup.name}
                              onChange={(e) => handleUpdateGroupInfo('name', e.target.value)}
                              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 text-sm"
                              disabled={selectedGroup.isBuiltIn}
                            />
                          </div>
                          <div className="w-24">
                            <label className="text-xs text-slate-400 mb-1 block">优先级</label>
                            <input
                              type="number"
                              value={selectedGroup.matchRules.priority}
                              onChange={(e) => handleUpdateMatchRule('priority', parseInt(e.target.value) || 0)}
                              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">描述</label>
                          <input
                            type="text"
                            value={selectedGroup.description}
                            onChange={(e) => handleUpdateGroupInfo('description', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="text-xs text-slate-400 mb-1 block">匹配视觉风格 (逗号分隔)</label>
                            <input
                              type="text"
                              value={selectedGroup.matchRules.visualStyle?.join(', ') || ''}
                              onChange={(e) => handleUpdateMatchRule('visualStyle', e.target.value)}
                              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 text-sm"
                              placeholder="如：真人写实, 电影感"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-400 mb-1 block">匹配题材类型 (逗号分隔)</label>
                            <input
                              type="text"
                              value={selectedGroup.matchRules.genre?.join(', ') || ''}
                              onChange={(e) => handleUpdateMatchRule('genre', e.target.value)}
                              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 text-sm"
                              placeholder="如：古装, 仙侠"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-400 mb-1 block">匹配全局设定 (逗号分隔)</label>
                            <input
                              type="text"
                              value={selectedGroup.matchRules.globalSettings?.join(', ') || ''}
                              onChange={(e) => handleUpdateMatchRule('globalSettings', e.target.value)}
                              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 text-sm"
                            />
                          </div>
                        </div>
                      </div>

                      {/* 模版选择和编辑 */}
                      <div className="p-4 border-b border-slate-600 bg-slate-700 flex items-center gap-3">
                        <CustomSelect
                          className="flex-1"
                          options={groupTemplateOptions}
                          value={selectedTemplateKey}
                          onChange={(v) => setSelectedTemplateKey(v as keyof GroupTemplates)}
                          placeholder="选择模版"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleResetGroupTemplate}
                            className="px-3 py-2 bg-slate-600 text-slate-300 hover:bg-slate-500 rounded-lg text-sm flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            重置
                          </button>
                          <button
                            onClick={handleSaveGroupTemplate}
                            className="px-3 py-2 bg-blue-600 text-slate-50 hover:bg-blue-500 rounded-lg text-sm flex items-center gap-1"
                          >
                            <Save className="w-3 h-3" />
                            保存
                          </button>
                        </div>
                        {!selectedGroup.isBuiltIn && (
                          <button
                            onClick={handleDeleteGroup}
                            className="px-3 py-2 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-slate-50 rounded-lg text-sm"
                          >
                            删除组
                          </button>
                        )}
                      </div>

                      {/* 变量提示 */}
                      {GROUP_TEMPLATE_VARIABLES[selectedTemplateKey]?.length > 0 && (
                        <div className="px-4 py-2 bg-slate-800 border-b border-slate-600 text-xs text-slate-400">
                          <span className="font-medium">可用变量：</span>
                          <span className="font-mono ml-1">
                            {GROUP_TEMPLATE_VARIABLES[selectedTemplateKey].join(', ')}
                          </span>
                        </div>
                      )}

                      {/* 模版编辑器 */}
                      <div className="flex-1 overflow-hidden">
                        <textarea
                          value={groupTemplateContent}
                          onChange={(e) => setGroupTemplateContent(e.target.value)}
                          className="select-text w-full h-full bg-slate-800 text-slate-100 p-4 font-mono text-sm resize-none focus:border-slate-500 focus:outline-none"
                          placeholder="在此编辑模版内容..."
                          spellCheck={false}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-400">
                      请选择一个模版组
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* 底部信息 */}
        <div className="p-4 border-t border-slate-700 flex justify-between items-center text-sm text-slate-400 bg-slate-600/80 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={activeTab === 'single' ? handleExport : handleExportGroups}
              className="flex items-center p-1 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded transition-colors cursor-pointer"
              title="导出"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={activeTab === 'single' ? handleImport : handleImportGroups}
              className="flex items-center p-1 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded transition-colors cursor-pointer"
              title="导入"
            >
              <Upload className="w-4 h-4" />
            </button>
            <span>变量使用 {`{var}`} 格式</span>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'single' ? (
              <span>字符数：{currentContent.length}</span>
            ) : (
              <span>{groups.length} 个模版组</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromptTemplateModal;
