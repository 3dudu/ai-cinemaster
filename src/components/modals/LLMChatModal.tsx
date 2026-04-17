/**
 * LLM Chat Modal - 桌面端 Modal 式聊天界面
 * 薄壳包装 LLMChatView，用于桌面端 Sidebar
 */

import React from 'react';
import LLMChatView from '../LLMChatView';

interface LLMChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LLMChatModal: React.FC<LLMChatModalProps> = ({ isOpen, onClose }) => {
  return (
    <div className={`fixed inset-y-0 left-0 z-60 w-[72vw] max-w-[480px] select-text transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      {/* 侧边栏容器 */}
      <div className="w-full h-full bg-slate-800 border-r border-slate-600 shadow-2xl overflow-hidden select-text">
        <LLMChatView isMobile={false} onClose={onClose} showCloseButton={true} />
      </div>
    </div>
  );
};

export default LLMChatModal;
