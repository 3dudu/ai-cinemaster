/**
 * LLM Chat Service - Stream 调用封装
 * 支持 OpenAI 兼容的 chat/completions API
 */

import { AIModelConfig } from '../types';
import { getModelConfigsByType } from './modelConfigService';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
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
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages,
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
