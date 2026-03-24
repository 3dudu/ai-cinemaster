import { AlertTriangle, CheckCircle, Info, X, XCircle } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

export interface ToastOptions {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
}

interface ToastProps extends ToastOptions {
  onClose: () => void;
}

const iconMap = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
};

const colorMap = {
  info: {
    bg: 'bg-blue-900/90',
    border: 'border-blue-500/50',
    icon: 'text-blue-400',
    progress: 'bg-blue-400',
  },
  success: {
    bg: 'bg-green-900/90',
    border: 'border-green-500/50',
    icon: 'text-green-400',
    progress: 'bg-green-400',
  },
  warning: {
    bg: 'bg-yellow-900/90',
    border: 'border-yellow-500/50',
    icon: 'text-yellow-400',
    progress: 'bg-yellow-400',
  },
  error: {
    bg: 'bg-red-900/90',
    border: 'border-red-500/50',
    icon: 'text-red-400',
    progress: 'bg-red-400',
  },
};

const positionMap = {
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
};

// Inject CSS keyframes for progress animation
if (typeof document !== 'undefined') {
  const styleId = 'toast-progress-animation';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes progress-shrink {
        from { transform: scaleX(1); }
        to { transform: scaleX(0); }
      }
    `;
    document.head.appendChild(style);
  }
}

interface ToastItemProps extends ToastOptions {
  onClose: () => void;
  index: number;
}

const ToastItemComponent: React.FC<ToastItemProps> = ({
  message,
  type = 'info',
  duration = 3000,
  onClose,
  index,
}) => {
  const [isExiting, setIsExiting] = useState(false);
  const Icon = iconMap[type];
  const colors = colorMap[type];

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onCloseRef.current(), 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  return (
    <div
      className={`transition-all duration-300 ${
        isExiting ? 'opacity-0 translate-y-[-20px]' : 'opacity-100 translate-y-0'
      }`}
      style={{ marginTop: index > 0 ? '12px' : '0' }}
    >
      <div
        className={`${colors.bg} backdrop-blur-sm border ${colors.border} rounded-lg shadow-lg min-w-[300px] max-w-[400px] overflow-hidden`}
      >
        <div className="flex items-start gap-3 p-4">
          <Icon className={`w-5 h-5 ${colors.icon} flex-shrink-0 mt-0.5`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-100 leading-relaxed">{message}</p>
          </div>
          <button
            onClick={handleClose}
            className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        {/* Progress bar - CSS animation for smooth performance */}
        <div className="h-1 bg-slate-700/50">
          <div
            className={`h-full ${colors.progress} origin-left`}
            style={{
              animationName: 'progress-shrink',
              animationDuration: `${duration}ms`,
              animationTimingFunction: 'linear',
              animationFillMode: 'forwards',
            }}
          />
        </div>
      </div>
    </div>
  );
};

// Legacy single Toast component for backward compatibility
export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 3000,
  position = 'top-right',
  onClose,
}) => {
  return (
    <div className={`fixed z-[9999] ${positionMap[position]}`}>
      <ToastItemComponent
        message={message}
        type={type}
        duration={duration}
        onClose={onClose}
        index={0}
      />
    </div>
  );
};

// Toast container for managing multiple toasts
export interface ToastItem extends ToastOptions {
  id: string;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
}

const containerPositionMap = {
  'top-left': 'top-4 left-4',
  'top-right': 'top-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
};

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  // Group toasts by position
  const groupedToasts = toasts.reduce((acc, toast) => {
    const pos = toast.position || 'top-center';
    if (!acc[pos]) acc[pos] = [];
    acc[pos].push(toast);
    return acc;
  }, {} as Record<string, ToastItem[]>);

  return (
    <>
      {Object.entries(groupedToasts).map(([position, positionToasts]) => (
        <div
          key={position}
          className={`fixed z-[9999] ${containerPositionMap[position as keyof typeof containerPositionMap]} flex flex-col`}
          style={{
            alignItems: position.includes('center')
              ? 'center'
              : position.includes('right')
              ? 'flex-end'
              : 'flex-start',
          }}
        >
          {positionToasts.map((toast, index) => (
            <ToastItemComponent
              key={toast.id}
              message={toast.message}
              type={toast.type}
              duration={toast.duration}
              onClose={() => onRemove(toast.id)}
              index={index}
            />
          ))}
        </div>
      ))}
    </>
  );
};
