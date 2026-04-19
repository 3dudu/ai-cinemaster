import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

export interface RichMentionEditorRef {
  insertMention: (type: 'character' | 'scene' | 'prop', id: string, name: string) => void;
  replaceMention: (type: 'character' | 'scene' | 'prop', id: string, name: string) => void;
}

interface RichMentionEditorProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  characters: Array<{ id: string; name: string }>;
  scenes: Array<{ id: string; location: string }>;
  props: Array<{ id: string; name: string }>;
  onMentionTrigger?: (position: { top: number; left: number }, searchText: string, atIndex: number) => void;
  onMentionClose?: () => void;
  mentionPickerOpen?: boolean;
  onMentionClick?: (position: { top: number; left: number }, type: 'character' | 'scene' | 'prop', id: string, name: string, startOffset: number) => void;
}

interface TextSegment {
  type: 'text' | 'mention';
  content: string;
  mentionType?: 'character' | 'scene' | 'prop';
  mentionId?: string;
}

/**
 * 将文本按提及项拆分为片段
 */
function parseTextToSegments(
  text: string,
  characters: Array<{ id: string; name: string }>,
  scenes: Array<{ id: string; location: string }>,
  props: Array<{ id: string; name: string }>
): TextSegment[] {
  if (!text) return [];

  // 收集所有提及项并按名称长度降序排序（优先匹配更长的名称）
  const mentions: Array<{ name: string; type: 'character' | 'scene' | 'prop'; id: string }> = [];
  
  characters.forEach(c => {
    if (c.name) mentions.push({ name: c.name, type: 'character', id: c.id });
  });
  scenes.forEach(s => {
    if (s.location) mentions.push({ name: s.location, type: 'scene', id: s.id });
  });
  props.forEach(p => {
    if (p.name) mentions.push({ name: p.name, type: 'prop', id: p.id });
  });

  // 按名称长度降序排序，避免短名称先匹配导致长名称被截断
  mentions.sort((a, b) => b.name.length - a.name.length);

  // 使用标记数组记录每个字符是否已被匹配
  const matched = new Array(text.length).fill(false);
  const matchInfo: Array<{ start: number; end: number; type: 'character' | 'scene' | 'prop'; id: string }> = [];

  for (const mention of mentions) {
    let searchStart = 0;
    while (true) {
      const index = text.indexOf(mention.name, searchStart);
      if (index === -1) break;
      
      // 检查是否已被匹配
      let alreadyMatched = false;
      for (let i = index; i < index + mention.name.length; i++) {
        if (matched[i]) {
          alreadyMatched = true;
          break;
        }
      }

      if (!alreadyMatched) {
        // 标记为已匹配
        for (let i = index; i < index + mention.name.length; i++) {
          matched[i] = true;
        }
        matchInfo.push({
          start: index,
          end: index + mention.name.length,
          type: mention.type,
          id: mention.id
        });
      }
      
      searchStart = index + 1;
    }
  }

  // 按位置排序
  matchInfo.sort((a, b) => a.start - b.start);

  // 构建片段
  const segments: TextSegment[] = [];
  let lastEnd = 0;

  for (const match of matchInfo) {
    // 添加匹配前的普通文本
    if (match.start > lastEnd) {
      segments.push({
        type: 'text',
        content: text.slice(lastEnd, match.start)
      });
    }
    // 添加提及片段
    segments.push({
      type: 'mention',
      content: text.slice(match.start, match.end),
      mentionType: match.type,
      mentionId: match.id
    });
    lastEnd = match.end;
  }

  // 添加最后剩余的文本
  if (lastEnd < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastEnd)
    });
  }

  return segments;
}

/**
 * 将片段转换为 HTML 字符串
 */
function segmentsToHtml(segments: TextSegment[]): string {
  if (segments.length === 0) {
    return '<br>';
  }

  return segments.map(segment => {
    if (segment.type === 'text') {
      // 转义 HTML 特殊字符并保留换行
      return segment.content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    }

    // Mention 标签
    const baseClass = 'mention-tag inline-flex items-center gap-1 px-1.5 py-0.5 my-0.5 rounded text-xs font-medium border mx-0.5';
    
    if (segment.mentionType === 'character') {
      return `<span class="${baseClass} bg-blue-500/15 text-blue-400 border-blue-500/25 cursor-pointer" contenteditable="false" data-mention-type="character" data-mention-id="${segment.mentionId}"><svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${segment.content}</span>`;
    } else if (segment.mentionType === 'scene') {
      return `<span class="${baseClass} bg-violet-500/15 text-violet-400 border-violet-500/25 cursor-pointer" contenteditable="false" data-mention-type="scene" data-mention-id="${segment.mentionId}"><svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>${segment.content}</span>`;
    } else {
      return `<span class="${baseClass} bg-amber-500/15 text-amber-400 border-amber-500/25 cursor-pointer" contenteditable="false" data-mention-type="prop" data-mention-id="${segment.mentionId}"><svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>${segment.content}</span>`;
    }
  }).join('');
}

const RichMentionEditor = React.forwardRef<RichMentionEditorRef, RichMentionEditorProps>(({
  value,
  onChange,
  onKeyDown,
  placeholder = '输入描述...',
  className = '',
  disabled = false,
  characters,
  scenes,
  props: propsList,
  onMentionTrigger,
  onMentionClose,
  mentionPickerOpen = false,
  onMentionClick,
}, ref) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const lastValueRef = useRef<string | null>(null); // null 表示需要初始化
  const mentionAtIndexRef = useRef<number | null>(null); // @ 符号的位置（用于插入）
  const mentionSearchLengthRef = useRef<number>(0); // 搜索文本长度
  const replacingMentionElRef = useRef<Element | null>(null); // 被点击要替换的 mention 元素
  
  // 暴露 insertMention 方法给父组件
  useImperativeHandle(ref, () => ({
    insertMention: (type: 'character' | 'scene' | 'prop', id: string, name: string) => {
      const editor = editorRef.current;
      if (!editor || mentionAtIndexRef.current === null) return;

      const selection = window.getSelection();
      if (!selection) return;

      // 获取当前文本
      const text = editor.textContent || '';
      const atIndex = mentionAtIndexRef.current;
      const searchLen = mentionSearchLengthRef.current;

      // 计算新文本
      const beforeAt = text.substring(0, atIndex);
      const afterSearch = text.substring(atIndex + 1 + searchLen);
      const newText = beforeAt + name + ' ' + afterSearch;

      // 创建 mention 标签
      const baseClass = 'mention-tag inline-flex items-center gap-1 px-1.5 py-0.5 my-0.5 rounded text-xs font-medium border mx-0.5';
      let colorClass = '';
      let icon = '';
      
      if (type === 'character') {
        colorClass = 'bg-blue-500/15 text-blue-400 border-blue-500/25';
        icon = '<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
      } else if (type === 'scene') {
        colorClass = 'bg-violet-500/15 text-violet-400 border-violet-500/25';
        icon = '<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
      } else {
        colorClass = 'bg-amber-500/15 text-amber-400 border-amber-500/25';
        icon = '<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>';
      }

      const mentionHtml = `<span class="${baseClass} ${colorClass} cursor-pointer" contenteditable="false" data-mention-type="${type}" data-mention-id="${id}">${icon}${name}</span>`;

      // 直接操作 DOM - 找到 @ 符号所在的文本节点
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
      let currentOffset = 0;
      let atNode: Node | null = null;
      let atNodeOffset = 0;

      // 遍历所有文本节点，找到包含目标 @ 位置的节点
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const nodeText = node.textContent || '';
        const nodeLen = nodeText.length;
        
        // 检查目标索引是否在这个节点的范围内
        if (currentOffset + nodeLen > atIndex) {
          atNode = node;
          atNodeOffset = atIndex - currentOffset;
          break;
        }
        currentOffset += nodeLen;
      }

      if (!atNode) {
        // 找不到位置，回退到重新渲染
        lastValueRef.current = newText;
        onChange(newText);
        return;
      }

      // 创建一个 Range 来选择要删除的内容 (@xxx)
      const range = document.createRange();
      range.setStart(atNode, atNodeOffset);
      
      // 计算结束位置是否在同一个节点内
      const endNodeOffset = atNodeOffset + 1 + searchLen;
      const atNodeText = atNode.textContent || '';
      
      if (endNodeOffset <= atNodeText.length) {
        // 结束位置在同一个节点内
        range.setEnd(atNode, endNodeOffset);
      } else {
        // 结束位置跨越多个节点，需要找到结束位置
        let remainingLen = 1 + searchLen - (atNodeText.length - atNodeOffset);
        let endNode = atNode;
        
        while (remainingLen > 0 && walker.nextNode()) {
          endNode = walker.currentNode;
          const endText = endNode.textContent || '';
          if (endText.length >= remainingLen) {
            range.setEnd(endNode, remainingLen);
            remainingLen = 0;
            break;
          }
          remainingLen -= endText.length;
        }
        
        if (remainingLen > 0) {
          // 无法找到正确的结束位置，回退到重新渲染
          lastValueRef.current = newText;
          onChange(newText);
          return;
        }
      }

      // 删除 @xxx 内容
      range.deleteContents();

      // 插入 mention 标签
      const template = document.createElement('template');
      template.innerHTML = mentionHtml;
      const mentionEl = template.content.firstChild as Element;
      range.insertNode(mentionEl);

      // 在 mention 后添加空格并设置光标
      const spaceNode = document.createTextNode(' ');
      mentionEl.parentNode?.insertBefore(spaceNode, mentionEl.nextSibling);

      // 设置光标到空格后
      const newRange = document.createRange();
      newRange.setStartAfter(spaceNode);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);

      // 更新状态
      lastValueRef.current = newText;
      onChange(newText);

      // 重置 refs
      mentionAtIndexRef.current = null;
      mentionSearchLengthRef.current = 0;
    },
    replaceMention: (type: 'character' | 'scene' | 'prop', id: string, name: string) => {
      const editor = editorRef.current;
      const targetMention = replacingMentionElRef.current;
      if (!editor || !targetMention) return;

      const selection = window.getSelection();
      if (!selection) return;

      // 创建 mention 标签
      const baseClass = 'mention-tag inline-flex items-center gap-1 px-1.5 py-0.5 my-0.5 rounded text-xs font-medium border mx-0.5';
      let colorClass = '';
      let icon = '';

      if (type === 'character') {
        colorClass = 'bg-blue-500/15 text-blue-400 border-blue-500/25';
        icon = '<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
      } else if (type === 'scene') {
        colorClass = 'bg-violet-500/15 text-violet-400 border-violet-500/25';
        icon = '<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
      } else {
        colorClass = 'bg-amber-500/15 text-amber-400 border-amber-500/25';
        icon = '<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>';
      }

      const mentionHtml = `<span class="${baseClass} ${colorClass} cursor-pointer" contenteditable="false" data-mention-type="${type}" data-mention-id="${id}">${icon}${name}</span>`;

      // 创建新 mention 元素
      const template = document.createElement('template');
      template.innerHTML = mentionHtml;
      const newMentionEl = template.content.firstChild as Element;

      // 替换旧元素
      targetMention.parentNode?.replaceChild(newMentionEl, targetMention);

      // 设置光标到 mention 后
      const newRange = document.createRange();
      newRange.setStartAfter(newMentionEl);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);

      // 更新文本状态
      const newText = editor.textContent || '';
      lastValueRef.current = newText;
      onChange(newText);

      // 重置
      replacingMentionElRef.current = null;
    }
  }), [onChange]);

  // 解析文本为片段
  const segments = useMemo(() => {
    return parseTextToSegments(value, characters, scenes, propsList);
  }, [value, characters, scenes, propsList]);

  // 初始化编辑器内容
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || lastValueRef.current !== null) return;

    // 首次渲染
    lastValueRef.current = value;
    const html = segmentsToHtml(segments);
    editor.innerHTML = html;
  }, []);

  // 同步外部值变化到编辑器
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // 判断是否是外部更新（value 变化但 lastValueRef 没有被内部更新）
    // 内部更新会在 handleInput 中先更新 lastValueRef
    const isExternalUpdate = lastValueRef.current !== value;
    
    if (!isExternalUpdate) {
      // 内部更新，不需要重新渲染
      return;
    }

    // 外部更新，重新渲染编辑器
    lastValueRef.current = value;
    const html = segmentsToHtml(segments);
    editor.innerHTML = html;

    // 设置光标到末尾
    requestAnimationFrame(() => {
      if (editorRef.current && editorRef.current.contains(document.activeElement)) {
        setCaretOffset(editorRef.current, value.length);
      }
    });
  }, [segments, value]);

  // 获取文本偏移量
  const getTextOffset = useCallback((root: Node, node: Node, offset: number): number => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let totalOffset = 0;
    let currentNode: Node | null;
    
    while ((currentNode = walker.nextNode())) {
      if (currentNode === node) {
        return totalOffset + offset;
      }
      totalOffset += currentNode.textContent?.length || 0;
    }
    
    return totalOffset;
  }, []);

  // 设置光标偏移量
  const setCaretOffset = useCallback((root: HTMLElement, offset: number) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let currentOffset = 0;
    let node: Node | null;
    
    while ((node = walker.nextNode())) {
      const nodeLength = node.textContent?.length || 0;
      if (currentOffset + nodeLength >= offset) {
        const selection = window.getSelection();
        if (selection) {
          const range = document.createRange();
          range.setStart(node, offset - currentOffset);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        }
        return;
      }
      currentOffset += nodeLength;
    }

    // 如果偏移量超出范围，设置到末尾
    const selection = window.getSelection();
    if (selection && root.lastChild) {
      const range = document.createRange();
      range.selectNodeContents(root.lastChild);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }, []);

  // 处理输入
  const handleInput = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const text = editor.textContent || '';
    
    // 更新 lastValueRef，防止 useEffect 重新渲染
    lastValueRef.current = text;
    onChange(text);

    // 检测 @ 输入 - 延迟到下一帧确保 selection 更新
    requestAnimationFrame(() => {
      const currentEditor = editorRef.current;
      if (!currentEditor) return;

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      
      // 确保光标在编辑器内
      if (!currentEditor.contains(range.startContainer)) return;

      const cursorPos = getTextOffset(currentEditor, range.startContainer, range.startOffset);
      const textBeforeCursor = text.substring(0, cursorPos);
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');

      if (lastAtIndex !== -1) {
        const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
        if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n') && !textAfterAt.includes('\t')) {
          // 获取光标屏幕坐标 (fixed 定位需要屏幕绝对坐标)
          const rect = range.getBoundingClientRect();
          
          // 使用屏幕绝对坐标，picker 会在光标下方显示
          const coords = {
            top: rect.bottom + window.scrollY + 4,  // 光标下方 4px
            left: rect.left + window.scrollX
          };
          // 存储 @ 位置和搜索长度，用于后续插入
          mentionAtIndexRef.current = lastAtIndex;
          mentionSearchLengthRef.current = textAfterAt.length;
          // 传递 @ 符号的位置、搜索文本
          onMentionTrigger?.(coords, textAfterAt.toLowerCase(), lastAtIndex);
          return;
        }
      }

      if (mentionPickerOpen) {
        onMentionClose?.();
      }
    });
  }, [onChange, onMentionTrigger, onMentionClose, mentionPickerOpen, getTextOffset]);

  // 键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onMentionClose?.();
      return;
    }

    // 删除整个 mention 标签
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        onKeyDown?.(e);
        return;
      }

      const range = selection.getRangeAt(0);
      const container = range.startContainer;
      const parent = container.parentElement;
      
      // 检查是否选中了整个 mention 标签
      if (parent?.classList.contains('mention-tag') && !range.collapsed) {
        e.preventDefault();
        parent.remove();
        if (editorRef.current) {
          const newText = editorRef.current.textContent || '';
          lastValueRef.current = newText;
          onChange(newText);
        }
        return;
      }

      // Backspace 在 mention 标签后 - 直接检查光标前的 DOM 节点
      if (e.key === 'Backspace' && range.collapsed) {
        const editor = editorRef.current;
        if (!editor) {
          onKeyDown?.(e);
          return;
        }

        // 检查光标前一个节点是否是 mention 标签
        const node = range.startContainer;
        
        // 如果光标在文本节点开头，检查前一个兄弟节点
        if (node.nodeType === Node.TEXT_NODE && range.startOffset === 0) {
          let prevNode = node.previousSibling;
          
          // 跳过空文本节点
          while (prevNode && prevNode.nodeType === Node.TEXT_NODE && !prevNode.textContent) {
            prevNode = prevNode.previousSibling;
          }
          
          // 检查前一个节点是否是 mention 标签
          if (prevNode && prevNode.nodeType === Node.ELEMENT_NODE) {
            const el = prevNode as Element;
            if (el.classList.contains('mention-tag')) {
              e.preventDefault();
              el.remove();
              const newText = editor.textContent || '';
              lastValueRef.current = newText;
              onChange(newText);
              return;
            }
          }
        }
        
        // 检查光标是否在 mention 标签后的空格后面
        if (node.nodeType === Node.TEXT_NODE && range.startOffset === 1 && node.textContent === ' ') {
          const prevNode = node.previousSibling;
          if (prevNode && prevNode.nodeType === Node.ELEMENT_NODE) {
            const el = prevNode as Element;
            if (el.classList.contains('mention-tag')) {
              e.preventDefault();
              // 删除 mention 和后面的空格
              el.remove();
              node.textContent = '';
              const newText = editor.textContent || '';
              lastValueRef.current = newText;
              onChange(newText);
              return;
            }
          }
        }
      }
    }

    onKeyDown?.(e);
  }, [onKeyDown, onMentionClose, onChange]);

  // 处理粘贴 - 只取纯文本
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (text) {
      document.execCommand('insertText', false, text);
    }
  }, []);

  // 点击 mention 标签时弹出替换选择器
  const handleMentionClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const mentionEl = target.closest('.mention-tag');
    if (!mentionEl) return;

    e.preventDefault();

    const editor = editorRef.current;
    if (!editor) return;

    // 获取 mention 信息
    const mentionType = mentionEl.getAttribute('data-mention-type') as 'character' | 'scene' | 'prop';
    const mentionId = mentionEl.getAttribute('data-mention-id') || '';
    const mentionName = mentionEl.textContent || '';

    // 存储要替换的元素引用
    replacingMentionElRef.current = mentionEl;

    // 获取 mention 元素的位置用于显示选择器
    const rect = mentionEl.getBoundingClientRect();
    const coords = {
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX
    };

    // 触发 onMentionClick
    onMentionClick?.(coords, mentionType, mentionId, mentionName, 0);
  }, [onMentionClick]);

  return (
    <div
      ref={editorRef}
      contentEditable={!disabled}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onClick={handleMentionClick}
      data-placeholder={placeholder}
      className={`rich-mention-editor w-full h-full p-3 pb-14 text-sm bg-slate-800 rounded-lg resize-none focus:outline-none text-slate-50 overflow-y-auto whitespace-pre-wrap break-words ${
        isFocused ? 'ring-1 ring-slate-500' : ''
      } ${className}`}
      style={{ minHeight: '100px' }}
      suppressContentEditableWarning
    />
  );
});

RichMentionEditor.displayName = 'RichMentionEditor';

export default RichMentionEditor;
