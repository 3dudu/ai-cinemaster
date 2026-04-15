import { Box, Copy, Loader2, Sparkles, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { ModelService } from '../../services/modelService';
import { generateId } from '../../services/seriesService';
import { ProjectState, Properties } from '../../types';
import { useDialog } from '../dialog';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (prop: Properties) => void;
  prop?: Properties | null;
  genre?: string;
  visualStyle?: string;
  project?: ProjectState;
}

const PropAddModal: React.FC<Props> = ({ isOpen, onClose, onSave, prop, genre = '剧情片', visualStyle = '真人写实', project }) => {
  const isEditMode = !!prop;
  const dialog = useDialog();

  const [formData, setFormData] = useState({
    name: '',
    shape: '',
    material: '',
    color: '',
    size: '',
    structural: '',
    effects: '',
    description: '',
    visualPrompt: ''
  });
  const [error, setError] = useState('');
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

  // Initialize form when prop changes or modal opens
  useEffect(() => {
    if (isOpen && prop) {
      setFormData({
        name: prop.name || '',
        shape: prop.shape || '',
        material: prop.material || '',
        color: prop.color || '',
        size: prop.size || '',
        structural: prop.structural || '',
        effects: prop.effects || '',
        description: prop.description || '',
        visualPrompt: prop.visualPrompt || ''
      });
    } else if (isOpen) {
      // Reset form for add mode
      setFormData({
        name: '',
        shape: '',
        material: '',
        color: '',
        size: '',
        structural: '',
        effects: '',
        description: '',
        visualPrompt: ''
      });
    }
  }, [isOpen, prop]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      dialog.toast({ message: '请输入道具名称', type: 'error' });
      return;
    }

    const propData: Properties = {
      id: prop?.id || generateId('prop'),
      name: formData.name.trim(),
      shape: formData.shape.trim(),
      material: formData.material.trim(),
      color: formData.color.trim(),
      size: formData.size.trim(),
      structural: formData.structural.trim(),
      effects: formData.effects.trim(),
      description: formData.description.trim(),
      visualPrompt: formData.visualPrompt.trim(),
      referenceImage: prop?.referenceImage || '',
      variations: prop?.variations || [],
      refId: prop?.refId
    };

    onSave(propData);
  };

  const handleClose = () => {
    setFormData({
      name: '',
      shape: '',
      material: '',
      color: '',
      size: '',
      structural: '',
      effects: '',
      description: '',
      visualPrompt: ''
    });
    setIsGeneratingPrompt(false);
    onClose();
  };

  const handleGenerateVisualPrompt = async () => {
    if (!formData.name.trim()) {
      dialog.toast({ message: '请先输入道具名称', type: 'error' });
      return;
    }

    setIsGeneratingPrompt(true);

    try {
      const tempProp: Properties = {
        id: prop?.id || generateId('prop'),
        name: formData.name.trim(),
        shape: formData.shape.trim(),
        material: formData.material.trim(),
        color: formData.color.trim(),
        size: formData.size.trim(),
        structural: formData.structural.trim(),
        effects: formData.effects.trim(),
        description: formData.description.trim(),
        variations: []
      };

      const prompt = await ModelService.generateVisualPrompts('prop', tempProp, genre, visualStyle,null,null,project?.globalSettings);
      setFormData({ ...formData, visualPrompt: prompt });
    } catch (e) {
      dialog.toast({ message: `生成视觉提示失败，请重试。${e}`, type: 'error' });
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handleCopyPrompt = async () => {
    if (!formData.visualPrompt.trim()) {
      dialog.toast({ message: '没有可复制的提示词', type: 'error' });
      return;
    }
    try {
      await navigator.clipboard.writeText(formData.visualPrompt);
      dialog.toast({ message: '提示词已复制', type: 'success' });
    } catch (e) {
      dialog.toast({ message: '复制失败', type: 'error' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in duration-200">
      <div className="bg-slate-800 border border-slate-600 rounded-2xl w-[600px] max-w-[90vw] max-h-[85vh] overflow-hidden shadow-2xl flex flex-col select-text">
        {/* 标题栏 */}
        <div className="h-16 px-6 border-b border-slate-600 flex items-center justify-between bg-slate-600/80 shrink-0">
          <h3 className="text-lg font-bold text-slate-50 flex items-center gap-2">
            <Box className="w-5 h-5 text-slate-400" />
            {isEditMode ? '编辑道具' : '新增道具'}
          </h3>
          <button
            onClick={handleClose}
            className="p-2 bg-slate-700 hover:bg-slate-800 rounded-full text-slate-500 hover:text-slate-50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 主内容区域 */}
        <div className="flex-1 overflow-y-auto p-2 md:p-6 space-y-2 bg-slate-700">
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-600/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* 道具名称 */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-slate-500 tracking-widest">
              道具名称 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-slate-800 border border-slate-600 text-slate-50 px-4 py-2 text-sm rounded-md focus:border-slate-500 focus:outline-none transition-all"
              placeholder="请输入道具名称"
              autoFocus
            />
          </div>

          {/* 形状 & 材质 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-slate-500 tracking-widest">形状</label>
              <input
                type="text"
                value={formData.shape}
                onChange={(e) => setFormData({ ...formData, shape: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 text-slate-50 px-4 py-2 text-sm rounded-md focus:border-slate-500 focus:outline-none transition-all"
                placeholder="例如：圆形、长方形"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-slate-500 tracking-widest">材质</label>
              <input
                type="text"
                value={formData.material}
                onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 text-slate-50 px-4 py-2 text-sm rounded-md focus:border-slate-500 focus:outline-none transition-all"
                placeholder="例如：金属、木质"
              />
            </div>
          </div>

          {/* 颜色 & 大小 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-slate-500 tracking-widest">颜色</label>
              <input
                type="text"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 text-slate-50 px-4 py-2 text-sm rounded-md focus:border-slate-500 focus:outline-none transition-all"
                placeholder="例如：红色、银色"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-slate-500 tracking-widest">大小</label>
              <input
                type="text"
                value={formData.size}
                onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 text-slate-50 px-4 py-2 text-sm rounded-md focus:border-slate-500 focus:outline-none transition-all"
                placeholder="例如：30cm、大型"
              />
            </div>
          </div>

          {/* 结构特点 */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-slate-500 tracking-widest">结构特点</label>
            <textarea
              value={formData.structural}
              onChange={(e) => setFormData({ ...formData, structural: e.target.value })}
              className="w-full bg-slate-800 border border-slate-600 text-slate-50 px-4 py-2 text-sm rounded-md focus:border-slate-500 focus:outline-none transition-all resize-none"
              rows={2}
              placeholder="描述道具的结构特征..."
            />
          </div>

          {/* 特殊效果 */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-slate-500 tracking-widest">特殊效果</label>
            <textarea
              value={formData.effects}
              onChange={(e) => setFormData({ ...formData, effects: e.target.value })}
              className="w-full bg-slate-800 border border-slate-600 text-slate-50 px-4 py-2 text-sm rounded-md focus:border-slate-500 focus:outline-none transition-all resize-none"
              rows={2}
              placeholder="例如：发光、透明、反光..."
            />
          </div>

          {/* 描述 */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-slate-500 tracking-widest">详细描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-slate-800 border border-slate-600 text-slate-50 px-4 py-2 text-sm rounded-md focus:border-slate-500 focus:outline-none transition-all resize-none"
              rows={2}
              placeholder="道具的详细描述..."
            />
          </div>

          {/* 视觉提示 */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-slate-500 tracking-widest">视觉提示</label>
            <div className={`relative ${isGeneratingPrompt ? 'ai-generating-border' : ''}`}>
              <textarea
                value={formData.visualPrompt}
                onChange={(e) => setFormData({ ...formData, visualPrompt: e.target.value })}
                className={`w-full bg-slate-800 border text-slate-50 px-4 py-2 pb-12 text-sm rounded-md focus:outline-none transition-all resize-none ${
                  isGeneratingPrompt ? 'border-transparent' : 'border-slate-600 focus:border-slate-500'
                }`}
                rows={6}
                placeholder="请输入视觉生成提示词"
              />
              {/* 底部覆盖层 */}
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-slate-800/65 backdrop-blur-sm border border-slate-600 rounded-b-md flex items-center justify-between">
                {/* 左边字数统计 */}
                <span className="text-[11px] text-slate-400 font-mono">
                  {formData.visualPrompt.length} 字
                </span>
                {/* 右边按钮组 */}
                <div className="flex items-center gap-2">
                  {/* 复制按钮 */}
                  <button
                    onClick={handleCopyPrompt}
                    disabled={!formData.visualPrompt.trim()}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-[11px] font-bold tracking-wider rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                    title="复制提示词"
                  >
                    <Copy className="w-3 h-3" />
                    复制
                  </button>
                  {/* AI生成按钮 */}
                  <button
                    onClick={handleGenerateVisualPrompt}
                    disabled={isGeneratingPrompt}
                    className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-slate-50 text-[11px] font-bold tracking-wider rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                    title="AI生成视觉提示"
                  >
                    {isGeneratingPrompt ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    {isGeneratingPrompt ? '生成中...' : 'AI生成'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 按钮栏 */}
        <div className="p-6 bg-slate-600/80 border-t border-slate-600 flex gap-3 shrink-0">
          <button
            onClick={handleClose}
            className="flex-1 py-3 bg-slate-600 text-slate-300 hover:bg-slate-800 text-[11px] font-bold tracking-wider rounded-lg transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className={`flex-1 py-3 text-[11px] font-bold tracking-wider rounded-lg transition-colors cursor-pointer ${
              isEditMode
                ? 'bg-blue-600 text-slate-50 hover:bg-blue-500'
                : 'bg-green-600 text-slate-50 hover:bg-green-500'
            }`}
          >
            {isEditMode ? '更新' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PropAddModal;
