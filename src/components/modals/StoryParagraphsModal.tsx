import { BookOpen, Plus, Trash, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface StoryParagraph {
  id: number;
  text: string;
  sceneRefId: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (paragraphs: StoryParagraph[]) => void;
  paragraphs: StoryParagraph[];
  sceneId: string;
}

const StoryParagraphsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSave,
  paragraphs,
  sceneId
}) => {
  const [tempParagraphs, setTempParagraphs] = useState<StoryParagraph[]>([]);

  useEffect(() => {
    // Filter paragraphs for current scene and sort by id
    const sceneParagraphs = paragraphs
      .filter(p => String(p.sceneRefId) === String(sceneId))
      .sort((a, b) => a.id - b.id);
    setTempParagraphs(sceneParagraphs);
  }, [paragraphs, sceneId, isOpen]);

  const addParagraph = () => {
    const newId = tempParagraphs.length > 0
      ? Math.max(...tempParagraphs.map(p => p.id)) + 1
      : 1;
    const newParagraph: StoryParagraph = {
      id: newId,
      text: '',
      sceneRefId: sceneId
    };
    setTempParagraphs([...tempParagraphs, newParagraph]);
  };

  const updateParagraph = (index: number, text: string) => {
    const updated = [...tempParagraphs];
    updated[index] = { ...updated[index], text };
    setTempParagraphs(updated);
  };

  const deleteParagraph = (index: number) => {
    const updated = tempParagraphs.filter((_, i) => i !== index);
    setTempParagraphs(updated);
  };

  const handleSave = () => {
    // Filter out empty paragraphs
    const validParagraphs = tempParagraphs.filter(p => p.text.trim() !== '');
    onSave(validParagraphs);
  };

  const handleClose = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-700/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="bg-slate-800 border border-slate-600 rounded-2xl w-[700px] max-w-[90vw] h-[80vh] overflow-hidden shadow-2xl flex flex-col select-text">
        {/* Header */}
        <div className="h-16 px-6 border-b border-slate-600 flex items-center justify-between bg-slate-600/80">
          <h3 className="text-lg font-bold text-slate-50 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-slate-400" />
            故事段落
          </h3>
          <button
            onClick={handleClose}
            className="p-2 bg-slate-700 hover:bg-slate-800 rounded-full text-slate-500 hover:text-slate-50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-2 md:p-6 space-y-4 bg-slate-700">
          {/* Paragraphs List */}
          <div className="space-y-3">
            {tempParagraphs.map((paragraph, index) => (
              <div
                key={paragraph.id}
                className="bg-slate-800 border border-slate-600 rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 tracking-widest">
                    段落 #{index + 1}
                  </span>
                  <button
                    onClick={() => deleteParagraph(index)}
                    className="p-1.5 hover:bg-red-900/20 text-slate-600 hover:text-red-400 rounded transition-colors cursor-pointer"
                    title="删除段落"
                  >
                    <Trash className="w-3.5 h-3.5" />
                  </button>
                </div>
                <textarea
                  value={paragraph.text}
                  onChange={(e) => updateParagraph(index, e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 text-slate-50 px-4 py-3 text-sm rounded-md focus:border-slate-500 focus:outline-none transition-all resize-none"
                  rows={4}
                  placeholder="输入故事段落内容..."
                />
              </div>
            ))}

            {tempParagraphs.length === 0 && (
              <div className="text-center py-12 border border-dashed border-slate-600 rounded-lg">
                <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-500">暂无故事段落</p>
                <p className="text-xs text-slate-600 mt-1">点击下方按钮添加</p>
              </div>
            )}
          </div>

          {/* Add Button */}
          <button
            onClick={addParagraph}
            className="w-full py-3 text-xs font-bold text-slate-400 hover:text-slate-50 bg-slate-900 border border-slate-600 rounded-lg hover:border-slate-300 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            添加段落
          </button>
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-600/80 border-t border-slate-600 flex gap-3 shrink-0">
          <button
            onClick={handleClose}
            className="flex-1 py-3 bg-slate-600 text-slate-300 hover:bg-slate-800 text-[11px] font-bold tracking-wider rounded-lg transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3 bg-slate-800 text-slate-300 hover:bg-slate-700 text-[11px] font-bold tracking-wider rounded-lg transition-colors cursor-pointer"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

export default StoryParagraphsModal;
