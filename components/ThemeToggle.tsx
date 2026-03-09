import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type Theme } from '../hooks/useTheme';

interface ThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ThemeToggle({ className = '', size = 'md' }: ThemeToggleProps) {
  const { theme, setTheme, actualTheme } = useTheme();
  
  const sizeClasses = {
    sm: 'w-8 h-8 p-1.5',
    md: 'w-10 h-10 p-2',
    lg: 'w-12 h-12 p-2.5'
  };

  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className={iconSizeClasses[size]} />;
      case 'dark':
        return <Moon className={iconSizeClasses[size]} />;
      case 'system':
        return <Monitor className={iconSizeClasses[size]} />;
      default:
        return <Moon className={iconSizeClasses[size]} />;
    }
  };

  const getTooltipText = () => {
    switch (theme) {
      case 'light':
        return '切换为深色主题';
      case 'dark':
        return '切换为跟随系统';
      case 'system':
        return `当前: ${actualTheme === 'light' ? '浅色' : '深色'}主题 (跟随系统)`;
      default:
        return '切换主题';
    }
  };

  const handleToggle = () => {
    const nextThemes: Record<Theme, Theme> = {
      'dark': 'light',
      'light': 'system',
      'system': 'dark'
    };
    setTheme(nextThemes[theme]);
  };

  // 等待客户端hydration完成再渲染
  if (typeof window === 'undefined') {
    return (
      <div className={`bg-bg-button rounded-full ${sizeClasses[size]} flex items-center justify-center text-slate-400 ${className}`}>
        <Moon className={iconSizeClasses[size]} />
      </div>
    );
  }

  return (
    <button
      onClick={handleToggle}
      className={`
        bg-bg-button rounded-lg cursor-pointer
        hover:bg-bg-selected hover:border-slate-300
        transition-all duration-200 ease-in-out
        flex items-center justify-center text-text-secondary
        hover:bg-slate-900/30
        hover:text-slate-50 ${sizeClasses[size]} ${className}
      `}
      title={getTooltipText()}
      aria-label={`当前主题: ${theme === 'light' ? '浅色' : theme === 'dark' ? '深色' : '跟随系统'}，点击切换`}
    >
      {getThemeIcon()}
    </button>
  );
}