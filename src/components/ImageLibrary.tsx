/**
 * Image Library - 共享的图片库核心组件
 * 由 StageImage（移动端全屏）和 ImageSelectorModal（桌面端 Modal）共同使用
 */

import { ArrowRightLeft, Cloud, Download, Images, Loader2, NotebookPen, RotateCcw, Search, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { deleteSingleMediaFile, getAllProjectsMetadata, getAllSeriesFromDB, getProjectMediaHistory, loadProjectFromDB, loadSeriesFromDB, md5Hash, MediaFile, saveProjectToDB, saveSeriesToDB, updateMediaHistoryFileUrl, addMediaHistory } from '../services/storageService';
import { ProjectState, SeriesRecord } from '../types';
import { uploadFileToService } from '../utils/fileUploadUtils';
import CustomSelect from './common/CustomSelect';
import { useDialog } from './dialog';
import { downloadImage, downloadVideo } from './modals/FileUploadModal';
import PromptDetailModal from './modals/PromptDetailModal';

export interface ImageItem {
  id: string;
  hash: string;
  imageUrl: string;
  title: string;
  subtitle: string;
  type: 'character' | 'scene' | 'prop' | 'keyframe-start' | 'keyframe-end' | 'keyframe-full' | 'video' | 'video-transition';
  projectId: string;
  projectName: string;
  downname: string;
  mediaType?: 'image' | 'video' | 'audio';
  ishistory: boolean;
  islocal?: boolean;
  prompt?: string;
  timestamp: number;
  shotId?: string;
}

export interface ImageLibraryProps {
  project?: ProjectState;
  updateProject?: (updates: Partial<ProjectState>) => void;
  /** 是否显示预览功能（StageImage 需要，ImageSelectorModal 不需要） */
  previewMode?: boolean;
  /** 是否显示视频 */
  showVideoDefault?: boolean;
  /** 选择图片回调（ImageSelectorModal 需要） */
  onSelectImage?: (imageUrl: string, allImages?: string[]) => void;
  /** 关闭回调（Modal 模式需要） */
  onClose?: () => void;
  /** 标题（可选，默认"媒体库"） */
  title?: string;
  /** 自定义 header 渲染函数 */
  renderHeader?: (props: {
    remoteImageCount: number;
    handleBatchUpload: () => Promise<void>;
    uploadingStatus: string | null;
    showVideo: boolean;
    setShowVideo: (show: boolean) => void;
    displayImagesLength: number;
  }) => React.ReactNode;
}

const ImageLibrary: React.FC<ImageLibraryProps> = ({
  project,
  updateProject,
  previewMode = false,
  showVideoDefault = true,
  onSelectImage,
  onClose,
  title = '媒体库',
  renderHeader,
}) => {
  const dialog = useDialog();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'character' | 'scene' | 'prop' | 'keyframe' | 'video'>('all');
  const [allProjects, setAllProjects] = useState<ProjectState[]>([]);
  const [seriesList, setSeriesList] = useState<SeriesRecord[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('');
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [showVideo, setShowVideo] = useState(showVideoDefault);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<{ title: string; prompt: string; timestamp?: number } | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const [uploadingStatus, setUploadingStatus] = useState<string | null>(null);
  const [associatingUrl, setAssociatingUrl] = useState<string | null>(null);
  const [allImages, setAllImages] = useState<ImageItem[]>([]);

  // 加载所有项目和连续剧
  useEffect(() => {
    const loadProjectsAndSeries = async () => {
      setLoadingProjects(true);
      try {
        const [projects, series] = await Promise.all([
          getAllProjectsMetadata(),
          getAllSeriesFromDB()
        ]);
        setAllProjects(projects);
        setSeriesList(series);

        // 设置默认选中项目
        if (project) {
          if (project.seriesRefId) {
            setSelectedSeriesId(project.seriesRefId);
            setSelectedProjectId(project.id);
          } else {
            setSelectedProjectId(project.id);
          }
        } else {
          // 优先选择单剧
          const standaloneProjects = projects.filter(p => !p.seriesRefId);
          if (standaloneProjects.length > 0) {
            setSelectedProjectId(standaloneProjects[0].id);
          } else if (projects.length > 0) {
            setSelectedProjectId(projects[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to load projects and series:', error);
      } finally {
        setLoadingProjects(false);
      }
    };

    loadProjectsAndSeries();
  }, [project]);

  const handleDownloadImage = useCallback(async (imageUrl: string, charName: string) => {
    if (downloadStatus) return;
    setDownloadStatus('downloading');
    try {
      await downloadImage(imageUrl, `${charName}.png`, null);
    } finally {
      setDownloadStatus(null);
    }
  }, [downloadStatus]);

  const handleDownloadVideo = useCallback(async (imageUrl: string, charName: string) => {
    if (downloadStatus) return;
    setDownloadStatus('downloading');
    try {
      await downloadVideo(imageUrl, `${charName}.mp4`, null);
    } finally {
      setDownloadStatus(null);
    }
  }, [downloadStatus]);

  const handleDeleteHistory = useCallback(async (image: ImageItem, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!image.ishistory) return;

    try {
      const confirmed = await dialog.confirm({
        title: '确认删除',
        message: `确定要删除此历史记录吗？此操作不可撤销。`,
        type: 'warning',
      });

      if (!confirmed) return;

      setAllImages(prevImages => prevImages.filter(img => img.id !== image.id));
      await deleteSingleMediaFile(image.projectId, image.hash);

    } catch (error) {
      console.error('Failed to delete media history:', error);
    }
  }, [dialog]);

  const handleShowPrompt = useCallback((image: ImageItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (image.prompt) {
      setSelectedPrompt({ title: image.title, prompt: image.prompt, timestamp: image.timestamp });
      setShowPromptModal(true);
    }
  }, []);

  const handleRestoreVideo = useCallback(async (image: ImageItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!image.shotId || !image.projectId || !image.imageUrl) {
      dialog.toast({ message: '缺少必要信息', type: 'error' });
      return;
    }

    const confirmed = await dialog.confirm({
      title: '还原视频',
      message: `确定要将此视频还原到对应的${image.type === 'video-transition' ? '转场' : '片段/镜头'}吗？这将覆盖现有视频。`,
      type: 'warning'
    });
    if (!confirmed) return;

    setAssociatingUrl(image.id);
    try {
      let finalUrl = image.imageUrl;
      const fileType = `${image.projectId}/video/${image.shotId}`;

      try {
        const uploadResponse = await uploadFileToService({
          fileType,
          fileUrl: image.imageUrl
        });

        if (uploadResponse.success && uploadResponse.data?.fileUrl) {
          finalUrl = uploadResponse.data.fileUrl;
        }
      } catch (uploadError) {
        console.warn(`文件上传出错:`, uploadError, '，使用原始URL');
      }

      const isCurrentProject = project && project.id === image.projectId;
      const targetProject = isCurrentProject ? project : await loadProjectFromDB(image.projectId);

      if (!targetProject) {
        dialog.toast({ message: '未找到项目', type: 'error' });
        return;
      }

      let updated = false;
      const segments = targetProject.segments || [];

      const matchingSegment = segments.find(seg => seg.id === image.shotId);
      if (matchingSegment) {
        const updatedSegments = segments.map((seg) =>
          seg.id === image.shotId ? { ...seg, videoUrl: finalUrl } : seg
        );
        await saveProjectToDB({ ...targetProject, segments: updatedSegments });

        if (isCurrentProject && updateProject) {
          updateProject({ segments: updatedSegments });
        }

        updated = true;
        const fileName = `Segment_${image.shotId}_video`;
        await addMediaHistory(targetProject.id, finalUrl, fileName, 'video', 'video', image.prompt || '', image.shotId);
        dialog.toast({ message: `已还原到片段 ${matchingSegment.name || matchingSegment.id}`, type: 'success' });
      } else {
        const updatedShots = targetProject.shots.map((shot) => {
          if (shot.id === image.shotId) {
            updated = true;
            return {
              ...shot,
              interval: {
                ...shot.interval,
                videoUrl: finalUrl
              }
            };
          }
          return shot;
        });

        if (updated) {
          await saveProjectToDB({ ...targetProject, shots: updatedShots });

          if (isCurrentProject && updateProject) {
            updateProject({ shots: updatedShots });
          }

          const fileName = `Shot_${image.shotId}_video`;
          await addMediaHistory(targetProject.id, finalUrl, fileName, 'video', 'video', image.prompt || '', image.shotId);
          dialog.toast({ message: `已还原到镜头 ${image.shotId}`, type: 'success' });
        } else {
          dialog.toast({ message: '未找到对应镜头或片段', type: 'warning' });
        }
      }
    } catch (error: any) {
      console.error('Failed to restore video:', error);
      dialog.toast({ message: `还原失败: ${error.message}`, type: 'error' });
    } finally {
      setAssociatingUrl(null);
    }
  }, [project, updateProject, dialog]);

  const findPromptFromHistory = useCallback((historyFiles: MediaFile[], fileid: string) => {
    const file = historyFiles.find(f => f.id === fileid);
    if (file) {
      return file;
    }
    return { prompt: '', timestamp: 0 };
  }, []);

  const getCharacterWithAssets = useCallback((char: import('../types').Character, projectSeriesRefId?: string): import('../types').Character => {
    if (!projectSeriesRefId || !char.refId) return char;
    const series = seriesList.find(s => s.id === projectSeriesRefId);
    if (series?.library?.characters) {
      const libraryChar = series.library.characters.find(c => c.id === char.refId);
      if (libraryChar) return libraryChar;
    }
    return char;
  }, [seriesList]);

  const getSceneWithAssets = useCallback((scene: import('../types').Scene, projectSeriesRefId?: string): import('../types').Scene => {
    if (!projectSeriesRefId || !scene.refId) return scene;
    const series = seriesList.find(s => s.id === projectSeriesRefId);
    if (series?.library?.scenes) {
      const libraryScene = series.library.scenes.find(s => s.id === scene.refId);
      if (libraryScene) return libraryScene;
    }
    return scene;
  }, [seriesList]);

  const getPropWithAssets = useCallback((prop: import('../types').Properties, projectSeriesRefId?: string): import('../types').Properties => {
    if (!projectSeriesRefId || !prop.refId) return prop;
    const series = seriesList.find(s => s.id === projectSeriesRefId);
    if (series?.library?.props) {
      const libraryProp = series.library.props.find(p => p.id === prop.refId);
      if (libraryProp) return libraryProp;
    }
    return prop;
  }, [seriesList]);

  useEffect(() => {
    const loadAllImages = async () => {
      if (allProjects.length === 0 || !selectedProjectId) {
        setAllImages([]);
        return;
      }

      const images: ImageItem[] = [];
      const urlHashSet = new Set<string>();
      const selectedProject = allProjects.find(p => p.id === selectedProjectId);

      if (!selectedProject) {
        setAllImages([]);
        return;
      }

      let historyFiles = await getProjectMediaHistory(selectedProject.id);
      if (selectedSeriesId) {
        const seriesHistoryFiles = await getProjectMediaHistory(selectedSeriesId);
        historyFiles = [...historyFiles, ...seriesHistoryFiles];
      }

      interface ImageTask {
        url: string;
        id: string;
        type: ImageItem['type'];
        title: string;
        subtitle: string;
        downname: string;
        mediaType: 'image' | 'video';
      }

      const imageTasks: ImageTask[] = [];

      if (selectedProject.scriptData?.characters) {
        for (const episodeChar of selectedProject.scriptData.characters) {
          const char = getCharacterWithAssets(episodeChar, selectedProject.seriesRefId);
          if (char.referenceImage) {
            imageTasks.push({
              url: char.referenceImage,
              id: `char-${selectedProject.id}-${char.id}`,
              type: 'character',
              title: char.name,
              subtitle: `角色 - ${char.name}`,
              downname: `${selectedProject.scriptData?.title || ''}-角色-${char.name}`,
              mediaType: 'image'
            });
          }

          if (char.variations) {
            for (let idx = 0; idx < char.variations.length; idx++) {
              const outfit = char.variations[idx];
              if (outfit.referenceImage) {
                imageTasks.push({
                  url: outfit.referenceImage,
                  id: `char-${selectedProject.id}-${char.id}-outfit-${idx}`,
                  type: 'character',
                  title: `${char.name} - ${outfit.name || `造型 ${idx + 1}`}`,
                  subtitle: `角色造型 - ${char.name}`,
                  downname: `${selectedProject.scriptData?.title || ''}-角色-${char.name}-造型 ${idx + 1}`,
                  mediaType: 'image'
                });
              }
            }
          }
        }
      }

      if (selectedProject.scriptData?.scenes) {
        for (const episodeScene of selectedProject.scriptData.scenes) {
          const scene = getSceneWithAssets(episodeScene, selectedProject.seriesRefId);
          if (scene.referenceImage) {
            imageTasks.push({
              url: scene.referenceImage,
              id: `scene-${selectedProject.id}-${scene.id}`,
              type: 'scene',
              title: scene.location,
              subtitle: `场景 - ${scene.id}`,
              downname: `${selectedProject.scriptData?.title || ''}-场景-${scene.id}`,
              mediaType: 'image'
            });
          }
        }
      }

      if (selectedProject.scriptData?.props) {
        for (const episodeProp of selectedProject.scriptData.props) {
          const prop = getPropWithAssets(episodeProp, selectedProject.seriesRefId);
          if (prop.referenceImage) {
            imageTasks.push({
              url: prop.referenceImage,
              id: `prop-${selectedProject.id}-${prop.id}`,
              type: 'prop',
              title: prop.name,
              subtitle: `道具 - ${prop.name}`,
              downname: `${selectedProject.scriptData?.title || ''}-道具-${prop.name}`,
              mediaType: 'image'
            });
          }

          if (prop.variations) {
            for (let idx = 0; idx < prop.variations.length; idx++) {
              const variation = prop.variations[idx];
              if (variation.referenceImage) {
                imageTasks.push({
                  url: variation.referenceImage,
                  id: `prop-${selectedProject.id}-${prop.id}-variation-${idx}`,
                  type: 'prop',
                  title: `${prop.name} - ${variation.name || `变体 ${idx + 1}`}`,
                  subtitle: `道具变体 - ${prop.name}`,
                  downname: `${selectedProject.scriptData?.title || ''}-道具-${prop.name}-变体 ${idx + 1}`,
                  mediaType: 'image'
                });
              }
            }
          }
        }
      }

      if (selectedProject.shots) {
        for (let shotIdx = 0; shotIdx < selectedProject.shots.length; shotIdx++) {
          const shot = selectedProject.shots[shotIdx];
          const shotLabel = `镜头 ${shotIdx + 1}`;

          if (shot.keyframes) {
            for (const kf of shot.keyframes) {
              if (kf.imageUrl) {
                let type: 'keyframe-start' | 'keyframe-end' | 'keyframe-full';
                let subtitle: string;
                if (kf.type === 'start') {
                  type = 'keyframe-start';
                  subtitle = `起始帧 - ${shot.actionSummary.substring(0, 30)}...`;
                } else if (kf.type === 'end') {
                  type = 'keyframe-end';
                  subtitle = `结束帧 - ${shot.actionSummary.substring(0, 30)}...`;
                } else {
                  type = 'keyframe-full';
                  subtitle = `宫格图 - ${shot.actionSummary.substring(0, 30)}...`;
                }

                imageTasks.push({
                  url: kf.imageUrl,
                  id: `kf-${selectedProject.id}-${shot.id}-${kf.type}`,
                  type,
                  title: shotLabel,
                  subtitle,
                  downname: `${selectedProject.scriptData?.title || ''}-镜头-${shot.id}-${kf.type}`,
                  mediaType: 'image'
                });
              }
            }
          }
        }
      }

      if (selectedProject.shots && showVideo) {
        for (let shotIdx = 0; shotIdx < selectedProject.shots.length; shotIdx++) {
          const shot = selectedProject.shots[shotIdx];
          const shotLabel = `镜头 ${shotIdx + 1}`;

          if (shot.interval?.videoUrl) {
            imageTasks.push({
              url: shot.interval.videoUrl,
              id: `shot-video-${selectedProject.id}-${shot.id}`,
              type: 'video',
              title: shotLabel,
              subtitle: `镜头视频 - ${shot.actionSummary.substring(0, 30)}...`,
              downname: `${selectedProject.scriptData?.title || ''}-镜头-${shot.id}`,
              mediaType: 'video'
            });
          }

          if (shot.transitionUrl) {
            imageTasks.push({
              url: shot.transitionUrl,
              id: `shot-transition-${selectedProject.id}-${shot.id}`,
              type: 'video-transition',
              title: shotLabel,
              subtitle: `转场视频 - ${shot.actionSummary.substring(0, 30)}...`,
              downname: `${selectedProject.scriptData?.title || ''}-镜头-${shot.id}-转场`,
              mediaType: 'video'
            });
          }
        }
      }

      if (selectedProject.segments && showVideo) {
        for (let segmentIdx = 0; segmentIdx < selectedProject.segments.length; segmentIdx++) {
          const segment = selectedProject.segments[segmentIdx];
          if (segment.videoUrl) {
            const segmentLabel = `片段 ${segmentIdx + 1}`;
            imageTasks.push({
              url: segment.videoUrl,
              id: `segment-video-${selectedProject.id}-${segment.id}`,
              type: 'video',
              title: segmentLabel,
              subtitle: `片段视频 - ${segment.name || segment.description.substring(0, 30)}...`,
              downname: `${selectedProject.scriptData?.title || ''}-片段-${segment.name || segment.id}`,
              mediaType: 'video'
            });
          }
        }
      }

      const BATCH_SIZE = 10;
      const md5Results: Array<{ task: ImageTask; hash: string }> = [];

      for (let i = 0; i < imageTasks.length; i += BATCH_SIZE) {
        const batch = imageTasks.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (task) => ({
            task,
            hash: await md5Hash(task.url)
          }))
        );
        md5Results.push(...batchResults);
      }

      for (const { task, hash } of md5Results) {
        if (!urlHashSet.has(hash)) {
          const file = findPromptFromHistory(historyFiles, hash);
          urlHashSet.add(hash);
          images.push({
            id: task.id,
            hash,
            imageUrl: task.url,
            title: task.title,
            subtitle: task.subtitle,
            type: task.type,
            projectId: selectedProject.id,
            projectName: selectedProject.title || '未命名项目',
            downname: task.downname,
            mediaType: task.mediaType,
            ishistory: false,
            islocal: isLocalFile(task.url),
            prompt: file.prompt,
            timestamp: file.timestamp
          });
        }
      }

      for (const file of historyFiles) {
        if (!showVideo && file.fileType === 'video') {
          continue;
        }

        if (!urlHashSet.has(file.id)) {
          urlHashSet.add(file.id);
          let type: 'character' | 'scene' | 'prop' | 'keyframe-start' | 'keyframe-end' | 'keyframe-full' | 'video' | 'video-transition';
          let subtitle = '';

          if (file.mediaType === 'character') {
            type = 'character';
            subtitle = `角色历史 - ${file.fileName}`;
          } else if (file.mediaType === 'scene') {
            type = 'scene';
            subtitle = `场景历史 - ${file.fileName}`;
          } else if (file.mediaType === 'prop') {
            type = 'prop';
            subtitle = `道具历史 - ${file.fileName}`;
          } else if (file.fileType === 'video') {
            type = file.mediaType === 'video' ? 'video' : 'video-transition';
            subtitle = `场景视频 - ${file.fileName}`;
          } else if (file.fileType === 'audio') {
            continue;
          } else {
            if (file.fileName.startsWith('start_')) type = 'keyframe-start';
            else if (file.fileName.startsWith('end_')) type = 'keyframe-end';
            else type = 'keyframe-full';
            subtitle = `关键帧历史 - ${file.fileName}`;
          }

          images.push({
            id: `history-${selectedProject.id}-${file.id}`,
            hash: file.id,
            imageUrl: file.fileUrl,
            title: file.fileName,
            subtitle: subtitle,
            type,
            projectId: selectedProject.seriesRefId || selectedProject.id,
            projectName: selectedProject.title || '未命名项目',
            downname: file.fileName,
            mediaType: file.fileType,
            ishistory: true,
            islocal: isLocalFile(file.fileUrl),
            prompt: file.prompt,
            timestamp: file.timestamp,
            shotId: file.shotId,
          });
        }
      }
      setAllImages(images);
    };

    loadAllImages();
  }, [allProjects, seriesList, selectedProjectId, selectedSeriesId, showVideo, getCharacterWithAssets, getSceneWithAssets, getPropWithAssets, project]);

  const filteredImages = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return allImages;

    return allImages.filter(img =>
      img.title.toLowerCase().includes(query) ||
      img.subtitle.toLowerCase().includes(query)
    );
  }, [allImages, searchQuery]);

  const displayImages = useMemo(() => {
    if (activeTab === 'all') return filteredImages;
    return filteredImages.filter(img => img.type.startsWith(activeTab));
  }, [filteredImages, activeTab]);

  const isLocalFile = useCallback((url: string): boolean => {
    if (!url) return true;
    if (url.startsWith('data:') || url.includes('volces.com')) {
      return false;
    }
    return true;
  }, []);

  const handleBatchUpload = useCallback(async () => {
    if (!project || uploadingStatus) return;
    const remoteImages = displayImages.filter(img => !img.islocal);
    if (remoteImages.length === 0) return;

    setUploadingStatus(`上传中 0/${remoteImages.length}`);
    let failCount = 0;
    const selectedProject = allProjects.find(p => p.id === selectedProjectId);

    const updatedProject = project.id === selectedProjectId ? { ...project } : { ...selectedProject };

    for (let i = 0; i < remoteImages.length; i++) {
      const img = remoteImages[i];
      setUploadingStatus(`上传中 ${i + 1}/${remoteImages.length}`);
      try {
        const isBase64 = img.imageUrl.startsWith('data:');
        const uploadResponse = await uploadFileToService({
          fileType: `${project.id}/batch/${img.type}/${img.hash}`,
          fileUrl: isBase64 ? undefined : img.imageUrl,
          base64Data: isBase64 ? img.imageUrl : undefined
        });

        if (uploadResponse.success && uploadResponse.data?.fileUrl) {
          const newUrl = uploadResponse.data.fileUrl;

          setAllImages(prev => prev.map(item =>
            item.id === img.id ? { ...item, imageUrl: newUrl, islocal: true } : item
          ));

          if (updatedProject.scriptData) {
            for (const char of updatedProject.scriptData.characters) {
              if (char.referenceImage === img.imageUrl) char.referenceImage = newUrl;
              if (char.variations) {
                for (const v of char.variations) {
                  if (v.referenceImage === img.imageUrl) v.referenceImage = newUrl;
                }
              }
            }
            for (const scene of updatedProject.scriptData.scenes) {
              if (scene.referenceImage === img.imageUrl) scene.referenceImage = newUrl;
            }
            for (const prop of updatedProject.scriptData.props) {
              if (prop.referenceImage === img.imageUrl) prop.referenceImage = newUrl;
              if (prop.variations) {
                for (const v of prop.variations) {
                  if (v.referenceImage === img.imageUrl) v.referenceImage = newUrl;
                }
              }
            }
          }
          if (updatedProject.shots) {
            for (const shot of updatedProject.shots) {
              if (shot.keyframes) {
                for (const kf of shot.keyframes) {
                  if (kf.imageUrl === img.imageUrl) kf.imageUrl = newUrl;
                }
              }
              if (shot.interval?.videoUrl === img.imageUrl) shot.interval.videoUrl = newUrl;
              if (shot.transitionUrl === img.imageUrl) shot.transitionUrl = newUrl;
            }
          }
          if (updatedProject.segments) {
            for (const seg of updatedProject.segments) {
              if (seg.videoUrl === img.imageUrl) seg.videoUrl = newUrl;
            }
          }

          try {
            await updateMediaHistoryFileUrl(img.projectId, img.imageUrl, newUrl);
          } catch (e) {
            console.warn('更新历史表失败:', e);
          }

          if (updatedProject.seriesRefId) {
            try {
              const series = await loadSeriesFromDB(updatedProject.seriesRefId);
              let seriesUpdated = false;
              for (const char of series.library.characters) {
                if (char.referenceImage === img.imageUrl) {
                  char.referenceImage = newUrl;
                  seriesUpdated = true;
                }
                if (char.variations) {
                  for (const v of char.variations) {
                    if (v.referenceImage === img.imageUrl) {
                      v.referenceImage = newUrl;
                      seriesUpdated = true;
                    }
                  }
                }
              }
              for (const prop of series.library.props) {
                if (prop.referenceImage === img.imageUrl) {
                  prop.referenceImage = newUrl;
                  seriesUpdated = true;
                }
                if (prop.variations) {
                  for (const v of prop.variations) {
                    if (v.referenceImage === img.imageUrl) {
                      v.referenceImage = newUrl;
                      seriesUpdated = true;
                    }
                  }
                }
              }
              for (const scene of series.library.scenes) {
                if (scene.referenceImage === img.imageUrl) {
                  scene.referenceImage = newUrl;
                  seriesUpdated = true;
                }
              }
              if (seriesUpdated) {
                await saveSeriesToDB(series);
              }
            } catch (e) {
              console.warn('更新连续剧Library失败:', e);
            }
          }
        } else {
          failCount++;
        }
      } catch (e) {
        console.error('上传失败:', img.id, e);
        failCount++;
      }
    }

    try {
      if (project.id === selectedProjectId) {
        updateProject(updatedProject);
      }
      await saveProjectToDB(updatedProject);
    } catch (e) {
      console.error('保存项目失败:', e);
    }

    setUploadingStatus(null);
  }, [project, displayImages, updateProject, uploadingStatus, allProjects, selectedProjectId]);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: 0,
      character: 0,
      scene: 0,
      prop: 0,
      video: 0,
      keyframe: 0
    };

    for (const img of filteredImages) {
      counts.all++;
      if (img.type === 'character') counts.character++;
      else if (img.type === 'scene') counts.scene++;
      else if (img.type === 'prop') counts.prop++;
      else if (img.type.startsWith('video')) counts.video++;
      else if (img.type.startsWith('keyframe')) counts.keyframe++;
    }

    return counts as typeof tabCounts;
  }, [filteredImages]);

  const remoteImageCount = useMemo(() => {
    return displayImages.filter(img => !img.islocal).length;
  }, [displayImages]);

  const handleImageClick = (image: ImageItem) => {
    if (image.mediaType === 'video') return;
    const allImageUrls = displayImages.map(img => img.imageUrl || '');
    setPreviewImages(allImageUrls);
    setPreviewIndex(allImageUrls.indexOf(image.imageUrl || ''));
    setPreviewImage(image.imageUrl || '');
  };

  const handleSelectImage = (image: ImageItem) => {
    if (onSelectImage) {
      const allImageUrls = displayImages.map(img => img.imageUrl || '');
      onSelectImage(image.imageUrl || '', allImageUrls);
    }
  };

  // 图片网格渲染
  const renderImageGrid = () => {
    if (displayImages.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
          <Search className="w-12 h-12 mb-4 opacity-50" />
          <p>未找到匹配的图片</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {displayImages.map((image) => (
          <div
            key={image.id}
            className="group relative aspect-square bg-slate-800 rounded-lg overflow-hidden border border-slate-700 hover:border-slate-500 transition-all hover:shadow-lg"
          >
            <button className="w-full h-full cursor-pointer">
              {image.mediaType === 'video' ? (
                <video
                  src={image.imageUrl}
                  className="w-full h-full object-contain"
                  controls
                  muted
                  onMouseLeave={(e) => e.currentTarget.pause()}
                />
              ) : (
                <img
                  src={image.imageUrl}
                  onClick={() => previewMode ? handleImageClick(image) : handleSelectImage(image)}
                  alt={image.title}
                  className="w-full h-full object-contain group-hover:scale-115 transition-transform duration-200"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <p className="text-xs font-medium text-white truncate">{image.title}</p>
                  <p className="text-[10px] text-white truncate">{image.subtitle}</p>
                </div>
              </div>
            </button>
            {!image.islocal && (
              <div className="absolute top-2 left-2 p-1.5 bg-orange-500/80 text-white rounded-full backdrop-blur" title="非本地文件，可上传到本地">
                <Cloud className="w-3 h-3" />
              </div>
            )}
            <div className="absolute top-2 right-2 flex gap-1 opacity-80 group-hover:opacity-100 transition-opacity pointer-events-none">
              {image.ishistory && (
                <button
                  onClick={(e) => handleDeleteHistory(image, e)}
                  className="pointer-events-auto p-2 bg-slate-700/50 text-slate-50 rounded-full hover:bg-slate-800 hover:text-slate-50 transition-colors border border-white/10 backdrop-blur cursor-pointer"
                  title="删除历史记录"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
              {image.mediaType === 'video' && image.shotId && image.ishistory && (
                <button
                  onClick={(e) => handleRestoreVideo(image, e)}
                  disabled={!!associatingUrl}
                  className="pointer-events-auto p-2 bg-slate-700/50 text-slate-50 rounded-full hover:bg-slate-800 hover:text-slate-50 transition-colors border border-white/10 backdrop-blur cursor-pointer disabled:opacity-50"
                  title="还原视频到片段/镜头"
                >
                  {associatingUrl === image.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3 h-3" />
                  )}
                </button>
              )}
              {image.prompt && (
                <button
                  onClick={(e) => handleShowPrompt(image, e)}
                  className="pointer-events-auto p-2 bg-slate-700/50 text-slate-50 rounded-full hover:bg-slate-800 hover:text-slate-50 transition-colors border border-white/10 backdrop-blur cursor-pointer"
                  title="查看提示词"
                >
                  <NotebookPen className="w-3 h-3" />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (image.mediaType === 'video') {
                    handleDownloadVideo(image.imageUrl!, image.downname);
                  } else {
                    handleDownloadImage(image.imageUrl!, image.downname);
                  }
                }}
                disabled={!!downloadStatus}
                className="pointer-events-auto p-2 bg-slate-700/50 text-slate-50 rounded-full hover:bg-slate-800 hover:text-slate-50 transition-colors border border-white/10 backdrop-blur cursor-pointer"
                title={image.mediaType === 'video' ? '下载视频' : '下载图片'}
              >
                <Download className="w-3 h-3" />
              </button>
              {image.type.includes('transition') && (
                <button
                  className="pointer-events-auto p-2 bg-slate-700/50 text-slate-50 rounded-full hover:bg-slate-800 hover:text-slate-50 transition-colors border border-white/10 backdrop-blur cursor-pointer"
                  title="转场视频"
                >
                  <ArrowRightLeft className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      {/* 自定义 Header */}
      {renderHeader && renderHeader({
        remoteImageCount,
        handleBatchUpload,
        uploadingStatus,
        showVideo,
        setShowVideo,
        displayImagesLength: displayImages.length
      })}

      {/* 标签页 */}
      <div className="sticky top-0 z-20 p-1 border-b border-slate-600 bg-slate-700">
        <div className="bg-slate-700 rounded-xl p-1">
          <div className="flex gap-1 overflow-x-auto">
            {(
              showVideo
                ? ['all', 'character', 'scene', 'prop', 'keyframe', 'video'] as const
                : ['all', 'character', 'scene', 'prop', 'keyframe'] as const
            ).map(tab => {
              const labels = {
                all: '全部',
                character: '角色',
                scene: '场景',
                prop: '道具',
                keyframe: '关键帧',
                video: '视频'
              };
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-2 lg:px-4 h-8 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center cursor-pointer ${
                    activeTab === tab
                      ? 'bg-slate-800 text-slate-100'
                      : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {labels[tab]} ({tabCounts[tab]})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 图片网格 */}
      <div className="p-2 md:p-6">
        {renderImageGrid()}
      </div>

      {/* Image Preview Modal */}
      {previewMode && previewImage && (
        <div
          className="fixed inset-0 z-[100] bg-slate-700/95 flex items-center justify-center backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          {previewImages.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const newIndex = previewIndex > 0 ? previewIndex - 1 : previewImages.length - 1;
                setPreviewIndex(newIndex);
                setPreviewImage(previewImages[newIndex]);
              }}
              className="absolute left-6 p-3 bg-slate-900/80 hover:bg-slate-800 text-slate-50 rounded-full transition-colors cursor-pointer"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          <img
            src={previewImage}
            alt="Preview"
            className="max-w-[95vw] max-h-[95vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {previewImages.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const newIndex = previewIndex < previewImages.length - 1 ? previewIndex + 1 : 0;
                setPreviewIndex(newIndex);
                setPreviewImage(previewImages[newIndex]);
              }}
              className="absolute right-16 p-3 bg-slate-900/80 hover:bg-slate-800 text-slate-50 rounded-full transition-colors cursor-pointer"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-6 right-6 p-3 bg-slate-900/80 hover:bg-slate-800 text-slate-50 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-900/80 text-slate-50 rounded-full text-sm">
            {previewImages.length > 1 ? `${previewIndex + 1} / ${previewImages.length}` : '预览'}
          </div>
        </div>
      )}

      {/* 提示词对话框 */}
      {showPromptModal && selectedPrompt && (
        <PromptDetailModal
          isOpen={showPromptModal}
          onClose={() => setShowPromptModal(false)}
          title={selectedPrompt.title}
          prompt={selectedPrompt.prompt}
          timestamp={selectedPrompt.timestamp}
        />
      )}
    </>
  );
};

export default ImageLibrary;
