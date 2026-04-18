import React, { createContext, useCallback, useContext, useState } from 'react';
import { AlertDialog } from './AlertDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { PromptDialog } from './PromptDialog';
import { ToastContainer, ToastItem, ToastOptions } from './Toast';

interface DialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}

interface PromptOptions {
  title?: string;
  message: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
}

interface DialogContextType {
  alert: (options: DialogOptions) => Promise<void>;
  confirm: (options: DialogOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
  toast: (options: ToastOptions) => void;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within DialogProvider');
  }
  return context;
};

interface DialogState {
  type: 'alert' | 'confirm' | 'prompt' | null;
  options: DialogOptions | PromptOptions;
  resolve: ((value: boolean | void | string | null | PromiseLike<boolean | string | null>) => void) | null;
}

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<DialogState>({
    type: null,
    options: { message: '' },
    resolve: null,
  });
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const alert = useCallback((options: DialogOptions): Promise<void> => {
    return new Promise((resolve) => {
      setDialog({
        type: 'alert',
        options,
        resolve: () => resolve(),
      });
    });
  }, []);

  const confirm = useCallback((options: DialogOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setDialog({
        type: 'confirm',
        options,
        resolve,
      });
    });
  }, []);

  const prompt = useCallback((options: PromptOptions): Promise<string | null> => {
    return new Promise<string | null>((resolve) => {
      setDialog({
        type: 'prompt',
        options,
        resolve,
      });
    });
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { ...options, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleClose = useCallback(() => {
    if (dialog.resolve) {
      if (dialog.type === 'confirm') {
        dialog.resolve(false);
      } else if (dialog.type === 'prompt') {
        dialog.resolve(null);
      } else {
        dialog.resolve(undefined);
      }
    }
    setDialog({ type: null, options: { message: '' }, resolve: null });
  }, [dialog]);

  const handleCancle = useCallback(() => {
    if (dialog.resolve) {
      if (dialog.type === 'confirm') {
        dialog.resolve(null);
      } else if (dialog.type === 'prompt') {
        dialog.resolve(null);
      } else {
        dialog.resolve(undefined);
      }
    }
    setDialog({ type: null, options: { message: '' }, resolve: null });
  }, [dialog]);

  const handlePromptConfirm = useCallback((value: string) => {
    if (dialog.resolve) {
      dialog.resolve(value);
    }
    setDialog({ type: null, options: { message: '' }, resolve: null });
  }, [dialog]);

  const handleConfirm = useCallback(() => {
    if (dialog.resolve) {
      dialog.resolve(true);
    }
    setDialog({ type: null, options: { message: '' }, resolve: null });
  }, [dialog]);

  return (
    <DialogContext.Provider value={{ alert, confirm, prompt, toast }}>
      {children}

      {dialog.type === 'alert' && (
        <AlertDialog
          {...(dialog.options as DialogOptions)}
          onClose={handleClose}
        />
      )}

      {dialog.type === 'confirm' && (
        <ConfirmDialog
          title={(dialog.options as DialogOptions).title}
          message={dialog.options.message}
          type={((dialog.options as DialogOptions).type === 'success' ? 'info' : (dialog.options as DialogOptions).type) as 'info' | 'warning' | 'error'}
          confirmText={(dialog.options as DialogOptions).confirmText}
          cancelText={(dialog.options as DialogOptions).cancelText}
          onClose={handleClose}
          onConfirm={handleConfirm}
          onCancel={handleCancle}
        />
      )}

      {dialog.type === 'prompt' && (
        <PromptDialog
          title={(dialog.options as PromptOptions).title}
          message={dialog.options.message}
          defaultValue={(dialog.options as PromptOptions).defaultValue}
          confirmText={(dialog.options as PromptOptions).confirmText}
          cancelText={(dialog.options as PromptOptions).cancelText}
          onClose={handleClose}
          onConfirm={handlePromptConfirm}
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </DialogContext.Provider>
  );
};
