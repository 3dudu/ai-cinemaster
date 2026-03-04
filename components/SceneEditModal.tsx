import { X } from 'lucide-react';
import React, { useState } from 'react';
import { Scene } from '../types';

interface StoryParagraph {
  id: number;
  text: string;
  sceneRefId: string;
}

interface Props {
  scene: Scene;
  storyParagraphs: StoryParagraph[];
  onSave: (updatedScene: Partial<Scene>, updatedStoryParagraphs: StoryParagraph[]) => void;
  onClose: () => void;
}

const SceneEditModal: React.FC<Props> = ({ scene, storyParagraphs, onSave, onClose }) => {
  const [tempScene, setTempScene] = useState<Partial<Scene>>({ ...scene });
  const [tempStoryParagraph, setTempStoryParagraph] = useState<string>(
    storyParagraphs.find(p => p.sceneRefId === scene.id)?.text || ''
  );

  const handleSave = () => {
    // 更新或创建 storyParagraph
    const updatedStoryParagraphs = [...storyParagraphs];
    const existingIndex = updatedStoryParagraphs.findIndex(p => p.sceneRefId === scene.id);

    if (tempStoryParagraph.trim()) {
      if (existingIndex >= 0) {
        // 更新现有的 storyParagraph
        updatedStoryParagraphs[existingIndex] = {
          ...updatedStoryParagraphs[existingIndex],
          text: tempStoryParagraph
        };
      } else {
        // 创建新的 storyParagraph
        updatedStoryParagraphs.push({
          id: Date.now(),
          text: tempStoryParagraph,
          sceneRefId: scene.id
        });
      }
    } else {
      // 如果文本为空，删除 storyParagraph
      if (existingIndex >= 0) {
        updatedStoryParagraphs.splice(existingIndex, 1);
      }
    }

    onSave(tempScene, updatedStoryParagraphs);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-700/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-600/80 border border-slate-600 rounded-2xl w-[600px] max-w-[90vw] max-h-[85vh] overflow-hidden shadow-2xl flex flex-col select-text">
        {/* 标题栏 */}
        <div className="h-16 px-6 border-b border-slate-600 flex items-center justify-between bg-slate-600/80 shrink-0">
          <h3 className="text-lg font-bold text-slate-50 flex items-center gap-2">
            <span className="w-5 h-5 text-slate-400">📍</span>
            编辑场景
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-full text-slate-500 hover:text-slate-50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 主内容区域 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-700">
          {/* Location */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-slate-500 uppercase tracking-widest">场景名称</label>
            <input
              type="text"
              value={tempScene.location || ''}
              onChange={(e) => setTempScene({ ...tempScene, location: e.target.value })}
              className="w-full bg-slate-800 border border-slate-600 text-slate-50 px-3 py-2.5 text-sm rounded-md focus:border-slate-600 focus:outline-none transition-all"
              placeholder="输入场景名称..."
            />
          </div>

          {/* Time */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-slate-500 uppercase tracking-widest">时间</label>
            <input
              type="text"
              value={tempScene.time || ''}
              onChange={(e) => setTempScene({ ...tempScene, time: e.target.value })}
              className="w-full bg-slate-800 border border-slate-600 text-slate-50 px-3 py-2.5 text-sm rounded-md focus:border-slate-600 focus:outline-none transition-all"
              placeholder="输入时间（如：日间、夜间、黄昏）..."
            />
          </div>

          {/* Atmosphere */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-slate-500 uppercase tracking-widest">氛围</label>
            <input
              type="text"
              value={tempScene.atmosphere || ''}
              onChange={(e) => setTempScene({ ...tempScene, atmosphere: e.target.value })}
              className="w-full bg-slate-800 border border-slate-600 text-slate-50 px-3 py-2.5 text-sm rounded-md focus:border-slate-600 focus:outline-none transition-all"
              placeholder="输入场景氛围..."
            />
          </div>

          {/* Story Paragraph Text */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-slate-500 uppercase tracking-widest">剧本段落</label>
            <textarea
              value={tempStoryParagraph}
              onChange={(e) => setTempStoryParagraph(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 text-slate-50 px-3 py-2.5 text-sm rounded-md focus:border-slate-600 focus:outline-none transition-all resize-none"
              rows={6}
              placeholder="输入该场景的剧本段落内容..."
            />
          </div>
        </div>

        {/* 按钮栏 */}
        <div className="p-6 bg-slate-600/80 border-t border-slate-600 flex gap-3 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-800 text-slate-300 hover:bg-slate-700 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3 bg-slate-600 text-slate-300 hover:bg-slate-800 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

export default SceneEditModal;
