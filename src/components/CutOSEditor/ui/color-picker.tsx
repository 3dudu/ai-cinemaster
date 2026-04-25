import { Eye } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}

export function ColorPicker({ value, onChange, disabled }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center gap-2 rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <div
          className="h-5 w-5 rounded border border-slate-600"
          style={{ backgroundColor: value }}
        />
        <span className="text-slate-500">{value.toUpperCase()}</span>
        <Eye className="h-3.5 w-3.5 text-slate-500" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-slate-600 bg-slate-900 p-4 shadow-xl">
          <div className="space-y-3">
            <div className="flex gap-3">
              <div
                className="h-16 w-16 shrink-0 rounded border-2 border-slate-600"
                style={{ backgroundColor: value }}
              />
              <div className="flex-1">
                <p className="mb-1 text-xs font-medium text-slate-100">颜色</p>
                <input
                  type="text"
                  value={value || '#00FF00'}
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    if (val === '' || /^#?[0-9A-Fa-f]{0,6}$/i.test(val)) {
                      onChange(val.startsWith('#') ? val : val ? `#${val}` : '#');
                    }
                  }}
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (!val || !/^#?[0-9A-Fa-f]{6}$/i.test(val)) {
                      onChange(value || '#00FF00');
                    }
                  }}
                  className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="#00FF00"
                  disabled={disabled}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">选择颜色:</label>
              <input
                type="color"
                value={value || '#00FF00'}
                onChange={(e) => e.target.value && onChange(e.target.value)}
                className="h-10 w-full cursor-pointer rounded border border-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={disabled}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
