import { Copy, Search, X } from 'lucide-react';
import React from 'react';
import { useDialog } from './dialog';

interface PromptDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  prompt: string;
  timestamp?: number;
}

const PromptDetailModal: React.FC<PromptDetailModalProps> = ({
  isOpen,
  onClose,
  title,
  prompt,
  timestamp
}) => {
  const dialog = useDialog();

  // 格式化时间戳
  const formatTimestamp = (ts: number) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      await dialog.alert({
        title: '成功',
        message: '提示词已复制到剪贴板',
        type: 'success'
      });
    } catch (error) {
      console.error('Failed to copy prompt:', error);
      await dialog.alert({
        title: '错误',
        message: '复制失败，请手动复制',
        type: 'error'
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-700/95 flex items-center justify-center backdrop-blur-sm select-text"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl overflow-hidden w-full max-w-2xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="h-16 px-6 border-b border-slate-600 flex items-center justify-between bg-slate-600/80">
          <h3 className="text-lg font-bold text-slate-50 flex items-center gap-2">
            <Search className="w-5 h-5 text-slate-400" />
            提示词详情
          </h3>
          <button
            onClick={onClose}
            className="p-2 bg-slate-700 hover:bg-slate-800 rounded-full text-slate-500 hover:text-slate-50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="p-6 space-y-4">
          {/* 图片标题 */}
          <div>
            <h4 className="text-sm font-bold text-slate-50 uppercase tracking-widest mb-2">图片标题</h4>
            <p className="text-sm text-slate-300 bg-slate-900/50 rounded-lg p-3 border border-slate-700">
              {title}
            </p>
          </div>

          {/* 时间戳 */}
          {timestamp && (
            <div>
              <h4 className="text-sm font-bold text-slate-50 uppercase tracking-widest mb-2">生成时间</h4>
              <p className="text-sm text-slate-300 bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                {formatTimestamp(timestamp)}
              </p>
            </div>
          )}

          {/* 提示词内容 */}
          <div>
            <h4 className="text-sm font-bold text-slate-50 uppercase tracking-widest mb-2">提示词内容</h4>
            <textarea
              readOnly
              value={prompt}
              className="w-full h-48 bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-sm text-slate-300 resize-none focus:outline-none focus:border-slate-500"
            />
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="px-6 py-4 border-t border-slate-600 bg-slate-600/80 flex justify-end gap-3">
          <button
            onClick={onClose}
                    className="px-4 py-2 bg-slate-700 text-slate-300 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium cursor-pointer"
          >
            关闭
          </button>
          <button
            onClick={handleCopyPrompt}
                  className="px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium cursor-pointer"
          >
            <Copy className="w-4 h-4" />
            复制提示词
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromptDetailModal;
