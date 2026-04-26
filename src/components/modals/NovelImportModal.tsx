import { BookOpen, FileText, Loader2, Upload, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { formatNaturalDuration, parseDurationSeconds, parseEpisodesFromScript } from '../../lib/utils';
import { ModelService } from '../../services/modelService';
import { createSeriesEpisode } from '../../services/seriesService';
import { saveProjectToDB, saveSeriesToDB } from '../../services/storageService';
import { ProjectState, SeriesRecord } from '../../types';
import CustomSelect from '../common/CustomSelect';

import {
  DURATION_OPTIONS,
  GENRE_OPTIONS,
  LANGUAGE_OPTIONS,
} from './ProjectSettingsModal';

interface NovelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  series: SeriesRecord;
  onSeriesUpdate: (updatedSeries: SeriesRecord) => void;
}

const NovelImportModal: React.FC<NovelImportModalProps> = ({
  isOpen,
  onClose,
  series,
  onSeriesUpdate
}) => {
  const [novelContent, setNovelContent] = useState('');
  const [episodeCount, setEpisodeCount] = useState(10);
  const [localDuration, setLocalDuration] = useState<string>('60s');
  const [customDurationInput, setCustomDurationInput] = useState('');
  const [localGenre, setLocalGenre] = useState(series.genre || '剧情片');
  const [localLanguage, setLocalLanguage] = useState(series.language || '中文');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync initial values from series when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalGenre(series.genre || '剧情片');
      setLocalLanguage(series.language || '中文');
      const currentDuration = series.targetDuration || '60s';
      if (!DURATION_OPTIONS.some(opt => opt.value === currentDuration)) {
        setLocalDuration('custom');
        setCustomDurationInput(currentDuration);
      } else {
        setLocalDuration(currentDuration);
      }
    }
  }, [isOpen, series.genre, series.language, series.targetDuration]);

  const getFinalDuration = useCallback(() => {
    return localDuration === 'custom' ? customDurationInput : localDuration;
  }, [localDuration, customDurationInput]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['text/plain', 'text/markdown', '.txt', '.md'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!validTypes.includes(file.type) && !['txt', 'md'].includes(ext || '')) {
      alert('请上传 .txt 或 .md 格式的文件');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setNovelContent(text);
      }
    };
    reader.readAsText(file);

    e.target.value = '';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['txt', 'md'].includes(ext || '')) {
      alert('请上传 .txt 或 .md 格式的文件');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setNovelContent(text);
      }
    };
    reader.readAsText(file);
  }, []);

  interface ParsedEpisode {
    title: string;
    content: string;
  }

  const handleGenerate = useCallback(async () => {
    if (!novelContent.trim()) {
      alert('请输入或上传小说内容');
      return;
    }

    const finalDurationStr = getFinalDuration();
    const secondsPerEpisode = parseDurationSeconds(finalDurationStr);
    const totalSeconds = episodeCount * secondsPerEpisode;
    const totalDurationStr = formatNaturalDuration(totalSeconds);

    setIsGenerating(true);
    setProgressMsg('正在调用 AI 改编剧本...');

    try {
      ModelService.setCurrentProjectProviders(series.modelProviders);

      const finalGenre = localGenre === 'custom' ? '' : localGenre;

      const generatedScript = await ModelService.generateScript(
        novelContent,
        finalGenre,
        finalDurationStr,
        localLanguage,
        series.globalSettings || '',
        episodeCount,
        totalDurationStr
      );

      if (!generatedScript) {
        throw new Error('AI 未返回有效剧本内容');
      }

      setProgressMsg(`剧本已生成，正在拆分 ${episodeCount} 集...`);

      const episodes = parseEpisodesFromScript(generatedScript, series.episodeOrder.length + 1);
      const actualCount = Math.min(episodes.length, episodeCount);

      if (actualCount === 0) {
        throw new Error('无法从生成的剧本中拆分出剧集，请尝试减少集数或增加小说内容长度');
      }

      setProgressMsg(`正在创建 ${actualCount} 个剧集项目...`);

      let updatedSeries: SeriesRecord = { ...series };
      const newProjects: ProjectState[] = [];

      for (let i = 0; i < actualCount; i++) {
        const epProject = createSeriesEpisode(updatedSeries);
        const epIndex = updatedSeries.episodeOrder.length + 1;
        const parsed = episodes[i];

        epProject.title = parsed.title || `${series.title} - 第${epIndex}集`;
        epProject.rawScript = parsed.content;

        newProjects.push(epProject);

        updatedSeries = {
          ...updatedSeries,
          episodeOrder: [...updatedSeries.episodeOrder, epProject.id],
          updatedAt: Date.now()
        };

        setProgressMsg(`正在保存第 ${i + 1}/${actualCount} 集...`);
      }

      setProgressMsg('正在保存所有数据...');

      await Promise.all(newProjects.map(p => saveProjectToDB(p)));
      await saveSeriesToDB(updatedSeries);

      onSeriesUpdate(updatedSeries);

      setProgressMsg(`成功！已生成 ${actualCount} 集剧本。`);
      setTimeout(() => {
        onClose();
      }, 1000);

    } catch (error: any) {
      console.error('Novel import failed:', error);
      alert(`拆集失败: ${error.message || '未知错误'}`);
    } finally {
      setIsGenerating(false);
      setProgressMsg('');
    }
  }, [novelContent, episodeCount, getFinalDuration, localGenre, localLanguage, series, onSeriesUpdate, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 select-text">
      <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl overflow-hidden w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="h-14 px-6 border-b border-slate-600 flex items-center justify-between bg-slate-600/80 shrink-0">
          <h3 className="text-base font-bold text-slate-50 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-400" />
            小说导入 / AI 拆集
          </h3>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="p-2 text-slate-400 bg-slate-700 hover:text-slate-100 hover:bg-slate-800 rounded-full transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-2 md:p-6 space-y-2">
          {/* File Upload Area */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">上传小说文件</label>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-2 text-center cursor-pointer transition-colors ${
                isGenerating
                  ? 'border-slate-600 opacity-50 cursor-not-allowed'
                  : 'border-slate-500 hover:border-slate-400 hover:bg-slate-700/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isGenerating}
              />
              <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
              <p className="text-sm text-slate-300">点击或拖拽上传 .txt / .md 文件</p>
              <p className="text-xs text-slate-500 mt-1">支持 TXT、Markdown 格式</p>
            </div>
          </div>

          {/* Textarea */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              小说内容 <span className="text-slate-500 font-normal">（可直接粘贴）</span>
            </label>
            <textarea
              value={novelContent}
              onChange={(e) => setNovelContent(e.target.value)}
              placeholder="在此粘贴小说全文内容..."
              rows={8}
              disabled={isGenerating}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 outline-none resize-vertical disabled:opacity-50"
            />
            <p className="text-xs text-slate-500 mt-1 text-right">{novelContent.length} 字符</p>
          </div>

          {/* Parameters */}
          <div className="grid grid-cols-2 gap-2">
            {/* Episode Count */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">拆分集数</label>
              <input
                type="number"
                min={1}
                max={100}
                value={episodeCount}
                onChange={(e) => setEpisodeCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                disabled={isGenerating}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 outline-none disabled:opacity-50"
              />
            </div>

            {/* Per Episode Duration */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">每集时长</label>
              <CustomSelect
                options={DURATION_OPTIONS}
                value={localDuration}
                onChange={setLocalDuration}
                className="w-full"
                disabled={isGenerating}
                dropdownPosition="top"
              />
            </div>

            {/* Custom Duration */}
            {localDuration === 'custom' && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-2">自定义时长（如 90s, 3m 等）</label>
                <input
                  type="text"
                  value={customDurationInput}
                  onChange={(e) => setCustomDurationInput(e.target.value)}
                  placeholder="例如: 90s 或 2m"
                  disabled={isGenerating}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 outline-none disabled:opacity-50"
                />
              </div>
            )}

            {/* Genre */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">题材类型</label>
              <CustomSelect
                options={GENRE_OPTIONS}
                value={localGenre}
                onChange={setLocalGenre}
                className="w-full"
                disabled={isGenerating}
                dropdownPosition="top"
              />
            </div>

            {/* Language */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">输出语言</label>
              <CustomSelect
                options={LANGUAGE_OPTIONS}
                value={localLanguage}
                onChange={setLocalLanguage}
                className="w-full"
                disabled={isGenerating}
                dropdownPosition="top"
              />
            </div>
          </div>

          {/* Total Duration Info */}
          <div className="px-4 py-3 bg-slate-700/40 rounded-lg border border-slate-600/50">
            <p className="text-xs text-slate-400">
              <FileText className="w-3.5 h-3.5 inline mr-1" />
              总时长预估：
              <span className="text-slate-200 font-medium ml-1">
                {formatNaturalDuration(episodeCount * parseDurationSeconds(getFinalDuration()))}
              </span>
              <span className="ml-2">（{episodeCount} 集 × 每集 {getFinalDuration()}）</span>
            </p>
          </div>

          {/* Progress */}
          {isGenerating && progressMsg && (
            <div className="flex items-center gap-3 px-4 py-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400 shrink-0" />
              <p className="text-sm text-blue-300">{progressMsg}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex items-center justify-end gap-3 bg-slate-600/80 shrink-0">
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !novelContent.trim()}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                处理中...
              </>
            ) : (
              <>
                <BookOpen className="w-4 h-4" />
                开始拆集
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NovelImportModal;
