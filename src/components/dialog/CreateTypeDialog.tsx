import { Film, Plus, Video } from 'lucide-react';
import React from 'react';

interface CreateTypeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStandalone: () => void;
  onSelectSeries: () => void;
}

const CreateTypeDialog: React.FC<CreateTypeDialogProps> = ({
  isOpen,
  onClose,
  onSelectStandalone,
  onSelectSeries,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-slate-700/60 backdrop-blur-sm" />
      <div
        className="relative bg-slate-700 border border-slate-600/50 rounded-xl shadow-2xl max-w-lg w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-6">
          <div className="p-3 rounded-full bg-indigo-600/20 mb-4 mx-auto w-fit">
            <Plus className="w-8 h-8 text-indigo-400" />
          </div>
          <h3 className="text-xl font-semibold text-slate-50 mb-2">选择创建类型</h3>
          <p className="text-slate-300 text-sm">请选择要创建的项目类型</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* 单剧选项 */}
          <button
            onClick={onSelectStandalone}
            className="group p-6 bg-slate-800/50 hover:bg-slate-600 border border-slate-600 hover:border-slate-500 rounded-xl transition-all cursor-pointer"
          >
            <div className="flex flex-col items-center text-center gap-3">
              <div className="p-3 rounded-full bg-slate-700 group-hover:bg-slate-600 transition-colors">
                <Video className="w-6 h-6 text-slate-400 group-hover:text-slate-300" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-50 mb-1">单剧</h4>
                <p className="text-xs text-slate-400">独立的短片项目</p>
              </div>
            </div>
          </button>

          {/* 连续剧选项 - 默认推荐 */}
          <button
            onClick={onSelectSeries}
            className="group p-6 bg-indigo-950/50 hover:bg-indigo-900/70 border border-indigo-600/50 hover:border-indigo-500 rounded-xl transition-all cursor-pointer relative"
          >
            <div className="absolute -top-2 -right-2">
              <span className="px-2 py-0.5 bg-indigo-600 text-[10px] font-bold text-slate-50 rounded-full uppercase tracking-wider">
                推荐
              </span>
            </div>
            <div className="flex flex-col items-center text-center gap-3">
              <div className="p-3 rounded-full bg-indigo-900/50 group-hover:bg-indigo-800 transition-colors">
                <Film className="w-6 h-6 text-indigo-400 group-hover:text-indigo-300" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-indigo-200 mb-1">连续剧</h4>
                <p className="text-xs text-indigo-300/70">多集系列作品</p>
              </div>
            </div>
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-600 text-slate-300 hover:text-slate-50 font-medium rounded-lg transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  );
};

export default CreateTypeDialog;
