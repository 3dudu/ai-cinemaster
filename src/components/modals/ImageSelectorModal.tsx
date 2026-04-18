/**
 * Image Selector Modal - 桌面端 Modal 式图片选择器
 * 恢复原始 ImageS.tsx 的完整功能
 */

import { ArrowRightLeft, Cloud, Download, Images, Loader2, NotebookPen, RotateCcw, Search, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { addMediaHistory, deleteSingleMediaFile, getAllProjectsMetadata, getAllSeriesFromDB, getProjectMediaHistory, loadProjectFromDB, loadSeriesFromDB, md5Hash, MediaFile, saveProjectToDB, saveSeriesToDB, updateMediaHistoryFileUrl } from '../../services/storageService';
import { ProjectState, SeriesRecord } from '../../types';
import { uploadFileToService } from '../../utils/fileUploadUtils';
import CustomSelect from '../common/CustomSelect';
import { useDialog } from '../dialog';
import { downloadImage, downloadVideo } from './FileUploadModal';
import PromptDetailModal from './PromptDetailModal';

interface ImageItem {
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

interface Props {
  isOpen: boolean;
  onClose: () => void;
  project?: ProjectState;
  updateProject?: (updates: Partial<ProjectState>) => void;
  onSelectImage: (imageUrl: string, allImages?: string[]) => void;
  filterType?: 'character' | 'scene' | 'keyframe' | 'prop' | 'all' | 'video';
  previewMode?: boolean;
  showVideo?: boolean;
}

const ImageSelectorModal: React.FC<Props> = ({
  isOpen,
  onClose,
  project,
  updateProject,
  onSelectImage,
  filterType = 'all',
  previewMode = false,
  showVideo = false
}) => {
  const dialog = useDialog();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'character' | 'scene' | 'prop' | 'keyframe' | 'video'>(filterType);
  const [allProjects, setAllProjects] = useState<ProjectState[]>([]);
  const [seriesList, setSeriesList] = useState<SeriesRecord[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('');
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<{title: string, prompt: string, timestamp?: number} | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const [uploadingStatus, setUploadingStatus] = useState<string | null>(null);
  const [associatingUrl, setAssociatingUrl] = useState<string | null>(null);
  const [showVideoState, setShowVideoState] = useState(showVideo);

  // 加载所有项目和连续剧
  useEffect(() => {
    const loadProjectsAndSeries = async () => {
      if (isOpen) {
        setLoadingProjects(true);
        try {
          const [projects, seriesData] = await Promise.all([
            getAllProjectsMetadata(),
            getAllSeriesFromDB()
          ]);

          // 设置连续剧列表
          setSeriesList(seriesData);

          // 设置所有项目（用于实际加载图片数据）
          setAllProjects(projects);

          // 设置默认选中项目
          if (project) {
            // 如果当前项目是连续剧的单集，选中其所属的连续剧
            if (project.seriesRefId) {
              setSelectedSeriesId(project.seriesRefId);
              setSelectedProjectId(project.id);
            } else {
              // 如果是单剧，直接选中
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
      }
    };

    loadProjectsAndSeries();
  }, [isOpen, project]);

  const handleDownloadImage = useCallback(async (imageUrl: string, charName: string) => {
    if(downloadStatus) return;
    setDownloadStatus('downloading');
    try {
      await downloadImage(imageUrl, `${charName}.png`, null);
    } finally {
      setDownloadStatus(null);
    }
  }, [downloadStatus]);

  const handleDownloadVideo = useCallback(async (imageUrl: string, charName: string) => {
    if(downloadStatus) return;
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

  // 将历史视频还原到当前shot或segment
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

  // 收集所有图片数据
  const [allImages, setAllImages] = useState<ImageItem[]>([]);

  const findPromptFromHistory = useCallback((historyFiles: MediaFile[], fileid: string) => {
    const file = historyFiles.find(f => f.id === fileid);
    if (file) {
      return file;
    }
    return { prompt: '', timestamp: 0 };
  }, []);

  // Helper function to get character with full library data (in series mode)
  const getCharacterWithAssets = useCallback((char: import('../../types').Character, projectSeriesRefId?: string): import('../../types').Character => {
    if (!projectSeriesRefId || !char.refId) return char;
    const series = seriesList.find(s => s.id === projectSeriesRefId);
    if (series?.library?.characters) {
      const libraryChar = series.library.characters.find(c => c.id === char.refId);
      if (libraryChar) return libraryChar;
    }
    return char;
  }, [seriesList]);

  // Helper function to get scene with full library data (in series mode)
  const getSceneWithAssets = useCallback((scene: import('../../types').Scene, projectSeriesRefId?: string): import('../../types').Scene => {
    if (!projectSeriesRefId || !scene.refId) return scene;
    const series = seriesList.find(s => s.id === projectSeriesRefId);
    if (series?.library?.scenes) {
      const libraryScene = series.library.scenes.find(s => s.id === scene.refId);
      if (libraryScene) return libraryScene;
    }
    return scene;
  }, [seriesList]);

  // Helper function to get prop with full library data (in series mode)
  const getPropWithAssets = useCallback((prop: import('../../types').Properties, projectSeriesRefId?: string): import('../../types').Properties => {
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

      // 角色图片（包含所有造型）
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
              downname: `${project?.scriptData?.title || ''}-角色-${char.name}`,
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
                  downname: `${project?.scriptData?.title || ''}-角色-${char.name}-造型 ${idx + 1}`,
                  mediaType: 'image'
                });
              }
            }
          }
        }
      }

      // 场景图片
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
              downname: `${project?.scriptData?.title || ''}-场景-${scene.id}`,
              mediaType: 'image'
            });
          }
        }
      }

      // 道具图片（包含所有变体）
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
              downname: `${project?.scriptData?.title || ''}-道具-${prop.name}`,
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
                  downname: `${project?.scriptData?.title || ''}-道具-${prop.name}-变体 ${idx + 1}`,
                  mediaType: 'image'
                });
              }
            }
          }
        }
      }

      // 关键帧图片
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
                  downname: `${project?.scriptData?.title || ''}-镜头-${shot.id}-${kf.type}`,
                  mediaType: 'image'
                });
              }
            }
          }
        }
      }

      // 添加视频
      if (selectedProject.shots && showVideoState) {
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
              mediaType: 'video',
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

      // 添加segment视频
      if (selectedProject.segments && showVideoState) {
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

      // 批量并行计算 MD5
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

      // 处理历史记录文件
      for (const file of historyFiles) {
        if (!showVideoState && file.fileType === 'video') {
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
  }, [allProjects, selectedProjectId, project, showVideoState, getCharacterWithAssets, getSceneWithAssets, getPropWithAssets, seriesList]);

  // 根据搜索词过滤图片
  const filteredImages = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return allImages;

    return allImages.filter(img =>
      img.title.toLowerCase().includes(query) ||
      img.subtitle.toLowerCase().includes(query)
    );
  }, [allImages, searchQuery]);

  // 根据标签和类型过滤图片
  const displayImages = useMemo(() => {
    if (activeTab === 'all') return filteredImages;
    return filteredImages.filter(img => img.type.startsWith(activeTab));
  }, [filteredImages, activeTab]);

  // 判断是否为本地文件
  const isLocalFile = useCallback((url: string): boolean => {
    if (!url) return true;
    if (url.startsWith('data:') || url.includes('volces.com')) {
      return false;
    }
    return true;
  }, []);

  // 批量上传非本地文件到本地服务器
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

  // 计算标签数量
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

  // 当前过滤结果中的非本地文件数量
  const remoteImageCount = useMemo(() => {
    return displayImages.filter(img => !img.islocal).length;
  }, [displayImages]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 select-text">
      {/* Modal 内容 */}
      <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl overflow-hidden w-full max-w-6xl h-[80vh] flex flex-col">
        {/* 标题栏 */}
        <div className="h-16 px-6 border-b border-slate-600 flex items-center justify-between bg-slate-600/80">
          <h3 className="text-lg font-bold text-slate-50 flex items-center gap-2">
            <Images className="w-5 h-5 text-slate-500" />
            {showVideoState ? '媒体' : '图片'}库
          </h3>
          <div className="flex items-center gap-2">
            {/* 视频/图片切换按钮 */}
            <button
              onClick={() => setShowVideoState(!showVideoState)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer ${
                showVideoState
                  ? 'bg-slate-700 text-slate-100 hover:bg-slate-600'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
              }`}
            >
              {showVideoState ? '显示图片' : '显示视频'}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 bg-slate-700 hover:text-slate-100 hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col">
          {/* 项目选择器和搜索框 */}
          <div className="px-2 md:px-6 py-2 md:py-4 border-b border-slate-600 bg-slate-700">
            <div className="flex md:gap-4 gap-2 md:flex-row flex-col">
              {/* 项目选择器（单剧和连续剧并集） */}
              <CustomSelect
                className="md:w-72 w-full"
                options={[
                  // 单剧项目
                  ...allProjects
                    .filter(p => !p.seriesRefId)
                    .map(proj => ({
                      value: `project-${proj.id}`,
                      label: proj.title || '未命名项目'
                    })),
                  // 连续剧
                  ...seriesList.map(s => ({
                    value: `series-${s.id}`,
                    label: `${s.title || '未命名连续剧'}`
                  }))
                ]}
                value={(() => {
                  const selectedProject = allProjects.find(p => p.id === selectedProjectId);
                  if (selectedProject?.seriesRefId) {
                    return `series-${selectedProject.seriesRefId}`;
                  }
                  return `project-${selectedProjectId}`;
                })()}
                onChange={(value) => {
                  if (value.startsWith('series-')) {
                    const seriesId = value.replace('series-', '');
                    setSelectedSeriesId(seriesId);
                    const series = seriesList.find(s => s.id === seriesId);
                    if (series && series.episodeOrder.length > 0) {
                      setSelectedProjectId(series.episodeOrder[0]);
                    }
                  } else {
                    const projectId = value.replace('project-', '');
                    setSelectedSeriesId('');
                    setSelectedProjectId(projectId);
                  }
                }}
                placeholder={loadingProjects ? '加载项目...' : '选择项目'}
                disabled={loadingProjects}
              />

              {/* 集数选择器（仅在选择连续剧时显示） */}
              {selectedSeriesId && (
                <CustomSelect
                  className="md:w-72 w-full"
                  options={(() => {
                    const series = seriesList.find(s => s.id === selectedSeriesId);
                    if (!series) return [];
                    return series.episodeOrder
                      .map(epId => allProjects.find(p => p.id === epId))
                      .filter((p): p is ProjectState => p !== undefined)
                      .map((proj, idx) => ({
                        value: proj.id,
                        label: `第${idx + 1}集 - ${proj.title || '未命名'}`
                      }));
                  })()}
                  value={selectedProjectId}
                  onChange={setSelectedProjectId}
                  placeholder="选择集数"
                  disabled={loadingProjects}
                />
              )}

              {/* 搜索框 */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索角色、场景或镜头..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:border-slate-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* 标签页 - 固定在滚动容器的顶部 */}
          <div className="sticky top-0 z-20 p-1 border-b border-slate-600 bg-slate-700">
            <div className="bg-slate-700 rounded-xl px-1 md:px-6">
              <div className="flex gap-1 md:gap-2 py-2 overflow-x-auto">
                {(
                  showVideoState
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
                      className={`px-2 md:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center cursor-pointer ${
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
          <div className="flex-1 md:overflow-y-auto p-2 md:p-6">
            {displayImages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <Search className="w-12 h-12 mb-4 opacity-50" />
                <p>未找到匹配的图片</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
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
                          alt={image.title}
                          onClick={() => {
                            const allImageUrls = displayImages.map(img => img.imageUrl || '');
                            onSelectImage(image.imageUrl || '', allImageUrls);
                            if (!previewMode) {
                              onClose();
                            }
                          }}
                          className="w-full h-full object-contain group-hover:scale-115 transition-transform duration-200"
                        />
                      )}
                      {/* 悬停遮罩 */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <div className="absolute bottom-0 left-0 right-0 p-2">
                          <p className="text-xs font-medium text-white truncate">{image.title}</p>
                          <p className="text-[10px] text-white truncate">{image.subtitle}</p>
                        </div>
                      </div>
                    </button>
                    {/* 非本地文件标记 */}
                    {!image.islocal && (
                      <div className="absolute top-2 left-2 p-1.5 bg-orange-500/80 text-white rounded-full backdrop-blur" title="非本地文件，可上传到本地">
                        <Cloud className="w-3 h-3" />
                      </div>
                    )}
                    {/* 按钮组 */}
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
            )}
          </div>
        </div>

        {/* 底部信息栏 */}
        <div className="p-4 border-t border-slate-700 flex justify-between items-center text-sm text-slate-400 bg-slate-600/80">
          <div className="flex items-center gap-3">
            <span>共 {displayImages.length} {activeTab === 'all' ? '个文件' : activeTab === 'video' ? '个视频' : '张图片'}</span>
            {remoteImageCount > 0 && (
              <button
                onClick={handleBatchUpload}
                disabled={!!uploadingStatus}
                className="px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {uploadingStatus ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {uploadingStatus}
                  </>
                ) : (
                  <>
                    <Cloud className="w-3 h-3" />
                    上传到本地 ({remoteImageCount})
                  </>
                )}
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors cursor-pointer"
          >
            取消
          </button>
        </div>
      </div>

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
    </div>
  );
};

export default ImageSelectorModal;
