import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertDialog } from './AlertDialog';
import { ConfirmDialog } from './ConfirmDialog';

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
    <DialogContext.Provider value={{ alert, confirm }}>
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
    </DialogContext.Provider>
  );
};
