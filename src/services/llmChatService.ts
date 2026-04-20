/**
 * LLM Chat Service - Stream 调用封装
 * 支持 OpenAI 兼容的 chat/completions API
 * 支持多模态内容（文本 + 视频文件）
 */

import { AIModelConfig } from '../types';
import { getModelConfigsByType } from './modelConfigService';

/**
 * 多模态内容部分
 */
export type ContentPart =
  | { type: 'input_video'; file_id: string }
  | { type: 'input_text'; text: string }
  | { type: 'video_url'; video_url:{url: string}  }
  | { type: 'text'; text: string }; // 兼容纯文本格式

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

/**
 * 判断 content 是否为多模态格式
 */
export function isMultimodalContent(content: string | ContentPart[]): content is ContentPart[] {
  return Array.isArray(content);
}

/**
 * 将多模态消息转换为 OpenAI Chat API 兼容格式
 * input_video -> video_url
 * input_text -> text
 */
function toOpenAICompatibleMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map(msg => {
    if (!isMultimodalContent(msg.content)) {
      return msg;
    }

    const newContent = msg.content.map(part => {
      if (part.type === 'input_video') {
        return { type: 'video_url' as const, video_url: { url: part.file_id } };
      }
      if (part.type === 'input_text') {
        return { type: 'text' as const, text: part.text };
      }
      return part;
    });

    return { ...msg, content: newContent };
  });
}

export interface LLMChatStreamCallbacks {
  onChunk: (text: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

/**
 * 获取所有可用的 LLM 模型配置
 */
export async function getLLMConfigs(): Promise<AIModelConfig[]> {
  return await getModelConfigsByType('llm');
}

/**
 * 构建发送给 API 的 messages 数组
 * @param history 历史消息
 * @param systemPrompt 系统提示词（必须由调用方提供）
 */
export function buildApiMessages(history: ChatMessage[], systemPrompt: string): ChatMessage[] {
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt }
  ];

  // 添加历史消息
  for (const msg of history) {
    messages.push({ role: msg.role, content: msg.content });
  }

  return messages;
}

/**
 * 创建多模态用户消息（包含视频文件 ID）
 */
export function createVideoMessage(fileId: string, text: string): ChatMessage {
  return {
    role: 'user',
    content: [
      { type: 'input_video', file_id: fileId },
      { type: 'input_text', text }
    ]
  };
}

/**
 * 截断消息历史（移除最早的一组 user+assistant）
 */
export function trimMessages(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= 1) return messages;
  
  const [system, ...rest] = messages;
  
  // 找到第一个 user 消息之后，移除第一组 user+assistant
  if (rest.length < 2) return messages;
  
  // 从第二个元素开始（跳过第一个 user 和可能的 assistant）
  let skipCount = 0;
  let foundFirstUser = false;
  
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].role === 'user') {
      if (!foundFirstUser) {
        foundFirstUser = true;
        skipCount = 1; // 跳过这个 user
      } else {
        break; // 找到第二个 user，停止
      }
    } else if (foundFirstUser && rest[i].role === 'assistant') {
      skipCount++; // 跳过对应的 assistant
      break;
    } else if (foundFirstUser) {
      skipCount++;
    }
  }
  
  const trimmed = rest.slice(skipCount);
  return [system!, ...trimmed];
}

/**
 * Stream 调用 LLM API
 */
export async function streamChat(
  config: AIModelConfig,
  messages: ChatMessage[],
  callbacks: LLMChatStreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const endpoint = `${config.apiUrl}/chat/completions`;

  // 转换多模态消息为 OpenAI API 兼容格式
  const apiMessages = toOpenAICompatibleMessages(messages);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: apiMessages,
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API 请求失败: ${response.status}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
      } catch {
        // 无法解析 JSON，使用默认错误信息
      }
      
      callbacks.onError(new Error(errorMessage));
      return;
    }

    if (!response.body) {
      callbacks.onError(new Error('响应体为空'));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        callbacks.onDone();
        return;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (!trimmedLine || !trimmedLine.startsWith('data: ')) {
          continue;
        }

        const data = trimmedLine.slice(6);
        
        if (data === '[DONE]') {
          callbacks.onDone();
          return;
        }

        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.delta?.content;
          
          if (content) {
            callbacks.onChunk(content);
          }
        } catch {
          // 解析失败，忽略这一行
        }
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        // 用户主动取消，不触发错误回调
        callbacks.onDone();
      } else {
        callbacks.onError(error);
      }
    } else {
      callbacks.onError(new Error('未知错误'));
    }
  }
}

/**
 * 检查是否是 token 超限错误
 */
export function isTokenLimitError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('context length') ||
    message.includes('token limit') ||
    message.includes('maximum context') ||
    message.includes('too long') ||
    message.includes('exceed') ||
    message.includes('400') && message.includes('length')
  );
}

/**
 * Responses API 消息格式（用于 /v1/responses 端点）
 */
export interface ResponsesMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

/**
 * Responses API 请求体格式（用于 /v1/responses 端点）
 */
export interface ResponsesRequest {
  model: string;
  input: string | ResponsesMessage[];
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop?: string[];
  truncation?: 'auto' | 'disabled';
  tools?: object[];
  tool_choice?: 'auto' | 'none' | 'required';
  response_format?: { type: 'text' | 'json_object' };
}

/**
 * 将 ChatMessage[] 转换为 ResponsesMessage[]（只保留纯文本消息）
 * Responses API 不支持多模态内容
 */
export function toResponsesMessages(messages: ChatMessage[]): ResponsesMessage[] {

  // 返回 system 消息 + 最后一条 user 消息
  const systemMessages = messages.filter(msg => msg.role === 'system');
  const lastUserMessage = messages.filter(msg => msg.role === 'user').pop();
  const result: ResponsesMessage[] = [
    ...systemMessages,
    ...(lastUserMessage ? [lastUserMessage as ResponsesMessage] : []),
  ];

  return result;
}

/**
 * Stream 调用 Responses API（/v1/responses）
 * 火山方舟 Responses API 封装
 */
export async function streamResponsesChat(
  config: AIModelConfig,
  messages: ResponsesMessage[],
  callbacks: LLMChatStreamCallbacks,
  signal?: AbortSignal,
  extraParams?: {
    max_tokens?: number;
    temperature?: number;
    tools?: object[];
  }
): Promise<void> {
  // Responses API 使用 /v1/responses 端点
  const endpoint = `${config.apiUrl.replace('/chat/completions', '')}/responses`;

  const requestBody: ResponsesRequest = {
    model: config.model,
    input: messages,
    stream: true,
  };

  // 添加可选参数
  if (extraParams?.max_tokens) {
    requestBody.max_tokens = extraParams.max_tokens;
  }
  if (extraParams?.temperature !== undefined) {
    requestBody.temperature = extraParams.temperature;
  }
  if (extraParams?.tools) {
    requestBody.tools = extraParams.tools;
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API 请求失败: ${response.status}`;

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
      } catch {
        // 无法解析 JSON，使用默认错误信息
      }

      callbacks.onError(new Error(errorMessage));
      return;
    }

    if (!response.body) {
      callbacks.onError(new Error('响应体为空'));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        callbacks.onDone();
        return;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();

        if (!trimmedLine) {
          continue;
        }

        // 解析 SSE 格式: event: xxx\ndata: yyy
        let eventType = '';
        let dataStr = '';

        if (trimmedLine.startsWith('event: ')) {
          eventType = trimmedLine.slice(7).trim();
        } else if (trimmedLine.startsWith('data: ')) {
          dataStr = trimmedLine.slice(6).trim();
        }

        if (dataStr === '[DONE]') {
          callbacks.onDone();
          return;
        }

        if (!dataStr) {
          continue;
        }

        try {
          const json = JSON.parse(dataStr);

          // 检查嵌套的 event 字段（某些 API 响应格式）
          const event = eventType || json.event || json.type;

          // 火山方舟 Responses API 格式
          // event: response.output_text.delta
          // data: {"type":"response.output_text.delta","delta":"内容"}
          if (event === 'response.output_text.delta' || json.type === 'response.output_text.delta') {
            const delta = json.delta;
            if (typeof delta === 'string' && delta) {
              callbacks.onChunk(delta);
            }
          } else if (event === 'response.completed' || json.type === 'response.completed') {
            callbacks.onDone();
            return;
          }
        } catch {
          // 解析失败，忽略这一行
        }
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        callbacks.onDone();
      } else {
        callbacks.onError(error);
      }
    } else {
      callbacks.onError(new Error('未知错误'));
    }
  }
}

/**
 * 统一 Stream 调用入口
 * 根据 config.useResponsesApi 自动选择 Chat API 或 Responses API
 * 
 * @param config 模型配置
 * @param messages 消息列表（支持 ChatMessage 多模态格式）
 * @param callbacks 流式回调
 * @param signal AbortSignal
 * @param responsesOptions Responses API 额外参数（仅在使用 Responses API 时生效）
 */
export async function streamLLMChat(
  config: AIModelConfig,
  messages: ChatMessage[],
  callbacks: LLMChatStreamCallbacks,
  signal?: AbortSignal,
  responsesOptions?: {
    max_tokens?: number;
    temperature?: number;
    tools?: object[];
  }
): Promise<void> {
  if (config.provider === 'doubao') {
    // 使用 Responses API
    const responsesMessages = toResponsesMessages(messages);
    // 如果所有消息都被过滤掉了（全是多模态内容），抛出错误
    if (responsesMessages.length === 0) {
      callbacks.onError(new Error('Responses API 不支持多模态内容，请移除视频/图片消息'));
      return;
    }
    
    await streamResponsesChat(config, responsesMessages, callbacks, signal, responsesOptions);
  } else {
    // 使用 Chat API
    await streamChat(config, messages, callbacks, signal);
  }
}
