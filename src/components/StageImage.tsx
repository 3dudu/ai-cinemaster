import { ArrowRightLeft, Cloud, Download, Images, Loader2, NotebookPen, Search, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { deleteSingleMediaFile, getAllProjectsMetadata, getAllSeriesFromDB, getProjectMediaHistory, loadSeriesFromDB, md5Hash, MediaFile, saveProjectToDB, saveSeriesToDB, updateMediaHistoryFileUrl } from '../services/storageService';
import { ProjectState, SeriesRecord } from '../types';
import { uploadFileToService } from '../utils/fileUploadUtils';
import CustomSelect from './common/CustomSelect';
import { useDialog } from './dialog';
import { downloadImage, downloadVideo } from './modals/FileUploadModal';
import PromptDetailModal from './modals/PromptDetailModal';

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
  prompt: string;
  timestamp: number;
}

interface Props {
  project: ProjectState;
  updateProject?: (updates: Partial<ProjectState>) => void;
}

const StageImage: React.FC<Props> = ({ project, updateProject }) => {
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
  const [showVideo, setShowVideo] = useState(true);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<{title: string, prompt: string, timestamp?: number} | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const [uploadingStatus, setUploadingStatus] = useState<string | null>(null);

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
    if(downloadStatus)return;
    setDownloadStatus('downloading');
    try{
      await downloadImage(imageUrl, `${charName}.png`, null);
    }finally{
      setDownloadStatus(null);
    }
  }, [downloadStatus]);
  
  const handleDownloadVideo = useCallback(async (imageUrl: string, charName: string) => {
    if(downloadStatus)return;
    setDownloadStatus('downloading');
    try{
      await downloadVideo(imageUrl, `${charName}.mp4`, null);
    }finally{
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

      // 从 allImages 中移除 hash 相同的元素
      setAllImages(prevImages => prevImages.filter(img => img.id !== image.id));

      // 删除媒体文件
      await deleteSingleMediaFile(image.projectId, image.hash);

    } catch (error) {
      console.error('Failed to delete media history:', error);
    }
  }, [dialog]);

  // 显示提示词
  const handleShowPrompt = useCallback((image: ImageItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (image.prompt) {
      setSelectedPrompt({ title: image.title, prompt: image.prompt, timestamp: image.timestamp });
      setShowPromptModal(true);
    }
  }, []);

  // 收集所有图片数据
  const [allImages, setAllImages] = useState<ImageItem[]>([]);
  
  const findPormtFromHistory = useCallback((historyFiles: MediaFile[], fileid: string) => {
    const file = historyFiles.find(f => f.id === fileid);
    if (file) {
      return file;
    }
    return {prompt: '',timestamp: 0};
  }, []);

  // Helper function to get character with full library data (in series mode)
  const getCharacterWithAssets = useCallback((char: import('../types').Character, projectSeriesRefId?: string): import('../types').Character => {
    // In standalone mode, return character directly
    if (!projectSeriesRefId || !char.refId) return char;

    // In series mode, get full character data from series library
    const series = seriesList.find(s => s.id === projectSeriesRefId);
    if (series?.library?.characters) {
      const libraryChar = series.library.characters.find(c => c.id === char.refId);
      if (libraryChar) return libraryChar;
    }
    return char;
  }, [seriesList]);

  // Helper function to get scene with full library data (in series mode)
  const getSceneWithAssets = useCallback((scene: import('../types').Scene, projectSeriesRefId?: string): import('../types').Scene => {
    // In standalone mode, return scene directly
    if (!projectSeriesRefId || !scene.refId) return scene;

    // In series mode, get full scene data from series library
    const series = seriesList.find(s => s.id === projectSeriesRefId);
    if (series?.library?.scenes) {
      const libraryScene = series.library.scenes.find(s => s.id === scene.refId);
      if (libraryScene) return libraryScene;
    }
    return scene;
  }, [seriesList]);

  // Helper function to get prop with full library data (in series mode)
  const getPropWithAssets = useCallback((prop: import('../types').Properties, projectSeriesRefId?: string): import('../types').Properties => {
    // In standalone mode, return prop directly
    if (!projectSeriesRefId || !prop.refId) return prop;

    // In series mode, get full prop data from series library
    const series = seriesList.find(s => s.id === projectSeriesRefId);
    if (series?.library?.props) {
      const libraryProp = series.library.props.find(p => p.id === prop.refId);
      if (libraryProp) return libraryProp;
    }
    return prop;
  }, [seriesList]);

  useEffect(() => {
    const loadAllImages = async () => {
      // 等待项目和媒体历史加载完成
      if (allProjects.length === 0 || !selectedProjectId) {
        return;
      }

      const images: ImageItem[] = [];
      const urlHashSet = new Set<string>();
      const selectedProject = allProjects.find(p => p.id === selectedProjectId);

      if (!selectedProject) {
        setAllImages([]);
        return;
      }

      // 添加 MediaHistory 中的文件
      let historyFiles = await getProjectMediaHistory(selectedProject.id);
      if(selectedSeriesId){
        const seriesHistoryFiles = await getProjectMediaHistory(selectedSeriesId);
        historyFiles = [...historyFiles, ...seriesHistoryFiles];
      }

      // ✅ 收集所有需要计算 MD5 的图片 URL 任务
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
              downname: `${selectedProject.scriptData?.title}-角色-${char.name}`,
              mediaType: 'image'
            });
          }

          // 添加角色的所有造型图片
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
                  downname: `${selectedProject.scriptData?.title}-角色-${char.name}-造型 ${idx + 1}`,
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
              downname: `${selectedProject.scriptData?.title}-场景-${scene.id}`,
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
              downname: `${selectedProject.scriptData?.title}-道具-${prop.name}`,
              mediaType: 'image'
            });
          }

          // 添加道具的所有变体图片
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
                  downname: `${selectedProject.scriptData?.title}-道具-${prop.name}-变体 ${idx + 1}`,
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
                  downname: `${selectedProject.scriptData?.title}-镜头-${shot.id}-${kf.type}`,
                  mediaType: 'image'
                });
              }
            }
          }
        }
      }

      // 添加视频
      if (selectedProject.shots && showVideo) {
        for (let shotIdx = 0; shotIdx < selectedProject.shots.length; shotIdx++) {
          const shot = selectedProject.shots[shotIdx];
          const shotLabel = `镜头 ${shotIdx + 1}`;

          // 添加主视频
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

          // 添加转场视频
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
      if (selectedProject.segments && showVideo) {
        for (let segmentIdx = 0; segmentIdx < selectedProject.segments.length; segmentIdx++) {
          const segment = selectedProject.segments[segmentIdx];
          const segmentLabel = `片段 ${segmentIdx + 1}`;
  
          // 添加视频
          imageTasks.push({
            url: segment.videoUrl,
            id: `segment-video-${selectedProject.id}-${segment.id}`,
            type: 'video',
            title: segmentLabel,
            subtitle: `片段视频 - ${segment.name||segment.description.substring(0, 30)}...`,
            downname: `${selectedProject.scriptData?.title || ''}-片段-${segment.name||segment.id}`,
            mediaType: 'video'
          });
        }
      }

      // ✅ 批量并行计算 MD5（限制并发数为 10）
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

      // 处理 MD5 结果并添加到 images 数组
      for (const { task, hash } of md5Results) {
        if (!urlHashSet.has(hash)) {
          const file = findPormtFromHistory(historyFiles, hash);
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
        // 如果不显示视频且当前文件是视频，则跳过
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
            // keyframe 类型
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
            prompt:file.prompt,
            timestamp: file.timestamp
          });
        }
      }
      setAllImages(images);
    };

    loadAllImages();
  }, [allProjects, seriesList, selectedProjectId, showVideo, getCharacterWithAssets, getSceneWithAssets, getPropWithAssets]);

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

    const updatedProject = project.id==selectedProjectId?{ ...project }:{...selectedProject};

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

          // 回写项目数据
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

          // 更新历史表中的 fileUrl
          try {
            await updateMediaHistoryFileUrl(img.projectId, img.imageUrl, newUrl);
          } catch (e) {
            console.warn('更新历史表失败:', e);
          }

          // 更新连续剧 SeriesLibrary
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
      if (project.id==selectedProjectId) {
        updateProject(updatedProject);
      }
      await saveProjectToDB(updatedProject);
    } catch (e) {
      console.error('保存项目失败:', e);
    }

    setUploadingStatus(null);
  }, [project, displayImages, updateProject, uploadingStatus]);

  // 计算标签数量 - 优化为单次遍历
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: 0,
      character: 0,
      scene: 0,
      prop: 0,
      video: 0,
      keyframe: 0
    };
    
    // 单次遍历完成所有计数
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

  // 处理图片点击预览
  const handleImageClick = (image: ImageItem) => {
    if (image.mediaType === 'video') return;
    const allImageUrls = displayImages.map(img => img.imageUrl || '');
    setPreviewImages(allImageUrls);
    setPreviewIndex(allImageUrls.indexOf(image.imageUrl || ''));
    setPreviewImage(image.imageUrl || '');
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 relative overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-slate-600 bg-slate-700 md:px-6 px-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-slate-50 flex items-center gap-3">
            <Images className="w-5 h-5 text-slate-500" />
            媒体库
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {remoteImageCount > 0 && (
            <button
              onClick={handleBatchUpload}
              disabled={!!uploadingStatus}
              className="px-3 py-1 rounded text-[12px] font-mono transition-colors cursor-pointer bg-orange-600 text-white hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {uploadingStatus ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {uploadingStatus}
                </>
              ) : (
                <>
                  <Cloud className="w-3 h-3" />
                  上传 ({remoteImageCount})
                </>
              )}
            </button>
          )}
          <button
            onClick={() => setShowVideo(!showVideo)}
            className={`px-3 py-1 rounded text-[12px] font-mono transition-colors cursor-pointer ${
              showVideo
                ? 'bg-blue-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
            }`}
          >
            视频 {showVideo ? '开启' : '关闭'}
          </button>
          <span className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-[12px] text-slate-400 font-mono">
            {displayImages.length} 媒体
          </span>
        </div>
      </div>

      {/* 可滚动的内容区域 */}
      <div className="flex-1 overflow-y-auto">
        {/* 控制区域（包含项目选择器和搜索框） */}
        <div className="border-b border-slate-600 bg-slate-700 space-y-1 p-2">
          <div className="flex gap-2 md:flex-row flex-col">
            {/* 项目选择器（单剧和连续剧并集） */}
            <div className="min-w-64">
              <CustomSelect
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
            </div>

            {/* 集数选择器（仅在选择连续剧时显示） */}
            {selectedSeriesId && (
              <div className="min-w-48">
                <CustomSelect
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
              </div>
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
        {displayImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Search className="w-12 h-12 mb-4 opacity-50" />
            <p>未找到匹配的图片</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {displayImages.map((image) => (
              <div
                key={image.id}
                className="group relative aspect-square bg-slate-800 rounded-lg overflow-hidden border border-slate-700 hover:border-slate-500 transition-all hover:shadow-lg"
              >
                <button
                  onClick={() => handleImageClick(image)}
                  className="w-full h-full cursor-pointer"
                >
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
                  {/* 删除历史记录按钮 - 仅历史记录显示 */}
                  {image.ishistory && (
                    <button
                      onClick={(e) => handleDeleteHistory(image, e)}
                    className="pointer-events-auto p-2 bg-slate-700/50 text-slate-50 rounded-full hover:bg-slate-800 hover:text-slate-50 transition-colors border border-white/10 backdrop-blur cursor-pointer"
                      title="删除历史记录"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                  {/* 查看提示词按钮 - 历史记录且包含提示词时显示 */}
                  {image.prompt && (
                    <button
                      onClick={(e) => handleShowPrompt(image, e)}
                    className="pointer-events-auto p-2 bg-slate-700/50 text-slate-50 rounded-full hover:bg-slate-800 hover:text-slate-50 transition-colors border border-white/10 backdrop-blur cursor-pointer"
                      title="查看提示词"
                    >
                      <NotebookPen className="w-3 h-3" />
                    </button>
                  )}
                  {/* 下载按钮 */}
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

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[100] bg-slate-700/95 flex items-center justify-center backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          {/* 左导航按钮 */}
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

          {/* 右导航按钮 */}
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

          {/* 图片信息 */}
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
    </div>
  );
};

export default StageImage;
