/**
 * Stage Chat - 移动端全屏聊天 Stage
 * 作为移动端底部导航的一个 Stage 页面
 */

import React from 'react';
import LLMChatView from './LLMChatView';

interface StageChatProps {
  isMobile?: boolean;
}

const StageChat: React.FC<StageChatProps> = ({ isMobile = true }) => {
  return (
      <LLMChatView isMobile={isMobile} showCloseButton={false} />
  );
};

export default StageChat;
