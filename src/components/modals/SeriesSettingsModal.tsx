import { BookOpen, ChevronDown, ChevronUp, Film, Image as ImageIcon, Settings, Sparkles, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { PromptTemplateGroup } from '../../prompt/promptTemplate';
import { TemplateGroupService } from '../../prompt/templateGroupService';
import { getEnabledConfigByType } from '../../services/modelConfigService';
import { ModelService } from '../../services/modelService';
import { createNewSeries } from '../../services/seriesService';
import { getAllModelConfigs } from '../../services/storageService';
import { SeriesRecord } from '../../types';
import CustomSelect from '../common/CustomSelect';
import ScriptServiceModal, { ChapterItem as ServiceChapterItem, ScriptItem as ServiceScriptItem } from './ScriptServiceModal';

import {
  DURATION_OPTIONS,
  GENRE_OPTIONS,
  IMAGE_COUNT_OPTIONS,
  IMAGE_SIZE_OPTIONS,
  LANGUAGE_OPTIONS,
  STYLE_OPTIONS
} from './ProjectSettingsModal';

interface SeriesSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  series: SeriesRecord | null; // null = 新建模式, 非 null = 编辑模式
  onSave: (series: SeriesRecord) => void;
}

const SeriesSettingsModal: React.FC<SeriesSettingsModalProps> = ({ isOpen, onClose, series, onSave }) => {
  const [localTitle, setLocalTitle] = useState('');
  const [localDuration, setLocalDuration] = useState('60s');
  const [localLanguage, setLocalLanguage] = useState('中文');
  const [localStyle, setLocalStyle] = useState('真人写实');
  const [localImageSize, setLocalImageSize] = useState('2560x1440');
  const [localImageCount, setLocalImageCount] = useState(0);
  const [localGenre, setLocalGenre] = useState('剧情片');
  const [customDurationInput, setCustomDurationInput] = useState('');
  const [customStyleInput, setCustomStyleInput] = useState('');
  const [customGenreInput, setCustomGenreInput] = useState('');
  const [localGlobalSettings, setLocalGlobalSettings] = useState('');
  const [modelConfigs, setModelConfigs] = useState<any[]>([]);
  const [localLlmProvider, setLocalLlmProvider] = useState('');
  const [localText2imageProvider, setLocalText2imageProvider] = useState('');
  const [localImage2videoProvider, setLocalImage2videoProvider] = useState('');
  const [showModelProviders, setShowModelProviders] = useState(false);
  const [matchedTemplateGroup, setMatchedTemplateGroup] = useState<PromptTemplateGroup | null>(null);
  const [showScriptService, setShowScriptService] = useState(false);
  // Script import state for series
  const [importedScript, setImportedScript] = useState<ServiceScriptItem | null>(null);
  const [importedChapters, setImportedChapters] = useState<ServiceChapterItem[]>([]);
  const [chaptersPerEpisode, setChaptersPerEpisode] = useState(3); // default: 3 chapters per episode

  // Load model configs when modal opens
  useEffect(() => {
    if (isOpen) {
      loadModelConfigs();
      initSystemModelProviders();
    }
  }, [isOpen]);

  const initSystemModelProviders = async () => {
    const llm = await getEnabledConfigByType('llm');
    const text2image = await getEnabledConfigByType('text2image');
    const image2video = await getEnabledConfigByType('image2video');
    if (series) {
      setLocalLlmProvider(series.modelProviders?.llm || llm?.id || '');
      setLocalText2imageProvider(series.modelProviders?.text2image || text2image?.id || '');
      setLocalImage2videoProvider(series.modelProviders?.image2video || image2video?.id || '');
    } else {
      setLocalLlmProvider(llm?.id || '');
      setLocalText2imageProvider(text2image?.id || '');
      setLocalImage2videoProvider(image2video?.id || '');
    }
  };

  const loadModelConfigs = async () => {
    try {
      const configs = await getAllModelConfigs();
      setModelConfigs(configs);
    } catch (error) {
      console.error('Failed to load model configs:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (series) {
        // 编辑模式
        setLocalTitle(series.title);
        setLocalLanguage(series.language || '中文');

        const currentStyle = series.visualStyle || '真人写实';
        const isCustomStyle = !STYLE_OPTIONS.some(opt => opt.value === currentStyle);
        setCustomStyleInput(isCustomStyle ? currentStyle : '');
        setLocalStyle(isCustomStyle ? 'custom' : currentStyle);

        const currentGenre = series.genre || '剧情片';
        const isCustomGenre = !GENRE_OPTIONS.some(opt => opt.value === currentGenre);
        setCustomGenreInput(isCustomGenre ? currentGenre : '');
        setLocalGenre(isCustomGenre ? 'custom' : currentGenre);

        setLocalImageSize(series.imageSize || '2560x1440');
        setLocalImageCount(series.imageCount ?? 0);

        const currentDuration = series.targetDuration || '60s';
        const isCustomDuration = !DURATION_OPTIONS.some(opt => opt.value === currentDuration);
        setLocalDuration(isCustomDuration ? 'custom' : currentDuration);
        setCustomDurationInput(isCustomDuration ? currentDuration : '');

        setLocalGlobalSettings(series.globalSettings || '');

        // Set model providers
        setLocalLlmProvider(series.modelProviders?.llm || '');
        setLocalText2imageProvider(series.modelProviders?.text2image || '');
        setLocalImage2videoProvider(series.modelProviders?.image2video || '');
      } else {
        // 新建模式 - 重置为默认值
        setLocalTitle('未命名剧集');
        setLocalLanguage('中文');
        setLocalStyle('真人写实');
        setCustomStyleInput('');
        setLocalGenre('剧情片');
        setCustomGenreInput('');
        setLocalImageSize('2560x1440');
        setLocalImageCount(0);
        setLocalDuration('60s');
        setCustomDurationInput('');
        setLocalGlobalSettings('');
        setLocalLlmProvider('');
        setLocalText2imageProvider('');
        setLocalImage2videoProvider('');
        // Reset script import state
        setImportedScript(null);
        setImportedChapters([]);
        setChaptersPerEpisode(3);
      }
    }
  }, [isOpen, series]);
  
  useEffect(() => {
    if (isOpen) {
      // 匹配模板组
      const finalStyle = localStyle === 'custom' ? customStyleInput : localStyle;
      const finalGenre = localGenre === 'custom' ? customGenreInput : localGenre;
      const matchedGroup = TemplateGroupService.matchGroup({
        visualStyle: finalStyle,
        genre: finalGenre,
        globalSettings: localGlobalSettings || ''
      });
      setMatchedTemplateGroup(matchedGroup);
    }
  },[localStyle,localGenre,localGlobalSettings,customStyleInput,customGenreInput])

  // Generate episode mappings from imported chapters
  const generateEpisodeMappings = useCallback((): { totalEpisodes: number; mappings: Array<{ episodeIndex: number; chapterNumbers: number[]; label: string }> } => {
    if (importedChapters.length === 0) return { totalEpisodes: 0, mappings: [] };

    const sorted = [...importedChapters].sort((a, b) => a.chapter_number - b.chapter_number);
    const mappings: Array<{ episodeIndex: number; chapterNumbers: number[]; label: string }> = [];
    let epIndex = 1;
    for (let i = 0; i < sorted.length; i += chaptersPerEpisode) {
      const chunk = sorted.slice(i, i + chaptersPerEpisode);
      mappings.push({
        episodeIndex: epIndex,
        chapterNumbers: chunk.map(ch => ch.chapter_number),
        label: `第${epIndex}集 (第${chunk[0].chapter_number}-${chunk[chunk.length - 1].chapter_number}章)`
      });
      epIndex++;
    }
    return { totalEpisodes: epIndex - 1, mappings };
  }, [importedChapters, chaptersPerEpisode]);

  const handleImportScriptForSeries = (script: ServiceScriptItem, chapters: ServiceChapterItem[]) => {
    setImportedScript(script);
    setImportedChapters(chapters);
    // Auto-set title to script topic if default
    if (localTitle === '未命名剧集') {
      setLocalTitle(script.topic);
    }
  };

  // Build full rawScript from imported chapters
  const buildRawScriptFromChapters = (): string => {
    return importedChapters
      .sort((a, b) => a.chapter_number - b.chapter_number)
      .map(ch => `【第${ch.chapter_number}章 ${ch.chapter_title}】\n${ch.chapter_content}`)
      .join('\n\n');
  };

  const saveSettings = () => {
    const finalDuration = localDuration === 'custom' ? customDurationInput : localDuration;
    const finalStyle = localStyle === 'custom' ? customStyleInput : localStyle;
    const finalGenre = localGenre === 'custom' ? customGenreInput : localGenre;
    const newModelProviders = {
      llm: localLlmProvider,
      text2image: localText2imageProvider,
      image2video: localImage2videoProvider
    };

    // Build rawScript and episode mappings from imported script data
    let rawScriptValue: string | undefined;
    let episodeMappings: any[] | undefined;
    if (importedChapters.length > 0) {
      rawScriptValue = buildRawScriptFromChapters();
      const { mappings } = generateEpisodeMappings();
      episodeMappings = mappings.map(m => ({ episodeIndex: m.episodeIndex, chapterNumbers: m.chapterNumbers }));
    }

    if (series) {
      // 编辑模式
      onSave({
        ...series,
        title: localTitle,
        targetDuration: finalDuration,
        language: localLanguage,
        visualStyle: finalStyle,
        genre: finalGenre,
        imageSize: localImageSize,
        imageCount: localImageCount,
        globalSettings: localGlobalSettings,
        modelProviders: newModelProviders,
        ...(rawScriptValue !== undefined && { rawScript: rawScriptValue }),
        ...(episodeMappings !== undefined && { episodeScriptMappings: episodeMappings }),
        updatedAt: Date.now()
      });
    } else {
      // 新建模式 - 创建新 Series
      const newSeries = createNewSeries(localTitle, {
        targetDuration: finalDuration,
        language: localLanguage,
        visualStyle: finalStyle,
        genre: finalGenre,
        imageSize: localImageSize,
        imageCount: localImageCount,
        globalSettings: localGlobalSettings,
        ...(rawScriptValue !== undefined && { rawScript: rawScriptValue })
      });
      newSeries.modelProviders = newModelProviders;
      if (episodeMappings) {
        newSeries.episodeScriptMappings = episodeMappings;
      }
      onSave(newSeries);
    }

    // Apply model provider configuration
    ModelService.setCurrentProjectProviders(newModelProviders);

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 select-text">
      <div className="bg-slate-600/80 border border-slate-600 w-[480px] max-w-[90vw] h-[65vh] overflow-hidden rounded-2xl shadow-2xl flex flex-col select-text">
        <div className="h-16 px-6 border-b border-slate-600 flex items-center justify-between bg-slate-600/80">
          <h3 className="text-lg font-bold text-slate-50 flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-400" />
            {series ? '剧集设置' : '新建剧集'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 bg-slate-700 hover:bg-slate-800 rounded-full text-slate-500 hover:text-slate-50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-2 md:p-6 space-y-2 flex-1 overflow-y-auto bg-slate-700">
          {/* Title Input */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-slate-500 tracking-widest">剧集标题</label>
            <input
              type="text"
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 text-slate-50 px-4 py-2 text-sm rounded-md focus:border-slate-500 focus:outline-none transition-all"
              placeholder="输入剧集名称..."
            />
          </div>

          {/* Language and Visual Style in one row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Language Selection */}
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-slate-500 tracking-widest">输出语言</label>
              <CustomSelect
                options={LANGUAGE_OPTIONS}
                value={localLanguage}
                onChange={setLocalLanguage}
                className="w-full"
              />
            </div>

            {/* Image Size Selection */}
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-slate-500 tracking-widest">图片尺寸</label>
              <CustomSelect
                options={IMAGE_SIZE_OPTIONS}
                value={localImageSize}
                onChange={setLocalImageSize}
                className="w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Genre Selection */}
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-slate-500 tracking-widest">题材类型</label>
              <CustomSelect
                options={GENRE_OPTIONS}
                value={localGenre}
                onChange={setLocalGenre}
                className="w-full"
              />
              {localGenre === 'custom' && (
                <input
                  type="text"
                  value={customGenreInput}
                  onChange={(e) => setCustomGenreInput(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 text-slate-50 px-4 py-2 text-sm rounded-md focus:border-slate-500 focus:outline-none transition-all placeholder:text-slate-600"
                  placeholder="输入自定义类型..."
                />
              )}
            </div>
            {/* Visual Style Selection */}
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-slate-500 tracking-widest">画面风格</label>
              <CustomSelect
                options={STYLE_OPTIONS}
                value={localStyle}
                onChange={setLocalStyle}
                className="w-full"
              />
              {localStyle === 'custom' && (
                <input
                  type="text"
                  value={customStyleInput}
                  onChange={(e) => setCustomStyleInput(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 text-slate-50 px-4 py-2 text-sm rounded-md focus:border-slate-500 focus:outline-none transition-all placeholder:text-slate-600"
                  placeholder="输入自定义画面风格..."
                />
              )}
            </div>
          </div>
          {/* Global Settings */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-slate-500 tracking-widest">补充信息</label>
            <textarea
              value={localGlobalSettings}
              onChange={(e) => setLocalGlobalSettings(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 text-slate-50 px-4 py-2 text-sm rounded-md focus:border-slate-500 focus:outline-none transition-all"
              placeholder="画面风格、历史年代等，如：赛博朋克，2077年"
              rows={2}
            />
            <p className="text-[10px] text-slate-500">
              设置整个剧的画面风格、历史年代等全局统一设定，新分集将继承此设置
            </p>
          </div>

          {/* Script Import Section (for new series) */}
          {!series && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-bold text-slate-500 tracking-widest">剧本导入</label>
                <button
                  onClick={() => setShowScriptService(true)}
                  className="px-3 py-1 text-[11px] font-medium bg-blue-900/30 text-blue-300 border border-blue-700/50 rounded-md hover:bg-blue-900/50 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <BookOpen className="w-3 h-3" /> 从剧本服务导入
                </button>
              </div>

              {importedScript && importedChapters.length > 0 ? (
                <div className="bg-slate-900/50 border border-blue-800/30 rounded-lg p-3 space-y-3">
                  {/* Imported script info */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-blue-300">{importedScript.topic}</span>
                    <span className="text-[10px] text-slate-500">共 {importedChapters.length} 章</span>
                  </div>

                  {/* Chapters per episode control */}
                  <div className="flex items-center gap-3">
                    <label className="text-[11px] text-slate-400 whitespace-nowrap">每集章节数:</label>
                    <input
                      type="number"
                      min={1}
                      max={Math.max(importedChapters.length, 1)}
                      value={chaptersPerEpisode}
                      onChange={(e) => setChaptersPerEpisode(Math.max(1, Math.min(importedChapters.length, parseInt(e.target.value) || 1)))}
                      className="w-16 bg-slate-800 border border-slate-600 text-slate-50 px-2 py-1 text-sm rounded focus:border-slate-500 focus:outline-none text-center"
                    />
                    <span className="text-[11px] text-slate-500">
                      → 共 {generateEpisodeMappings().totalEpisodes} 集
                    </span>
                  </div>

                  {/* Episode mapping preview */}
                  {generateEpisodeMappings().mappings.length > 0 && (
                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                      {generateEpisodeMappings().mappings.map(m => (
                        <div key={m.episodeIndex} className="text-[11px] text-slate-300 font-mono flex items-center gap-2 bg-slate-800/60 rounded px-2 py-1">
                          <span className="text-blue-400 font-bold shrink-0">EP{String(m.episodeIndex).padStart(2, '0')}</span>
                          <span>第{m.chapterNumbers[0]}-{m.chapterNumbers[m.chapterNumbers.length - 1]}章 ({m.chapterNumbers.length}章)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500">未导入剧本，可手动输入或从剧本服务选择</p>
              )}
            </div>
          )}

          {/* Matched Template Group */}
          {matchedTemplateGroup && (
            <div className="space-y-2 p-3 bg-slate-900/50 border border-slate-600 rounded-lg">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-bold text-slate-400 tracking-widest">匹配的模板组</label>
                {matchedTemplateGroup.isBuiltIn && (
                  <span className="text-[10px] text-slate-500 bg-slate-700 px-2 py-0.5 rounded">内置</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-200">{matchedTemplateGroup.name}</span>
                <span className="text-xs text-slate-500">({matchedTemplateGroup.id})</span>
              </div>
              {matchedTemplateGroup.description && (
                <p className="text-[11px] text-slate-400 leading-relaxed">{matchedTemplateGroup.description}</p>
              )}
              {matchedTemplateGroup.matchRules && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {matchedTemplateGroup.matchRules.visualStyle?.map((keyword, i) => (
                    <span key={`vs-${i}`} className="text-[10px] bg-orange-900/50 text-orange-300 px-1.5 py-0.5 rounded border border-orange-500/30">
                      风格: {keyword}
                    </span>
                  ))}
                  {matchedTemplateGroup.matchRules.genre?.map((keyword, i) => (
                    <span key={`g-${i}`} className="text-[10px] bg-purple-900/50 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30">
                      题材: {keyword}
                    </span>
                  ))}
                  {matchedTemplateGroup.matchRules.globalSettings?.map((keyword, i) => (
                    <span key={`gs-${i}`} className="text-[10px] bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30">
                      设定: {keyword}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* Duration Selection */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-slate-500 tracking-widest">每集时长</label>
            <div className="grid grid-cols-2 gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setLocalDuration(opt.value)}
                  className={`px-4 py-2 text-sm font-medium rounded-md duration-200 transition-all text-center border cursor-pointer ${
                    localDuration === opt.value
                    ? 'bg-slate-600 text-slate-50 border-slate-500 shadow-md shadow-slate-500/25'
                    : 'bg-slate-900 text-slate-400 border-slate-600 hover:border-slate-300 hover:text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            {localDuration === 'custom' && (
              <div>
                <input
                  type="text"
                  value={customDurationInput}
                  onChange={(e) => setCustomDurationInput(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 text-slate-50 px-4 py-2 text-sm rounded-md focus:border-slate-500 focus:outline-none font-mono placeholder:text-slate-600"
                  placeholder="输入时长 (如: 90s, 3m)"
                />
              </div>
            )}
            </div>
          </div>

          {/* Image Count Selection */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-slate-500 tracking-widest">参考图数</label>
            <CustomSelect
              options={IMAGE_COUNT_OPTIONS}
              value={localImageCount.toString()}
              onChange={(value) => setLocalImageCount(Number(value))}
              className="w-full"
            />
          </div>

          {/* Divider */}
          <div className="border-t border-slate-600 pt-4">
            <button
              onClick={() => setShowModelProviders(!showModelProviders)}
              className="flex items-center justify-between w-full cursor-pointer"
            >
              <p className="text-[12px] font-bold text-slate-500 tracking-widest">模型供应商</p>
              {showModelProviders ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </button>
          </div>

          {/* LLM Provider Selection */}
          {showModelProviders && (<>
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-slate-500 tracking-widest flex items-center gap-2">
              <Sparkles className="w-3 h-3" />
              大语言模型 (LLM)
            </label>
            <CustomSelect
              options={modelConfigs.filter(c => c.modelType === 'llm' && c.apiKey).map(config => ({
                value: config.id,
                label: `${config.provider} - ${config.description || config.model}`,
                suffix: config.enabled ? ' ✅' : ''
              }))}
              value={localLlmProvider}
              onChange={setLocalLlmProvider}
              className="w-full"
              allowEmpty
              emptyLabel="系统默认模型"
              dropdownPosition="top"
            />
          </div>

          {/* Text2Image Provider Selection */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-slate-500 tracking-widest flex items-center gap-2">
              <ImageIcon className="w-3 h-3" />
              文生图模型
            </label>
            <CustomSelect
              options={modelConfigs.filter(c => c.modelType === 'text2image' && c.apiKey).map(config => ({
                value: config.id,
                label: `${config.provider} - ${config.description || config.model}`,
                suffix: config.enabled ? ' ✅' : ''
              }))}
              value={localText2imageProvider}
              onChange={setLocalText2imageProvider}
              className="w-full"
              allowEmpty
              emptyLabel="系统默认模型"
              dropdownPosition="top"
            />
          </div>

          {/* Image2Video Provider Selection */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-slate-500 tracking-widest flex items-center gap-2">
              <Film className="w-3 h-3" />
              图生视频模型
            </label>
            <CustomSelect
              options={modelConfigs.filter(c => c.modelType === 'image2video' && c.apiKey).map(config => ({
                value: config.id,
                label: `${config.provider} - ${config.description || config.model}`,
                suffix: config.enabled ? ' ✅' : ''
              }))}
              value={localImage2videoProvider}
              onChange={setLocalImage2videoProvider}
              className="w-full"
              allowEmpty
              emptyLabel="系统默认模型"
              dropdownPosition="top"
            />
          </div>
          </>)}
        </div>

        <div className="p-6 border-t border-slate-600 flex gap-3 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-600 text-slate-300 hover:bg-slate-800 text-[11px] font-bold tracking-wider rounded-lg transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={saveSettings}
            className="flex-1 py-3 bg-slate-600 text-slate-50 hover:bg-slate-700 text-[11px] font-bold tracking-wider rounded-lg transition-colors cursor-pointer"
          >
            {series ? '保存设置' : '创建剧集'}
          </button>
        </div>
      </div>

      {/* Script Service Modal for series script selection */}
      <ScriptServiceModal
        isOpen={showScriptService}
        onClose={() => setShowScriptService(false)}
        mode="select-script"
        onSelectScript={handleImportScriptForSeries}
      />
    </div>
  );
};

export default SeriesSettingsModal;
