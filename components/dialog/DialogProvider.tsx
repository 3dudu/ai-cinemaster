import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertDialog } from './AlertDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { ToastContainer, ToastItem, ToastOptions } from './Toast';

interface DialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}

interface DialogContextType {
  alert: (options: DialogOptions) => Promise<void>;
  confirm: (options: DialogOptions) => Promise<boolean>;
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
  type: 'alert' | 'confirm' | null;
  options: DialogOptions;
  resolve: ((value: boolean | void | PromiseLike<boolean>) => void) | null;
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

  const toast = useCallback((options: ToastOptions) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { ...options, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleClose = useCallback(() => {
    if (dialog.resolve) {
      dialog.resolve(dialog.type === 'confirm' ? false : undefined);
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
    <DialogContext.Provider value={{ alert, confirm, toast }}>
      {children}

      {dialog.type === 'alert' && (
        <AlertDialog
          {...dialog.options}
          onClose={handleClose}
        />
      )}

      {dialog.type === 'confirm' && (
        <ConfirmDialog
          title={dialog.options.title}
          message={dialog.options.message}
          type={dialog.options.type === 'success' ? 'info' : dialog.options.type}
          confirmText={dialog.options.confirmText}
          cancelText={dialog.options.cancelText}
          onClose={handleClose}
          onConfirm={handleConfirm}
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </DialogContext.Provider>
  );
};
