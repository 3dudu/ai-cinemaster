import { Loader2, NotebookPen, RefreshCw, RotateCcw, Save, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { ModelService } from '../services/modelService';
import { ScriptData, Shot } from '../types';
import { useDialog } from './dialog';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  shot: Shot | null;
  scriptData: ScriptData | null;
  visualStyle: string;
  onSave: (videoPrompt: string) => void;
}

const VideoPromptModal: React.FC<Props> = ({
  isOpen,
  onClose,
  shot,
  scriptData,
  visualStyle,
  onSave
}) => {
  const dialog = useDialog();
  const [videoPrompt, setVideoPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Reset when modal opens or shot changes
  useEffect(() => {
    if (isOpen && shot?.interval?.videoPrompt) {
      setVideoPrompt(shot.interval.videoPrompt);
      setHasChanges(false);
    } else if (isOpen) {
      setVideoPrompt('');
      setHasChanges(false);
    }
  }, [isOpen, shot]);

  const handleRegenerate = async () => {
    if (!shot || !scriptData) return;

    setIsGenerating(true);
    try {
      const newPrompt = await ModelService.generateVideoPrompt(shot, scriptData, visualStyle);
      setVideoPrompt(newPrompt);
      setHasChanges(true);
    } catch (error) {
      console.error('生成视频提示词失败:', error);
      await dialog.alert({
        title: '错误',
        message: '生成视频提示词失败，请重试。',
        type: 'error'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    if (videoPrompt.trim()) {
      onSave(videoPrompt.trim());
      onClose();
    }
  };

  const handleReset = () => {
    if (shot?.interval?.videoPrompt) {
      setVideoPrompt(shot.interval.videoPrompt);
      setHasChanges(false);
    } else {
      setVideoPrompt('');
      setHasChanges(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-700/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 select-text">
      <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl overflow-hidden w-full max-w-2xl h-[80vh] flex flex-col">
        {/* 标题栏 */}
        <div className="h-16 px-6 border-b border-slate-600 flex items-center justify-between bg-slate-600/80 shrink-0">
          <h3 className="text-lg font-bold text-slate-50 flex items-center gap-2">
            <NotebookPen className="w-5 h-5 text-slate-400" />
            视频提示词
          </h3>
          <button
            onClick={onClose}
            className="p-2 bg-slate-700 hover:bg-slate-800 rounded-full text-slate-500 hover:text-slate-50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-hidden flex flex-col bg-slate-700">
          {/* 工具栏 */}
          <div className="p-4 md:p-6 bg-slate-600/80 border-t border-slate-600 space-y-3 shrink-0">
            {/* 镜头信息 */}
            {shot && (
              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span><span className="text-slate-300 font-bold">镜头情节：</span>{shot.actionSummary}</span>
                  <span><span className="text-slate-300 font-bold">镜头运动：</span>{shot.cameraMovement}</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span><span className="text-slate-300 font-bold">景别：</span>{shot.shotSize || '-'}</span>
                  <span><span className="text-slate-300 font-bold">时长：</span>{shot.interval?.duration}s</span>
                  <span><span className="text-slate-300 font-bold">画面风格：</span>{visualStyle}</span>
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-2 items-center">
              {/* 状态指示 */}
              {hasChanges && (
                  <div className="flex items-center gap-2 text-sm text-green-600 bg-slate-900/20 px-3 py-2 rounded-lg border border-green-600">
                  <div className="w-2 h-2 bg-green-600 rounded-full" />
                  <span>已修改</span>
                </div>
              )}
              <div className="flex-1" />
              {hasChanges && (
                <button
                  onClick={handleReset}
                  disabled={isGenerating}
                  className="px-4 py-2 bg-slate-700 text-slate-300 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-4 h-4" />
                  重置
                </button>
              )}
              <button
                onClick={handleRegenerate}
                disabled={isGenerating}
                className="px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    AI生成
                  </>
                )}
              </button>
              <button
                onClick={handleSave}
                disabled={!videoPrompt.trim() || isGenerating}
                className="px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                保存
              </button>
            </div>
          </div>

          {/* 编辑器 */}
          <div className="flex-1 overflow-hidden">
            <textarea
              value={videoPrompt}
              onChange={(e) => {
                setVideoPrompt(e.target.value);
                setHasChanges(true);
              }}
              disabled={isGenerating}
              className="w-full h-full bg-slate-800 text-slate-100 p-4 font-mono text-sm resize-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="点击 重新生成 按钮通过 LLM 生成视频拍摄提示词，或在此手动编辑..."
              spellCheck={false}
            />
          </div>
        </div>

        {/* 底部信息 */}
        <div className="p-4 border-t border-slate-700 flex justify-end items-center text-sm text-slate-400 bg-slate-600/80 shrink-0">
          <span>字符数：{videoPrompt.length}</span>
        </div>
      </div>
    </div>
  );
};

export default VideoPromptModal;
