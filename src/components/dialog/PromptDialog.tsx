import { HelpCircle, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

interface PromptDialogProps {
  title?: string;
  message: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  onClose: () => void;
  onConfirm: (value: string) => void;
}

export const PromptDialog: React.FC<PromptDialogProps> = ({
  title,
  message,
  defaultValue = '',
  confirmText = '确定',
  cancelText = '取消',
  onClose,
  onConfirm,
}) => {
  const [inputValue, setInputValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onConfirm(inputValue);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-slate-700/60 backdrop-blur-sm" />
      <div
        className="relative bg-slate-700 border border-slate-600/50 rounded-xl shadow-2xl max-w-md w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 rounded-full bg-indigo-500/20">
              <HelpCircle className="w-6 h-6 text-indigo-400" />
            </div>
            <div className="flex-1">
              {title && <h3 className="text-lg font-semibold text-slate-50 mb-1">{title}</h3>}
              <p className="text-slate-300 text-sm">{message}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-600 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          <div className="mb-6">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-slate-50 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
              placeholder="请输入..."
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-600 text-slate-300 font-medium rounded-lg transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={() => onConfirm(inputValue)}
              className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
