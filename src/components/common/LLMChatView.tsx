/**
 * LLM Chat View - 可复用的聊天主体组件
 * 支持 Modal 和 Stage 两种使用场景
 */

import { Bot, Check, ChevronDown, Copy, Download, Film, Loader2, MessageSquare, Paperclip, Plus, Send, Square, Upload, User, Video, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import { ChatAgent, getChatAgents, getDefaultAgent } from '../../services/chatAgentService';
import {
  buildApiMessages,
  ChatMessage,
  createVideoMessage,
  getLLMConfigs,
  isTokenLimitError,
  streamLLMChat,
  trimMessages
} from '../../services/llmChatService';
import { AIModelConfig } from '../../types';
import { uploadLocalVideoFile } from '../../utils/fileUploadUtils';
import CustomSelect from './CustomSelect';

/**
 * 多模态消息内容
 */
export interface MultimodalContent {
  fileId?: string;
  fileName?: string;
  text?: string;
}

/**
 * 消息类型：
 * - text: 普通文本消息
 * - video: 视频消息（下载上传流程）
 * - localVideo: 本地视频（已上传到服务器）
 */
type MessageType = 'text' | 'video' | 'localVideo';

/**
 * 本地上传的本地视频信息
 */
interface LocalVideoInfo {
  fileUrl: string;
  fileName: string;
  fileSize: number;
}

interface ChatMessageUI {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  type: MessageType;
  multimodal?: MultimodalContent; // 多模态附加信息
  localVideo?: LocalVideoInfo; // 本地视频信息
}

/**
 * 抖音视频分析结果
 */
interface DouyinProcessResult {
  fileId: string;
  fileName: string;
  fileSize: number;
}

/**
 * 检测消息是否包含抖音视频分析请求
 * 需要同时包含：抖音 URL + "分析视频"关键词
 */
function detectDouyinVideoRequest(text: string): { url: string; prompt: string } | null {
  // 抖音 URL 正则
  const douyinUrlPattern = /https?:\/\/v\.douyin\.com\/[a-zA-Z0-9]+/;

  // 分析视频关键词
  const analyzePattern = /分析(?:这个)?视频/i;

  // 匹配抖音 URL
  const urlMatch = text.match(douyinUrlPattern);
  if (!urlMatch) return null;

  const url = urlMatch[0];

  // 检查是否包含分析关键词
  if (!analyzePattern.test(text)) return null;

  // 提取用户附加的提示词（去掉 URL 和分析关键词后的内容）
  let prompt = text
    .replace(douyinUrlPattern, '')
    .replace(analyzePattern, '')
    .trim();

  // 如果没有附加提示词，使用默认提示词
  if (!prompt) {
    prompt = '请分析这个视频的内容、主题和亮点';
  }

  return { url, prompt };
}

/**
 * 检测是否请求分析已上传的本地视频
 * 当消息只包含"分析这个视频"且没有其他视频URL时触发
 * @param text - 用户输入文本
 * @param hasLocalVideo - 是否存在已上传的本地视频
 */
function detectLocalVideoAnalysisRequest(text: string, hasLocalVideo: boolean): { prompt: string } | null {
  if (!hasLocalVideo) return null;

  // 只分析"分析这个视频"关键词，不包含其他URL
  const douyinUrlPattern = /https?:\/\/v\.douyin\.com\/[a-zA-Z0-9]+/;

  // 如果包含抖音URL，跳过（走抖音流程）
  if (douyinUrlPattern.test(text)) return null;

  // 分析视频关键词
  const analyzePattern = /分析(?:这个)?视频/i;
  if (!analyzePattern.test(text)) return null;

  // 提取用户附加的提示词
  let prompt = text
    .replace(analyzePattern, '')
    .trim();

  // 如果没有附加提示词，使用默认提示词
  if (!prompt) {
    prompt = '请分析这个视频的内容、主题和亮点';
  }

  return { prompt };
}

/**
 * 从历史消息中查找可复用的 fileId
 * 查找最近一条包含 fileId 的多模态消息
 */
function findReusableFileId(messages: ChatMessageUI[]): { fileId: string; fileName?: string } | null {
  // 从后往前找最近的一条包含 fileId 的消息
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.multimodal?.fileId) {
      return {
        fileId: msg.multimodal.fileId,
        fileName: msg.multimodal.fileName,
      };
    }
    if (msg.localVideo?.fileUrl) {
      // 本地视频有 fileUrl 但没有 fileId，需要上传
      return null;
    }
  }
  return null;
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

  // 本地视频上传相关状态
  const [uploadedLocalVideo, setUploadedLocalVideo] = useState<LocalVideoInfo | null>(null);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const agentDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    const selectedAgent = getSelectedAgent();
    const userText = inputText.trim();

    // 检测是否为本地视频分析请求
    const localVideoRequest = detectLocalVideoAnalysisRequest(userText, !!uploadedLocalVideo);

    // 检查历史消息中是否有可复用的 fileId
    const reusableFileId = findReusableFileId(messages);

    if (localVideoRequest && (uploadedLocalVideo || reusableFileId)) {
      // ========== 本地视频分析流程 ==========
      if (reusableFileId) {
        // 有可复用的 fileId，直接复用（不重新上传）
        await handleReuseFileIdAnalysis(
          userText,
          localVideoRequest.prompt,
          reusableFileId,
          config,
          selectedAgent.systemPrompt
        );
      } else if (uploadedLocalVideo) {
        // 有本地视频文件，需要上传
        await handleLocalVideoAnalysis(
          userText,
          localVideoRequest.prompt,
          config,
          selectedAgent.systemPrompt
        );
      }
      return;
    }

    // 检测是否为抖音视频分析请求
    const douyinRequest = detectDouyinVideoRequest(userText);

    if (douyinRequest) {
      // ========== 抖音视频分析流程 ==========
      await handleDouyinVideoAnalysis(
        userText,
        douyinRequest.url,
        douyinRequest.prompt,
        config,
        selectedAgent.systemPrompt
      );
    } else {
      // ========== 普通聊天流程 ==========
      const userMessage: ChatMessageUI = {
        id: generateId(),
        role: 'user',
        content: userText,
        timestamp: Date.now(),
        type: 'text',
      };

      const assistantMessage: ChatMessageUI = {
        id: generateId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        type: 'text',
      };

      setMessages(prev => [...prev, userMessage]);
      setInputText('');
      setIsStreaming(true);
      setError(null);

      setMessages(prev => [...prev, assistantMessage]);

      const history: ChatMessage[] = [...messages, userMessage].map(m => ({
        role: m.role,
        content: m.content,
      }));

      let apiMessages = buildApiMessages(history, selectedAgent.systemPrompt);
      let retryCount = 0;
      const maxRetries = 2;

      const doStream = async (messagesToSend: ChatMessage[]): Promise<void> => {
        abortControllerRef.current = new AbortController();

        let fullContent = '';

        await streamLLMChat(
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
              if (isTokenLimitError(err) && retryCount < maxRetries) {
                retryCount++;
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
    }
  };

  /**
   * 处理本地上传视频的分析流程
   */
  const handleLocalVideoAnalysis = async (
    userText: string,
    prompt: string,
    config: AIModelConfig,
    systemPrompt: string
  ) => {
    if (!uploadedLocalVideo) return;

    const userMessage: ChatMessageUI = {
      id: generateId(),
      role: 'user',
      content: userText,
      timestamp: Date.now(),
      type: 'localVideo',
      localVideo: uploadedLocalVideo,
    };

    // 进度状态 assistant 消息
    const assistantMessage: ChatMessageUI = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      type: 'video',
      multimodal: {
        text: '正在上传视频到火山引擎...',
      },
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsStreaming(true);
    setError(null);

    setMessages(prev => [...prev, assistantMessage]);

    try {
      // 获取本地视频文件
      const videoFileUrl = uploadedLocalVideo.fileUrl;
      const url = new URL(videoFileUrl);
      // 获取路径部分（不包含查询参数）
      const path = url.pathname;
      // 调用火山引擎上传接口
      const response = await fetch('/api/douyin/upload-volcengine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileUrl: path,
          apiKey: config.apiKey,
        }),
      });

      if (!response.ok) {
        throw new Error(`上传失败: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      const decoder = new TextDecoder();
      let buffer = '';
      let fileId: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const event = JSON.parse(trimmed);

            if (event.type === 'progress') {
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantMessage.id
                    ? {
                        ...m,
                        content: event.data?.message || '上传中...',
                        multimodal: { text: event.data?.message || '上传中...' },
                      }
                    : m
                )
              );
            } else if (event.type === 'complete') {
              fileId = event.data?.id;
              if (!fileId) {
                // 尝试其他可能的字段名
                fileId = event.data?.file_id || event.data?.fileId;
              }
            } else if (event.type === 'error') {
              throw new Error(event.message || '上传失败');
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }

      if (!fileId) {
        throw new Error('未收到上传结果，file_id 缺失');
      }

      // 更新状态为上传完成
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMessage.id
            ? {
                ...m,
                content: `✅ 视频已上传到火山引擎\n📎 file_id: ${fileId}\n🎬 正在分析视频...`,
                multimodal: {
                  fileId: fileId,
                  fileName: uploadedLocalVideo.fileName,
                  text: '视频上传完成，开始分析...',
                },
              }
            : m
        )
      );

      // 创建多模态消息
      const videoMessage = createVideoMessage(fileId, prompt);

      // 新的 assistant 消息用于显示分析结果
      const analysisMessage: ChatMessageUI = {
        id: generateId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        type: 'video',
        multimodal: {
          fileId: fileId,
          fileName: uploadedLocalVideo.fileName,
          text: prompt,
        },
      };

      setMessages(prev => [...prev, analysisMessage]);

      // 构建 API 请求消息
      const historyMessages: ChatMessage[] = [
        ...messages,
        userMessage,
        assistantMessage,
      ].map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      historyMessages.push(videoMessage);

      const apiMessages = buildApiMessages(historyMessages, systemPrompt);

      abortControllerRef.current = new AbortController();
      let fullContent = '';

      await streamLLMChat(
        config,
        apiMessages,
        {
          onChunk: (text) => {
            fullContent += text;
            setMessages(prev =>
              prev.map(m =>
                m.id === analysisMessage.id
                  ? { ...m, content: fullContent }
                  : m
              )
            );
          },
          onDone: () => {
            setIsStreaming(false);
            abortControllerRef.current = null;
            // 分析完成后清除本地视频状态
            setUploadedLocalVideo(null);
          },
          onError: (err) => {
            setMessages(prev =>
              prev.map(m =>
                m.id === analysisMessage.id
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMessage.id
            ? {
                ...m,
                content: `❌ 处理失败: ${errorMessage}`,
                multimodal: { text: errorMessage },
              }
            : m
        )
      );
      setIsStreaming(false);
      setError(errorMessage);
    }
  };

  /**
   * 处理复用已有 fileId 的视频分析流程（不重新上传）
   */
  const handleReuseFileIdAnalysis = async (
    userText: string,
    prompt: string,
    fileInfo: { fileId: string; fileName?: string },
    config: AIModelConfig,
    systemPrompt: string
  ) => {
    const userMessage: ChatMessageUI = {
      id: generateId(),
      role: 'user',
      content: userText,
      timestamp: Date.now(),
      type: 'localVideo',
      multimodal: {
        fileId: fileInfo.fileId,
        fileName: fileInfo.fileName,
        text: userText,
      },
    };

    // assistant 消息用于显示分析结果
    const assistantMessage: ChatMessageUI = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      type: 'video',
      multimodal: {
        fileId: fileInfo.fileId,
        fileName: fileInfo.fileName,
        text: prompt,
      },
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsStreaming(true);
    setError(null);

    setMessages(prev => [...prev, assistantMessage]);

    try {
      // 直接使用已有的 fileId，不上传
      const fileId = fileInfo.fileId;

      // 创建多模态消息
      const videoMessage = createVideoMessage(fileId, prompt);

      // 构建历史消息
      const historyMessages: ChatMessage[] = [
        ...messages,
        userMessage,
      ].map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      historyMessages.push(videoMessage);

      const apiMessages = buildApiMessages(historyMessages, systemPrompt);
      abortControllerRef.current = new AbortController();
      let fullContent = '';

      await streamLLMChat(
        config,
        apiMessages,
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMessage.id
            ? {
                ...m,
                content: `❌ 处理失败: ${errorMessage}`,
                multimodal: { fileId: fileInfo.fileId, fileName: fileInfo.fileName, text: errorMessage },
              }
            : m
        )
      );
      setIsStreaming(false);
      setError(errorMessage);
    }
  };

  /**
   * 处理本地视频文件上传
   */
  const handleLocalVideoUpload = async (file: File) => {
    setIsUploadingVideo(true);
    setUploadProgress('准备上传...');
    setError(null);

    try {
      const result = await uploadLocalVideoFile(file, 'douyin');

      if (result.success && result.data) {
        setUploadedLocalVideo({
          fileUrl: result.data.url,
          fileName: result.data.filename,
          fileSize: parseInt(result.data.size) || 0,
        });
        setUploadProgress('');
      } else {
        setError(result.error || '上传失败');
        setUploadProgress('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败');
      setUploadProgress('');
    } finally {
      setIsUploadingVideo(false);
    }
  };

  /**
   * 触发文件选择
   */
  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  /**
   * 处理文件选择
   */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleLocalVideoUpload(file);
    }
    // 清空 input 以便选择相同文件
    e.target.value = '';
  };

  /**
   * 处理抖音视频分析流程
   */
  const handleDouyinVideoAnalysis = async (
    userText: string,
    url: string,
    prompt: string,
    config: AIModelConfig,
    systemPrompt: string
  ) => {
    const userMessage: ChatMessageUI = {
      id: generateId(),
      role: 'user',
      content: userText,
      timestamp: Date.now(),
      type: 'video',
      multimodal: { fileName: url.match(/\/([^\/]+)$/)?.[1] || 'douyin_video' },
    };

    // 进度状态 assistant 消息
    const assistantMessage: ChatMessageUI = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      type: 'video',
      multimodal: {
        text: '正在连接抖音服务...',
      },
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsStreaming(true);
    setError(null);

    setMessages(prev => [...prev, assistantMessage]);

    try {
      // 通过 SSE 调用 /api/douyin/process
      const response = await fetch('/api/douyin/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          apiKey: config.apiKey,
        }),
      });

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      const decoder = new TextDecoder();
      let buffer = '';
      let processResult: DouyinProcessResult | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          try {
            const event = JSON.parse(data);

            if (event.type === 'progress') {
              // 更新进度
              const { stage, percent, message } = event.data;
              let displayText = message || '';
              if (stage === 'parsing') displayText = '正在解析视频链接...';
              else if (stage === 'downloading') displayText = `正在下载视频 ${percent}%`;
              else if (stage === 'uploading') displayText = '正在上传到火山引擎...';

              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantMessage.id
                    ? {
                        ...m,
                        content: displayText,
                        multimodal: { text: displayText },
                      }
                    : m
                )
              );
            } else if (event.type === 'ready') {
              // 视频处理完成，获取 file_id
              processResult = event.data;
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantMessage.id
                    ? {
                        ...m,
                        content: `✅ 视频已上传完成\n📎 file_id: ${processResult.fileId}\n🎬 正在分析视频...`,
                        multimodal: {
                          fileId: processResult.fileId,
                          fileName: processResult.fileName,
                          text: '视频上传完成，开始分析...',
                        },
                      }
                    : m
                )
              );
            } else if (event.type === 'error') {
              throw new Error(event.data?.message || '处理失败');
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }

      if (!processResult) {
        throw new Error('未收到视频处理结果');
      }

      // 构建多模态消息并调用 LLM 流式分析
      const videoMessage = createVideoMessage(processResult.fileId, prompt);

      // 新的 assistant 消息用于显示分析结果
      const analysisMessage: ChatMessageUI = {
        id: generateId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        type: 'video',
        multimodal: {
          fileId: processResult.fileId,
          fileName: processResult.fileName,
          text: prompt,
        },
      };

      setMessages(prev => [...prev, analysisMessage]);

      // 构建 API 请求消息
      const historyMessages: ChatMessage[] = [
        ...messages,
        userMessage,
        assistantMessage,
      ].map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      // 添加视频消息到历史
      historyMessages.push(videoMessage);

      const apiMessages = buildApiMessages(historyMessages, systemPrompt);

      abortControllerRef.current = new AbortController();
      let fullContent = '';

      await streamLLMChat(
        config,
        apiMessages,
        {
          onChunk: (text) => {
            fullContent += text;
            setMessages(prev =>
              prev.map(m =>
                m.id === analysisMessage.id
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
            setMessages(prev =>
              prev.map(m =>
                m.id === analysisMessage.id
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMessage.id
            ? {
                ...m,
                content: `❌ 处理失败: ${errorMessage}`,
                multimodal: { text: errorMessage },
              }
            : m
        )
      );
      setIsStreaming(false);
      setError(errorMessage);
    }
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
      type: 'text',
    };

    setIsStreaming(true);
    setMessages([welcomeMessage]);

    abortControllerRef.current = new AbortController();
    let fullContent = '';

    await streamLLMChat(
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
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3.5 h-3.5 text-slate-100" />
                </div>
              )}

              {/* 消息气泡 */}
              <div
                className={`max-w-[80%] rounded-xl px-3 py-2 select-text break-all ${
                  message.role === 'user'
                    ? 'bg-slate-600 text-slate-200'
                    : 'bg-slate-700 text-slate-100'
                }`}
              >
                {/* 本地视频预览 */}
                {message.type === 'localVideo' && message.localVideo && (
                  <div className="mb-2">
                    <div className="flex items-center gap-1.5 mb-1.5 text-xs text-slate-300 bg-slate-800/50 px-2 py-1 rounded-lg">
                      <Film className="w-3 h-3 text-green-400" />
                      <span>本地视频</span>
                      <span className="truncate max-w-[150px]">{message.localVideo.fileName}</span>
                    </div>
                    <video
                      src={message.localVideo.fileUrl}
                      controls
                      className="w-full max-w-[300px] h-40 rounded-lg bg-black"
                    />
                  </div>
                )}

                {/* 抖音视频消息标记 */}
                {message.type === 'video' && message.role === 'user' && !message.localVideo && (
                  <div className="flex items-center gap-1.5 mb-1.5 text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded-lg">
                    <Video className="w-3 h-3" />
                    <span>抖音视频</span>
                    {message.multimodal?.fileName && (
                      <span className="truncate max-w-[150px]">{message.multimodal.fileName}</span>
                    )}
                  </div>
                )}

                {/* 视频消息进度/状态显示 */}
                {message.type === 'video' && message.role === 'assistant' && (
                  <div className="mb-2">
                    <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/50 px-2 py-1.5 rounded-lg">
                      {message.multimodal?.text?.includes('下载') && <Download className="w-3 h-3 text-yellow-400" />}
                      {message.multimodal?.text?.includes('上传') && <Upload className="w-3 h-3 text-blue-400" />}
                      {message.multimodal?.text?.includes('分析') && <Loader2 className="w-3 h-3 animate-spin text-green-400" />}
                      {message.multimodal?.text?.includes('失败') && <X className="w-3 h-3 text-red-400" />}
                      {message.multimodal?.text?.includes('✅') && <Check className="w-3 h-3 text-green-400" />}
                      <span className="whitespace-pre-wrap">{message.content}</span>
                    </div>
                    {message.multimodal?.fileId && (
                      <div className="text-xs text-slate-500 mt-1">
                        file_id: {message.multimodal.fileId}
                      </div>
                    )}
                  </div>
                )}

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
                <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0">
                  <User className="w-3.5 h-3.5 text-slate-100" />
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
        {/* 本地视频预览区域 */}
        {uploadedLocalVideo && (
          <div className="w-64 mb-2 p-2 bg-slate-700/50 rounded-lg border border-slate-600">
            <div className="flex items-center gap-3">
              {/* 视频缩略图/图标 */}
              <div className="w-16 h-12 bg-slate-800 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                <video
                  src={uploadedLocalVideo.fileUrl}
                  className="w-full h-full object-contain"
                  muted
                  preload="metadata"
                />
              </div>
              {/* 视频信息 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span className="text-sm text-slate-200 truncate">{uploadedLocalVideo.fileName}</span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {isUploadingVideo ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {uploadProgress || '上传中...'}
                    </span>
                  ) : (
                    <span>{(uploadedLocalVideo.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                  )}
                </div>
              </div>
              {/* 移除按钮 */}
              <button
                onClick={() => setUploadedLocalVideo(null)}
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                title="移除视频"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* 视频播放器 */}
            <div className="mt-2">
              <video
                src={uploadedLocalVideo.fileUrl}
                controls
                className="w-full h-32 rounded bg-black object-cover"
              />
            </div>
            {/* 提示 */}
            <p className="text-xs text-slate-500 mt-1.5">
              输入&quot;分析这个视频&quot;可让 AI 分析视频内容
            </p>
          </div>
        )}

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
          {/* 视频上传按钮 */}
          <button
            onClick={triggerFileSelect}
            disabled={isStreaming || isUploadingVideo || llmConfigs.length === 0}
            className="p-2.5 mb-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="上传本地视频"
          >
            {isUploadingVideo ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Paperclip className="w-4 h-4" />
            )}
          </button>
          {/* 隐藏的文件输入 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={uploadedLocalVideo ? '输入"分析这个视频"分析视频，或直接聊天...' : '输入消息...'}
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
              disabled={!inputText.trim() && !uploadedLocalVideo || llmConfigs.length === 0}
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
