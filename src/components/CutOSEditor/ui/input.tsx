import * as React from 'react';
import { cn } from '../../../lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'h-9 w-full min-w-0 rounded-md border border-slate-600 bg-slate-950 px-3 py-1 text-slate-100 shadow-sm outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50 focus:border-blue-500',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export { Input };
