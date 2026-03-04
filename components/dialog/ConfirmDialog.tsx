import { AlertTriangle, Info, XCircle } from 'lucide-react';
import React from 'react';

interface ConfirmDialogProps {
  title?: string;
  message: string;
  type?: 'info' | 'warning' | 'error';
  confirmText?: string;
  cancelText?: string;
  onClose: () => void;
  onConfirm: () => void;
}

const typeConfig = {
  info: { icon: Info, bgColor: 'bg-blue-500/20', iconColor: 'text-blue-500' },
  warning: { icon: AlertTriangle, bgColor: 'bg-yellow-500/20', iconColor: 'text-yellow-500' },
  error: { icon: XCircle, bgColor: 'bg-red-500/20', iconColor: 'text-red-500' },
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  type = 'info',
  confirmText = '确定',
  cancelText = '取消',
  onClose,
  onConfirm,
}) => {
  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-slate-700/60 backdrop-blur-sm" />
      <div
        className="relative bg-slate-800 border border-slate-600/50 rounded-xl shadow-2xl max-w-md w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center">
          <div className={`p-3 rounded-full ${config.bgColor} mb-4`}>
            <Icon className={`w-8 h-8 ${config.iconColor}`} />
          </div>
          {title && <h3 className="text-lg font-semibold text-slate-50 mb-2">{title}</h3>}
          <p className="text-slate-300 mb-6">{message}</p>
          <div className="flex gap-3 w-full">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 bg-slate-600 hover:bg-slate-700 text-slate-50 font-medium rounded-lg transition-colors"
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
