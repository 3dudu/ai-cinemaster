import { renderGroupTemplate } from '@/prompt/templateGroupService';
import { ModelService } from '@/services/modelService';
import { createLightweightCharacters, createLightweightScenes, mergeToLibrary, remapScriptDataRefs } from '@/services/seriesService';
import { Box, ChevronLeft, ChevronRight, Clapperboard, Copy, Edit, Film, ListVideo, Loader2, NotebookPen, Play, Plus, RefreshCw, RotateCcw, Sparkles, Trash, Video, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addMediaHistory } from '../services/storageService';
import { Character, ProjectState, Properties, Scene, Segment, SeriesRecord } from '../types';
import { generateVideoThumbnail, getVideoDuration, getVideoFrameAtTime, getVideoLastFrame } from "../utils/imageUtils";
import CustomSelect from './common/CustomSelect';

import {
  aiConvertShotsToSegments,
  convertShotsToSegments,
  generateAllTransitionDescriptions,
  generateSegmentDescription,
  generateTransitionDescription
} from '../utils/segmentUtils';
import { useDialog } from './dialog';
import SegmentEditModal from './modals/SegmentEditModal';
import SegmentPreviewModal from './modals/SegmentPreviewModal';

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
  
  // Memoized active characters and scenes to prevent re-calculation on every render
  const activeCharacters = useMemo(() => 
    isSeriesMode ? (series?.library?.characters || []) : (project.scriptData?.characters || []),
    [isSeriesMode, series?.library?.characters, project.scriptData?.characters]
  );
  
  const activeScenes = useMemo(() => 
    isSeriesMode ? (series?.library?.scenes || []) : (project.scriptData?.scenes || []),
    [isSeriesMode, series?.library?.scenes, project.scriptData?.scenes]
  );

  const activeProps = useMemo(() => 
    isSeriesMode ? (series?.library?.props || []) : (project.scriptData?.props || []),
    [isSeriesMode, series?.library?.props, project.scriptData?.props]
  );

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
  const [editingScript, setEditingScript] = useState(isMobile?false:true);  // 控制描述编辑区显示
  const [generatingVideo, setGeneratingVideo] = useState<string | null>(null);  // 视频生成状态
  const [videoGenerateStartTime, setVideoGenerateStartTime] = useState<number | null>(null);  // 视频生成开始时间
  const [videoElapsedSeconds, setVideoElapsedSeconds] = useState<number>(0);  // 已耗时秒数
  const [batchGeneratingVideos, setBatchGeneratingVideos] = useState(false);  // 批量生成视频状态
  const [insertIndex, setInsertIndex] = useState<number | null>(null);  // 新片段插入位置
  const [previewModalOpen, setPreviewModalOpen] = useState(false);  // 预览模态框状态
  const [aiSplitting, setAiSplitting] = useState(false);  // AI 分镜等待遮罩
  const [curProjectid, setCurProjectid] = useState<string | null>(null);
  const [refreshingTailFrame, setRefreshingTailFrame] = useState(false);  // 刷新尾帧中
  const [tailFrameTime, setTailFrameTime] = useState<number>(0);  // 尾帧时间点（秒）
  const [prevSegmentDuration, setPrevSegmentDuration] = useState<number>(0);  // 前一片段视频时长
  const [refreshingFirstFrame, setRefreshingFirstFrame] = useState<Set<string>>(new Set());  // 刷新首帧中的片段ID集合

  // 实时更新视频生成耗时
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (generatingVideo && videoGenerateStartTime) {
      interval = setInterval(() => {
        setVideoElapsedSeconds(Math.floor((Date.now() - videoGenerateStartTime) / 1000));
      }, 1000);
    } else {
      setVideoElapsedSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [generatingVideo, videoGenerateStartTime]);

  // @ Mention Picker States
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false);
  const [mentionPickerPosition, setMentionPickerPosition] = useState({ top: 0, left: 0 });
  const [mentionSearchText, setMentionSearchText] = useState('');
  const [mentionStartPos, setMentionStartPos] = useState<number | null>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Refs for auto-scroll to selected segment
  const segmentRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Helper function to get character with full library data (in series mode)
  const getCharacterWithAssets = useCallback(
    (charId: string): Character | null => {
      const char = activeCharacters.find((c) => String(c.id) === String(charId));
      return char;
    },
    [activeCharacters, isSeriesMode, series?.library?.characters],
  );

  // Helper function to get scene with full library data (in series mode)
  const getSceneWithAssets = useCallback(
    (sceneId: string): Scene | null => {
      const scene = activeScenes.find((s) => String(s.id) === String(sceneId));
      return scene;
    },
    [activeScenes, isSeriesMode, series?.library?.scenes],
  );

  // Helper function to get prop with full library data (in series mode)
  const getPropWithAssets = useCallback(
    (propId: string): Properties | null => {
      const prop = activeProps.find((p) => String(p.id) === String(propId));
      return prop;
    },
    [activeProps, isSeriesMode, series?.library?.props],
  );

  // Initialize segments if empty
  useEffect(() => {
    if (!project.initSegment && project.shots.length > 0) {
      const newSegments = convertShotsToSegments(project.shots);
      updateProject({ segments: newSegments,initSegment:true });
    }
  }, [project.segments, project.shots, updateProject]);

  // Generate single segment description
  const handleGenerateDescription = useCallback(
    async (segmentId: string) => {
      const segments = project.segments || [];
      const segment = segments.find((s) => s.id === segmentId);
      if (!segment) return;
      // 如果已有 videoPrompt，询问用户选择
      if (segment.videoPrompt) {
        const choice = await dialog.confirm({
          title: '已有分镜描述',
          message: '该片段已有分镜描述，请选择操作方式：',
          type: 'info',
          confirmText: '重新生成',
          cancelText: '优化当前',
        });
        // choice: true = 重新生成, false = 优化
        await doGenerateDescription(segmentId, !choice);
      } else {
        await doGenerateDescription(segmentId, false);
      }
    },
    [project.segments, dialog,descriptionDraft],
  );

  // 实际执行生成分片描述
  const doGenerateDescription = useCallback(
    async (segmentId: string, optimizeMode: boolean) => {
      const segments = project.segments || [];
      const segment = segments.find((s) => s.id === segmentId);
      if (!segment) return;
      setGeneratingDescription((prev) => new Set([...prev, segmentId]));
      const segmentIndex = segments.findIndex((s) => s.id === segmentId);
      try {
        const description = await generateSegmentDescription(
          segment,
          project.shots,
          activeCharacters,
          activeScenes,
          project.visualStyle,
          project.genre,
          project.rawScript,
          optimizeMode?descriptionDraft:segment.description||'',
          segmentIndex+1,
          segment.estimatedDuration||project.segmentDuration,
          project.imageSize,
          project.globalSettings,
          optimizeMode ? descriptionDraft||segment.videoPrompt||segment.description:'', // 优化模式传入现有提示词
          activeProps,
        );
        if(!description){
          dialog.toast({ message: '生成分片描述失败，请重试',type: 'error' });
          return;
        }
        updateProject({
          segments: segments.map((s) =>
            s.id === segmentId
              ? { ...s, videoPrompt: description, lastModified: Date.now() }
              : s,
          ),
        });
      } catch (error) {
        dialog.toast({ message: '生成分片描述失败，请重试',type: 'error' });
      } finally {
        setGeneratingDescription((prev) => {
          const newSet = new Set(prev);
          newSet.delete(segmentId);
          return newSet;
        });
      }
    },
    [project.segments, project.shots, activeCharacters, activeScenes, updateProject, dialog,descriptionDraft],
  );

  // Generate all segment descriptions
  const handleBatchGenerateDescriptions = useCallback(async () => {
    const segments = project.segments || [];
    if (segments.length === 0) {
      dialog.toast({ message: '没有片段需要生成描述',type: 'warning' });
      return;
    }

    setBatchGenerating(true);

    let successCount = 0;
    // 使用累积数组，避免每次更新后覆盖之前的修改
    let currentSegments = [...segments];

    try {
      // 逐个生成描述，每生成一个就保存一次
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        setSelectedSegmentId(segment.id);
        try {
          const description = await generateSegmentDescription(
            segment,
            project.shots,
            activeCharacters,
            activeScenes,
            project.visualStyle,
            project.genre,
            project.rawScript,
            segment.description||'',
            i+1,
            segment.estimatedDuration||project.segmentDuration,
            project.imageSize,
            project.globalSettings,
            null,
            activeProps
          );
          if(!description){
            dialog.toast({ message: `生成片段 ${segment.name || segment.id} 描述失败`, type: 'error' });
            continue;
          }
          // 更新当前 segment 并保存
          /*
          segments[i].description=description;
          updateProject({ segments: [...segments] });
          successCount++;
          */
          const segmentIndex = currentSegments.findIndex(s => s.id === segment.id);
          if (segmentIndex >= 0) {
            currentSegments[segmentIndex] = {
              ...currentSegments[segmentIndex],
              videoPrompt: description,
              lastModified: Date.now(),
            };
            updateProject({ segments: [...currentSegments] });
            successCount++;
          }
          dialog.toast({ message: `成功生成 ${successCount} / ${segments.length} 个片段描述`, type: 'success' });
        } catch (err) {
          dialog.toast({ message: `生成片段 ${segment.name || segment.id} 描述失败: ${err}`, type: 'error' });
          // 继续生成下一个
        }
      }
    } catch (error) {
      dialog.toast({ message: '批量生成描述失败，请重试', type: 'error' });
    } finally {
      setBatchGenerating(false);
    }
  }, [project.segments, project.shots, activeCharacters, activeScenes, project.visualStyle, project.genre, project.rawScript, project.scriptData?.storyParagraphs, updateProject, dialog]);

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

  // Open edit modal
  const handleEditSegment = useCallback((segment: Segment) => {
    setEditingSegment(segment);
    setSegmentEditModalOpen(true);
  }, []);

  // Add new segment after current index
  const handleAddSegmentAfter = useCallback((index: number) => {
    const newSegment: Segment = {
      id: `segment-${Date.now()}`,
      name: `片段 ${(project.segments || []).length + 1}`,
      shotIds: [],
      sceneIds: [],
      characterIds: [],
      description: '',
      videoPrompt: '',
      transitionFrom: '',
      transitionTo: '',
      estimatedDuration: 0,
      motionIntensity: 5,
      emotionCurve: '',
      dialogueRhythm: '',
      createdAt: Date.now(),
      lastModified: Date.now(),
      propIds: [],
    };
    setEditingSegment(newSegment);
    setInsertIndex(index + 1);
    setSegmentEditModalOpen(true);
  }, [project.segments]);

  // Save segment from edit modal
  const handleSaveSegment = useCallback(
    (updatedSegment: Segment) => {
      const segments = project.segments || [];
      if ((editingSegment|| selectedSegment) && !insertIndex){
        // Update existing segment
        updateProject({
          segments: segments.map((s) =>
            s.id === updatedSegment.id ? updatedSegment : s,
          ),
        });
        setEditingSegment(null);
      } else {
        // Insert new segment at specified position
        const newSegments = [...segments];
        const insertPos = insertIndex !== null ? insertIndex : newSegments.length;
        newSegments.splice(insertPos, 0, updatedSegment);
        updateProject({ segments: newSegments });
      }
      setSegmentEditModalOpen(false);
      setInsertIndex(null);
    },
    [project.segments, updateProject, editingSegment, insertIndex],
  );

  // Get thumbnail image for segment (priority: firstFrameThumbnail > scene reference image)
  const getSegmentThumbnail = useCallback(
    (segment: Segment): string | undefined => {
      // 优先使用视频首帧缩略图
      if (segment.firstFrameThumbnail) {
        return segment.firstFrameThumbnail;
      }
      // 次选使用场景参考图
      const sceneids = segment.sceneIds.find(sceneid=>{
        const scene = activeScenes.find((s) => String(s.id) === String(sceneid));
        return scene && scene.referenceImage;
      });
      if(sceneids){
        const scene = activeScenes.find((s) => String(s.id) === String(sceneids));
        return scene.referenceImage;
      }
    },
    [activeScenes],
  );

  // Calculate total duration - memoized to prevent re-calculation
  const totalDuration = useMemo(() => 
    (project.segments || []).reduce((sum, s) => sum + s.estimatedDuration, 0),
    [project.segments]
  );

  // Calculate total shots - memoized to prevent re-calculation
  const totalShots = useMemo(() => 
    project.shots.length,
    [project.shots]
  );
  // Auto-select first segment when segments are available
  useEffect(() => {
    if(curProjectid!=project.id){
      setCurProjectid(project.id);
      setSelectedSegmentId(null);
    }
    const segments = project.segments || [];
    if (segments.length > 0 && !selectedSegmentId) {
      setSelectedSegmentId(segments[0].id);
    }
  }, [project,project.segments, selectedSegmentId]);

  // 当前选中 segment 的索引
  const activeSegmentIndex = useMemo(() => {
    if (!selectedSegmentId) return -1;
    return (project.segments || []).findIndex((s) => s.id === selectedSegmentId);
  }, [selectedSegmentId, project.segments]);

  // Get selected segment
  const selectedSegment = useMemo(() => {
    if (activeSegmentIndex < 0) return null;
    return (project.segments || [])?.[activeSegmentIndex] || null;
  }, [activeSegmentIndex, project.segments]);

  // Auto-scroll selected segment into view
  useEffect(() => {
    if (selectedSegmentId) {
      const element = segmentRefs.current.get(selectedSegmentId);
      const container = scrollContainerRef.current;
      if (element && container) {
        const elementRect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const isOverflowing = elementRect.left < containerRect.left || elementRect.right > containerRect.right;

        if (isOverflowing) {
          element.scrollIntoView({
            behavior: 'smooth',
            inline: 'center',
            block: 'nearest',
          });
        }
      }
    }
  }, [selectedSegmentId]);

  // Update draft when selected segment changes
  useEffect(() => {
    if (selectedSegment) {
      // videoPrompt 优先，无值时回退到 description
      setDescriptionDraft(selectedSegment.videoPrompt || selectedSegment.description || '');
      setTransitionFromDraft(selectedSegment.transitionFrom || '');
      setTransitionToDraft(selectedSegment.transitionTo || '');
    } else {
      setDescriptionDraft('');
      setTransitionFromDraft('');
      setTransitionToDraft('');
    }
  }, [selectedSegment]);

  // Get previous segment's video duration
  useEffect(() => {
    const fetchDuration = async () => {
      if (activeSegmentIndex > 0) {
        const prevSegment = (project.segments || [])[activeSegmentIndex - 1];
        if (prevSegment?.videoUrl) {
          const duration = await getVideoDuration(prevSegment.videoUrl);
          setPrevSegmentDuration(duration);
          // 默认设置为视频末尾
          setTailFrameTime(Math.max(0, duration - 0.5));
        } else {
          setPrevSegmentDuration(0);
        }
      } else {
        setPrevSegmentDuration(0);
      }
    };
    fetchDuration();
  }, [activeSegmentIndex, project.segments]);

  // Save description changes
  const handleSaveDescription = useCallback(() => {
    if (!selectedSegment) return;
    const updatedSegment: Segment = {
      ...selectedSegment,
      videoPrompt: descriptionDraft,
      transitionFrom: transitionFromDraft,
      transitionTo: transitionToDraft,
      lastModified: Date.now(),
    };
    handleSaveSegment(updatedSegment);
    dialog.toast({ message: '描述已保存' ,type: 'success'});
  }, [selectedSegment, descriptionDraft, transitionFromDraft, transitionToDraft, handleSaveSegment, dialog]);

  // Refresh last frame thumbnail from previous segment
  const handleRefreshTailFrame = useCallback(async (timeSeconds: number) => {
    if (!selectedSegment || activeSegmentIndex <= 0) return;

    const segments = project.segments || [];
    const prevSegment = segments[activeSegmentIndex - 1];

    if (!prevSegment?.videoUrl) {
      dialog.toast({ message: '前一片段没有视频', type: 'warning' });
      return;
    }

    setRefreshingTailFrame(true);
    try {
      const frame = await getVideoFrameAtTime(prevSegment.videoUrl, timeSeconds);
      if (frame) {
        // Update previous segment's lastFrameThumbnail
        const updatedSegments = segments.map(s =>
          s.id === prevSegment.id ? { ...s, lastFrameThumbnail: frame } : s
        );
        updateProject({ segments: updatedSegments });
        dialog.toast({ message: '尾帧已更新', type: 'success' });
      } else {
        dialog.toast({ message: '获取帧失败', type: 'error' });
      }
    } catch (error) {
      dialog.toast({ message: '刷新尾帧失败', type: 'error' });
    } finally {
      setRefreshingTailFrame(false);
    }
  }, [selectedSegment, activeSegmentIndex, project.segments, updateProject, dialog]);

  // Refresh first frame thumbnail for a segment
  const handleRefreshFirstFrame = useCallback(async (segmentId: string) => {
    const segments = project.segments || [];
    const segment = segments.find(s => s.id === segmentId);

    if (!segment?.videoUrl) {
      dialog.toast({ message: '片段没有视频', type: 'warning' });
      return;
    }

    setRefreshingFirstFrame(prev => new Set(prev).add(segmentId));
    try {
      const thumbnail = await generateVideoThumbnail(segment.videoUrl, 2);
      if (thumbnail) {
        const updatedSegments = segments.map(s =>
          s.id === segmentId ? { ...s, firstFrameThumbnail: thumbnail, lastModified: Date.now() } : s
        );
        updateProject({ segments: updatedSegments });
        dialog.toast({ message: '首帧已更新', type: 'success' });
      } else {
        dialog.toast({ message: '获取首帧失败', type: 'error' });
      }
    } catch (error) {
      dialog.toast({ message: '刷新首帧失败', type: 'error' });
    } finally {
      setRefreshingFirstFrame(prev => {
        const newSet = new Set(prev);
        newSet.delete(segmentId);
        return newSet;
      });
    }
  }, [project.segments, updateProject, dialog]);

  // Reconvert shots to segments
  const handleReconvertSegments = useCallback(async () => {
    // shots 为空时，从 rawScript 直接生成片段
    if (project.shots.length === 0) {
      if (!project.rawScript?.trim()) {
        dialog.toast({ message: '没有剧本内容，请先在剧本阶段输入内容', type: 'warning' });
        return;
      }

      const confirmed = await dialog.confirm({
        title: '生成片段',
        message: '当前没有分镜数据，是否从剧本直接生成片段？',
        confirmText: '生成片段',
        cancelText: '取消',
      });
      if (!confirmed) return;

      setAiSplitting(true);
      try {
        // 1. 解析剧本获取角色和场景
        let scriptData = project.scriptData;
        
        // 如果没有 scriptData，先解析剧本
        if (!scriptData || !scriptData.scenes || scriptData.scenes.length === 0) {
          ModelService.setCurrentProjectProviders(project.modelProviders);
          scriptData = await ModelService.parseScriptToData(
            project.rawScript, 
            project.language || '中文', 
            project.genre || '剧情片',
            project.globalSettings || '',
            project.targetDuration || '60s'
          );
          
          if (!scriptData || scriptData.scenes.length === 0) {
            dialog.toast({ message: '解析剧本失败', type: 'error' });
            return;
          }
          
          scriptData.targetDuration = project.targetDuration;
          scriptData.language = project.language;
          scriptData.title = project.title;
          scriptData.genre = project.genre;
        }

        // 2. Series 模式：合并到 library
        if (series && updateSeries) {
          const { series: updatedSeries, charIdMapping, sceneIdMapping,propIdMapping } = 
            mergeToLibrary(series, scriptData.characters, scriptData.scenes,scriptData.props);
          
          scriptData = remapScriptDataRefs(scriptData, charIdMapping, sceneIdMapping,propIdMapping);
          scriptData.characters = createLightweightCharacters(scriptData.characters, charIdMapping);
          scriptData.scenes = createLightweightScenes(scriptData.scenes, sceneIdMapping);
          updateSeries(updatedSeries);
        }

        // 3. 从剧本直接生成片段
        const segments = await ModelService.generateSegmentsFromScript(
          project.rawScript,
          scriptData,
          project.visualStyle,
          project.genre,
          project.language,
          project.targetDuration,
          project.segmentDuration,
          project.globalSettings
        );

        if (segments.length === 0) {
          dialog.toast({ message: '生成片段失败', type: 'error' });
          return;
        }

        updateProject({ 
          scriptData,
          segments, 
          isSegmentMode: true,
          initSegment: true 
        });
        setSelectedSegmentId(segments[0].id);
        dialog.toast({ message: `已生成 ${segments.length} 个片段`, type: 'success' });
      } catch (error) {
        console.error('生成片段失败:', error);
        dialog.toast({ message: '生成片段失败，请重试', type: 'error' });
      } finally {
        setAiSplitting(false);
      }
      return;
    }

    const confirmed = project.segments.length ==0 || await dialog.confirm({
      title: '重新拆分片段',
      message: '这将根据当前分镜重新生成片段，现有片段的描述和转场设置将被重置。是否继续？',
      confirmText: '重新拆分',
      cancelText: '取消',
    });
    if(confirmed){

      // 拆分前询问用户
    const useAi = await dialog.confirm({
      title: '拆分片段',
      message: '是否使用 AI 智能拆分？',
      confirmText: 'AI 智能拆分',
      cancelText: '规则拆分'
    });

    let newSegments: Segment[];
    if (useAi) {
      // AI 拆分（失败返回 null）
      setAiSplitting(true);
      try {
        const characters = isSeriesMode ? series?.library?.characters : project.scriptData.characters;
        const scenes = isSeriesMode ? series?.library?.scenes : project.scriptData.scenes;
        const props = isSeriesMode ? series?.library?.props : project.scriptData.props;
        newSegments = await aiConvertShotsToSegments(
          project.shots, characters, scenes, project.visualStyle, project.genre,project.segmentDuration,props,project.globalSettings
        ) ?? [];
        if (newSegments.length === 0) {
          dialog.toast({ message: 'AI 拆分失败', type: 'error' });
          return;
        }
      } finally {
        setAiSplitting(false);
      }
    } else {
      // 规则拆分（默认）
      newSegments = convertShotsToSegments(project.shots);
    }

    updateProject({ segments: newSegments });
    setSelectedSegmentId(null);
    dialog.toast({ message: `已重新拆分为 ${newSegments.length} 个片段`, type: 'success' });
    }
  }, [project.shots, project.rawScript, project.scriptData, project.modelProviders, project.visualStyle, project.genre, project.language, project.targetDuration, updateProject, dialog, series, updateSeries, isSeriesMode]);

  // Generate single transition (from)
  const handleGenerateTransitionFrom = useCallback(async () => {
    if (!selectedSegment) return;
    const segments = project.segments || [];
    const currentIndex = segments.findIndex(s => s.id === selectedSegment.id);
    if (currentIndex <= 0) {
      dialog.toast({ message: '当前片段是第一个片段，没有入场转场', type: 'warning' });
      return;
    }
    
    setGeneratingTransition(true);
    try {
      const fromSegment = segments[currentIndex - 1];
      const toSegment = segments[currentIndex];
      const transition = await generateTransitionDescription(
        fromSegment,
        toSegment,
        fromSegment.description,
        toSegment.description
      );
      setTransitionFromDraft(transition);
      dialog.toast({ message: '入场转场生成成功', type: 'success' });
    } catch (error) {
      console.error('生成入场转场失败:', error);
      dialog.toast({ message: '生成入场转场失败', type: 'error' });
    } finally {
      setGeneratingTransition(false);
    }
  }, [selectedSegment, project.segments, dialog]);

  // Generate single transition (to)
  const handleGenerateTransitionTo = useCallback(async () => {
    if (!selectedSegment) return;
    const segments = project.segments || [];
    const currentIndex = segments.findIndex(s => s.id === selectedSegment.id);
    if (currentIndex < 0 || currentIndex >= segments.length - 1) {
      dialog.toast({ message: '当前片段是最后一个片段，没有出场转场', type: 'warning' });
      return;
    }
    
    setGeneratingTransition(true);
    try {
      const fromSegment = segments[currentIndex];
      const toSegment = segments[currentIndex + 1];
      const transition = await generateTransitionDescription(
        fromSegment,
        toSegment,
        fromSegment.description,
        toSegment.description
      );
      setTransitionToDraft(transition);
      dialog.toast({ message: '出场转场生成成功', type: 'success' });
    } catch (error) {
      console.error('生成出场转场失败:', error);
      dialog.toast({ message: '生成出场转场失败', type: 'error' });
    } finally {
      setGeneratingTransition(false);
    }
  }, [selectedSegment, project.segments, dialog]);

  // Copy text to clipboard
  const handleCopyText = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      dialog.toast({ message: `${label}已复制`, type: 'success' });
    } catch (error) {
      dialog.toast({ message: '复制失败', type: 'error' });
    }
  }, [dialog]);

  // Navigate to previous segment
  const goToPrevSegment = useCallback(() => {
    const segments = project.segments || [];
    if (activeSegmentIndex > 0) {
      setSelectedSegmentId(segments[activeSegmentIndex - 1].id);
    }
  }, [activeSegmentIndex, project.segments])

  // Handle wheel event for horizontal scrolling
  const handleThumbnailWheel = useCallback((e: React.WheelEvent) => {
    if (scrollContainerRef.current) {
      e.preventDefault();
      scrollContainerRef.current.scrollLeft += e.deltaY;
    }
  }, []);

  // Navigate to next segment
  const goToNextSegment = useCallback(() => {
    const segments = project.segments || [];
    if (activeSegmentIndex >= 0 && activeSegmentIndex < segments.length - 1) {
      setSelectedSegmentId(segments[activeSegmentIndex + 1].id);
    }
  }, [activeSegmentIndex, project.segments]);

  // Generate video for segment
  const handleGenerateSegmentVideo = useCallback(async () => {
    if (!selectedSegment) return;
    // 如果已有视频，需要用户确认
    if (selectedSegment.videoUrl) {
      const confirmed = await dialog.confirm({
        title: '重新生成视频',
        message: '该片段已有视频，确定要重新生成吗？这将覆盖现有视频。',
        type: 'warning'
      });
      if (!confirmed) return;
    }

    setGeneratingVideo(selectedSegment.id);
    setVideoGenerateStartTime(Date.now());
    try {
      // 如果 videoPrompt 为空，先生成 videoPrompt
      let currentDescription = selectedSegment.videoPrompt || selectedSegment.description;
      const segments = project.segments || [];
      const segmentIndex = segments.findIndex((s) => s.id === selectedSegment.id);
      if (!currentDescription?.trim()) {

        try {
          currentDescription = await generateSegmentDescription(
            selectedSegment,
            project.shots,
            activeCharacters,
            activeScenes,
            project.visualStyle,
            project.genre,
            project.rawScript,
            selectedSegment.description||'',
            segmentIndex+1,
            selectedSegment.estimatedDuration||project.segmentDuration,
            project.imageSize,
            project.globalSettings,
            null,
            activeProps
          );
          if(!currentDescription){
            dialog.toast({ message: `生成片段描述失败`, type: 'error' });
            return;
          }
          // 更新 segment 的 videoPrompt
          const updatedSegments = (project.segments || []).map((seg) =>
            seg.id === selectedSegment.id ? { ...seg, videoPrompt: currentDescription, lastModified: Date.now() } : seg
          );
          updateProject({ segments: updatedSegments });
        } catch (err) {
          dialog.toast({ message: '生成描述失败，无法继续生成视频', type: 'error' });
          setGeneratingVideo(null);
          return;
        }
      }

      // Collect reference images from scenes and characters
      const referenceImages: string[] = [];
      const imageLabels: string[] = [];
      const scenes: string[] = [];
      let imageIndex = 1;
      
      // Add scene images
      selectedSegment.sceneIds?.forEach((sceneId) => {
        let scene = activeScenes.find((s) => s.id === sceneId);
        if (scene && scene?.referenceImage) {
          referenceImages.push(scene.referenceImage);
          currentDescription = currentDescription.replaceAll(`${scene.location} `, `@图${imageIndex}（${scene.location}）`);
          scenes.push(scene.location);
          imageIndex++;
        }
      });
      
      // Add character images
      const voices: string[] = [];
      const voicesLabels: string[] = [];
      let voiceIndex = 1;
      selectedSegment.characterIds?.forEach((charId) => {
        let character = activeCharacters.find((c) => c.id === charId);
        if(character){
          if(selectedSegment.characterVariations && selectedSegment.characterVariations[charId]){
            const variation = selectedSegment.characterVariations[charId];
            const selectedVar = character.variations.find(v => v.id === variation);
            if(selectedVar?.referenceImage){
              referenceImages.push(selectedVar.referenceImage);
              currentDescription = currentDescription.replaceAll(`${character.name} `, `@图${imageIndex}（${character.name}）`);
              imageIndex++;
            }else if(character?.referenceImage){
              referenceImages.push(character.referenceImage);
              currentDescription = currentDescription.replaceAll(`${character.name} `, `@图${imageIndex}（${character.name}）`);
              imageIndex++;
            }
          }else if(character?.referenceImage){
            referenceImages.push(character.referenceImage);
              currentDescription = currentDescription.replaceAll(`${character.name} `, `@图${imageIndex}（${character.name}）`);
            imageIndex++;
          }
          if(character?.voiceUrl){
            voices.push(character.voiceUrl);
            voicesLabels.push(`@音频${voiceIndex} 作为（${character.name}）声音参考`);
            voiceIndex++;
          }
        }
      });

      // Add prop images
      selectedSegment.propIds?.forEach((propId) => {
        let prop = activeProps.find((p) => p.id === propId);
        if (prop) {
          if (selectedSegment.propVariations && selectedSegment.propVariations[propId]) {
            const variation = selectedSegment.propVariations[propId];
            const selectedVar = prop.variations?.find(v => v.id === variation);
            if (selectedVar?.referenceImage) {
              referenceImages.push(selectedVar.referenceImage);
              currentDescription = currentDescription.replaceAll(`${prop.name} `, `@图${imageIndex}（${prop.name}）`);
              imageIndex++;
            } else if (prop?.referenceImage) {
              referenceImages.push(prop.referenceImage);
              currentDescription = currentDescription.replaceAll(`${prop.name} `, `@图${imageIndex}（${prop.name}）`);
              imageIndex++;
            }
          } else if (prop?.referenceImage) {
            referenceImages.push(prop.referenceImage);
              currentDescription = currentDescription.replaceAll(`${prop.name} `, `@图${imageIndex}（${prop.name}）`);
            imageIndex++;
          }
        }
      });
      // 检查是否启用尾帧参考（默认 true）
      const useTailFrameRef = selectedSegment.useTailFrameRef == true;
      if(segmentIndex>0 && useTailFrameRef){
        const lastSegment = segments[segmentIndex-1];
        // 优先使用缓存的尾帧缩略图
        if(lastSegment.lastFrameThumbnail){
          referenceImages.push(lastSegment.lastFrameThumbnail);
          imageLabels.push(`@图${imageIndex} 作为首帧约束`);
          imageIndex++;
        } else if(lastSegment.videoUrl){
          // fallback：实时提取尾帧
          const lastframe = await getVideoLastFrame(lastSegment.videoUrl);
          if(lastframe){
            referenceImages.push(lastframe);
            imageLabels.push(`@图${imageIndex} 作为首帧约束`);
            imageIndex++;
          }
        }
      }

      // 使用 currentDescription（可能刚生成）
      const videoPrompt = renderGroupTemplate('GENERATE_SEGMENT_VIDEO_PROMPT', { visualStyle: project.visualStyle, genre: project.genre, globalSettings: project.globalSettings },scenes.join(','),currentDescription,
        selectedSegment.transitionFrom,selectedSegment.transitionTo,project.globalSettings,project.visualStyle
      );

      const prompt = `${imageLabels.length>0?`**首尾帧控制**：${imageLabels.join('；')}`:''}${voicesLabels.length>0?`\n **角色声音控制**：${voicesLabels.join('；')}`:''}\n\n${videoPrompt}` ;

      const videoUrl = await ModelService.generateVideo(
          prompt,
          null,
          null,
          selectedSegment.estimatedDuration || 15,
          project.imageCount > 2,
          project.modelProviders,
          project.id,
          project.imageSize,
          project.visualStyle,
          selectedSegment.id,
          referenceImages,
          project.seed,
          voices
      );


      if (videoUrl) {
        // Save to media history
        const fileName = `Segment_${selectedSegment.name||selectedSegment.id}_video`;
        await addMediaHistory(project.id, videoUrl, fileName, 'video', 'video',prompt,selectedSegment.id);

        // 提取首帧和尾帧缩略图
        const [firstFrame, lastFrame] = await Promise.all([
          generateVideoThumbnail(videoUrl, 2),
          getVideoLastFrame(videoUrl),
        ]);

        // Update segment with videoUrl and thumbnails
        const updatedSegments = (project.segments || []).map((seg) =>
          seg.id === selectedSegment.id ? {
            ...seg,
            videoUrl,
            firstFrameThumbnail: firstFrame || undefined,
            lastFrameThumbnail: lastFrame || undefined,
          } : seg
        );
        updateProject({ segments: updatedSegments });
        dialog.toast({ message: '视频生成成功', type: 'success' });
      } else {
        dialog.toast({ message: '视频生成失败，请重试', type: 'error' });
      }
    } catch (error) {
      dialog.toast({ message: `视频生成失败，${error}`, type: 'error' });
    } finally {
      setGeneratingVideo(null);
      setVideoGenerateStartTime(null);
    }
  }, [selectedSegment, dialog, updateProject, project.segments, activeScenes, activeCharacters, activeProps, project.imageCount, project.modelProviders, project.id, project.imageSize, project.visualStyle, project.seed, project.shots, project.visualStyle, project.genre, project.rawScript, project.scriptData?.storyParagraphs]);

  // Batch generate videos for all segments
  const handleBatchGenerateVideos = useCallback(async () => {
    const segments = project.segments || [];
    if (segments.length === 0) {
      dialog.toast({ message: '没有片段需要生成视频', type: 'warning' });
      return;
    }

    setBatchGeneratingVideos(true);
    let successCount = 0;
    // 使用累积数组
    let currentSegments = [...segments];

    try {
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        setSelectedSegmentId(segment.id);
        try {
          setGeneratingVideo(segment.id);

          // 如果 videoPrompt 为空，先生成 videoPrompt
          let currentDescription = segment.videoPrompt || segment.description;
          if (!currentDescription?.trim()) {
            currentDescription = await generateSegmentDescription(
              segment,
              project.shots,
              activeCharacters,
              activeScenes,
              project.visualStyle,
              project.genre,
              project.rawScript,
              segment.description || '',
              i+1,
              segment.estimatedDuration||project.segmentDuration,
              project.imageSize,
              project.globalSettings,
              null,
              activeProps
            );
            if(!currentDescription){
              continue;
            }
            // 更新 videoPrompt
            const segIndex = currentSegments.findIndex(s => s.id === segment.id);
            if (segIndex >= 0) {
              currentSegments[segIndex] = {
                ...currentSegments[segIndex],
                videoPrompt: currentDescription,
                lastModified: Date.now(),
              };
            }
          }

          // Collect reference images
          const referenceImages: string[] = [];
          const imageLabels: string[] = [];
          const scenes: string[] = [];
          let imageIndex = 1;

          segment.sceneIds?.forEach((sceneId) => {
            let scene = activeScenes.find((s) => s.id === sceneId);
            if (scene?.referenceImage) {
              referenceImages.push(scene.referenceImage);
              currentDescription = currentDescription.replaceAll(`${scene.location} `, `@图${imageIndex}（${scene.location}）`);
              scenes.push(scene.location);
              imageIndex++;
            }
          });

          const voices: string[] = [];
          let voiceIndex = 1;
          const voicesLabels: string[] = [];
          segment.characterIds?.forEach((charId) => {
            let character = activeCharacters.find((c) => c.id === charId);
            if (character) {
              if (segment.characterVariations?.[charId]) {
                const variation = segment.characterVariations[charId];
                const selectedVar = character.variations?.find(v => v.id === variation);
                if (selectedVar?.referenceImage) {
                  referenceImages.push(selectedVar.referenceImage);
                  currentDescription = currentDescription.replaceAll(`${character.name} `, `@图${imageIndex}（${character.name}）`);
                  imageIndex++;
                } else if (character.referenceImage) {
                  referenceImages.push(character.referenceImage);
                  currentDescription = currentDescription.replaceAll(`${character.name} `, `@图${imageIndex}（${character.name}）`);
                  imageIndex++;
                }
              } else if (character.referenceImage) {
                referenceImages.push(character.referenceImage);
                  currentDescription = currentDescription.replaceAll(`${character.name} `, `@图${imageIndex}（${character.name}）`);
                imageIndex++;
              }
              if(character?.voiceUrl){
                voices.push(character.voiceUrl);
                voicesLabels.push(`@音频${voiceIndex} 作为（${character.name}）声音参考`);
                voiceIndex++;
              }
            }
          });

          // Add prop images
          segment.propIds?.forEach((propId) => {
            let prop = activeProps.find((p) => p.id === propId);
            if (prop) {
              if (segment.propVariations?.[propId]) {
                const variation = segment.propVariations[propId];
                const selectedVar = prop.variations?.find(v => v.id === variation);
                if (selectedVar?.referenceImage) {
                  referenceImages.push(selectedVar.referenceImage);
                  currentDescription = currentDescription.replaceAll(`${prop.name} `, `@图${imageIndex}（${prop.name}）`);
                  imageIndex++;
                } else if (prop.referenceImage) {
                  referenceImages.push(prop.referenceImage);
                  currentDescription = currentDescription.replaceAll(`${prop.name} `, `@图${imageIndex}（${prop.name}）`);
                  imageIndex++;
                }
              } else if (prop.referenceImage) {
                referenceImages.push(prop.referenceImage);
                  currentDescription = currentDescription.replaceAll(`${prop.name} `, `@图${imageIndex}（${prop.name}）`);
                imageIndex++;
              }
            }
          });

          const videoPrompt = renderGroupTemplate(
            'GENERATE_SEGMENT_VIDEO_PROMPT',
            { visualStyle: project.visualStyle, genre: project.genre, globalSettings: project.globalSettings },
            scenes.join(','),
            currentDescription,
            segment.transitionFrom,
            segment.transitionTo,project.visualStyle,
            project.globalSettings
          );

          // 检查是否启用尾帧参考（默认 true）
          const useTailFrameRef = segment.useTailFrameRef == true;
          if(i>0 && useTailFrameRef){
            const lastSegment = segments[i-1];
            // 优先使用缓存的尾帧缩略图
            if(lastSegment.lastFrameThumbnail){
              referenceImages.push(lastSegment.lastFrameThumbnail);
              imageLabels.push(`@图${imageIndex} 作为首帧约束`);
              imageIndex++;
            } else if(lastSegment.videoUrl){
              // fallback：实时提取尾帧
              const lastframe = await getVideoLastFrame(lastSegment.videoUrl);
              if(lastframe){
                referenceImages.push(lastframe);
                imageLabels.push(`@图${imageIndex} 作为首帧约束`);
                imageIndex++;
              }
            }
          }
          const prompt = `${imageLabels.length>0?`**首尾帧控制**：${imageLabels.join('；')}`:''}${voicesLabels.length>0?`\n **角色声音控制**：${voicesLabels.join('；')}`:''}\n\n${videoPrompt}` ;

          const videoUrl = await ModelService.generateVideo(
            prompt,
            null,
            null,
            segment.estimatedDuration || 15,
            project.imageCount > 2,
            project.modelProviders,
            project.id,
            project.imageSize,
            project.visualStyle,
            segment.id,
            referenceImages,
            project.seed,
            voices
          );

          if (videoUrl) {
            // Save to media history
            const fileName = `Segment_${segment.name || segment.id}_video`;
            await addMediaHistory(project.id, videoUrl, fileName, 'video', 'video', prompt,segment.id);

            // 提取首帧和尾帧缩略图
            const [firstFrame, lastFrame] = await Promise.all([
              generateVideoThumbnail(videoUrl, 2),
              getVideoLastFrame(videoUrl),
            ]);

            // Update segment with videoUrl and thumbnails
            const segIndex = currentSegments.findIndex(s => s.id === segment.id);
            if (segIndex >= 0) {
              currentSegments[segIndex] = {
                ...currentSegments[segIndex],
                videoUrl,
                firstFrameThumbnail: firstFrame || undefined,
                lastFrameThumbnail: lastFrame || undefined,
              };
              updateProject({ segments: [...currentSegments] });
              successCount++;
            }
          }else{
            dialog.toast({ message: `生成片段 ${i+1} 视频失败`, type: 'error' });
          }
        } catch (err) {
          dialog.toast({ message: `生成片段 ${i+1} 视频失败，${err}`, type: 'error' });
        } finally {
          setGeneratingVideo(null);
        }
      }

      if (successCount > 0) {
        dialog.toast({ message: `成功生成 ${successCount} / ${segments.length} 个视频`, type: 'success' });
      } else {
        dialog.toast({ message: '所有视频生成失败', type: 'error' });
      }
    } catch (error) {
      dialog.toast({ message: '批量生成视频失败', type: 'error' });
    } finally {
      setBatchGeneratingVideos(false);
    }
  }, [project.segments, project.shots, activeCharacters, activeScenes, project.visualStyle, project.genre, project.rawScript, project.scriptData?.storyParagraphs, project.imageCount, project.modelProviders, project.id, project.imageSize, project.seed, updateProject, dialog, getSceneWithAssets, getCharacterWithAssets]);

  // Open edit script panel
  const handleOpenEditScript = useCallback(() => {
    if (!selectedSegmentId) {
      dialog.toast({ message: '请先选择一个片段', type: 'warning' });
      return;
    }
    setEditingScript(true);
  }, [selectedSegmentId, dialog]);

  // Close edit script panel
  const handleCloseEditScript = useCallback(() => {
    setEditingScript(false);
  }, []);

  // @ Mention: Calculate cursor position for floating picker
  const getCaretCoordinates = useCallback((element: HTMLTextAreaElement) => {
    const rect = element.getBoundingClientRect();
    const text = element.value.substring(0, element.selectionStart);
    
    // Create a mirror div to measure text position
    const mirror = document.createElement('div');
    const computed = window.getComputedStyle(element);
    
    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordWrap = 'break-word';
    mirror.style.width = computed.width;
    mirror.style.font = computed.font;
    mirror.style.padding = computed.padding;
    mirror.style.border = computed.border;
    mirror.style.boxSizing = computed.boxSizing;
    
    mirror.textContent = text;
    document.body.appendChild(mirror);
    
    const span = document.createElement('span');
    span.textContent = '|';
    mirror.appendChild(span);
    
    const coordinates = {
      top: rect.top + span.offsetTop + parseInt(computed.lineHeight) - element.scrollTop,
      left: rect.left + span.offsetLeft
    };
    
    document.body.removeChild(mirror);
    return coordinates;
  }, []);

  // @ Mention: Handle textarea input for @ detection
  const handleDescriptionInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    setDescriptionDraft(value);

    // Check if user is typing @
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      // Check if there's a space or newline between @ and cursor (which would close the picker)
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        // Open mention picker
        const searchText = textAfterAt.toLowerCase();
        setMentionSearchText(searchText);
        setMentionStartPos(lastAtIndex);
        
        // Calculate position
        const coords = getCaretCoordinates(e.target);
        setMentionPickerPosition({ top: coords.top, left: coords.left });
        setMentionPickerOpen(true);
      } else {
        setMentionPickerOpen(false);
      }
    } else {
      setMentionPickerOpen(false);
    }
  }, [getCaretCoordinates]);

  // @ Mention: Handle selection from picker
  const handleSelectMention = useCallback((type: 'character' | 'scene' | 'prop', item: { id: string; name: string }, variationId?: string) => {
    if (descriptionTextareaRef.current === null || mentionStartPos === null) return;
    
    const textarea = descriptionTextareaRef.current;
    
    // Calculate the end position of the @ mention search text
    const mentionEndPos = mentionStartPos + 1 + mentionSearchText.length;
    
    // Replace the @ and search text with the selected name (without @ symbol)
    const beforeAt = descriptionDraft.substring(0, mentionStartPos);
    const afterMention = descriptionDraft.substring(mentionEndPos);
    const newText = beforeAt + item.name + ' ' + afterMention;
    
    const savedScrollTop = textarea.scrollTop;

    // Update local state first
    setDescriptionDraft(newText);
    setMentionPickerOpen(false);
    
        // Update segment's characterIds or sceneIds AND videoPrompt (to prevent reset)
        if (selectedSegment) {
          const field = type === 'character' ? 'characterIds' : 'sceneIds';
          const currentIds = selectedSegment[field] || [];
          if (!currentIds.includes(item.id)) {
            const updatedSegment: Segment = {
              ...selectedSegment,
              videoPrompt: newText,  // Include updated description to prevent reset
              [field]: [...currentIds, item.id],
              lastModified: Date.now()
            };
            // If character with variation, update characterVariations
            if (type === 'character' && variationId) {
              updatedSegment.characterVariations = {
                ...selectedSegment.characterVariations,
                [item.id]: variationId
              };
            }
            handleSaveSegment(updatedSegment);
          } else if (type === 'character' && variationId) {
        // Character already in list, but update variation
        const updatedSegment: Segment = {
          ...selectedSegment,
          description: newText,  // Include updated description to prevent reset
          characterVariations: {
            ...selectedSegment.characterVariations,
            [item.id]: variationId
          },
          lastModified: Date.now()
        };
        handleSaveSegment(updatedSegment);
      }
    }
    
    // Set cursor position after inserted text (use requestAnimationFrame for reliability)
    const newCursorPos = beforeAt.length + item.name.length + 1; // +1 for space
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.scrollTop = savedScrollTop;
    });
  }, [descriptionDraft, mentionStartPos, mentionSearchText, selectedSegment, handleSaveSegment]);

  // @ Mention: Close picker on click outside
  const handleDescriptionKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      setMentionPickerOpen(false);
    }
  }, []);

  // @ Mention: Filtered items for picker
  const filteredCharacters = useMemo(() => {
    const chars = activeCharacters || [];
    if (!mentionSearchText) return chars;
    return chars.filter(c => 
      c.name.toLowerCase().includes(mentionSearchText)
    );
  }, [activeCharacters, mentionSearchText]);

  const filteredScenes = useMemo(() => {
    const scenes = activeScenes || [];
    if (!mentionSearchText) return scenes;
    return scenes.filter(s => 
      s.location.toLowerCase().includes(mentionSearchText)
    );
  }, [activeScenes, mentionSearchText]);

  const filteredProps = useMemo(() => {
    const props = activeProps || [];
    if (!mentionSearchText) return props;
    return props.filter(p => 
      p.name.toLowerCase().includes(mentionSearchText)
    );
  }, [activeProps, mentionSearchText]);

  // @ Mention: Expanded character for variations
  const [expandedCharId, setExpandedCharId] = useState<string | null>(null);
  const [expandedPropId, setExpandedPropId] = useState<string | null>(null);

  // Preview image state
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Handle toggle scene
  const handleToggleSceneInline = useCallback((sceneId: string) => {
    if (!selectedSegment) return;
    const currentIds = selectedSegment.sceneIds || [];
    const newIds = currentIds.includes(sceneId)
      ? currentIds.filter(id => id !== sceneId)
      : [...currentIds, sceneId];
    const updatedSegment: Segment = {
      ...selectedSegment,
      sceneIds: newIds,
      lastModified: Date.now()
    };
    handleSaveSegment(updatedSegment);
  }, [selectedSegment, handleSaveSegment]);

  // Handle toggle character
  const handleToggleCharacterInline = useCallback((charId: string) => {
    if (!selectedSegment) return;
    const currentIds = selectedSegment.characterIds || [];
    const newIds = currentIds.includes(charId)
      ? currentIds.filter(id => id !== charId)
      : [...currentIds, charId];
    const updatedSegment: Segment = {
      ...selectedSegment,
      characterIds: newIds,
      lastModified: Date.now()
    };
    // Remove variation if character removed
    if (!newIds.includes(charId) && selectedSegment.characterVariations?.[charId]) {
      const newVariations = { ...selectedSegment.characterVariations };
      delete newVariations[charId];
      updatedSegment.characterVariations = newVariations;
    }
    handleSaveSegment(updatedSegment);
  }, [selectedSegment, handleSaveSegment]);

  // Handle select variation
  const handleSelectVariationInline = useCallback((charId: string, variationId: string) => {
    if (!selectedSegment) return;
    const updatedSegment: Segment = {
      ...selectedSegment,
      characterVariations: {
        ...selectedSegment.characterVariations,
        [charId]: variationId
      },
      lastModified: Date.now()
    };
    handleSaveSegment(updatedSegment);
  }, [selectedSegment, handleSaveSegment]);

  const handleTogglePropInline = useCallback((propId: string) => {
    if (!selectedSegment) return;
    const currentIds = selectedSegment.propIds || [];
    const newIds = currentIds.includes(propId)
      ? currentIds.filter(id => id !== propId)
      : [...currentIds, propId];
    const updatedSegment: Segment = {
      ...selectedSegment,
      propIds: newIds,
      lastModified: Date.now()
    };
    // Remove variation if prop removed
    if (!newIds.includes(propId) && selectedSegment.propVariations?.[propId]) {
      const newVariations = { ...selectedSegment.propVariations };
      delete newVariations[propId];
      updatedSegment.propVariations = newVariations;
    }
    handleSaveSegment(updatedSegment);
  }, [selectedSegment, handleSaveSegment]);

  const handleSelectPropVariationInline = useCallback((propId: string, variationId: string) => {
    if (!selectedSegment) return;
    const updatedSegment: Segment = {
      ...selectedSegment,
      propVariations: {
        ...selectedSegment.propVariations,
        [propId]: variationId
      },
      lastModified: Date.now()
    };
    handleSaveSegment(updatedSegment);
  }, [selectedSegment, handleSaveSegment]);

  // Available scenes/characters for selection
  const availableScenesInline = useMemo(() => 
    (activeScenes || []).filter(s => !(selectedSegment?.sceneIds || []).includes(s.id)),
    [activeScenes, selectedSegment?.sceneIds]
  );
  const availableCharactersInline = useMemo(() => 
    (activeCharacters || []).filter(c => !(selectedSegment?.characterIds || []).includes(c.id)),
    [activeCharacters, selectedSegment?.characterIds]
  );

  const availablePropsInline = useMemo(() => 
    (activeProps || []).filter(p => !(selectedSegment?.propIds || []).includes(p.id)),
    [activeProps, selectedSegment?.propIds]
  );

  return (
    <div className="flex flex-col h-full bg-slate-900 relative overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-slate-600 bg-slate-700 md:px-6 px-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <ListVideo className="w-5 h-5 text-slate-500" />
          <div>
            <h2 className="text-lg font-bold text-slate-50">片段{isMobile?'':`编辑`}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {project.shots.length > 0 && (
            <button
              onClick={() => {
                updateProject({ stage: 'director', isSegmentMode: false });
              }}
              className="px-4 py-2 rounded-lg border border-slate-600 bg-slate-700/20 text-slate-300 text-xs font-bold tracking-wide transition-all flex items-center gap-2 hover:bg-slate-600/30 hover:border-slate-500 cursor-pointer"
              title="切换到分镜模式"
            >
              <Clapperboard className="w-3 h-3" />
              <span className='hidden lg:inline'>{!isMobile && '分镜模式'}</span>
            </button>
          )}
          <button
            onClick={() => setPreviewModalOpen(true)}
            disabled={(project.segments || []).filter(s => s.videoUrl).length === 0}
            className="px-4 py-2 rounded-lg bg-slate-700 text-slate-50 text-xs font-bold tracking-wide transition-all flex items-center gap-2 hover:bg-slate-600 border border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            title="预览所有片段视频"
          >
            <Play className="w-3 h-3" />
            {!isMobile && '预览片段'}
          </button>
          <button
            onClick={handleReconvertSegments}
            disabled={project.shots.length === 0 && !project.rawScript?.trim()}
            className="px-4 py-2 rounded-lg bg-slate-700 text-slate-50 text-xs font-bold tracking-wide transition-all flex items-center gap-2 hover:bg-slate-600 border border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <ListVideo className="w-3 h-3" />
            {!isMobile && (project.shots.length === 0 ? '生成片段' : '重新拆分片段')}
          </button>
          <button
            onClick={handleBatchGenerateDescriptions}
            disabled={batchGenerating || batchGeneratingVideos || (project.segments || []).length === 0}
            className="px-4 py-2 rounded-lg bg-slate-700 text-slate-50 text-xs font-bold tracking-wide transition-all flex items-center gap-2 hover:bg-slate-600 border border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {batchGenerating ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            {!isMobile && '批量生成描述'}
          </button>
          {/**
           * 
          <button
            onClick={handleBatchGenerateTransitions}
            disabled={generatingTransition || batchGeneratingVideos || (project.segments || []).length < 2}
            className="px-4 py-2 rounded-lg bg-slate-700 text-slate-50 text-xs font-bold tracking-wide transition-all flex items-center gap-2 hover:bg-slate-600 border border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {generatingTransition ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            {!isMobile && '批量生成转场'}
          </button>
           */}
          <button
            onClick={handleBatchGenerateVideos}
            disabled={batchGeneratingVideos || (project.segments || []).length === 0}
            className="px-4 py-2 rounded-lg bg-slate-700 text-slate-50 text-xs font-bold tracking-wide transition-all flex items-center gap-2 hover:bg-slate-600 border border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {batchGeneratingVideos ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Video className="w-3 h-3" />
            )}
            {!isMobile && '批量生成视频'}
          </button>
        </div>
      </div>

      {/* Main Content Area - Video Preview (2/3) + Description Editor (1/3) */}
      <div className="flex-1 flex min-h-0">
        {selectedSegment ? (
          <>
            {/* Left: Video Preview (2/3) */}
            <div className={`${editingScript && isMobile?'hidden':''} ${editingScript ? 'border-r' : ''} border-slate-600 p-2 md:p-4 flex flex-col flex-1 overflow-y-auto transition-all duration-500 ease-in-out`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-50 flex items-center gap-2">
                  <Play className="w-4 h-4 text-slate-500" />
                  {`${selectedSegment.name||`片段 ${activeSegmentIndex+1}`}`}
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  片段 {(project.segments || []).findIndex(s => s.id === selectedSegment.id) + 1} / {(project.segments || []).length}
                </span>
              </div>
              <div className="flex-1 bg-slate-700 flex-col rounded-lg overflow-hidden flex items-center justify-center border border-slate-600">
                <div className={`w-full h-full aspect-[9/16] bg-slate-800/50 rounded-lg border-1 border-slate-600 relative shadow-lg
                   ${(generatingVideo === selectedSegment.id || batchGeneratingVideos)&&'ai-generating-border'}`}>
                {selectedSegment.videoUrl ? (
                  <video
                    src={selectedSegment.videoUrl}
                    controls
                    className="w-full h-full object-contain rounded-lg"
                  />
                ) : (
                  <div className="flex w-full h-full flex-col items-center justify-center text-slate-500 aspect-video bg-slate-800/50">
                    <ListVideo className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-sm">暂无视频预览</p>
                    <p className="text-xs text-slate-600">请先生成视频</p>
                  </div>
                )}
                </div>
              </div>
              {/* Shot Thumbnails */}
              <div className="relative md:h-16 h-14">
                <div className="md:pt-4 pt-2 flex gap-2 overflow-x-auto pb-">
                {selectedSegment.shotIds.map((shotId, idx) => {
                  const shot = project.shots.find((s) => s.id === shotId);
                  const thumbnail = shot?.keyframes?.find((k) => k.type === 'start')?.imageUrl;
                  return (
                    <div
                      key={shotId}
                      title={shot?.actionSummary || ''}
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
              {/* Action Buttons */}
              <div className="absolute top-4 md:top-6 right-2 flex items-center gap-2 justify-end">
                {!editingScript && (
                <button
                  onClick={handleOpenEditScript}
                  className="px-4 py-2 rounded-lg bg-slate-700 text-slate-50 text-xs border border-slate-500 font-bold tracking-wide transition-all flex items-center gap-2 hover:bg-slate-600 cursor-pointer"
                >
                  <NotebookPen className="w-3 h-3" />
                  {!isMobile && '编辑提示词'}
                </button>
                )}
                <button
                  onClick={handleGenerateSegmentVideo}
                  disabled={generatingVideo === selectedSegment.id || batchGeneratingVideos}
                  className="px-4 py-2 rounded-lg bg-slate-700 text-slate-50 text-xs font-bold tracking-wide transition-all flex items-center gap-2 hover:bg-slate-600 border border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {generatingVideo === selectedSegment.id ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {`${!isMobile && '生成中'}${videoElapsedSeconds}s`}
                    </>
                  ) : (
                    <>
                      <Video className="w-3 h-3" />
                      {!isMobile && (selectedSegment.videoUrl ? '重新生成视频' : '生成视频')}
                    </>
                  )}
                </button>
                {activeSegmentIndex > 0 && (
                <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedSegment.useTailFrameRef === true}
                    onChange={(e) => {
                      const updated = (project.segments || []).map(s =>
                        s.id === selectedSegment.id ? { ...s, useTailFrameRef: e.target.checked } : s
                      );
                      updateProject({ segments: updated });
                    }}
                    className="w-3 h-3 rounded border-slate-500 accent-indigo-500"
                  />
                  自动首帧
                </label>
                )}
              </div>
              </div>
            </div>

            {/* Right: Description Editor (1/3) */}
            {editingScript && (
            <div className={`${isMobile ? 'w-full' : 'md:w-[55%] lg:w-[480px] xl:w-[560px] 2xl:w-[640px] 3xl:w-[720px]'} bg-slate-700/50 flex flex-col h-full relative z-20`}>

            <div className="md:p-4 p-2 border-b border-slate-600 flex items-center justify-between bg-slate-600/50 shrink-0">
              <div className="flex items-center gap-3">
              <h3 className="text-sm font-bold text-slate-50 flex items-center gap-2">
                <NotebookPen className="w-4 h-4 text-slate-500" />
                描述提示词编辑
              </h3>
              </div>

              <div className="flex items-center gap-1">
                  <button onClick={goToPrevSegment} disabled={activeSegmentIndex <= 0} className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-50 disabled:opacity-20 transition-colors cursor-pointer">
                      <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={goToNextSegment} disabled={activeSegmentIndex < 0 || activeSegmentIndex >= (project.segments || []).length - 1} className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-50 disabled:opacity-20 transition-colors cursor-pointer">
                      <ChevronRight className="w-4 h-4" />
                  </button>
                  <div className="w-px h-4 bg-slate-700 mx-2"></div>
                  <button onClick={handleCloseEditScript} className="p-2 hover:bg-red-900/20 rounded text-slate-400 hover:text-red-400 transition-colors cursor-pointer">
                      <X className="w-4 h-4" />
                  </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto md:p-4 p-2 space-y-4 border-b border-slate-600">
               {/* Description */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-400 mb-2 tracking-wide">片段描述</label>
                <div 
                  className={`relative h-[35vh] ${
                    selectedSegment && generatingDescription.has(selectedSegment.id) 
                      ? 'ai-generating-border' 
                      : ''
                  }`}
                >
                  <textarea
                    ref={descriptionTextareaRef}
                    value={descriptionDraft}
                    onChange={handleDescriptionInput}
                    onKeyDown={handleDescriptionKeyDown}
                    placeholder="输入片段描述... 使用 @ 提及角色或场景"
                    className={`w-full h-full p-3 pb-14 text-sm bg-slate-800 border rounded-lg resize-none focus:outline-none text-slate-50 placeholder:text-slate-600 ${
                      selectedSegment && generatingDescription.has(selectedSegment.id)
                        ? 'border-transparent'
                        : 'border-slate-600 focus:border-slate-500'
                    }`}
                  />
                  {/* @ Mention Picker */}
                  {mentionPickerOpen && (
                    <div
                      className="fixed z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-80 overflow-y-auto w-64"
                      style={{ 
                        top: mentionPickerPosition.top, 
                        left: Math.max(8, mentionPickerPosition.left - 256) // 左下角，确保不超出左边界
                      }}
                    >
                      {/* Characters Section */}
                      {filteredCharacters.length > 0 && (
                        <div className="p-1">
                          <div className="text-[10px] text-slate-500 px-2 py-1 font-bold tracking-wide">角色</div>
                          {filteredCharacters.slice(0, 5).map(char => {
                            const isExpanded = expandedCharId === char.id;
                            const charWithAssets = getCharacterWithAssets(char.id) || char;
                            const variations = charWithAssets.variations || [];
                            return (
                              <div key={char.id}>
                                <button
                                  onClick={() => {
                                    if (variations.length > 0) {
                                      setExpandedCharId(isExpanded ? null : char.id);
                                    } else {
                                      handleSelectMention('character', { id: char.id, name: char.name });
                                    }
                                  }}
                                  className="w-full text-left px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-700 rounded flex items-center gap-2 cursor-pointer"
                                >
                                  {charWithAssets.referenceImage ? (
                                    <img src={charWithAssets.referenceImage} alt={char.name} className="w-8 h-8 rounded-full object-cover" />
                                  ) : (
                                    <div className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center text-[10px] text-slate-400">
                                      {char.name.charAt(0)}
                                    </div>
                                  )}
                                  <span className="flex-1">{char.name}</span>
                                  {variations.length > 0 && (
                                    <ChevronRight className={`w-3 h-3 text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                  )}
                                </button>
                                {/* Variations */}
                                {isExpanded && variations.length > 0 && (
                                  <div className="ml-4 border-l border-slate-700 pl-1">
                                    {variations.map(variation => (
                                      <button
                                        key={variation.id}
                                        onClick={() => handleSelectMention('character', { id: char.id, name: `${char.name}(${variation.name})` }, variation.id)}
                                        className="w-full text-left px-2 py-1 text-xs text-slate-400 hover:bg-slate-700 rounded flex items-center gap-2 cursor-pointer"
                                      >
                                        {variation.referenceImage ? (
                                          <img src={variation.referenceImage} alt={variation.name} className="w-8 h-8 rounded-full object-cover" />
                                        ) : (
                                          <div className="w-4 h-4 rounded bg-slate-700" />
                                        )}
                                        <span>{variation.name}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {/* Scenes Section */}
                      {filteredScenes.length > 0 && (
                        <div className="p-1 border-t border-slate-700">
                          <div className="text-[10px] text-slate-500 px-2 py-1 font-bold tracking-wide">场景</div>
                          {filteredScenes.slice(0, 5).map(scene => {
                            const sceneWithAssets = getSceneWithAssets(scene.id) || scene;
                            return (
                              <button
                                key={scene.id}
                                onClick={() => handleSelectMention('scene', { id: scene.id, name: scene.location })}
                                className="w-full text-left px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-700 rounded flex items-center gap-2 cursor-pointer"
                              >
                                {sceneWithAssets.referenceImage ? (
                                  <img src={sceneWithAssets.referenceImage} alt={scene.location} className="w-8 h-8 rounded object-cover" />
                                ) : (
                                  <div className="w-5 h-5 rounded bg-slate-700 flex items-center justify-center">
                                    <Film className="w-3 h-3 text-slate-500" />
                                  </div>
                                )}
                                <span>{scene.location}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {/* Props Section */}
                      {filteredProps.length > 0 && (
                        <div className="p-1 border-t border-slate-700">
                          <div className="text-[10px] text-amber-400 px-2 py-1 font-bold tracking-wide">道具</div>
                          {filteredProps.slice(0, 5).map(prop => {
                            const isExpanded = expandedPropId === prop.id;
                            const propWithAssets = getPropWithAssets(prop.id) || prop;
                            const variations = propWithAssets.variations || [];

                            return (
                              <div key={prop.id}>
                                <button
                                  onClick={() => {
                                    if (variations.length > 0) {
                                      setExpandedPropId(isExpanded ? null : prop.id);
                                    } else {
                                      handleSelectMention('prop', { id: prop.id, name: prop.name });
                                    }
                                  }}
                                  className="w-full text-left px-2 py-1.5 text-sm text-amber-200 hover:bg-amber-900/30 rounded flex items-center gap-2 cursor-pointer"
                                >
                                  {propWithAssets.referenceImage ? (
                                    <img src={propWithAssets.referenceImage} alt={prop.name} className="w-8 h-8 rounded object-cover" />
                                  ) : (
                                    <div className="w-5 h-5 rounded bg-amber-800 flex items-center justify-center text-[10px] text-amber-400">
                                      <Box className="w-3 h-3" />
                                    </div>
                                  )}
                                  <span className="flex-1">{prop.name}</span>
                                  {variations.length > 0 && (
                                    <ChevronRight className={`w-3 h-3 text-amber-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                  )}
                                </button>
                                {/* Variations */}
                                {isExpanded && variations.length > 0 && (
                                  <div className="ml-4 border-l border-amber-800 pl-1">
                                    {variations.map(variation => (
                                      <button
                                        key={variation.id}
                                        onClick={() => handleSelectMention('prop', { id: prop.id, name: `${prop.name}(${variation.name})` }, variation.id)}
                                        className="w-full text-left px-2 py-1 text-xs text-amber-300 hover:bg-amber-900/30 rounded flex items-center gap-2 cursor-pointer"
                                      >
                                        {variation.referenceImage ? (
                                          <img src={variation.referenceImage} alt={variation.name} className="w-8 h-8 rounded object-cover" />
                                        ) : (
                                          <div className="w-4 h-4 rounded bg-amber-800" />
                                        )}
                                        <span>{variation.name}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {/* No results */}
                      {filteredCharacters.length === 0 && filteredScenes.length === 0 && filteredProps.length === 0 && (
                        <div className="p-3 text-sm text-slate-500 text-center">
                          未找到匹配的角色、场景或道具
                        </div>
                      )}
                    </div>
                  )}
                  {/* 底部悬浮按钮层 */}
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-slate-800/65 backdrop-blur-sm border border-slate-600 border-t-slate-600/50 rounded-b-lg flex items-center justify-between">
                    {/* 左边字数统计 */}
                    <span className="text-[11px] text-slate-400 font-mono">
                      {descriptionDraft.length} 字
                    </span>
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
                      {/* 重置按钮：当 videoPrompt 和 description 不同时显示 */}
                      {selectedSegment.videoPrompt !== selectedSegment.description && selectedSegment.description && (
                        <button
                          onClick={() => setDescriptionDraft(selectedSegment.description || '')}
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-400 text-[11px] font-bold tracking-wider rounded transition-colors flex items-center gap-1.5 cursor-pointer"
                          title="重置为原始描述"
                        >
                          <RotateCcw className="w-3 h-3" />
                          重置
                        </button>
                      )}
                      {/* AI生成按钮 */}
                      <button
                        onClick={() => handleGenerateDescription(selectedSegment.id)}
                        disabled={generatingDescription.has(selectedSegment.id) || batchGeneratingVideos}
                        className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-slate-50 text-[11px] font-bold tracking-wider rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
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
              {/* Scenes Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-500 tracking-wide">
                    场景 ({(selectedSegment?.sceneIds || []).length})
                  </label>
                  {availableScenesInline.length > 0 && (
                    <CustomSelect
                      value=""
                      onChange={(val) => { if (val) handleToggleSceneInline(val); }}
                      options={availableScenesInline.map(s => ({ value: s.id, label: s.location }))}
                      placeholder="+ 添加场景"
                      className="w-64" size='sm'
                    />
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(selectedSegment?.sceneIds || []).map(sceneId => {
                    const scene = getSceneWithAssets(sceneId) || activeScenes.find(s => s.id === sceneId);
                    if (!scene) return null;
                    return (
                      <div key={sceneId} className="relative group flex items-center gap-1.5 px-2 py-1 bg-slate-700 border border-slate-600 rounded-lg">
                        {scene.referenceImage ? (
                          <img
                            src={scene.referenceImage}
                            alt={scene.location}
                            className="w-12 h-9 rounded object-cover cursor-pointer hover:ring-1 ring-indigo-400"
                            onClick={() => setPreviewImage(scene.referenceImage)}
                          />
                        ) : (
                          <div className="w-8 h-6 rounded bg-slate-600 flex items-center justify-center">
                            <Film className="w-3 h-3 text-slate-400" />
                          </div>
                        )}
                        <span className="text-xs text-slate-300 max-w-[80px] truncate">{scene.location}</span>
                        <button
                          onClick={() => handleToggleSceneInline(sceneId)}
                          className="opacity-100 group-hover:opacity-100 p-0.5 hover:bg-red-900/30 hover:text-red-400 rounded transition-all cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                  {(selectedSegment?.sceneIds || []).length === 0 && (
                    <span className="text-xs text-slate-500">未选择场景</span>
                  )}
                </div>
              </div>

              {/* Characters Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-500 tracking-wide">
                    角色 ({(selectedSegment?.characterIds || []).length})
                  </label>
                  {availableCharactersInline.length > 0 && (
                    <CustomSelect
                      value=""
                      onChange={(val) => { if (val) handleToggleCharacterInline(val); }}
                      options={availableCharactersInline.map(c => ({ value: c.id, label: c.name }))}
                      placeholder="+ 添加角色"
                      className="w-64" size='sm'
                    />
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(selectedSegment?.characterIds || []).map(charId => {
                    const character = getCharacterWithAssets(charId) || activeCharacters.find(c => c.id === charId);
                    if (!character) return null;
                    
                    // Get available looks
                    const availableLooks: { id: string; name: string; image?: string }[] = [];
                    if (character.referenceImage) {
                      availableLooks.push({ id: 'base', name: '默认', image: character.referenceImage });
                    }
                    character.variations?.forEach(v => {
                      if (v.referenceImage) {
                        availableLooks.push({ id: v.id, name: v.name, image: v.referenceImage });
                      }
                    });
                    
                    const selectedVarId = selectedSegment?.characterVariations?.[charId];
                    const currentLook = selectedVarId
                      ? availableLooks.find(l => l.id === selectedVarId) || availableLooks[0]
                      : availableLooks[0];
                    
                    return (
                      <div key={charId} className="relative group flex items-center gap-1.5 px-2 py-1 bg-slate-700 border border-slate-600 rounded-lg">
                        {currentLook?.image ? (
                          <img
                            src={currentLook.image}
                            alt={character.name}
                            className="w-10 h-10 rounded-full object-cover cursor-pointer hover:ring-1 ring-indigo-400"
                            onClick={() => setPreviewImage(currentLook.image!)}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-xs text-slate-400">
                            {character.name.charAt(0)}
                          </div>
                        )}
                        <div>
                        <div className="flex items-center gap-1 justify-between pb-1">
                        <div className="flex-1 text-xs text-slate-300 max-w-[60px] truncate text-left">{character.name}</div>
                        <button
                          onClick={() => handleToggleCharacterInline(charId)}
                          className="opacity-100 group-hover:opacity-100 p-0.5 hover:bg-red-900/30 hover:text-red-400 rounded transition-all cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        </div>
                        {availableLooks.length > 1 && (
                          <CustomSelect
                            value={currentLook?.id || 'base'}
                            onChange={(val) => handleSelectVariationInline(charId, val)}
                            options={availableLooks.map(look => ({ value: look.id, label: look.name }))}
                            className="w-24 text-[9px]"
                            size='sm'
                          />
                        )}
                        </div>
                      </div>
                    );
                  })}
                  {(selectedSegment?.characterIds || []).length === 0 && (
                    <span className="text-xs text-slate-500">未选择角色</span>
                  )}
                </div>
              </div>

              {/* Props Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-amber-400 tracking-wide">
                    道具 ({(selectedSegment?.propIds || []).length})
                  </label>
                  {availablePropsInline.length > 0 && (
                    <CustomSelect
                      value=""
                      onChange={(val) => { if (val) handleTogglePropInline(val); }}
                      options={availablePropsInline.map(p => ({ value: p.id, label: p.name }))}
                      placeholder="+ 添加道具"
                      className="w-64" size='sm'
                    />
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(selectedSegment?.propIds || []).map(propId => {
                    const prop = getPropWithAssets(propId) || activeProps.find(p => p.id === propId);
                    if (!prop) return null;

                    // Get available looks
                    const availableLooks: { id: string; name: string; image?: string }[] = [];
                    if (prop.referenceImage) {
                      availableLooks.push({ id: 'base', name: '默认', image: prop.referenceImage });
                    }
                    prop.variations?.forEach(v => {
                      if (v.referenceImage) {
                        availableLooks.push({ id: v.id, name: v.name, image: v.referenceImage });
                      }
                    });

                    const selectedVarId = selectedSegment?.propVariations?.[propId];
                    const currentLook = selectedVarId
                      ? availableLooks.find(l => l.id === selectedVarId) || availableLooks[0]
                      : availableLooks[0];

                    return (
                      <div key={propId} className="relative group flex items-center gap-1.5 px-2 py-1 bg-amber-900/30 border border-amber-700/50 rounded-lg">
                        {currentLook?.image ? (
                          <img
                            src={currentLook.image}
                            alt={prop.name}
                            className="w-10 h-10 rounded-lg object-cover cursor-pointer hover:ring-1 ring-amber-400"
                            onClick={() => setPreviewImage(currentLook.image!)}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-amber-800 flex items-center justify-center text-xs text-amber-400">
                            <Box className="w-4 h-4" />
                          </div>
                        )}
                        <div>
                        <div className="flex items-center gap-1 justify-between pb-1">
                        <div className="flex-1 text-xs text-amber-200 max-w-[60px] truncate text-left">{prop.name}</div>
                        <button
                          onClick={() => handleTogglePropInline(propId)}
                          className="opacity-100 group-hover:opacity-100 p-0.5 hover:bg-red-900/30 hover:text-red-400 rounded transition-all cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        </div>
                        {availableLooks.length > 1 && (
                          <CustomSelect
                            value={currentLook?.id || 'base'}
                            onChange={(val) => handleSelectPropVariationInline(propId, val)}
                            options={availableLooks.map(look => ({ value: look.id, label: look.name }))}
                            className="w-24 text-[9px]"
                            size='sm'
                          />
                        )}
                        </div>
                      </div>
                    );
                  })}
                  {(selectedSegment?.propIds || []).length === 0 && (
                    <span className="text-xs text-amber-500/50">未选择道具</span>
                  )}
                </div>
              </div>

              {/* Tail Frame Reference */}
              {selectedSegment?.useTailFrameRef && activeSegmentIndex > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-400 tracking-wide">前一片段尾帧</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max={prevSegmentDuration > 0 ? prevSegmentDuration.toFixed(1) : undefined}
                        step="0.5"
                        value={tailFrameTime}
                        onChange={(e) => setTailFrameTime(parseFloat(e.target.value) || 0)}
                        className="w-16 px-2 py-1 text-xs bg-slate-800 border border-slate-600 rounded text-slate-200"
                        placeholder="秒"
                      />
                      {prevSegmentDuration > 0 && (
                        <span className="text-[10px] text-slate-500">/{prevSegmentDuration.toFixed(1)}s</span>
                      )}
                      <button
                        onClick={() => handleRefreshTailFrame(tailFrameTime)}
                        disabled={refreshingTailFrame}
                        className="p-1.5 text-slate-400 hover:text-slate-50 hover:bg-slate-700 rounded transition-colors disabled:opacity-50 cursor-pointer"
                        title="刷新尾帧"
                      >
                        {refreshingTailFrame ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-2">
                    {(() => {
                      const prevSegment = (project.segments || [])[activeSegmentIndex - 1];
                      if (!prevSegment?.videoUrl) {
                        return <span className="text-xs text-slate-500">前一片段无视频</span>;
                      }
                      if (!prevSegment.lastFrameThumbnail) {
                        return (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">无尾帧缓存</span>
                            <button
                              onClick={() => handleRefreshTailFrame(tailFrameTime)}
                              disabled={refreshingTailFrame}
                              className="text-xs text-indigo-400 hover:text-indigo-300"
                            >
                              获取
                            </button>
                          </div>
                        );
                      }
                      return (
                        <img
                          src={prevSegment.lastFrameThumbnail}
                          alt="前一片段尾帧"
                          className="w-full h-auto rounded"
                        />
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Transition From */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-400 tracking-wide flex items-center gap-1">
                    <ChevronLeft className="w-3 h-3" />
                    入场转场
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleGenerateTransitionFrom}
                      disabled={generatingTransition}
                      className="p-1.5 text-[10px] text-slate-400 hover:text-slate-50 hover:bg-slate-700 rounded transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      title="AI生成"
                    >
                      {generatingTransition ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      AI生成
                    </button>
                    <button
                      onClick={() => handleCopyText(transitionFromDraft, '入场转场')}
                      disabled={!transitionFromDraft}
                      className="p-1.5 text-slate-400 hover:text-slate-50 hover:bg-slate-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      title="复制"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className={`relative ${generatingTransition ? 'ai-generating-border' : ''}`}>
                  <textarea
                    value={transitionFromDraft}
                    onChange={(e) => setTransitionFromDraft(e.target.value)}
                    placeholder="描述从上一个片段的转场效果..."
                    className={`w-full h-16 p-3 text-sm bg-slate-800 border rounded-lg resize-none focus:outline-none text-slate-50 placeholder:text-slate-600 ${
                      generatingTransition ? 'border-transparent' : 'border-slate-600 focus:border-slate-500'
                    }`}
                  />
                </div>
              </div>

              {/* Transition To */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-400 tracking-wide flex items-center gap-1">
                    <ChevronRight className="w-3 h-3" />
                    出场转场
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleGenerateTransitionTo}
                      disabled={generatingTransition}
                      className="p-1.5 text-[10px] text-slate-400 hover:text-slate-50 hover:bg-slate-700 rounded transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      title="AI 生成"
                    >
                      {generatingTransition ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      AI生成
                    </button>
                    <button
                      onClick={() => handleCopyText(transitionToDraft, '出场转场')}
                      disabled={!transitionToDraft}
                      className="p-1.5 text-slate-400 hover:text-slate-50 hover:bg-slate-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      title="复制"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className={`relative ${generatingTransition ? 'ai-generating-border' : ''}`}>
                  <textarea
                    value={transitionToDraft}
                    onChange={(e) => setTransitionToDraft(e.target.value)}
                    placeholder="描述到下一个片段的转场效果..."
                    className={`w-full h-16 p-3 text-sm bg-slate-800 border rounded-lg resize-none focus:outline-none text-slate-50 placeholder:text-slate-600 ${
                      generatingTransition ? 'border-transparent' : 'border-slate-600 focus:border-slate-500'
                    }`}
                  />
                </div>
              </div>
            </div>
              {/* Save Button */}
              <div className='flex ajust-between items-center px-2 md:px-4 py-2 gap-2'>
              <button
                onClick={handleSaveDescription}
                className="flex-1 py-2 rounded-lg bg-slate-700 text-slate-50 text-xs font-bold tracking-wide transition-all flex items-center justify-center gap-2 hover:bg-slate-600 border border-slate-600 cursor-pointer"
              >
                保存描述
              </button>
              <button
                  onClick={handleGenerateSegmentVideo}
                  disabled={generatingVideo === selectedSegment.id || batchGeneratingVideos}
                  className="flex-1 py-2 rounded-lg bg-slate-700 text-slate-50 text-xs gap-2 font-bold tracking-wide transition-all flex items-center justify-center hover:bg-slate-600 border border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {generatingVideo === selectedSegment.id ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {`生成中 ${videoElapsedSeconds}s`}
                    </>
                  ) : (
                    <>
                      <Video className="w-3 h-3" />
                      {(selectedSegment.videoUrl ? '重新生成视频' : '生成视频')}
                    </>
                  )}
                </button>
                </div>
            </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <ListVideo className="w-20 h-20 mb-6 opacity-50" />
            <p className="text-lg font-bold text-slate-400 mb-2">选择一个片段进行编辑</p>
            <p className="text-xs text-slate-600">从下方列表中点击片段查看预览和编辑描述</p>
          </div>
        )}
      </div>

      {/* Bottom: Segments List - Horizontal Scroll */}
      <div className="pb-1 border-t border-slate-600 bg-slate-700/50">
        <p className="text-xs text-slate-400 font-mono px-3 py-2">
          {(project.segments || []).length} 个片段 · {totalShots} 个分镜 · 总时长 {totalDuration.toFixed(1)} 秒
        </p>
        <div ref={scrollContainerRef} onWheel={handleThumbnailWheel} className="mx-2 rounded-lg overflow-x-auto overflow-y-hidden custom-scrollbar">
          {(project.segments || []).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <p className="text-xs">暂无片段，请先创建片段</p>
              <div className="flex items-center h-26 justify-center z-10 opacity-80 hover:opacity-100 transition-opacity duration-200">
                <button
                  onClick={() => handleAddSegmentAfter(0)}
                  className="text-white flex items-center justify-center shadow-lg shadow-indigo-500/30 transition-all hover:scale-110"
                  title="在此后添加片段"
                >
                  <Plus className="rounded-full bg-indigo-600 hover:bg-indigo-500 w-6 h-6" />
                </button>
                  <p className="text-xs">添加第一个片段</p>
              </div>
            </div>
          ) : (
            <div className="flex h-full p-1">
              {(project.segments || []).map((segment, index) => {
                const thumbnail = getSegmentThumbnail(segment);
                const isSelected = selectedSegmentId === segment.id;
                return (
                  <React.Fragment key={segment.id}>
                  <div
                    ref={(el) => {
                      if (el) {
                        segmentRefs.current.set(segment.id, el);
                      } else {
                        segmentRefs.current.delete(segment.id);
                      }
                    }}
                    className={`p-0.5 flex-shrink-0 w-47 h-27 bg-slate-900 border-1 rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? 'border-indigo-500 ring-1 ring-indigo-500/50 shadow-lg shadow-indigo-700/40'
                        : 'border-slate-600 hover:border-slate-400 hover:shadow-lg shadow-indigo-800/60'
                    } ${generatingVideo === segment.id&&'ai-generating-border'}`}
                    onClick={() => setSelectedSegmentId(segment.id)}
                    onMouseEnter={() => setHoveredSegmentId(segment.id)}
                    onMouseLeave={() => setHoveredSegmentId(null)}
                  >
                    {/* Thumbnail */}
                    <div className={`relative w-full h-full bg-slate-800 group overflow-hidden rounded-md`}>
                      {thumbnail ? (
                        <img
                          src={thumbnail}
                          alt={`片段 ${index + 1}`}
                          className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-200"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                          <ListVideo className="w-5 h-5" />
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
                      {/* Bottom Actions */}
                      <div className="absolute bottom-1 w-full flex items-center justify-between px-1.5 py-0.5">
                        <span className="text-[10px] text-slate-100 px-1 font-mono group-hover:bg-slate-700 rounded text-slate-400 group-hover:text-slate-200">
                          {segment.name}
                        </span>
                        <div className="flex gap-1">
                          {segment.videoUrl && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRefreshFirstFrame(segment.id);
                              }}
                              disabled={refreshingFirstFrame.has(segment.id)}
                              className="p-1 group-hover:bg-slate-700 rounded text-slate-400 group-hover:text-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                              title="刷新首帧缩略图"
                            >
                              {refreshingFirstFrame.has(segment.id) ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <RefreshCw className="w-3 h-3" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditSegment(segment);
                            }}
                            className="p-1 group-hover:bg-slate-700 rounded text-slate-400 group-hover:text-slate-200 transition-colors cursor-pointer"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSegment(segment.id);
                            }}
                            className="p-1 group-hover:bg-slate-700 rounded text-slate-400 group-hover:text-red-400 transition-colors cursor-pointer"
                          >
                            <Trash className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Add Segment Button - Invisible by default, visible on hover */}
                  <div className="flex items-center justify-center w-0.5 mx-1 hover:bg-indigo-500 z-10 opacity-100 md:opacity-0 hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={() => handleAddSegmentAfter(index)}
                      className="p-1 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30 transition-all hover:scale-110 cursor-pointer"
                      title="在此后添加片段"
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                 </div>
                </React.Fragment>
              )})}
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
          allProps={activeProps}
          getCharacterWithAssets={getCharacterWithAssets}
          getSceneWithAssets={getSceneWithAssets}
          getPropWithAssets={getPropWithAssets}
          isOpen={segmentEditModalOpen}
          onClose={() => setSegmentEditModalOpen(false)}
          onSave={handleSaveSegment}
        />
      )}

      {/* Segment Preview Modal */}
      <SegmentPreviewModal
        segments={project.segments || []}
        projectTitle={project.title}
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        getSegmentThumbnail={getSegmentThumbnail}
      />

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[60] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={previewImage}
            alt="Preview"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-300 hover:text-slate-50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* AI 分镜等待遮罩 */}
      {aiSplitting && (
        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <Loader2 className="w-12 h-12 text-slate-50 animate-spin mb-6" />
          <h3 className="text-xl font-bold text-slate-50 mb-2">AI 智能分镜中...</h3>
          <p className="text-slate-400">请稍候，正在分析分镜数据</p>
        </div>
      )}
    </div>
  );
};

export default StageSegments;
