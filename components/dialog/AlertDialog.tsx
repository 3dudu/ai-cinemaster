import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';
import React from 'react';

interface AlertDialogProps {
  title?: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  onClose: () => void;
}

const typeConfig = {
  info: { icon: Info, bgColor: 'bg-blue-500/20', iconColor: 'text-blue-500' },
  success: { icon: CheckCircle, bgColor: 'bg-green-500/20', iconColor: 'text-green-500' },
  warning: { icon: AlertTriangle, bgColor: 'bg-yellow-500/20', iconColor: 'text-yellow-500' },
  error: { icon: XCircle, bgColor: 'bg-red-500/20', iconColor: 'text-red-500' },
};

export const AlertDialog: React.FC<AlertDialogProps> = ({
  title,
  message,
  type = 'info',
  onClose,
}) => {
  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-slate-700/60 backdrop-blur-sm" />
      <div
        className="relative bg-slate-800 border border-slate-600/50 rounded-xl shadow-2xl max-w-md w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center overflow-y-auto">
          <div className={`p-3 rounded-full ${config.bgColor} mb-4`}>
            <Icon className={`w-8 h-8 ${config.iconColor}`} />
          </div>
          {title && <h3 className="text-lg font-semibold text-slate-50 mb-2">{title}</h3>}
          <p className="text-slate-300 mb-6 whitespace-wrap line-clamp-6 tracking-wide">{message}</p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-slate-600 hover:bg-slate-700 text-slate-50 font-medium rounded-lg transition-colors"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
};
