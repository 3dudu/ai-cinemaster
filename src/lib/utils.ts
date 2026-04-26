/**
 * 工具函数 - 供 CutOS 等模块使用
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 解析时长字符串为秒数
 * 支持 "60s", "3m", "2m30s" 等格式
 */
export function parseDurationSeconds(d: string): number {
  if (!d) return 60;
  let total = 0;
  const m = d.match(/(\d+)\s*m/);
  const s = d.match(/(\d+)\s*s/);
  if (m) total += parseInt(m[1]) * 60;
  if (s) total += parseInt(s[1]);
  // 纯数字默认为秒
  if (total === 0) {
    const n = parseInt(d);
    return isNaN(n) ? 60 : n;
  }
  return total;
}

/**
 * 将秒数格式化为自然语言时长描述
 * 如: 90 -> "1分钟30秒", 120 -> "2分钟", 30 -> "30秒"
 */
export function formatNaturalDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}秒`;
  if (secs === 0) return `${mins}分钟`;
  return `${mins}分钟${secs}秒`;
}

/** 解析出的单集数据 */
export interface ParsedEpisode {
  title: string;
  content: string;
}

/**
 * 从 AI 生成的多集剧本文本中拆分出各集
 *
 * 匹配格式: "第X集 《标题》" / "第X集(标题)" / "第X集【标题】"
 * 每集 content 从标题行开始截取到下一集标题（或文末），
 * 前言文字自动丢弃。startFrom 用于控制起始编号。
 */
export function parseEpisodesFromScript(script: string, startFrom = 1): ParsedEpisode[] {
  // Match "第X集 《标题》" — loose pattern: episode number + title in brackets
  const separator = /第\s*(\d+)\s*集\s*[《\(【]([^\)】》]+?)[\)】》]/g;
  const matches = [...script.matchAll(separator)];

  if (matches.length >= 1) {
    const results: ParsedEpisode[] = [];

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const epTitle = match[2].trim();

      // Content: from this header line to next header (or end of text)
      const start = match.index!;
      const end = i < matches.length - 1 ? matches[i + 1].index! : script.length;
      let content = script.slice(start, end).trim();

      if (content.length > 10) {
        results.push({ title: `第${startFrom + i}集 ${epTitle}`, content });
      }
    }

    return results;
  }

  // No episode headers found — return empty array (caller decides fallback)
  return [];
}
