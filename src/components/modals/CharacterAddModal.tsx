import { Loader2, Sparkles, User, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { ModelService } from '../../services/modelService';
import { generateId } from '../../services/seriesService';
import { Character } from '../../types';
import CustomSelect from '../common/CustomSelect';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (character: Character) => void;
  character?: Character | null;
  genre?: string;
  visualStyle?: string;
}

const CharacterAddModal: React.FC<Props> = ({ isOpen, onClose, onSave, character, genre = '剧情片', visualStyle = '真人写实' }) => {
  const isEditMode = !!character;
  
  const [formData, setFormData] = useState({
    name: '',
    gender: '男',
    age: '',
    personality: '',
    visualPrompt: ''
  });
  const [error, setError] = useState('');
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

  // Initialize form when character changes or modal opens
  useEffect(() => {
    if (isOpen && character) {
      setFormData({
        name: character.name || '',
        gender: character.gender || '男',
        age: character.age || '',
        personality: character.personality || '',
        visualPrompt: character.visualPrompt || ''
      });
    } else if (isOpen) {
      // Reset form for add mode
      setFormData({
        name: '',
        gender: '男',
        age: '',
        personality: '',
        visualPrompt: ''
      });
    }
  }, [isOpen, character]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('请输入角色名称');
      return;
    }

    const charData: Character = {
      id: character?.id || generateId('char'),
      name: formData.name.trim(),
      gender: formData.gender,
      age: formData.age.trim() || '未指定',
      personality: formData.personality.trim(),
      visualPrompt: formData.visualPrompt.trim(),
      referenceImage: character?.referenceImage || '',
      variations: character?.variations || [],
      refId: character?.refId
    };

    onSave(charData);
    // Reset form
    setFormData({
      name: '',
      gender: '男',
      age: '',
      personality: '',
      visualPrompt: ''
    });
  };

  const handleClose = () => {
    setError('');
    setFormData({
      name: '',
      gender: '男',
      age: '',
      personality: '',
      visualPrompt: ''
    });
    setIsGeneratingPrompt(false);
    onClose();
  };

  const handleGenerateVisualPrompt = async () => {
    if (!formData.name.trim()) {
      setError('请先输入角色名称');
      return;
    }

    setIsGeneratingPrompt(true);
    setError('');

    try {
      const tempChar: Character = {
        id: character?.id || generateId('char'),
        name: formData.name.trim(),
        gender: formData.gender,
        age: formData.age.trim() || '未指定',
        personality: formData.personality.trim(),
        visualPrompt: '',
        variations: []
      };

      const prompt = await ModelService.generateVisualPrompts('character', tempChar, genre, visualStyle);
      setFormData(prev => ({ ...prev, visualPrompt: prompt }));
    } catch (e) {
      console.error(e);
      setError('生成视觉提示失败，请重试');
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-700/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="bg-slate-800 border border-slate-600 rounded-2xl w-[600px] max-w-[90vw] max-h-[85vh] overflow-hidden shadow-2xl flex flex-col select-text">
        {/* 标题栏 */}
        <div className="h-16 px-6 border-b border-slate-600 flex items-center justify-between bg-slate-600/80 shrink-0">
          <h3 className="text-lg font-bold text-slate-50 flex items-center gap-2">
            <User className="w-5 h-5 text-slate-400" />
            {isEditMode ? '编辑角色' : '新增角色'}
          </h3>
          <button
            onClick={handleClose}
            className="p-2 bg-slate-700 hover:bg-slate-800 rounded-full text-slate-500 hover:text-slate-50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 主内容区域 */}
        <div className="flex-1 overflow-y-auto p-2 md:p-6 space-y-5 bg-slate-700">
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-600/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* 角色名称 */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-slate-500 tracking-widest">
              角色名称 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-slate-800 border border-slate-600 text-slate-50 px-4 py-2 text-sm rounded-md focus:border-slate-500 focus:outline-none transition-all"
              placeholder="请输入角色名称"
              autoFocus
            />
          </div>

          {/* 性别 */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-slate-500 tracking-widest">性别</label>
            <CustomSelect
              options={[
                { value: '男', label: '男' },
                { value: '女', label: '女' },
                { value: '未知', label: '未知' }
              ]}
              value={formData.gender}
              onChange={(value) => setFormData({ ...formData, gender: value })}
            />
          </div>

          {/* 年龄 */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-slate-500 tracking-widest">年龄</label>
            <input
              type="text"
              value={formData.age}
              onChange={(e) => setFormData({ ...formData, age: e.target.value })}
              className="w-full bg-slate-800 border border-slate-600 text-slate-50 px-4 py-2 text-sm rounded-md focus:border-slate-500 focus:outline-none transition-all"
              placeholder="例如：25岁、中年"
            />
          </div>

          {/* 性格特点 */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-slate-500 tracking-widest">性格特点</label>
            <textarea
              value={formData.personality}
              onChange={(e) => setFormData({ ...formData, personality: e.target.value })}
              className="w-full bg-slate-800 border border-slate-600 text-slate-50 px-4 py-2 text-sm rounded-md focus:border-slate-500 focus:outline-none transition-all resize-none"
              rows={3}
              placeholder="请输入角色性格特点"
            />
          </div>

          {/* 视觉提示 */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-slate-500 tracking-widest">视觉提示</label>
            <div className="relative">
              <textarea
                value={formData.visualPrompt}
                onChange={(e) => setFormData({ ...formData, visualPrompt: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 text-slate-50 px-4 py-2 pb-12 text-sm rounded-md focus:border-slate-500 focus:outline-none transition-all resize-none"
                rows={4}
                placeholder="请输入视觉生成提示词"
              />
              {/* 底部覆盖层 */}
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-slate-800/65 backdrop-blur-sm border-t border-slate-600/50 rounded-b-md flex items-center justify-between">
                {/* 左边字数统计 */}
                <span className="text-[11px] text-slate-400 font-mono">
                  {formData.visualPrompt.length} 字
                </span>
                {/* 右边AI生成按钮 */}
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

export default CharacterAddModal;
