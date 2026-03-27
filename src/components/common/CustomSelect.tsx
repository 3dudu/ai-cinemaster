import { Check, ChevronDown } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

interface Option {
  value: string;
  label: string;
  suffix?: string;
  description?: string;
  disabled?: boolean;
}

interface Props {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  allowEmpty?: boolean;
  emptyLabel?: string;
  dropdownPosition?: 'auto' | 'bottom' | 'top';
}

const CustomSelect: React.FC<Props> = ({
  options,
  value,
  onChange,
  label,
  placeholder = '请选择',
  className = '',
  disabled = false,
  size = 'md',
  allowEmpty = false,
  emptyLabel = '默认',
  dropdownPosition = 'auto'
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [shouldDropUp, setShouldDropUp] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);

  const selectedOption = options.find(opt => opt.value === value);
  const emptyOption: Option = { value: '', label: emptyLabel };

  // 计算下拉菜单弹出方向
  useEffect(() => {
    if (showDropdown && dropdownPosition === 'auto' && buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const dropdownHeight = Math.min(options.length * 40, 240); // 估算下拉菜单高度

      // 计算下方剩余空间
      const spaceBelow = windowHeight - buttonRect.bottom;
      const spaceAbove = buttonRect.top;

      // 如果下方空间不足，且上方空间足够，则向上弹出
      setShouldDropUp(spaceBelow < dropdownHeight + 10 && spaceAbove > dropdownHeight + 10);
    }
    if(showDropdown){
    // 滚动到选中项
    setTimeout(() => {
      if (selectedItemRef.current) {
        selectedItemRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        });
      }
    }, 100);
    }
  }, [showDropdown, options.length, dropdownPosition]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {label}
        </label>
      )}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setShowDropdown(!showDropdown)}
        disabled={disabled}
        className={`w-full bg-slate-800 border border-slate-600 rounded-md text-left focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between ${
          size === 'sm' ? 'px-2 py-1 text-xs' : 'px-4 py-2 text-sm'
        }`}
      >
        <span className={`flex-1 truncate ${selectedOption ? 'text-slate-400' : 'text-slate-300'}`}>
          {selectedOption ? selectedOption.label : value ? value : placeholder}
        </span>
        {(dropdownPosition === 'top' || shouldDropUp) ? (
          <ChevronDown className={`ml-2 flex-shrink-0 ${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} rotate-180`} />
        ) : (
          <ChevronDown className={`ml-2 flex-shrink-0 ${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'}`} />
        )}
      </button>

      {showDropdown && !disabled && (
        <div className={`absolute z-50 w-full bg-slate-700 border border-slate-500 rounded-md shadow-lg max-h-60 overflow-auto ${
          (dropdownPosition === 'top' || shouldDropUp) ? 'bottom-full mb-1' : 'mt-1'
        }`}>
          {allowEmpty && (
            <button
              key="empty"
              type="button"
              onClick={() => {
                onChange('');
                setShowDropdown(false);
              }}
              className={`w-full text-left hover:bg-slate-600 flex items-center justify-between ${
                size === 'sm' ? 'px-2 py-1 text-xs' : 'px-4 py-2 text-sm'
              } ${
                value === ''
                  ? 'bg-slate-500/60 text-slate-300'
                  : 'ttext-slate-200'
              }`}
            >
              <span>{emptyLabel}</span>
              {value === '' && <Check className={`flex-shrink-0 ${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'}`} />}
            </button>
          )}
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              ref={option.value === value ? selectedItemRef : null}
              disabled={option.disabled}
              onClick={() => {
                if (option.disabled) return;
                onChange(option.value);
                setShowDropdown(false);
              }}
              className={`w-full text-left ${
                size === 'sm' ? 'px-2 py-1 text-xs' : 'px-4 py-2 text-sm'
              } ${
                option.disabled
                  ? 'opacity-50 cursor-not-allowed text-slate-500'
                  : 'hover:bg-slate-500/60 hover:text-slate-200 text-slate-200'
              } ${
                option.value === value && !option.disabled
                  ? 'bg-slate-600 text-slate-300'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex-1 min-w-0">
                  <div className="">{option.label}{option.suffix}</div>
                  {option.description && (
                    <div className="text-xs text-slate-300 mt-0.5">
                      {option.description}
                    </div>
                  )}
                </div>
                {option.value === value && <Check className={`flex-shrink-0 ${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'}`} />}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
