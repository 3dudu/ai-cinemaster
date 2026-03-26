import { ArrowRightLeft, Download, Images, NotebookPen, Search, Trash2, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { deleteSingleMediaFile, getAllProjectsMetadata, getAllSeriesFromDB, getProjectMediaHistory, md5Hash, MediaFile } from '../services/storageService';
import { ProjectState, SeriesRecord } from '../types';
import CustomSelect from './CustomSelect';
import { useDialog } from './dialog';
import { downloadImage, downloadVideo } from './FileUploadModal';
import PromptDetailModal from './PromptDetailModal';

interface ImageItem {
  id: string;
  hash: string;
  imageUrl: string;
  title: string;
  subtitle: string;
  type: 'character' | 'scene' | 'keyframe-start' | 'keyframe-end' | 'keyframe-full' | 'video' | 'video-transition';
  projectId: string;
  projectName: string;
  downname: string;
  mediaType?: 'image' | 'video' | 'audio';
  ishistory: boolean;
  prompt?: string;
  timestamp: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  project?: ProjectState;
  onSelectImage: (imageUrl: string, allImages?: string[]) => void;
  filterType?: 'character' | 'scene' | 'keyframe' | 'all';
  previewMode?: boolean;
  showVideo?: boolean;
}

const ImageSelectorModal: React.FC<Props> = ({
  isOpen,
  onClose,
  project,
  onSelectImage,
  filterType = 'all',
  previewMode = false,
  showVideo = false
}) => {
  const dialog = useDialog();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'character' | 'scene' | 'keyframe' | 'video'>(filterType);
  const [allProjects, setAllProjects] = useState<ProjectState[]>([]);
  const [seriesList, setSeriesList] = useState<SeriesRecord[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('');
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<{title: string, prompt: string, timestamp?: number} | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);

  // 加载所有项目和连续剧
  useEffect(() => {
    const loadProjectsAndSeries = async () => {
      if (isOpen) {
        setLoadingProjects(true);
        try {
          const [projects, seriesList] = await Promise.all([
            getAllProjectsMetadata(),
            getAllSeriesFromDB()
          ]);

          // 设置连续剧列表
          setSeriesList(seriesList);

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
  const handleDownloadImage = async (imageUrl: string, charName: string) => {
    if(downloadStatus)return;
    setDownloadStatus('downloading');
    try{
      await downloadImage(imageUrl, `${charName}.png`, null);
    }finally{
      setDownloadStatus(null);
    }
  };

  const handleDownloadVideo = async (imageUrl: string, charName: string) => {
    if(downloadStatus)return;
    setDownloadStatus('downloading');
    try{
      await downloadVideo(imageUrl, `${charName}.mp4`, null);
    }finally{
      setDownloadStatus(null);
    }
  };


  const handleDeleteHistory = async (image: ImageItem, e: React.MouseEvent) => {
    e.stopPropagation(); // 防止触发图片选择

    if (!image.ishistory) return; // 只有历史记录可以删除

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
      await deleteSingleMediaFile(image.projectId, image.id);
    } catch (error) {
      console.error('Failed to delete media history:', error);
    }
  };

  const handleShowPrompt = (image: ImageItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (image.prompt) {
      setSelectedPrompt({ title: image.title, prompt: image.prompt, timestamp: image.timestamp });
      setShowPromptModal(true);
    }
  };

  // 收集所有图片数据
  const [allImages, setAllImages] = useState<ImageItem[]>([]);
  const findPormtFromHistory = (historyFiles: MediaFile[],fileid: string) => {
      const file = historyFiles.find(f => f.id === fileid);
      if (file) {
        return file;
      }
      return {prompt: '',timestamp: 0};
  }

  // Helper function to get character with full library data (in series mode)
  const getCharacterWithAssets = (char: import('../types').Character, projectSeriesRefId?: string): import('../types').Character => {
    // In standalone mode, return character directly
    if (!projectSeriesRefId || !char.refId) return char;

    // In series mode, get full character data from series library
    const series = seriesList.find(s => s.id === projectSeriesRefId);
    if (series?.library?.characters) {
      const libraryChar = series.library.characters.find(c => c.id === char.refId);
      if (libraryChar) return libraryChar;
    }
    return char;
  };

  // Helper function to get scene with full library data (in series mode)
  const getSceneWithAssets = (scene: import('../types').Scene, projectSeriesRefId?: string): import('../types').Scene => {
    // In standalone mode, return scene directly
    if (!projectSeriesRefId || !scene.refId) return scene;

    // In series mode, get full scene data from series library
    const series = seriesList.find(s => s.id === projectSeriesRefId);
    if (series?.library?.scenes) {
      const libraryScene = series.library.scenes.find(s => s.id === scene.refId);
      if (libraryScene) return libraryScene;
    }
    return scene;
  };

  useEffect(() => {
    const loadAllImages = async () => {
      const images: ImageItem[] = [];
      const urlHashSet = new Set<string>(); // 用于去重（存储hash值）
      const selectedProject = allProjects.find(p => p.id === selectedProjectId);

      if (!selectedProject) {
        setAllImages([]);
        return;
      }

      const historyFiles = await getProjectMediaHistory(selectedProject.id);
      const isSeriesMode = !!selectedProject.seriesRefId;

      // 角色图片（包含所有造型）
      if (selectedProject.scriptData?.characters) {
        for (const episodeChar of selectedProject.scriptData.characters) {
          // Get full character data from library if in series mode
          const char = getCharacterWithAssets(episodeChar, selectedProject.seriesRefId);
          if (char.referenceImage) {
            const hash = await md5Hash(char.referenceImage);
            if (!urlHashSet.has(hash)) {
              const file = findPormtFromHistory(historyFiles,hash);
              urlHashSet.add(hash);
              images.push({
                id: `char-${selectedProject.id}-${char.id}`,
                hash: hash,
                imageUrl: char.referenceImage,
                title: char.name,
                subtitle: `角色 - ${char.name}`,
                type: 'character',
                projectId: selectedProject.id,
                projectName: selectedProject.title || '未命名项目',
                downname: `${project?.scriptData?.title || ''}-角色-${char.name}`,
                mediaType: 'image',
                ishistory: false,
                prompt: file.prompt,
                timestamp: file.timestamp
              });
            }
          }

          // 添加角色的所有造型图片
          if (char.variations) {
            for (let idx = 0; idx < char.variations.length; idx++) {
              const outfit = char.variations[idx];
              if (outfit.referenceImage) {
                const hash = await md5Hash(outfit.referenceImage);
                if (!urlHashSet.has(hash)) {
                  const file = findPormtFromHistory(historyFiles,hash);
                  urlHashSet.add(hash);
                  images.push({
                    id: `char-${selectedProject.id}-${char.id}-outfit-${idx}`,
                    hash: hash,
                    imageUrl: outfit.referenceImage,
                    title: `${char.name} - ${outfit.name || `造型 ${idx + 1}`}`,
                    subtitle: `角色造型 - ${char.name}`,
                    type: 'character',
                    projectId: selectedProject.id,
                    projectName: selectedProject.title || '未命名项目',
                    downname: `${project?.scriptData?.title || ''}-角色-${char.name}-造型 ${idx + 1}`,
                    mediaType: 'image',
                    ishistory: false,
                    prompt: file.prompt,
                    timestamp: file.timestamp
                  });
                }
              }
            }
          }
        }
      }

      // 场景图片
      if (selectedProject.scriptData?.scenes) {
        for (const episodeScene of selectedProject.scriptData.scenes) {
          // Get full scene data from library if in series mode
          const scene = getSceneWithAssets(episodeScene, selectedProject.seriesRefId);
          if (scene.referenceImage) {
            const hash = await md5Hash(scene.referenceImage);
            if (!urlHashSet.has(hash)) {
              const file = findPormtFromHistory(historyFiles,hash);
              urlHashSet.add(hash);
              images.push({
                id: `scene-${selectedProject.id}-${scene.id}`,
                hash: hash,
                imageUrl: scene.referenceImage,
                title: scene.location,
                subtitle: `场景 - ${scene.id}`,
                type: 'scene',
                projectId: selectedProject.id,
                projectName: selectedProject.title || '未命名项目',
                downname: `${project?.scriptData?.title || ''}-场景-${scene.id}`,
                mediaType: 'image',
                ishistory: false,
                prompt: file.prompt,
                timestamp: file.timestamp
              });
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
                const hash = await md5Hash(kf.imageUrl);
                if (!urlHashSet.has(hash)) {
                  const file = findPormtFromHistory(historyFiles,hash);
                  urlHashSet.add(hash);
                  let type: 'keyframe-start' | 'keyframe-end' | 'keyframe-full';
                  if (kf.type === 'start') type = 'keyframe-start';
                  else if (kf.type === 'end') type = 'keyframe-end';
                  else type = 'keyframe-full';

                  images.push({
                    id: `kf-${selectedProject.id}-${shot.id}-${kf.type}`,
                    hash: hash,
                    imageUrl: kf.imageUrl,
                    title: shotLabel,
                    subtitle: `${kf.type === 'full' ? '宫格图' : kf.type === 'start' ? '起始帧' : '结束帧'} - ${shot.actionSummary.substring(0, 30)}...`,
                    type,
                    projectId: selectedProject.id,
                    projectName: selectedProject.title || '未命名项目',
                    downname: `${project?.scriptData?.title || ''}-镜头-${shot.id}-${kf.type}`,
                    mediaType: 'image',
                    ishistory: false,
                    prompt: file.prompt,
                    timestamp: file.timestamp
                  });
                }
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
            const hash = await md5Hash(shot.interval.videoUrl);
            if (!urlHashSet.has(hash)){
              const file = findPormtFromHistory(historyFiles,hash);
              urlHashSet.add(hash);
              images.push({
                id: `shot-video-${selectedProject.id}-${shot.id}`,
                hash: hash,
                imageUrl: shot.interval.videoUrl,
                title: shotLabel,
                subtitle: `镜头视频 - ${shot.actionSummary.substring(0, 30)}...`,
                type: 'video',
                projectId: selectedProject.id,
                projectName: selectedProject.title || '未命名项目',
                downname: `${selectedProject.scriptData?.title || ''}-镜头-${shot.id}`,
                mediaType: 'video',
                ishistory: false,
                prompt: file.prompt,
                timestamp: file.timestamp
              });
            }
          }

          // 添加转场视频
          if (shot.transitionUrl) {
            const hash = await md5Hash(shot.transitionUrl);
            if (!urlHashSet.has(hash)) {
              const file = findPormtFromHistory(historyFiles,hash);
              urlHashSet.add(hash);
              images.push({
                id: `shot-transition-${selectedProject.id}-${shot.id}`,
                hash: hash,
                imageUrl: shot.transitionUrl,
                title: shotLabel,
                subtitle: `转场视频 - ${shot.actionSummary.substring(0, 30)}...`,
                type: 'video-transition',
                projectId: selectedProject.id,
                projectName: selectedProject.title || '未命名项目',
                downname: `${selectedProject.scriptData?.title || ''}-镜头-${shot.id}-转场`,
                mediaType: 'video',
                ishistory: false,
                prompt: file.prompt,
                timestamp: file.timestamp
              });
            }
          }
        }
      }

      for (const file of historyFiles) {
        // 如果不显示视频且当前文件是视频，则跳过
        if (!showVideo && file.fileType === 'video') {
          continue;
        }

        if (!urlHashSet.has(file.id)) {
          urlHashSet.add(file.id);

          let type: 'character' | 'scene' | 'keyframe-start' | 'keyframe-end' | 'keyframe-full' | 'video' | 'video-transition';
          let subtitle = '';

          if (file.mediaType === 'character') {
            type = 'character';
            subtitle = `角色历史 - ${file.fileName}`;
          } else if (file.mediaType === 'scene') {
            type = 'scene';
            subtitle = `场景历史 - ${file.fileName}`;
          } else if (file.fileType === 'video') {
            type = file.mediaType==='video'?'video':'video-transition';
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
            projectId: selectedProject.id,
            projectName: selectedProject.title || '未命名项目',
            downname: file.fileName,
            mediaType: file.fileType,
            ishistory: true,
            prompt: file.prompt,
            timestamp: file.timestamp
          });
        }
      }

      setAllImages(images);
    };

    loadAllImages();
  }, [allProjects, selectedProjectId, project, showVideo]);

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

  // 计算标签数量
  const tabCounts = useMemo(() => ({
    all: filteredImages.length,
    character: filteredImages.filter(i => i.type === 'character').length,
    scene: filteredImages.filter(i => i.type === 'scene').length,
    video: filteredImages.filter(i => i.type.startsWith('video')).length,
    keyframe: filteredImages.filter(i => i.type.startsWith('keyframe')).length
  }), [filteredImages]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-700/90 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in duration-200">

      {/* Modal 内容 */}
      <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl overflow-hidden w-full max-w-6xl h-[80vh] flex flex-col">
        {/* 标题栏 */}
        <div className="h-16 px-6 border-b border-slate-600 flex items-center justify-between bg-slate-600/80">
          <h3 className="text-lg font-bold text-slate-50 flex items-center gap-2">
            <Images className="w-5 h-5 text-slate-500" />
            {showVideo ? '媒体' : '图片'}库
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 bg-slate-700 hover:text-slate-100 hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
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
                  // 如果选中的是连续剧的单集，返回连续剧的ID
                  return `series-${selectedProject.seriesRefId}`;
                }
                return `project-${selectedProjectId}`;
              })()}
              onChange={(value) => {
                if (value.startsWith('series-')) {
                  // 选择的是连续剧
                  const seriesId = value.replace('series-', '');
                  setSelectedSeriesId(seriesId);
                  const series = seriesList.find(s => s.id === seriesId);
                  if (series && series.episodeOrder.length > 0) {
                    setSelectedProjectId(series.episodeOrder[0]);
                  }
                } else {
                  // 选择的是单剧
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
                    .map((proj,idx)=> ({
                      value: proj.id,
                      label: `第${idx+1}集 - ${proj.title || '未命名'}`
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
            <div className="flex gap-1 md:gap-2 py-2">
          {(
            showVideo
              ? ['all', 'character', 'scene', 'keyframe', 'video'] as const
              : ['all', 'character', 'scene', 'keyframe'] as const
          ).map(tab => {
            const labels = {
              all: '全部',
              character: '角色',
              scene: '场景',
              keyframe: '关键帧',
              video: '视频'
            };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-1 md:px-2 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center cursor-pointer ${
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
                  <button
                    onClick={() => { 
                      if(image.mediaType === 'video')return;
                      const allImageUrls = displayImages.map(img => img.imageUrl || '');
                      onSelectImage(image.imageUrl || '', allImageUrls);
                      if (!previewMode) {
                        onClose();
                      }
                    }}
                    className="w-full h-full cursor-pointer"
                  >
                    {image.mediaType === 'video' ? (
                      // 视频使用 video 标签
                      <video
                        src={image.imageUrl}
                        className="w-full h-full object-contain"
                        controls
                        muted
                        onMouseLeave={(e) => e.currentTarget.pause()}
                      />
                    ) : (
                      // 图片使用 img 标签
                      <img
                        src={image.imageUrl}
                        alt={image.title}
                        className="w-full h-full object-contain group-hover:scale-115 transition-transform duration-200"
                      />
                    )}
                    {/* 悬停遮罩 - 图片和视频都显示 */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <p className="text-xs font-medium text-white truncate">{image.title}</p>
                        <p className="text-[10px] text-white truncate">{image.subtitle}</p>
                      </div>
                    </div>
                  </button>
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
                    {/* 下载按钮 - 图片和视频都显示 */}
                    <button
                      onClick={(e) => {
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
        {/* 底部信息 */}
        <div className="p-4 border-t border-slate-700 flex justify-between items-center text-sm text-slate-400 bg-slate-600/80">
          <span>共 {displayImages.length} {activeTab=='all'?'个文件':activeTab=='video'?'个视频':'张图片'}</span>
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
