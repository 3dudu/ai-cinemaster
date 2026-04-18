/**
 * LLM Chat View - 可复用的聊天主体组件
 * 支持 Modal 和 Stage 两种使用场景
 */

import { Bot, Check, ChevronDown, Copy, Loader2, MessageSquare, Plus, Send, Square, User, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import { ChatAgent, getChatAgents, getDefaultAgent } from '../../services/chatAgentService';
import {
  buildApiMessages,
  ChatMessage,
  getLLMConfigs,
  isTokenLimitError,
  streamChat,
  trimMessages,
} from '../../services/llmChatService';
import { AIModelConfig } from '../../types';
import CustomSelect from './CustomSelect';

interface ChatMessageUI {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface LLMChatViewProps {
  isMobile?: boolean;
  onClose?: () => void;
  showCloseButton?: boolean;
}

const LLMChatView: React.FC<LLMChatViewProps> = ({
  isMobile = false,
  onClose,
  showCloseButton = false,
}) => {
  const [messages, setMessages] = useState<ChatMessageUI[]>([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [llmConfigs, setLLMConfigs] = useState<AIModelConfig[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Agent 相关状态
  const [agents, setAgents] = useState<ChatAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const agentDropdownRef = useRef<HTMLDivElement>(null);

  // 加载 LLM 模型配置
  useEffect(() => {
    getLLMConfigs().then(configs => {
      setLLMConfigs(configs);
      if (configs.length > 0 && !selectedModelId) {
        setSelectedModelId(configs[0].id);
      }
    });
  }, [selectedModelId]);

  // 加载 Agent 配置
  useEffect(() => {
    const loadedAgents = getChatAgents();
    setAgents(loadedAgents);
    if (loadedAgents.length > 0 && !selectedAgentId) {
      const defaultAgent = getDefaultAgent();
      setSelectedAgentId(defaultAgent.id);
    }
  }, [selectedAgentId]);

  // 点击外部关闭 Agent 下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (agentDropdownRef.current && !agentDropdownRef.current.contains(event.target as Node)) {
        setShowAgentDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 聚焦输入框
  useEffect(() => {
    if (!isStreaming) {
      inputRef.current?.focus();
    }
  }, [isStreaming]);

  // 获取当前选中的模型配置
  const getSelectedConfig = useCallback(() => {
    return llmConfigs.find(c => c.id === selectedModelId);
  }, [llmConfigs, selectedModelId]);

  // 获取当前选中的 Agent
  const getSelectedAgent = useCallback(() => {
    return agents.find(a => a.id === selectedAgentId) || getDefaultAgent();
  }, [agents, selectedAgentId]);

  // 生成唯一 ID
  const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  // 发送消息
  const handleSend = async () => {
    if (!inputText.trim() || isStreaming) return;

    const config = getSelectedConfig();
    if (!config) {
      setError('请先选择一个模型');
      return;
    }

    const userMessage: ChatMessageUI = {
      id: generateId(),
      role: 'user',
      content: inputText.trim(),
      timestamp: Date.now(),
    };

    const assistantMessage: ChatMessageUI = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };

    // 添加用户消息
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsStreaming(true);
    setError(null);

    // 添加空的 assistant 消息（用于 streaming 填充）
    setMessages(prev => [...prev, assistantMessage]);

    // 构建 API 请求
    const history: ChatMessage[] = [...messages, userMessage].map(m => ({
      role: m.role,
      content: m.content,
    }));

    const selectedAgent = getSelectedAgent();
    let apiMessages = buildApiMessages(history, selectedAgent.systemPrompt);
    let retryCount = 0;
    const maxRetries = 2;

    const doStream = async (messagesToSend: ChatMessage[]): Promise<void> => {
      abortControllerRef.current = new AbortController();

      let fullContent = '';

      await streamChat(
        config,
        messagesToSend,
        {
          onChunk: (text) => {
            fullContent += text;
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantMessage.id
                  ? { ...m, content: fullContent }
                  : m
              )
            );
          },
          onDone: () => {
            setIsStreaming(false);
            abortControllerRef.current = null;
          },
          onError: (err) => {
            // 检查是否是 token 超限错误
            if (isTokenLimitError(err) && retryCount < maxRetries) {
              retryCount++;
              // 截断消息后重试
              const trimmed = trimMessages(messagesToSend);
              if (trimmed.length < messagesToSend.length) {
                doStream(trimmed);
                return;
              }
            }

            setMessages(prev =>
              prev.map(m =>
                m.id === assistantMessage.id
                  ? { ...m, content: `错误: ${err.message}` }
                  : m
              )
            );
            setIsStreaming(false);
            abortControllerRef.current = null;
          },
        },
        abortControllerRef.current.signal
      );
    };

    doStream(apiMessages);
  };

  // 停止生成
  const handleStop = () => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  };

  // 新建对话 - 自动发送 system 消息给大模型
  const handleNewChat = async () => {
    // 如果正在流式输出，先停止
    if (isStreaming) {
      abortControllerRef.current?.abort();
      setIsStreaming(false);
    }

    setMessages([]);
    setInputText('');
    setError(null);

    const config = getSelectedConfig();
    if (!config) {
      inputRef.current?.focus();
      return;
    }

    const selectedAgent = getSelectedAgent();

    // 构建开场白请求：只有 system prompt，没有 user 消息
    const apiMessages = buildApiMessages([], selectedAgent.systemPrompt);

    const welcomeMessage: ChatMessageUI = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };

    setIsStreaming(true);
    setMessages([welcomeMessage]);

    abortControllerRef.current = new AbortController();
    let fullContent = '';

    await streamChat(
      config,
      apiMessages,
      {
        onChunk: (text) => {
          fullContent += text;
          setMessages(prev =>
            prev.map(m =>
              m.id === welcomeMessage.id
                ? { ...m, content: fullContent }
                : m
            )
          );
        },
        onDone: () => {
          setIsStreaming(false);
          abortControllerRef.current = null;
          inputRef.current?.focus();
        },
        onError: () => {
          // 开场白失败时静默处理，不阻塞用户
          setMessages([]);
          setIsStreaming(false);
          abortControllerRef.current = null;
          inputRef.current?.focus();
        },
      },
      abortControllerRef.current.signal
    );
  };

  // 键盘事件处理
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-hidden">
      {/* Header */}
        <div className="h-14 md:px-4 px-2 border-b border-slate-600 flex items-center justify-between bg-slate-600/80">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-slate-700 text-slate-50 flex items-center justify-center rounded-lg">
            <MessageSquare className="w-4 h-4" />
          </div>
          <h2 className="text-base font-bold text-slate-50 tracking-wide">AI 对话</h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Agent 选择器 */}
          <div className="relative" ref={agentDropdownRef}>
            <button
              onClick={() => setShowAgentDropdown(!showAgentDropdown)}
              disabled={isStreaming}
              className="flex items-center gap-1.5 bg-slate-700 border border-slate-600 text-slate-50 text-sm px-2 py-1.5 rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50"
            >
              <span>{getSelectedAgent().emoji}</span>
              <span className="max-w-[80px] truncate">{getSelectedAgent().name}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {showAgentDropdown && (
              <div className="absolute top-full right-0 mt-1 w-56 bg-slate-700 border border-slate-600 rounded-lg shadow-xl z-10 max-h-80 overflow-y-auto">
                {agents.map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => {
                      // 如果切换到同一个 Agent，不做处理
                      if (agent.id === selectedAgentId) {
                        setShowAgentDropdown(false);
                        return;
                      }
                      
                      setSelectedAgentId(agent.id);
                      setShowAgentDropdown(false);
                      
                      // 如果没有历史消息，自动发送开场白
                      if (messages.length === 0) {
                        // 复用 handleNewChat 中的开场白逻辑
                        handleNewChat();
                      }
                    }}
                    className={`w-full px-3 py-2 text-left hover:bg-slate-600 transition-colors flex items-start gap-2 ${
                      selectedAgentId === agent.id ? 'bg-slate-600/50' : ''
                    }`}
                  >
                    <span className="text-base">{agent.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-50 font-medium">{agent.name}</div>
                      <div className="text-sm text-slate-400 truncate">{agent.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 新建对话 */}
          <button
            onClick={handleNewChat}
            disabled={messages.length === 0}
            className="p-1.5 text-slate-400 hover:text-slate-50 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="新建对话"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* 关闭按钮 - 仅 Modal 场景显示 */}
          {showCloseButton && onClose && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 bg-slate-700 hover:text-slate-100 hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <p className="text-sm">开始与 AI 对话</p>
            <p className="text-sm mt-1 text-slate-600">输入问题，按 Enter 发送</p>
          </div>
        ) : (
          messages.map(message => (
            <div
              key={message.id}
              className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {/* AI 助手头像 */}
              {message.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3.5 h-3.5 text-slate-300" />
                </div>
              )}

              {/* 消息气泡 */}
              <div
                className={`max-w-[80%] rounded-xl px-3 py-2 ${
                  message.role === 'user'
                    ? 'bg-slate-600 text-slate-50'
                    : 'bg-slate-700/50 text-slate-200'
                }`}
              >
                {message.role === 'assistant' ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkBreaks]}
                      components={{
                        pre: ({ children, ...props }) => {
                          const [copied, setCopied] = useState(false);
                          const preRef = useRef<HTMLPreElement>(null);
                          const handleCopy = () => {
                            const text = preRef.current?.innerText ?? '';
                            navigator.clipboard.writeText(text);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          };
                          return (
                            <div className="relative group">
                              <pre ref={preRef} className="bg-slate-900 rounded-lg p-2 pr-8 overflow-x-auto text-sm mb-2" {...props}>
                                {children}
                              </pre>
                              <button
                                onClick={handleCopy}
                                className="absolute bottom-1.5 right-1.5 p-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                title="复制代码"
                              >
                                {copied ? <Check size={12} /> : <Copy size={12} />}
                              </button>
                            </div>
                          );
                        },
                        code: ({ className, children, ...props }) => {
                          const isInline = !className;
                          return isInline ? (
                            <code className="bg-slate-900/50 px-1 py-0.5 rounded text-sm" {...props}>
                              {children}
                            </code>
                          ) : (
                            <code className={className} {...props}>
                              {children}
                            </code>
                          );
                        },
                        p: ({ children }) => <p className="mb-1.5 last:mb-0 text-sm">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc pl-3 mb-1.5 text-sm">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-3 mb-1.5 text-sm">{children}</ol>,
                        h1: ({ children }) => <h1 className="text-sm font-bold mb-1.5">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-sm font-bold mb-1">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-[11px] font-bold mb-1">{children}</h3>,
                      }}
                    >
                      {message.content || (isStreaming && message.id === messages[messages.length - 1]?.id ? '...' : '')}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap select-text">{message.content}</p>
                )}
              </div>

              {/* 用户头像 */}
              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-slate-500 flex items-center justify-center flex-shrink-0">
                  <User className="w-3.5 h-3.5 text-slate-200" />
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Message */}
      {error && (
        <div className="md:px-4 px-2 py-1.5 bg-red-900/20 border-t border-red-900/30">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Input Area */}
      <div className="md:px-4 px-2 py-3 border-t border-slate-700 bg-slate-600/80">
        <div className="flex items-center justify-between mb-1.5 text-sm text-slate-500">
          {/* 模型选择 */}
          <CustomSelect
            options={llmConfigs.map(config => ({
              value: config.id,
              label: config.provider || config.model,
            }))}
            value={selectedModelId}
            onChange={setSelectedModelId}
            disabled={isStreaming}
            placeholder="暂无可用模型"
            dropdownPosition="top"
            size="sm"
          />
          <span>Enter 发送 · Shift+Enter 换行</span>
          {isStreaming && (
            <span className="flex items-center gap-1 text-slate-400">
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
              正在生成...
            </span>
          )}
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息..."
              disabled={isStreaming || llmConfigs.length === 0}
              rows={1}
              className="w-full bg-slate-700 border border-slate-600 text-slate-50 px-3 py-2.5 pr-10 text-sm rounded-xl focus:outline-none focus:border-slate-500 resize-none disabled:opacity-50 placeholder:text-slate-500"
              style={{
                minHeight: '40px',
                maxHeight: '100px',
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 100) + 'px';
              }}
            />
          </div>
          {/* 发送/停止按钮 */}
          {isStreaming ? (
            <button
              onClick={handleStop}
              className="p-2.5 mb-2 bg-red-600 hover:bg-red-700 text-slate-50 rounded-xl transition-colors"
              title="停止生成"
            >
              <Square className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || llmConfigs.length === 0}
              className="p-2.5 mb-2 bg-slate-600 hover:bg-slate-500 text-slate-50 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="发送"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LLMChatView;
