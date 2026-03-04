import { ArrowRightLeft, ChevronDown, Download, Images, Search, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deleteSingleMediaFile, getAllProjectsMetadata, getProjectMediaHistory, md5Hash, MediaFile } from '../services/storageService';
import { ProjectState } from '../types';
import { downloadImage, downloadVideo } from './FileUploadModal';

interface ImageItem {
  id: string;
  imageUrl: string;
  title: string;
  subtitle: string;
  type: 'character' | 'scene' | 'keyframe-start' | 'keyframe-end' | 'keyframe-full' | 'video' | 'video-transition';
  projectId: string;
  projectName: string;
  downname: string;
  mediaType?: 'image' | 'video';
  ishistory: boolean;
}

interface Props {
  project: ProjectState;
}

const StageImage: React.FC<Props> = ({ project }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'character' | 'scene' | 'keyframe' | 'video'>('all');
  const [allProjects, setAllProjects] = useState<ProjectState[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [showVideo, setShowVideo] = useState(true);
  const [mediaHistory, setMediaHistory] = useState<Record<string, MediaFile[]>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 加载所有项目
  useEffect(() => {
    const loadProjects = async () => {
      setLoadingProjects(true);
      try {
        const projects = await getAllProjectsMetadata();
        setAllProjects(projects);

        // 设置默认选中项目
        if (project) {
          setSelectedProjectId(project.id);
        } else if (projects.length > 0) {
          setSelectedProjectId(projects[0].id);
        }

        // 加载所有项目的媒体历史
        const historyMap: Record<string, MediaFile[]> = {};
        for (const p of projects) {
          try {
            const history = await getProjectMediaHistory(p.id);
            historyMap[p.id] = history;
          } catch (error) {
            console.error(`Failed to load media history for project ${p.id}:`, error);
            historyMap[p.id] = [];
          }
        }
        setMediaHistory(historyMap);
      } catch (error) {
        console.error('Failed to load projects:', error);
      } finally {
        setLoadingProjects(false);
      }
    };

    loadProjects();
  }, [project]);

  const handleDownloadImage = async (imageUrl: string, charName: string) => {
    await downloadImage(imageUrl, `${charName}.png`, null);
  };

  const handleDeleteHistory = async (image: ImageItem, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!image.ishistory) return;

    try {
      const mediaFileId = image.id.split('-').pop();
      if (!mediaFileId) return;

      await deleteSingleMediaFile(image.projectId, mediaFileId);

      const history = await getProjectMediaHistory(image.projectId);
      setMediaHistory(prev => ({
        ...prev,
        [image.projectId]: history
      }));
    } catch (error) {
      console.error('Failed to delete media history:', error);
    }
  };

  // 延迟关闭下拉列表
  const handleMouseLeave = useCallback(() => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
    }
    dropdownTimeoutRef.current = setTimeout(() => {
      setShowProjectDropdown(false);
    }, 300);
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
      dropdownTimeoutRef.current = null;
    }
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (dropdownTimeoutRef.current) {
        clearTimeout(dropdownTimeoutRef.current);
      }
    };
  }, []);

  // 收集所有图片数据
  const [allImages, setAllImages] = useState<ImageItem[]>([]);

  useEffect(() => {
    const loadAllImages = async () => {
      const images: ImageItem[] = [];
      const urlHashSet = new Set<string>();
      const selectedProject = allProjects.find(p => p.id === selectedProjectId);

      if (!selectedProject) {
        setAllImages([]);
        return;
      }

      // 角色图片（包含所有造型）
      if (selectedProject.scriptData?.characters) {
        for (const char of selectedProject.scriptData.characters) {
          if (char.referenceImage) {
            const hash = await md5Hash(char.referenceImage);
            if (!urlHashSet.has(hash)) {
              urlHashSet.add(hash);
              images.push({
                id: `char-${selectedProject.id}-${char.id}`,
                imageUrl: char.referenceImage,
                title: char.name,
                subtitle: `角色 - ${char.name}`,
                type: 'character',
                projectId: selectedProject.id,
                projectName: selectedProject.title || '未命名项目',
                downname: `${selectedProject.scriptData?.title}-角色-${char.name}`,
                mediaType: 'image',
                ishistory: false
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
                  urlHashSet.add(hash);
                  images.push({
                    id: `char-${selectedProject.id}-${char.id}-outfit-${idx}`,
                    imageUrl: outfit.referenceImage,
                    title: `${char.name} - ${outfit.name || `造型 ${idx + 1}`}`,
                    subtitle: `角色造型 - ${char.name}`,
                    type: 'character',
                    projectId: selectedProject.id,
                    projectName: selectedProject.title || '未命名项目',
                    downname: `${selectedProject.scriptData?.title}-角色-${char.name}-造型 ${idx + 1}`,
                    mediaType: 'image',
                    ishistory: false
                  });
                }
              }
            }
          }
        }
      }

      // 场景图片
      if (selectedProject.scriptData?.scenes) {
        for (const scene of selectedProject.scriptData.scenes) {
          if (scene.referenceImage) {
            const hash = await md5Hash(scene.referenceImage);
            if (!urlHashSet.has(hash)) {
              urlHashSet.add(hash);
              images.push({
                id: `scene-${selectedProject.id}-${scene.id}`,
                imageUrl: scene.referenceImage,
                title: scene.location,
                subtitle: `场景 - ${scene.id}`,
                type: 'scene',
                projectId: selectedProject.id,
                projectName: selectedProject.title || '未命名项目',
                downname: `${selectedProject.scriptData?.title}-场景-${scene.id}`,
                mediaType: 'image',
                ishistory: false
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
                  urlHashSet.add(hash);
                  let type: 'keyframe-start' | 'keyframe-end' | 'keyframe-full';
                  if (kf.type === 'start') type = 'keyframe-start';
                  else if (kf.type === 'end') type = 'keyframe-end';
                  else type = 'keyframe-full';

                  images.push({
                    id: `kf-${selectedProject.id}-${shot.id}-${kf.type}`,
                    imageUrl: kf.imageUrl,
                    title: shotLabel,
                    subtitle: `${kf.type === 'full' ? '宫格图' : kf.type === 'start' ? '起始帧' : '结束帧'} - ${shot.actionSummary.substring(0, 30)}...`,
                    type,
                    projectId: selectedProject.id,
                    projectName: selectedProject.title || '未命名项目',
                    downname: `${selectedProject.scriptData?.title}-镜头-${shot.id}-${kf.type}`,
                    mediaType: 'image',
                    ishistory: false
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
            if (!urlHashSet.has(hash)) {
              urlHashSet.add(hash);
              images.push({
                id: `shot-video-${selectedProject.id}-${shot.id}`,
                imageUrl: shot.interval.videoUrl,
                title: shotLabel,
                subtitle: `镜头视频 - ${shot.actionSummary.substring(0, 30)}...`,
                type: 'video',
                projectId: selectedProject.id,
                projectName: selectedProject.title || '未命名项目',
                downname: `${selectedProject.scriptData?.title || ''}-镜头-${shot.id}`,
                mediaType: 'video',
                ishistory: false
              });
            }
          }

          // 添加转场视频
          if (shot.transitionUrl) {
            const hash = await md5Hash(shot.transitionUrl);
            if (!urlHashSet.has(hash)) {
              urlHashSet.add(hash);
              images.push({
                id: `shot-transition-${selectedProject.id}-${shot.id}`,
                imageUrl: shot.transitionUrl,
                title: shotLabel,
                subtitle: `转场视频 - ${shot.actionSummary.substring(0, 30)}...`,
                type: 'video-transition',
                projectId: selectedProject.id,
                projectName: selectedProject.title || '未命名项目',
                downname: `${selectedProject.scriptData?.title || ''}-镜头-${shot.id}-转场`,
                mediaType: 'video',
                ishistory: false
              });
            }
          }
        }
      }

      // 添加 MediaHistory 中的文件
      const historyFiles = mediaHistory[selectedProject.id] || [];
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
            type = file.mediaType === 'video' ? 'video' : 'video-transition';
            subtitle = `场景视频 - ${file.fileName}`;
          } else {
            // keyframe 类型
            if (file.fileName.startsWith('start_')) type = 'keyframe-start';
            else if (file.fileName.startsWith('end_')) type = 'keyframe-end';
            else type = 'keyframe-full';
            subtitle = `关键帧历史 - ${file.fileName}`;
          }

          images.push({
            id: `history-${selectedProject.id}-${file.id}`,
            imageUrl: file.fileUrl,
            title: file.fileName,
            subtitle: subtitle,
            type,
            projectId: selectedProject.id,
            projectName: selectedProject.title || '未命名项目',
            downname: file.fileName,
            mediaType: file.fileType,
            ishistory: true
          });
        }
      }

      setAllImages(images);
    };

    loadAllImages();
  }, [allProjects, selectedProjectId, mediaHistory, showVideo]);

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
      <div className="h-14 border-b border-slate-600 bg-slate-700 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-slate-50 flex items-center gap-3">
            <Images className="w-5 h-5 text-slate-500" />
            媒体库
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowVideo(!showVideo)}
            className={`px-3 py-1 rounded text-[12px] font-mono uppercase transition-colors ${
              showVideo
                ? 'bg-blue-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
            }`}
          >
            视频 {showVideo ? '开启' : '关闭'}
          </button>
          <span className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-[12px] text-slate-400 font-mono uppercase">
            {displayImages.length} 媒体
          </span>
        </div>
      </div>

      {/* 可滚动的内容区域 */}
      <div className="flex-1 overflow-y-auto">
        {/* 控制区域（包含项目选择器和搜索框） */}
        <div className="border-b border-slate-600 bg-slate-700 space-y-1 p-2">
          <div className="flex gap-2 md:flex-row flex-col">
            {/* 项目选择器 */}
            <div
              ref={dropdownRef}
              className="relative min-w-64"
              onMouseLeave={handleMouseLeave}
              onMouseEnter={handleMouseEnter}
            >
              <button
                onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                disabled={loadingProjects || allProjects.length === 0}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-left text-slate-100 flex items-center justify-between hover:border-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="truncate">
                  {loadingProjects ? '加载项目...' : (
                    selectedProjectId ? (
                      allProjects.find(p => p.id === selectedProjectId)?.title || '选择项目'
                    ) : '选择项目'
                  )}
                </span>
                <ChevronDown className={`w-4 h-4 ml-2 flex-shrink-0 transition-transform ${showProjectDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showProjectDropdown && (
                <div
                  onMouseLeave={handleMouseLeave}
                  onMouseEnter={handleMouseEnter}
                  className="absolute z-30 w-full mt-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-64 overflow-y-auto"
                >
                  {allProjects.map(proj => (
                    <button
                      key={proj.id}
                      onClick={() => {
                        setSelectedProjectId(proj.id);
                        setShowProjectDropdown(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                        proj.id === selectedProjectId
                          ? 'bg-slate-700 text-slate-100'
                          : 'text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {proj.title || '未命名项目'}
                    </button>
                  ))}
                  {allProjects.length === 0 && !loadingProjects && (
                    <div className="px-4 py-3 text-sm text-slate-400 text-center">
                      暂无项目
                    </div>
                  )}
                </div>
              )}
            </div>

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
            <div className="flex gap-1">
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
                    className={`px-1 lg:px-2 h-8 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center ${
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
        <div className="p-2">
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
                  className="w-full h-full"
                >
                  {image.mediaType === 'video' ? (
                    <video
                      src={image.imageUrl}
                      className="w-full object-cover"
                      controls
                      muted
                      onMouseLeave={(e) => e.currentTarget.pause()}
                    />
                  ) : (
                    <img
                      src={image.imageUrl}
                      alt={image.title}
                      className="w-full h-full object-cover group-hover:scale-115 transition-transform duration-200"
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
                {/* 按钮组 */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-80 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {/* 删除历史记录按钮 - 仅历史记录显示 */}
                  {image.ishistory && (
                    <button
                      onClick={(e) => handleDeleteHistory(image, e)}
                      className="pointer-events-auto p-2 bg-red-600/80 text-slate-50 rounded-full hover:bg-red-700 transition-colors border border-white/10 backdrop-blur"
                      title="删除历史记录"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                  {/* 下载按钮 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (image.mediaType === 'video') {
                        downloadVideo(image.imageUrl!, image.downname, null);
                      } else {
                        handleDownloadImage(image.imageUrl!, image.downname);
                      }
                    }}
                    className="pointer-events-auto p-2 bg-slate-700/50 text-slate-50 rounded-full hover:bg-slate-800 hover:text-slate-50 transition-colors border border-white/10 backdrop-blur"
                    title={image.mediaType === 'video' ? '下载视频' : '下载图片'}
                  >
                    <Download className="w-3 h-3" />
                  </button>
                  {image.type.includes('transition') && (
                    <button
                      className="pointer-events-auto p-2 bg-slate-700/50 text-slate-50 rounded-full hover:bg-slate-800 hover:text-slate-50 transition-colors border border-white/10 backdrop-blur"
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
              className="absolute left-6 p-3 bg-slate-900/80 hover:bg-slate-800 text-slate-50 rounded-full transition-colors"
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
              className="absolute right-16 p-3 bg-slate-900/80 hover:bg-slate-800 text-slate-50 rounded-full transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-6 right-6 p-3 bg-slate-900/80 hover:bg-slate-800 text-slate-50 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          {/* 图片信息 */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-900/80 text-slate-50 rounded-full text-sm">
            {previewImages.length > 1 ? `${previewIndex + 1} / ${previewImages.length}` : '预览'}
          </div>
        </div>
      )}
    </div>
  );
};

export default StageImage;
