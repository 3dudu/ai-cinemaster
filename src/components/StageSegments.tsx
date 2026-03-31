import { ChevronLeft, ChevronRight, Clapperboard, Copy, Edit, Film, Loader2, Play, RefreshCw, Sparkles, Trash } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Character, ProjectState, Scene, Segment, SeriesRecord } from '../types';
import {
  convertShotsToSegments,
  generateAllSegmentDescriptions,
  generateAllTransitionDescriptions,
  generateSegmentDescription,
  mergeSegments,
  splitSegment
} from '../utils/segmentUtils';
import { useDialog } from './dialog';
import SegmentEditModal from './modals/SegmentEditModal';

interface StageSegmentsProps {
  project: ProjectState;
  updateProject: (updates: Partial<ProjectState>) => void;
  isMobile: boolean;
  series?: SeriesRecord | null;
  updateSeries?: (series: SeriesRecord) => void;
}

const StageSegments: React.FC<StageSegmentsProps> = ({
  project,
  updateProject,
  isMobile = false,
  series,
  updateSeries,
}) => {
  const dialog = useDialog();

  // Internal merge logic for series mode
  const isSeriesMode = !!project.seriesRefId;
  const activeCharacters = project.scriptData?.characters || [];
  const activeScenes = project.scriptData?.scenes || [];

  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [generatingDescription, setGeneratingDescription] = useState<Set<string>>(new Set());
  const [generatingTransition, setGeneratingTransition] = useState(false);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [segmentEditModalOpen, setSegmentEditModalOpen] = useState(false);
  const [hoveredSegmentId, setHoveredSegmentId] = useState<string | null>(null);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [transitionFromDraft, setTransitionFromDraft] = useState('');
  const [transitionToDraft, setTransitionToDraft] = useState('');

  // Helper function to get character with full library data (in series mode)
  const getCharacterWithAssets = useCallback(
    (charId: string): Character | null => {
      const char = activeCharacters.find((c) => String(c.id) === String(charId));
      if (!char) return null;
      if (!isSeriesMode || !char.refId) return char;
      if (series?.library?.characters) {
        const libraryChar = series.library.characters.find((c) => c.id === char.refId);
        if (libraryChar) return libraryChar;
      }
      return char;
    },
    [activeCharacters, isSeriesMode, series?.library?.characters],
  );

  // Helper function to get scene with full library data (in series mode)
  const getSceneWithAssets = useCallback(
    (sceneId: string): Scene | null => {
      const scene = activeScenes.find((s) => String(s.id) === String(sceneId));
      if (!scene) return null;
      if (!isSeriesMode || !scene.refId) return scene;
      if (series?.library?.scenes) {
        const libraryScene = series.library.scenes.find((s) => s.id === scene.refId);
        if (libraryScene) return libraryScene;
      }
      return scene;
    },
    [activeScenes, isSeriesMode, series?.library?.scenes],
  );

  // Initialize segments if empty
  useEffect(() => {
    const segments = project.segments || [];
    if (segments.length === 0 && project.shots.length > 0) {
      const newSegments = convertShotsToSegments(project.shots);
      updateProject({ segments: newSegments });
    }
  }, [project.segments, project.shots, updateProject]);

  // Generate single segment description
  const handleGenerateDescription = useCallback(
    async (segmentId: string) => {
      const segments = project.segments || [];
      const segment = segments.find((s) => s.id === segmentId);
      if (!segment) return;

      setGeneratingDescription((prev) => new Set([...prev, segmentId]));

      try {
        const description = await generateSegmentDescription(
          segment,
          project.shots,
          activeCharacters,
          activeScenes,
          project.visualStyle,
          project.genre
        );

        updateProject({
          segments: segments.map((s) =>
            s.id === segmentId
              ? { ...s, description, lastModified: Date.now() }
              : s,
          ),
        });
      } catch (error) {
        console.error('生成分片描述失败:', error);
        dialog.toast({ message: '生成分片描述失败，请重试',type: 'error' });
      } finally {
        setGeneratingDescription((prev) => {
          const newSet = new Set(prev);
          newSet.delete(segmentId);
          return newSet;
        });
      }
    },
    [project.segments, project.shots, activeCharacters, activeScenes, updateProject, dialog],
  );

  // Generate all segment descriptions
  const handleBatchGenerateDescriptions = useCallback(async () => {
    const segments = project.segments || [];
    if (segments.length === 0) {
      dialog.toast({ message: '没有片段需要生成描述',type: 'warning' });
      return;
    }

    setBatchGenerating(true);

    try {
      const updatedSegments = await generateAllSegmentDescriptions(
        segments,
        project.shots,
        activeCharacters,
        activeScenes,
        project.visualStyle,
        project.genre
      );

      updateProject({ segments: updatedSegments });
      dialog.toast({ message: `成功生成 ${updatedSegments.length} 个片段描述` ,type: 'success'});
    } catch (error) {
      console.error('批量生成描述失败:', error);
      dialog.toast({ message: '批量生成描述失败，请重试',type: 'error' });
    } finally {
      setBatchGenerating(false);
    }
  }, [project.segments, project.shots, activeCharacters, activeScenes, updateProject, dialog]);

  // Generate all transition descriptions
  const handleBatchGenerateTransitions = useCallback(async () => {
    const segments = project.segments || [];
    if (segments.length < 2) {
      dialog.alert({ message: '至少需要2个片段才能生成转场描述' });
      return;
    }

    setGeneratingTransition(true);

    try {
      const updatedSegments = await generateAllTransitionDescriptions(segments);
      updateProject({ segments: updatedSegments });
      dialog.toast({ message: '成功生成所有转场描述' ,type: 'success'});
    } catch (error) {
      console.error('批量生成转场描述失败:', error);
      dialog.toast({ message: '批量生成转场描述失败，请重试' ,type: 'error'});
    } finally {
      setGeneratingTransition(false);
    }
  }, [project.segments, updateProject, dialog]);

  // Delete segment
  const handleDeleteSegment = useCallback(
    async (segmentId: string) => {
      const confirmed = await dialog.confirm({
        message: '确定要删除此片段吗？删除后分镜将返回到未分配状态。'
      });
      if (!confirmed) return;

      const segments = project.segments || [];
      const segment = segments.find((s) => s.id === segmentId);
      if (!segment) return;

      updateProject({
        segments: segments.filter((s) => s.id !== segmentId),
      });

      dialog.toast({ message: '片段已删除',type: 'success' });
    },
    [project.segments, updateProject, dialog],
  );

  // Merge adjacent segments
  const handleMergeSegments = useCallback(
    async (index1: number, index2: number) => {
      const confirmed = await dialog.confirm({
        message: '确定要合并这两个片段吗？'
      });
      if (!confirmed) return;

      const segments = project.segments || [];
      const newSegments = mergeSegments(segments, index1, index2);
      updateProject({ segments: newSegments });
      dialog.toast({ message: '片段已合并' ,type: 'success'});
    },
    [project.segments, updateProject, dialog],
  );

  // Split segment
  const handleSplitSegment = useCallback(
    async (segmentId: string, shotId: string) => {
      const segments = project.segments || [];
      const segment = segments.find((s) => s.id === segmentId);
      if (!segment) return;

      const newSegments = splitSegment(segment, shotId);
      if (newSegments.length === 1) {
        dialog.toast({ message: '无法在此位置拆分片段' ,type: 'error'});
        return;
      }

      updateProject({ segments: newSegments });
      dialog.toast({ message: '片段已拆分' ,type: 'success'});
    },
    [project.segments, updateProject, dialog],
  );

  // Open edit modal
  const handleEditSegment = useCallback((segment: Segment) => {
    setEditingSegment(segment);
    setSegmentEditModalOpen(true);
  }, []);

  // Save segment from edit modal
  const handleSaveSegment = useCallback(
    (updatedSegment: Segment) => {
      const segments = project.segments || [];
      updateProject({
        segments: segments.map((s) =>
          s.id === updatedSegment.id ? updatedSegment : s,
        ),
      });
      setSegmentEditModalOpen(false);
      setEditingSegment(null);
    },
    [project.segments, updateProject],
  );

  // Get thumbnail image for segment (first shot's start keyframe)
  const getSegmentThumbnail = useCallback(
    (segment: Segment): string | undefined => {
      if (segment.shotIds.length === 0) return undefined;
      const firstShotId = segment.shotIds[0];
      const firstShot = project.shots.find((s) => s.id === firstShotId);
      return firstShot?.keyframes?.find((k) => k.type === 'start')?.imageUrl;
    },
    [project.shots],
  );

  // Calculate total duration
  const totalDuration = (project.segments || []).reduce((sum, s) => sum + s.estimatedDuration, 0);

  // Calculate total shots
  const totalShots = project.shots.length;

  // Get selected segment
  const selectedSegment = useMemo(() => {
    if (!selectedSegmentId) return null;
    return (project.segments || []).find((s) => s.id === selectedSegmentId) || null;
  }, [selectedSegmentId, project.segments]);

  // Update draft when selected segment changes
  useEffect(() => {
    if (selectedSegment) {
      setDescriptionDraft(selectedSegment.description || '');
      setTransitionFromDraft(selectedSegment.transitionFrom || '');
      setTransitionToDraft(selectedSegment.transitionTo || '');
    } else {
      setDescriptionDraft('');
      setTransitionFromDraft('');
      setTransitionToDraft('');
    }
  }, [selectedSegment]);

  // Save description changes
  const handleSaveDescription = useCallback(() => {
    if (!selectedSegment) return;
    const updatedSegment: Segment = {
      ...selectedSegment,
      description: descriptionDraft,
      transitionFrom: transitionFromDraft,
      transitionTo: transitionToDraft,
      lastModified: Date.now(),
    };
    handleSaveSegment(updatedSegment);
    dialog.toast({ message: '描述已保存' ,type: 'success'});
  }, [selectedSegment, descriptionDraft, transitionFromDraft, transitionToDraft, handleSaveSegment, dialog]);

  return (
    <div className="flex flex-col h-full bg-slate-900 relative overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-slate-600 bg-slate-700 md:px-6 px-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Film className="w-5 h-5 text-slate-500" />
          <div>
            <h2 className="text-lg font-bold text-slate-50">片段编辑</h2>
            <p className="text-xs text-slate-400 font-mono">
              {(project.segments || []).length} 个片段 · {totalShots} 个分镜 · 总时长 {totalDuration.toFixed(1)} 秒
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleBatchGenerateDescriptions}
            disabled={batchGenerating || (project.segments || []).length === 0}
            className="px-4 py-2 rounded-lg bg-slate-700 text-slate-50 text-xs font-bold tracking-wide transition-all flex items-center gap-2 hover:bg-slate-600 border border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {batchGenerating ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            批量生成描述
          </button>
          <button
            onClick={handleBatchGenerateTransitions}
            disabled={generatingTransition || (project.segments || []).length < 2}
            className="px-4 py-2 rounded-lg bg-slate-700 text-slate-50 text-xs font-bold tracking-wide transition-all flex items-center gap-2 hover:bg-slate-600 border border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {generatingTransition ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            批量生成转场
          </button>
        </div>
      </div>

      {/* Main Content Area - Video Preview (2/3) + Description Editor (1/3) */}
      <div className="flex-1 flex min-h-0">
        {selectedSegment ? (
          <>
            {/* Left: Video Preview (2/3) */}
            <div className="border-r border-slate-600 p-4 flex flex-col flex-1 overflow-y-auto transition-all duration-500 ease-in-out ">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-50 flex items-center gap-2">
                  <Play className="w-4 h-4 text-slate-500" />
                  片段预览
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  片段 {(project.segments || []).findIndex(s => s.id === selectedSegment.id) + 1} / {(project.segments || []).length}
                </span>
              </div>
              <div className="flex-1 bg-slate-700 rounded-lg overflow-hidden flex items-center justify-center border border-slate-600 p-2 md:p-4">
                <div className="w-full h-full aspect-[9/16] bg-slate-800/50 rounded-lg overflow-hidden border border-slate-600 relative shadow-lg">
                {selectedSegment.videoUrl ? (
                  <video
                    src={selectedSegment.videoUrl}
                    controls
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex w-full h-full flex-col items-center justify-center text-slate-500 aspect-video bg-slate-800/50">
                    <Film className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-sm">暂无视频预览</p>
                    <p className="text-xs text-slate-600">请先在导演工作台生成视频</p>
                  </div>
                )}
                </div>
              </div>
              {/* Shot Thumbnails */}
              <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                {selectedSegment.shotIds.map((shotId, idx) => {
                  const shot = project.shots.find((s) => s.id === shotId);
                  const thumbnail = shot?.keyframes?.find((k) => k.type === 'start')?.imageUrl;
                  return (
                    <div
                      key={shotId}
                      className="flex-shrink-0 w-20 h-12 bg-slate-800 rounded overflow-hidden relative border border-slate-600"
                    >
                      {thumbnail ? (
                        <img src={thumbnail} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Film className="w-4 h-4 text-slate-600" />
                        </div>
                      )}
                      <span className="absolute bottom-0 left-0 right-0 bg-slate-900/80 text-slate-300 text-[10px] text-center">
                        {idx + 1}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Description Editor (1/3) */}
            <div className={`${isMobile ? 'w-full' : 'md:w-[55%] lg:w-[480px] xl:w-[560px] 2xl:w-[640px] 3xl:w-[720px]'} bg-slate-700/50 flex flex-col h-full shadow-2xl animate-in slide-in-from-right-10 duration-300 relative z-20`}>

            <div className="md:p-6 p-2 border-b border-slate-600 flex items-center justify-between bg-slate-600/50 shrink-0">
              <h3 className="text-sm font-bold text-slate-50 flex items-center gap-2">
                <Edit className="w-4 h-4 text-slate-500" />
                描述提示词编辑
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto md:p-6 p-2 space-y-6 border-b border-slate-600">
              {/* Description */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-400 mb-2 tracking-wide">片段描述</label>
                <div className="relative h-[45vh]">
                  <textarea
                    value={descriptionDraft}
                    onChange={(e) => setDescriptionDraft(e.target.value)}
                    placeholder="输入片段描述..."
                    className="w-full h-full p-3 pb-14 text-sm bg-slate-800 border border-slate-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-slate-50 placeholder:text-slate-600"
                  />
                  {/* 底部悬浮按钮层 */}
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-slate-800/65 backdrop-blur-sm border border-slate-600 border-t-slate-600/50 rounded-b-lg flex items-center justify-between">
                    {/* 左边占位 */}
                    <div />
                    {/* 右边按钮组 */}
                    <div className="flex items-center gap-2">
                      {/* 复制按钮 */}
                      <button
                        onClick={() => navigator.clipboard.writeText(descriptionDraft)}
                        disabled={!descriptionDraft.trim()}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-[11px] font-bold tracking-wider rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                        title="复制描述"
                      >
                        <Copy className="w-3 h-3" />
                        复制
                      </button>
                      {/* AI生成按钮 */}
                      <button
                        onClick={() => handleGenerateDescription(selectedSegment.id)}
                        disabled={generatingDescription.has(selectedSegment.id)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-slate-50 text-[11px] font-bold tracking-wider rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                        title="AI生成描述"
                      >
                        {generatingDescription.has(selectedSegment.id) ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            生成中...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3" />
                            AI生成
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transition From */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-400 mb-2 tracking-wide flex items-center gap-1">
                  <ChevronLeft className="w-3 h-3" />
                  入场转场
                </label>
                <textarea
                  value={transitionFromDraft}
                  onChange={(e) => setTransitionFromDraft(e.target.value)}
                  placeholder="描述从上一个片段的转场效果..."
                  className="w-full h-16 p-3 text-sm bg-slate-800 border border-slate-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-slate-50 placeholder:text-slate-600"
                />
              </div>

              {/* Transition To */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-400 mb-2 tracking-wide flex items-center gap-1">
                  <ChevronRight className="w-3 h-3" />
                  出场转场
                </label>
                <textarea
                  value={transitionToDraft}
                  onChange={(e) => setTransitionToDraft(e.target.value)}
                  placeholder="描述到下一个片段的转场效果..."
                  className="w-full h-16 p-3 text-sm bg-slate-800 border border-slate-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-slate-50 placeholder:text-slate-600"
                />
              </div>

            </div>
              {/* Save Button */}
              <button
                onClick={handleSaveDescription}
                className="m-4 px-4 py-2 rounded-lg bg-slate-700 text-slate-50 text-xs font-bold tracking-wide transition-all flex items-center justify-center gap-2 hover:bg-slate-600 border border-slate-600 cursor-pointer"
              >
                保存描述
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <Clapperboard className="w-20 h-20 mb-6 opacity-50" />
            <p className="text-lg font-bold text-slate-400 mb-2">选择一个片段进行编辑</p>
            <p className="text-xs text-slate-600">从下方列表中点击片段查看预览和编辑描述</p>
          </div>
        )}
      </div>

      {/* Bottom: Segments List - Horizontal Scroll */}
      <div className="h-40 border-t border-slate-600 bg-slate-800/50">
        <div className="h-full overflow-x-auto overflow-y-hidden p-3">
          {(project.segments || []).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <p className="text-xs">暂无片段，请先在导演工作台创建分镜</p>
            </div>
          ) : (
            <div className="flex gap-3 h-full">
              {(project.segments || []).map((segment, index) => {
                const thumbnail = getSegmentThumbnail(segment);
                const isSelected = selectedSegmentId === segment.id;

                return (
                  <div
                    key={segment.id}
                    className={`flex-shrink-0 w-48 bg-slate-900 border rounded-lg overflow-hidden cursor-pointer transition-all ${
                      isSelected
                        ? 'border-indigo-500 ring-1 ring-indigo-500/50 shadow-lg shadow-indigo-500/20'
                        : 'border-slate-600 hover:border-slate-400 hover:shadow-lg'
                    }`}
                    onClick={() => setSelectedSegmentId(segment.id)}
                    onMouseEnter={() => setHoveredSegmentId(segment.id)}
                    onMouseLeave={() => setHoveredSegmentId(null)}
                  >
                    {/* Thumbnail */}
                    <div className="relative w-full h-full bg-slate-800 overflow-hidden">
                      {thumbnail ? (
                        <img
                          src={thumbnail}
                          alt={`片段 ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                          <Film className="w-5 h-5" />
                        </div>
                      )}
                      {/* Index Badge */}
                      <div className="absolute top-1 left-1 bg-slate-900/80 text-slate-300 text-[10px] px-1.5 py-0.5 rounded">
                        {index + 1}
                      </div>
                      {/* Duration Badge */}
                      <div className="absolute top-1 right-1 bg-slate-900/80 text-slate-300 text-[10px] px-1.5 py-0.5 rounded">
                        {segment.estimatedDuration.toFixed(0)}s
                      </div>
                      {/* Play Icon on Hover */}
                      {hoveredSegmentId === segment.id && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Play className="w-5 h-5 text-white" />
                        </div>
                      )}

                      <div className="absolute bottom-1 w-full flex items-center justify-between px-1.5 py-0.5">
                        <span className="text-[10px] text-slate-500 font-mono">
                          {segment.shotIds.length} 镜
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditSegment(segment);
                            }}
                            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 transition-colors"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSegment(segment.id);
                            }}
                            className="p-1 hover:bg-red-900/30 rounded text-slate-400 hover:text-red-400 transition-colors"
                          >
                            <Trash className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Segment Edit Modal */}
      {editingSegment && segmentEditModalOpen && (
        <SegmentEditModal
          segment={editingSegment}
          allShots={project.shots}
          allCharacters={activeCharacters}
          allScenes={activeScenes}
          getCharacterWithAssets={getCharacterWithAssets}
          getSceneWithAssets={getSceneWithAssets}
          isOpen={segmentEditModalOpen}
          onClose={() => setSegmentEditModalOpen(false)}
          onSave={handleSaveSegment}
        />
      )}
    </div>
  );
};

export default StageSegments;
