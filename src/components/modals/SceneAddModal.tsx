import { Copy, Loader2, MapPin, Sparkles, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { ModelService } from '../../services/modelService';
import { generateId } from '../../services/seriesService';
import { ProjectState, Scene } from '../../types';
import { useDialog } from '../dialog';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (scene: Scene) => void;
  scene?: Scene | null;
  genre?: string;
  visualStyle?: string;
  project?:ProjectState
}

const SceneAddModal: React.FC<Props> = ({ isOpen, onClose, onSave, scene, genre = '剧情片', visualStyle = '真人写实',project }) => {
  const isEditMode = !!scene;
  const dialog = useDialog();
  
  const [formData, setFormData] = useState({
    location: '',
    time: '',
    atmosphere: '',
    visualPrompt: ''
  });
  const [error, setError] = useState('');
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

  // Initialize form when scene changes or modal opens
  useEffect(() => {
    if (isOpen && scene) {
      setFormData({
        location: scene.location || '',
        time: scene.time || '',
        atmosphere: scene.atmosphere || '',
        visualPrompt: scene.visualPrompt || ''
      });
    } else if (isOpen) {
      // Reset form for add mode
      setFormData({
        location: '',
        time: '',
        atmosphere: '',
        visualPrompt: ''
      });
    }
  }, [isOpen, scene]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.location.trim()) {
      dialog.toast({ message: '请输入场景地点', type: 'error'});
      return;
    }

    const sceneData: Scene = {
      id: scene?.id || generateId('scene'),
      location: formData.location.trim(),
      time: formData.time.trim() || '日间',
      atmosphere: formData.atmosphere.trim(),
      visualPrompt: formData.visualPrompt.trim(),
      referenceImage: scene?.referenceImage || '',
      refId: scene?.refId
    };

    onSave(sceneData);
  };

  const handleClose = () => {
    setFormData({
      location: '',
      time: '',
      atmosphere: '',
      visualPrompt: ''
    });
    setIsGeneratingPrompt(false);
    onClose();
  };

  const handleGenerateVisualPrompt = async () => {
    if (!formData.location.trim()) {
      dialog.toast({ message: '请先输入场景地点', type: 'error'});
      return;
    }

    setIsGeneratingPrompt(true);

    try {
      const tempScene: Scene = {
        id: scene?.id || generateId('scene'),
        location: formData.location.trim(),
        time: formData.time.trim() || '日间',
        atmosphere: formData.atmosphere.trim(),
        visualPrompt: ''
      };

      const prompt = await ModelService.generateVisualPrompts('scene', tempScene, genre, visualStyle,project.globalSettings);
      setFormData({ ...formData, visualPrompt: prompt });
    } catch (e) {
      dialog.toast({ message: `生成视觉提示失败，请重试.${e}`, type: 'error'});
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handleCopyPrompt = async () => {
    if (!formData.visualPrompt.trim()) {
      dialog.toast({ message: '没有可复制的提示词', type: 'error'});
      return;
    }
    try {
      await navigator.clipboard.writeText(formData.visualPrompt);
      dialog.toast({ message: '提示词已复制', type: 'success' });
    } catch (e) {
      dialog.toast({ message: '复制失败', type: 'error'});
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in duration-200">
      <div className="bg-slate-800 border border-slate-600 rounded-2xl w-[600px] max-w-[90vw] max-h-[85vh] overflow-hidden shadow-2xl flex flex-col select-text">
        {/* 标题栏 */}
        <div className="h-16 px-6 border-b border-slate-600 flex items-center justify-between bg-slate-600/80 shrink-0">
          <h3 className="text-lg font-bold text-slate-50 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-slate-400" />
            {isEditMode ? '编辑场景' : '新增场景'}
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

          {/* 场景地点 */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-slate-500 tracking-widest">
              场景地点 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full bg-slate-800 border border-slate-600 text-slate-50 px-4 py-2 text-sm rounded-md focus:border-slate-500 focus:outline-none transition-all"
              placeholder="例如：办公室、公园、餐厅"
              autoFocus
            />
          </div>

          {/* 时间 */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-slate-500 tracking-widest">时间</label>
            <input
              type="text"
              value={formData.time}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              className="w-full bg-slate-800 border border-slate-600 text-slate-50 px-4 py-2 text-sm rounded-md focus:border-slate-500 focus:outline-none transition-all"
              placeholder="例如：白天、夜晚、黄昏"
            />
          </div>

          {/* 氛围 */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-slate-500 tracking-widest">氛围</label>
            <textarea
              value={formData.atmosphere}
              onChange={(e) => setFormData({ ...formData, atmosphere: e.target.value })}
              className="w-full bg-slate-800 border border-slate-600 text-slate-50 px-4 py-2 text-sm rounded-md focus:border-slate-500 focus:outline-none transition-all resize-none"
              rows={2}
              placeholder="请输入场景氛围描述"
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

export default SceneAddModal;
