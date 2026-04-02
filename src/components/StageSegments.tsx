import { ModelService } from '@/services/modelService';
import { renderTemplate } from '@/services/promptTemplates';
import { createLightweightCharacters, createLightweightScenes, mergeToLibrary, remapScriptDataRefs } from '@/services/seriesService';
import { ChevronLeft, ChevronRight, Copy, Edit, Film, ListVideo, Loader2, NotebookPen, Play, Plus, RefreshCw, Sparkles, Trash, Video, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addMediaHistory } from '../services/storageService';
import { Character, ProjectState, Scene, Segment, SeriesRecord } from '../types';

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
    isSeriesMode ? series?.library?.characters : project.scriptData?.characters || [],
    [isSeriesMode, series?.library?.characters, project.scriptData?.characters]
  );
  
  const activeScenes = useMemo(() => 
    isSeriesMode ? series?.library?.scenes : project.scriptData?.scenes || [],
    [isSeriesMode, series?.library?.scenes, project.scriptData?.scenes]
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
  const [batchGeneratingVideos, setBatchGeneratingVideos] = useState(false);  // 批量生成视频状态
  const [insertIndex, setInsertIndex] = useState<number | null>(null);  // 新片段插入位置
  const [previewModalOpen, setPreviewModalOpen] = useState(false);  // 预览模态框状态
  const [aiSplitting, setAiSplitting] = useState(false);  // AI 分镜等待遮罩
  const [curProjectid, setCurProjectid] = useState<string | null>(null);

  // Refs for auto-scroll to selected segment
  const segmentRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

      setGeneratingDescription((prev) => new Set([...prev, segmentId]));

      try {
        const description = await generateSegmentDescription(
          segment,
          project.shots,
          activeCharacters,
          activeScenes,
          project.visualStyle,
          project.genre,
          project.rawScript,
          project.scriptData.storyParagraphs
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

    let successCount = 0;
    // 使用累积数组，避免每次更新后覆盖之前的修改
    let currentSegments = [...segments];

    try {
      // 逐个生成描述，每生成一个就保存一次
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];

        try {
          const description = await generateSegmentDescription(
            segment,
            project.shots,
            activeCharacters,
            activeScenes,
            project.visualStyle,
            project.genre,
            project.rawScript,
            project.scriptData?.storyParagraphs || []
          );
          
          
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
              description,
              lastModified: Date.now(),
            };
            updateProject({ segments: [...currentSegments] });
            successCount++;
          }
          dialog.toast({ message: `成功生成 ${successCount} / ${segments.length} 个片段描述`, type: 'success' });
        } catch (err) {
          console.error(`生成片段 ${segment.name || segment.id} 描述失败:`, err);
          // 继续生成下一个
        }
      }
    } catch (error) {
      console.error('批量生成描述失败:', error);
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
      transitionFrom: '',
      transitionTo: '',
      estimatedDuration: 0,
      motionIntensity: 5,
      emotionCurve: '',
      dialogueRhythm: '',
      createdAt: Date.now(),
      lastModified: Date.now(),
    };
    setEditingSegment(newSegment);
    setInsertIndex(index + 1);
    setSegmentEditModalOpen(true);
  }, [project.segments]);

  // Save segment from edit modal
  const handleSaveSegment = useCallback(
    (updatedSegment: Segment) => {
      const segments = project.segments || [];
      if (editingSegment || selectedSegment) {
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

  // Get thumbnail image for segment (first shot's scene image, fallback to start keyframe)
  const getSegmentThumbnail = useCallback(
    (segment: Segment): string | undefined => {
      const sceneid = segment.sceneIds[0];
      if (sceneid) {
        // In series mode, get scene from library for full assets
        if (isSeriesMode){
          if(series?.library?.scenes) {
          const libraryScene = series.library.scenes.find((s) => s.id === sceneid);
          if (libraryScene?.referenceImage) {
            return libraryScene.referenceImage;
          }
        }else{
          const scene = project.scriptData.scenes.find((s) => s.id === sceneid);
          if (scene?.referenceImage) {
            return scene.referenceImage;
          }
        }
      }
    }},
    [project, isSeriesMode, series?.library?.scenes],
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
            project.genre || '剧情片'
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
          const { series: updatedSeries, charIdMapping, sceneIdMapping } = 
            mergeToLibrary(series, scriptData.characters, scriptData.scenes);
          
          scriptData = remapScriptDataRefs(scriptData, charIdMapping, sceneIdMapping);
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
          project.targetDuration
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
        newSegments = await aiConvertShotsToSegments(
          project.shots, characters, scenes, project.visualStyle, project.genre
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
    setGeneratingVideo(selectedSegment.id);
    try {
      // 如果 description 为空，先生成 description
      let currentDescription = selectedSegment.description;
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
            project.scriptData?.storyParagraphs || []
          );
          // 更新 segment 的 description
          const updatedSegments = (project.segments || []).map((seg) =>
            seg.id === selectedSegment.id ? { ...seg, description: currentDescription, lastModified: Date.now() } : seg
          );
          updateProject({ segments: updatedSegments });
        } catch (err) {
          console.error('生成描述失败:', err);
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
        if(!scene && getSceneWithAssets){
          scene = getSceneWithAssets(sceneId);
        }
        if (scene && scene?.referenceImage) {
          referenceImages.push(scene.referenceImage);
          imageLabels.push(`图${imageIndex}: ${scene.location}`);
          scenes.push(scene.location);
          imageIndex++;
        }
      });

      // Add character images
      selectedSegment.characterIds?.forEach((charId) => {
        let character = activeCharacters.find((c) => c.id === charId);
        if(!character && getCharacterWithAssets){
          character = getCharacterWithAssets(charId);
        }
        if(character){
          if(selectedSegment.characterVariations && selectedSegment.characterVariations[charId]){
            const variation = selectedSegment.characterVariations[charId];
            const selectedVar = character.variations.find(v => v.id === variation);
            if(selectedVar?.referenceImage){
              referenceImages.push(selectedVar.referenceImage);
              imageLabels.push(`图${imageIndex}: ${character.name}`);
              imageIndex++;
            }else if(character?.referenceImage){
              referenceImages.push(character.referenceImage);
              imageLabels.push(`图${imageIndex}: ${character.name}`);
              imageIndex++;
            }
          }else if(character?.referenceImage){
            referenceImages.push(character.referenceImage);
            imageLabels.push(`图${imageIndex}: ${character.name}`);
            imageIndex++;
          }
        }
      });

      // 使用 currentDescription（可能刚生成）
      const videoPrompt = renderTemplate('GENERATE_SEGMENT_VIDEO_PROMPT',scenes.join(','),currentDescription,selectedSegment.shotIds.length,
        selectedSegment.transitionFrom,selectedSegment.transitionTo
      );

      const prompt = '## 参考图说明：\n'+imageLabels.map((l,i)=>`${i+1}. ${l}`).join('\n')+'\n\n'+videoPrompt;

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
          project.seed
      );

      
      if (videoUrl) {
        // Save to media history
        const fileName = `Segment_${selectedSegment.name||selectedSegment.id}_video`;
        await addMediaHistory(project.id, videoUrl, fileName, 'video', 'video',prompt);
        // Update segment with videoUrl
        const updatedSegments = (project.segments || []).map((seg) =>
          seg.id === selectedSegment.id ? { ...seg, videoUrl } : seg
        );
        updateProject({ segments: updatedSegments });
        dialog.toast({ message: '视频生成成功', type: 'success' });
      } else {
        dialog.toast({ message: '视频生成失败，请重试', type: 'error' });
      }
    } catch (error) {
      dialog.toast({ message: '视频生成失败', type: 'error' });
    } finally {
      setGeneratingVideo(null);
    }
  }, [selectedSegment, dialog, updateProject, project.segments, activeScenes, activeCharacters, project.imageCount, project.modelProviders, project.id, project.imageSize, project.visualStyle, project.seed, project.shots, project.visualStyle, project.genre, project.rawScript, project.scriptData?.storyParagraphs]);

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

        try {
          setGeneratingVideo(segment.id);

          // 如果 description 为空，先生成 description
          let currentDescription = segment.description;
          if (!currentDescription?.trim()) {
            currentDescription = await generateSegmentDescription(
              segment,
              project.shots,
              activeCharacters,
              activeScenes,
              project.visualStyle,
              project.genre,
              project.rawScript,
              project.scriptData?.storyParagraphs || []
            );
            // 更新 description
            const segIndex = currentSegments.findIndex(s => s.id === segment.id);
            if (segIndex >= 0) {
              currentSegments[segIndex] = {
                ...currentSegments[segIndex],
                description: currentDescription,
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
            if (!scene && getSceneWithAssets) {
              scene = getSceneWithAssets(sceneId);
            }
            if (scene?.referenceImage) {
              referenceImages.push(scene.referenceImage);
              imageLabels.push(`图${imageIndex}: ${scene.location}`);
              scenes.push(scene.location);
              imageIndex++;
            }
          });

          segment.characterIds?.forEach((charId) => {
            let character = activeCharacters.find((c) => c.id === charId);
            if (!character && getCharacterWithAssets) {
              character = getCharacterWithAssets(charId);
            }
            if (character) {
              if (segment.characterVariations?.[charId]) {
                const variation = segment.characterVariations[charId];
                const selectedVar = character.variations?.find(v => v.id === variation);
                if (selectedVar?.referenceImage) {
                  referenceImages.push(selectedVar.referenceImage);
                  imageLabels.push(`图${imageIndex}: ${character.name}`);
                  imageIndex++;
                } else if (character.referenceImage) {
                  referenceImages.push(character.referenceImage);
                  imageLabels.push(`图${imageIndex}: ${character.name}`);
                  imageIndex++;
                }
              } else if (character.referenceImage) {
                referenceImages.push(character.referenceImage);
                imageLabels.push(`图${imageIndex}: ${character.name}`);
                imageIndex++;
              }
            }
          });

          const videoPrompt = renderTemplate(
            'GENERATE_SEGMENT_VIDEO_PROMPT',
            scenes.join(','),
            currentDescription,
            segment.shotIds.length,
            segment.transitionFrom,
            segment.transitionTo
          );

          const prompt = '## 参考图说明：\n' + imageLabels.map((l, i) => `${i + 1}. ${l}`).join('\n') + '\n\n' + videoPrompt;

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
            project.seed
          );

          if (videoUrl) {
            // Save to media history
            const fileName = `Segment_${segment.name || segment.id}_video`;
            await addMediaHistory(project.id, videoUrl, fileName, 'video', 'video', prompt);

            // Update segment with videoUrl
            const segIndex = currentSegments.findIndex(s => s.id === segment.id);
            if (segIndex >= 0) {
              currentSegments[segIndex] = {
                ...currentSegments[segIndex],
                videoUrl,
              };
              updateProject({ segments: [...currentSegments] });
              successCount++;
            }
          }
        } catch (err) {
          console.error(`生成片段 ${segment.name || segment.id} 视频失败:`, err);
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
      console.error('批量生成视频失败:', error);
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

  return (
    <div className="flex flex-col h-full bg-slate-900 relative overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-slate-600 bg-slate-700 md:px-6 px-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <ListVideo className="w-5 h-5 text-slate-500" />
          <div>
            <h2 className="text-lg font-bold text-slate-50">片段编辑</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {project.shots.length > 0 && (
            <button
              onClick={() => {
                updateProject({ stage: 'director', isSegmentMode: false });
              }}
              className="px-4 py-2 rounded-lg border border-indigo-600 bg-indigo-700/20 text-indigo-300 text-xs font-bold tracking-wide transition-all flex items-center gap-2 hover:bg-indigo-600/30 hover:border-indigo-500 cursor-pointer"
              title="切换到分镜模式"
            >
              <ListVideo className="w-3 h-3" />
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
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-50 flex items-center gap-2">
                  <Play className="w-4 h-4 text-slate-500" />
                  片段预览
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  片段 {(project.segments || []).findIndex(s => s.id === selectedSegment.id) + 1} / {(project.segments || []).length}
                </span>
              </div>
              <div className="flex-1 bg-slate-700 flex-col rounded-lg overflow-hidden flex items-center justify-center border border-slate-600 p-2 md:p-4">
                <div className="w-full h-full aspect-[9/16] bg-slate-800/50 rounded-lg overflow-hidden border border-slate-600 relative shadow-lg">
                {selectedSegment.videoUrl ? (
                  <video
                    src={selectedSegment.videoUrl}
                    controls
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex w-full h-full flex-col items-center justify-center text-slate-500 aspect-video bg-slate-800/50">
                    <ListVideo className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-sm">暂无视频预览</p>
                    <p className="text-xs text-slate-600">请先在导演工作台生成视频</p>
                  </div>
                )}
                </div>

              </div>
              {/* Shot Thumbnails */}
              <div className="relative">
                <div className="pt-4 h-16 flex gap-2 overflow-x-auto pb-0">
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
              <div className="absolute top-5.5 right-2 flex items-center gap-2 justify-end">
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
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Video className="w-3 h-3" />
                  )}
                  {!isMobile && (selectedSegment.videoUrl ? '重新生成视频' : '生成视频')}
                </button>
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
            <div className="flex-1 overflow-y-auto md:p-4 p-2 space-y-6 border-b border-slate-600">
              {/* Description */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-400 mb-2 tracking-wide">片段描述</label>
                <div className="relative h-[35vh]">
                  <textarea
                    value={descriptionDraft}
                    onChange={(e) => setDescriptionDraft(e.target.value)}
                    placeholder="输入片段描述..."
                    className="w-full h-full p-3 pb-14 text-sm bg-slate-800 border border-slate-600 rounded-lg resize-none focus:outline-none focus:border-slate-500 text-slate-50 placeholder:text-slate-600"
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
                <textarea
                  value={transitionFromDraft}
                  onChange={(e) => setTransitionFromDraft(e.target.value)}
                  placeholder="描述从上一个片段的转场效果..."
                  className="w-full h-20 p-3 text-sm bg-slate-800 border border-slate-600 rounded-lg resize-none focus:outline-none focus:border-slate-500 text-slate-50 placeholder:text-slate-600"
                />
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
                <textarea
                  value={transitionToDraft}
                  onChange={(e) => setTransitionToDraft(e.target.value)}
                  placeholder="描述到下一个片段的转场效果..."
                  className="w-full h-20 p-3 text-sm bg-slate-800 border border-slate-600 rounded-lg resize-none focus:outline-none focus:border-slate-500 text-slate-50 placeholder:text-slate-600"
                />
              </div>

            </div>
              {/* Save Button */}
              <button
                onClick={handleSaveDescription}
                className="m-4 px-2 md:px-4 py-2 rounded-lg bg-slate-700 text-slate-50 text-xs font-bold tracking-wide transition-all flex items-center justify-center gap-2 hover:bg-slate-600 border border-slate-600 cursor-pointer"
              >
                保存描述
              </button>
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
        <p className="text-xs text-slate-400 font-mono px-4 py-3">
          {(project.segments || []).length} 个片段 · {totalShots} 个分镜 · 总时长 {totalDuration.toFixed(1)} 秒
        </p>
        <div ref={scrollContainerRef} onWheel={handleThumbnailWheel} className="pb-2 mx-2 md:mx-4 overflow-x-auto overflow-y-hidden custom-scrollbar">
          {(project.segments || []).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <p className="text-xs">暂无片段，请先在导演工作台创建分镜</p>
              <div className="flex items-center h-26 justify-center z-10 opacity-80 hover:opacity-100 transition-opacity duration-200">
                <button
                  onClick={() => handleAddSegmentAfter(0)}
                  className="text-white flex items-center justify-center shadow-lg shadow-indigo-500/30 transition-all hover:scale-110"
                  title="在此后添加片段"
                >
                  <Plus className="rounded-full bg-indigo-600 hover:bg-indigo-500 w-6 h-6" />
               <p className="text-xs">添加第一个片段</p>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex h-full">
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
                    className={`flex-shrink-0 w-48 bg-slate-900 border rounded-lg overflow-hidden cursor-pointer transition-all ${
                      isSelected
                        ? 'border-indigo-500 ring-1 ring-indigo-500/50 shadow-lg shadow-indigo-700/40'
                        : 'border-slate-600 hover:border-slate-400 hover:shadow-lg shadow-indigo-800/60'
                    }`}
                    onClick={() => setSelectedSegmentId(segment.id)}
                    onMouseEnter={() => setHoveredSegmentId(segment.id)}
                    onMouseLeave={() => setHoveredSegmentId(null)}
                  >
                    {/* Thumbnail */}
                    <div className="relative w-full h-26 bg-slate-800 group p-1">
                      {thumbnail ? (
                        <img
                          src={thumbnail}
                          alt={`片段 ${index + 1}`}
                          className="w-full h-full object-cover group-hover:scale-115 transition-transform duration-200 rounded-lg"
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
                        <span className="text-[10px] text-slate-500 font-mono">
                          {segment.shotIds.length} 镜
                        </span>
                        <div className="flex gap-1">
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
                  <div className="flex items-center h-26 justify-center w-0.5 mx-1 hover:bg-indigo-500 z-10 opacity-100 md:opacity-0 hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={() => handleAddSegmentAfter(index)}
                      className="p-1 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30 transition-all hover:scale-110 cursor-pointer"
                      title="在此后添加片段"
                    >
                      <Plus className="w-3 h-3" />
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
          getCharacterWithAssets={getCharacterWithAssets}
          getSceneWithAssets={getSceneWithAssets}
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
