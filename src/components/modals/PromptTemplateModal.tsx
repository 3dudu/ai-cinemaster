import { Copy, Download, Layers, List, MessageSquare, NotebookPen, RefreshCw, RotateCcw, Save, Trash2, Upload, X } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BUILT_IN_TEMPLATE_GROUPS, getGroupFull } from '../../prompt';
import {
  GROUP_TEMPLATE_OPTIONS,
  GROUP_TEMPLATE_VARIABLES,
  GroupTemplates,
  PromptTemplateGroup,
  TEMPLATE_LIST,
  TEMPLATE_VARIABLES,
  TemplateInfo,
} from '../../prompt/promptTemplate';
import { PROMPT_TEMPLATES } from '../../prompt/promptTemplates';
import { TemplateGroupService } from '../../prompt/templateGroupService';
import {
  addChatAgent,
  ChatAgent,
  deleteChatAgent,
  exportAgents,
  getChatAgents,
  importAgents,
  resetAgentToDefault,
  updateChatAgent,
} from '../../services/chatAgentService';
import CustomSelect from '../common/CustomSelect';
import { useDialog } from '../dialog';

const PromptTemplateModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  isMobile: boolean
}> = ({ isOpen, onClose,isMobile=false }) => {
  const dialog = useDialog();
  const [activeTab, setActiveTab] = useState<'single' | 'agent' | 'group'>('single');

  // ===== 单模版编辑状态 =====
  const [selectedKey, setSelectedKey] = useState<string>('SYSTEM_SEGMENT_DESIGNER');
  const [customContent, setCustomContent] = useState<Record<string, string>>({});
  const [currentContent, setCurrentContent] = useState('');

  // ===== 模版组管理状态 =====
  const [selectedGroupId, setSelectedGroupId] = useState<string>(isMobile?'':'default');
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<keyof GroupTemplates>('characterImage');
  const [groupTemplateContent, setGroupTemplateContent] = useState('');
  const [groups, setGroups] = useState<PromptTemplateGroup[]>([]);

  // ===== Agent 系统提示词状态 =====
  const [agents, setAgents] = useState<ChatAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [editingAgent, setEditingAgent] = useState<ChatAgent | null>(null);
  const [agentName, setAgentName] = useState('');
  const [agentDescription, setAgentDescription] = useState('');
  const [agentEmoji, setAgentEmoji] = useState('🤖');
  const [agentSystemPrompt, setAgentSystemPrompt] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // 模板列表
  const templates: TemplateInfo[] = useMemo(() => TEMPLATE_LIST, []);

  // ===== 模版组管理：模版 key 选项 =====
  const groupTemplateOptions = useMemo(() => GROUP_TEMPLATE_OPTIONS, []);

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

  // ===== 模版组管理逻辑 =====

  // 加载模版组列表
  useEffect(() => {
    if (activeTab === 'group') {
      reloadGroups();
    }
    if (activeTab === 'agent') {
      reloadAgents();
    }
  }, [activeTab]);

  const reloadAgents = () => {
    const loadedAgents = getChatAgents();
    setAgents(loadedAgents);
    if (loadedAgents.length > 0 && !selectedAgentId) {
      setSelectedAgentId(loadedAgents[0].id);
    }
  };

  // 当选中的 Agent 变化时，更新编辑状态
  useEffect(() => {
    if (activeTab === 'agent' && selectedAgentId) {
      const agent = agents.find(a => a.id === selectedAgentId);
      if (agent) {
        setEditingAgent(agent);
        setAgentName(agent.name);
        setAgentDescription(agent.description);
        setAgentEmoji(agent.emoji);
        setAgentSystemPrompt(agent.systemPrompt);
      }
    }
  }, [activeTab, selectedAgentId, agents]);

  // 点击外部关闭 Emoji 选择器
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 新建 Agent
  const handleCreateAgent = () => {
    const newAgent = addChatAgent({
      name: '新 Agent',
      description: '自定义 Agent',
      emoji: '🤖',
      systemPrompt: '你是一个 AI 助手。',
    });
    reloadAgents();
    setSelectedAgentId(newAgent.id);
    dialog.toast({ message: 'Agent 已创建', type: 'success' });
  };

  // 保存 Agent
  const handleSaveAgent = () => {
    if (!selectedAgentId || !agentName.trim()) {
      dialog.toast({ message: '请填写 Agent 名称', type: 'warning' });
      return;
    }
    updateChatAgent(selectedAgentId, {
      name: agentName.trim(),
      description: agentDescription,
      emoji: agentEmoji,
      systemPrompt: agentSystemPrompt,
    });
    reloadAgents();
    dialog.toast({ message: 'Agent 已保存', type: 'success' });
  };

  // 重置 Agent 到默认
  const handleResetAgent = async () => {
    if (!selectedAgentId) return;
    const agent = agents.find(a => a.id === selectedAgentId);
    if (!agent?.isBuiltIn) {
      dialog.toast({ message: '只有内置 Agent 可以重置', type: 'warning' });
      return;
    }

    const confirmed = await dialog.confirm({
      title: '确认重置',
      message: `确定要将 Agent"${agent.name}"重置为默认值吗？`,
      type: 'warning',
    });

    if (confirmed) {
      resetAgentToDefault(selectedAgentId);
      reloadAgents();
      // 重新加载编辑状态
      const resetAgent = getChatAgents().find(a => a.id === selectedAgentId);
      if (resetAgent) {
        setAgentName(resetAgent.name);
        setAgentDescription(resetAgent.description);
        setAgentEmoji(resetAgent.emoji);
        setAgentSystemPrompt(resetAgent.systemPrompt);
      }
      dialog.toast({ message: 'Agent 已重置', type: 'success' });
    }
  };

  // 删除 Agent
  const handleDeleteAgent = async (agentId?: string) => {
    const targetAgent = agentId ? agents.find(a => a.id === agentId) : editingAgent;
    if (!targetAgent) return;

    if (targetAgent.isBuiltIn) {
      dialog.toast({ message: '内置 Agent 不可删除', type: 'warning' });
      return;
    }

    const confirmed = await dialog.confirm({
      title: '确认删除',
      message: `确定要删除 Agent"${targetAgent.name}"吗？`,
      type: 'warning',
    });

    if (confirmed) {
      deleteChatAgent(targetAgent.id);
      reloadAgents();
      if (selectedAgentId === targetAgent.id) {
        const remaining = getChatAgents();
        setSelectedAgentId(remaining.length > 0 ? remaining[0].id : '');
      }
      dialog.toast({ message: 'Agent 已删除', type: 'success' });
    }
  };

  // 导出 Agent
  const handleExportAgents = () => {
    const json = exportAgents();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-agents-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 导入 Agent
  const handleImportAgents = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const result = importAgents(text);
        if (result.success) {
          dialog.toast({ message: result.message, type: 'success' });
          reloadAgents();
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

  // 常用 Emoji 列表
  const EMOJI_OPTIONS = ['💬', '📝', '🎨', '🎬', '🤖', '🎭', '📚', '💡', '🔧', '🚀', '🎯', '✨', '🌟', '🔮', '🧠', '💻'];

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
    const builtInGroup = getGroupFull(selectedGroupId) || BUILT_IN_TEMPLATE_GROUPS[0];
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
  const handleDeleteGroup = async (groupId?: string) => {
    const targetGroup = groupId ? groups.find(g => g.id === groupId) : selectedGroup;
    if (!targetGroup || targetGroup.isBuiltIn) {
      dialog.toast({ message: '内置模版组不可删除', type: 'warning' });
      return;
    }

    const confirmed = await dialog.confirm({
      title: '确认删除',
      message: `确定要删除模版组"${targetGroup.name}"吗？`,
      type: 'warning',
    });

    if (confirmed) {
      TemplateGroupService.deleteCustomGroup(targetGroup.id);
      dialog.toast({ message: '模版组已删除', type: 'success' });
      reloadGroups();
      if (selectedGroupId === targetGroup.id) {
        setSelectedGroupId('default');
      }
    }
  };

  // 复制模版组
  const handleDuplicateGroup = (group: PromptTemplateGroup) => {
    const newId = `custom-${Date.now()}`;
    const newGroup: PromptTemplateGroup = {
      ...group,
      id: newId,
      name: `${group.name} (副本)`,
      isBuiltIn: false,
      matchRules: {
        ...group.matchRules,
        priority: (group.matchRules.priority || 0) + 1,
      },
    };

    TemplateGroupService.addCustomGroup(newGroup);
    dialog.toast({ message: '模版组已复制', type: 'success' });
    reloadGroups();
    setSelectedGroupId(newId);
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
            单模版
          </button>
          <button
            onClick={() => setActiveTab('agent')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'agent'
                ? 'bg-slate-800 text-slate-50 border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Agent
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
            模版组
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 flex overflow-hidden flex-col bg-slate-700">
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
                {TEMPLATE_VARIABLES[selectedKey] && TEMPLATE_VARIABLES[selectedKey].length > 0 && (
                  <div className="text-xs text-slate-400 pt-2">
                    <span className="font-medium">可用变量：</span>
                    <span className="font-mono ml-1">
                      {TEMPLATE_VARIABLES[selectedKey].map(v => `${v}`).join(', ')}
                    </span>
                  </div>
                )}
              </div>

              {/* 编辑器 */}
              <div className={`flex-1 overflow-hidden`}>
                <textarea
                  value={currentContent}
                  onChange={(e) => setCurrentContent(e.target.value)}
                  className="select-text w-full h-full bg-slate-800 text-slate-100 p-2 md:p-6 font-mono text-sm resize-none focus:border-slate-500 focus:outline-none transition-all"
                  placeholder="在此编辑提示词模板..."
                  spellCheck={false}
                />
              </div>
            </>
          ) : activeTab === 'agent' ? (
            <>
              {/* Agent 系统提示词 - 左右布局 */}
              <div className="flex-1 flex overflow-hidden">
                {/* 左侧：Agent 列表 */}
                {(!selectedAgentId || !isMobile) && (
                <div className="md:w-64 w-full border-r border-slate-600 flex flex-col bg-slate-800">
                  <div className="p-3 border-b border-slate-600 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-300">Agent 列表</span>
                    <div className="flex gap-1">
                      <button
                        onClick={reloadAgents}
                        className="p-1.5 bg-slate-600 hover:bg-slate-500 rounded text-slate-300 hover:text-slate-100 transition-colors"
                        title="刷新列表"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={handleCreateAgent}
                        className="p-1.5 px-2.5 bg-green-600 hover:bg-green-500 rounded text-slate-50 text-xs"
                        title="新建 Agent"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {agents.map(agent => (
                      <div
                        key={agent.id}
                        onClick={() => setSelectedAgentId(agent.id)}
                        className={`p-3 rounded-lg cursor-pointer transition-colors relative group bg-slate-700/50 ${
                          selectedAgentId === agent.id
                            ? 'bg-blue-600/20 border border-blue-500'
                            : 'hover:bg-slate-700 border border-transparent'
                        }`}
                      >
                        {/* 右上角删除按钮 */}
                        {!agent.isBuiltIn && (
                          <div 
                            className="absolute top-2 right-2 flex gap-1 opacity-100 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => handleDeleteAgent(agent.id)}
                              className="p-1 bg-red-600/30 hover:bg-red-600 rounded text-red-400 hover:text-white transition-colors"
                              title="删除"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{agent.emoji}</span>
                          <span className="text-sm font-medium text-slate-200 truncate pr-8">{agent.name}</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1 truncate">
                          {agent.description || '无描述'}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <div className={`w-2 h-2 rounded-full ${
                            agent.isBuiltIn ? 'bg-blue-400' : 'bg-green-400'
                          }`} />
                          <span className="text-xs text-slate-500">
                            {agent.isBuiltIn ? '内置' : '自定义'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                )}

                {/* 右侧：Agent 详情编辑 */}
                {(!isMobile || selectedAgentId) && (
                <div className="flex flex-col w-full overflow-hidden">
                  {selectedAgentId ? (
                    <div className='overflow-y-auto h-full'>
                      {/* Agent 信息编辑 */}
                      <div className="md:p-4 p-2 border-b border-slate-600 space-y-3 bg-slate-800">
                        <div className="flex gap-2">
                          <button
                            onClick={()=>setSelectedAgentId('')}
                            className="px-3 py-2 bg-slate-600 text-slate-300 hover:bg-slate-500 rounded-lg text-sm flex items-center gap-1 md:hidden"
                          >
                            <List className="w-3 h-3" />
                          </button>
                          
                          {/* Emoji 选择 */}
                          <div className="flex flex-col gap-1">
                            <div className="relative" ref={emojiPickerRef}>
                              <button
                                type="button"
                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                className="w-10 h-10 flex items-center justify-center bg-slate-700 border border-slate-600 rounded-lg text-xl hover:bg-slate-600 transition-colors"
                              >
                                {agentEmoji}
                              </button>
                              {showEmojiPicker && (
                                <div className="absolute top-full left-0 mt-1 p-2 bg-slate-700 border border-slate-600 rounded-lg shadow-xl z-20 flex flex-wrap gap-1 w-[180px]">
                                  {EMOJI_OPTIONS.map(emoji => (
                                    <button
                                      key={emoji}
                                      type="button"
                                      onClick={() => {
                                        setAgentEmoji(emoji);
                                        setShowEmojiPicker(false);
                                      }}
                                      className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
                                        agentEmoji === emoji 
                                          ? 'bg-blue-600 text-white' 
                                          : 'hover:bg-slate-600'
                                      }`}
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* 名称 */}
                          <div className="flex-1">
                            <input
                              type="text"
                              value={agentName}
                              onChange={(e) => setAgentName(e.target.value)}
                              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 text-sm"
                              placeholder="Agent 名称"
                            />
                          </div>
                        </div>
                        
                        {/* 描述 */}
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">描述</label>
                          <input
                            type="text"
                            value={agentDescription}
                            onChange={(e) => setAgentDescription(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 text-sm"
                            placeholder="简短描述 Agent 的用途"
                          />
                        </div>
                        
                        {/* 标签 */}
                        <div className="flex items-center gap-2 text-xs">
                          <div className={`px-2 py-1 rounded ${
                            editingAgent?.isBuiltIn 
                              ? 'bg-blue-600/20 text-blue-400' 
                              : 'bg-green-600/20 text-green-400'
                          }`}>
                            {editingAgent?.isBuiltIn ? '内置 Agent' : '自定义 Agent'}
                          </div>
                          {editingAgent?.isBuiltIn && (
                            <span className="text-slate-500">可修改系统提示词，不可删除</span>
                          )}
                        </div>
                      </div>

                      {/* 系统提示词编辑 */}
                      <div className="md:p-4 p-2 border-b border-slate-600 bg-slate-700 flex items-center justify-between sticky top-0 z-10">
                        <span className="text-sm font-medium text-slate-300">系统提示词</span>
                        <div className="flex gap-2">
                          {editingAgent?.isBuiltIn && (
                            <button
                              onClick={handleResetAgent}
                              className="px-3 py-2 bg-slate-600 text-slate-300 hover:bg-slate-500 rounded-lg text-sm flex items-center gap-1"
                            >
                              <RotateCcw className="w-3 h-3" />
                              重置
                            </button>
                          )}
                          <button
                            onClick={handleSaveAgent}
                            className="px-3 py-2 bg-blue-600 text-slate-50 hover:bg-blue-500 rounded-lg text-sm flex items-center gap-1"
                          >
                            <Save className="w-3 h-3" />
                            保存
                          </button>
                        </div>
                      </div>

                      {/* 系统提示词编辑器 */}
                      <div className="h-full flex-1 overflow-hidden">
                        <textarea
                          value={agentSystemPrompt}
                          onChange={(e) => setAgentSystemPrompt(e.target.value)}
                          className="select-text w-full h-full bg-slate-800 text-slate-100 p-2 md:p-4 font-mono text-sm resize-none focus:border-slate-500 focus:outline-none"
                          placeholder="在此编辑 Agent 的系统提示词..."
                          spellCheck={false}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-400">
                      请选择一个 Agent
                    </div>
                  )}
                </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* 模版组管理 - 左右布局 */}
              <div className="flex-1 flex overflow-hidden">
                {/* 左侧：模版组列表 */}
                {(!selectedGroupId || !isMobile) && (
                <div className="md:w-64 w-full border-r border-slate-600 flex flex-col bg-slate-800">
                  <div className="p-3 border-b border-slate-600 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-300">模版组列表</span>
                    <div className="flex gap-1">
                      <button
                        onClick={reloadGroups}
                        className="p-1.5 bg-slate-600 hover:bg-slate-500 rounded text-slate-300 hover:text-slate-100 transition-colors"
                        title="刷新列表"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={handleCreateGroup}
                        className="p-1.5 px-2.5 bg-green-600 hover:bg-green-500 rounded text-slate-50 text-xs"
                        title="新建模版组"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {groups.map(group => (
                      <div
                        key={group.id}
                        onClick={() => setSelectedGroupId(group.id)}
                        className={`p-3 rounded-lg cursor-pointer transition-colors relative group bg-slate-700/50 ${
                          selectedGroupId === group.id
                            ? 'bg-blue-600/20 border border-blue-500'
                            : 'hover:bg-slate-700 border border-transparent'
                        }`}
                      >
                        {/* 右上角操作按钮 */}
                        <div 
                          className="absolute top-2 right-2 flex gap-1 opacity-100 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleDuplicateGroup(group)}
                            className="p-1 bg-slate-600 hover:bg-slate-500 rounded text-slate-300 hover:text-slate-100 transition-colors"
                            title="复制"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          {!group.isBuiltIn && (
                            <button
                              onClick={() => handleDeleteGroup(group.id)}
                              className="p-1 bg-red-600/30 hover:bg-red-600 rounded text-red-400 hover:text-white transition-colors"
                              title="删除"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            group.isBuiltIn ? 'bg-blue-400' : 'bg-green-400'
                          }`} />
                          <span className="text-sm font-medium text-slate-200 truncate pr-12">{group.name}</span>
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
                )}

                {/* 右侧：模版组详情 */}
                 {(!isMobile || selectedGroup) && (
                <div className="flex flex-col w-full overflow-hidden">
                  {selectedGroup ? (
                    <div className='overflow-y-auto h-full'>
                      {/* 组信息编辑 */}
                      <div className="md:p-4 p-2 border-b border-slate-600 space-y-3 bg-slate-800">
                        <div className="flex gap-2">
                            <button
                            onClick={()=>setSelectedGroupId(null)}
                            className="px-3 py-2 bg-slate-600 text-slate-300 hover:bg-slate-500 rounded-lg text-sm flex items-center gap-1 md:hidden"
                          >
                            <List className="w-3 h-3" />
                          </button>
                          <div className="flex-1">
                            <input
                              type="text"
                              value={selectedGroup.name}
                              onChange={(e) => handleUpdateGroupInfo('name', e.target.value)}
                              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 text-sm"
                              disabled={selectedGroup.isBuiltIn}
                            />
                          </div>
                        </div>
                         <div className="flex gap-2">
                          <div className="flex-1">
                          <label className="text-xs text-slate-400 mb-1 block">描述</label>
                          <input
                            type="text"
                            value={selectedGroup.description}
                            onChange={(e) => handleUpdateGroupInfo('description', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 text-sm"
                          />
                        </div>
                         <div className="">
                            <label className="text-xs text-slate-400 mb-1 block">优先级</label>
                            <input
                              type="number"
                              value={selectedGroup.matchRules.priority}
                              onChange={(e) => handleUpdateMatchRule('priority', parseInt(e.target.value) || 0)}
                              className="w-[64px] px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 text-sm"
                            />
                          </div>
                          </div>
                        <div className="grid md:grid-cols-3 grid-cols-1 gap-2">
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
                      <div className="md:p-4 p-2 border-b border-slate-600 bg-slate-700 flex items-center justify-between gap-2 sticky top-0 z-10">
                        <CustomSelect
                          className="flex-1 md:max-w-full max-w-[170px]"
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
                      <div className={`h-full flex-1 overflow-hidden`}>
                        <textarea
                          value={groupTemplateContent}
                          onChange={(e) => setGroupTemplateContent(e.target.value)}
                          className="select-text w-full h-full bg-slate-800 text-slate-100 md:p-4 p-2 font-mono text-sm resize-none focus:border-slate-500 focus:outline-none"
                          placeholder="在此编辑模版内容..."
                          spellCheck={false}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-400">
                      请选择一个模版组
                    </div>
                  )}
                </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* 底部信息 */}
        <div className="p-4 border-t border-slate-700 flex justify-between items-center text-sm text-slate-400 bg-slate-600/80 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={
                activeTab === 'single' 
                  ? handleExport 
                  : activeTab === 'agent' 
                    ? handleExportAgents 
                    : handleExportGroups
              }
              className="flex items-center p-1 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded transition-colors cursor-pointer"
              title="导出"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={
                activeTab === 'single' 
                  ? handleImport 
                  : activeTab === 'agent' 
                    ? handleImportAgents 
                    : handleImportGroups
              }
              className="flex items-center p-1 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded transition-colors cursor-pointer"
              title="导入"
            >
              <Upload className="w-4 h-4" />
            </button>
            <span>{activeTab !== 'agent' && `变量使用 {var} 格式`}</span>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'single' ? (
              <span>字符数：{currentContent.length}</span>
            ) : activeTab === 'agent' ? (
              <span>{agents.length} 个 Agent</span>
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
