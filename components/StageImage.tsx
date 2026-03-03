import { ChevronDown, Download, Images, Search, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAllProjectsMetadata } from '../services/storageService';
import { ProjectState } from '../types';
import { downloadImage } from './FileUploadModal';

interface ImageItem {
  id: string;
  imageUrl: string;
  title: string;
  subtitle: string;
  type: 'character' | 'scene' | 'keyframe-start' | 'keyframe-end' | 'keyframe-full';
  projectId: string;
  projectName: string;
  downname: string;
}

interface Props {
  project: ProjectState;
}

const StageImage: React.FC<Props> = ({ project }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'character' | 'scene' | 'keyframe'>('all');
  const [allProjects, setAllProjects] = useState<ProjectState[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
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
  const allImages = useMemo(() => {
    const images: ImageItem[] = [];
    const selectedProject = allProjects.find(p => p.id === selectedProjectId);

    if (!selectedProject) return images;

    // 角色图片（包含所有造型）
    if (selectedProject.scriptData?.characters) {
      selectedProject.scriptData.characters.forEach(char => {
        if (char.referenceImage) {
          images.push({
            id: `char-${selectedProject.id}-${char.id}`,
            imageUrl: char.referenceImage,
            title: char.name,
            subtitle: `角色 - ${char.name}`,
            type: 'character',
            projectId: selectedProject.id,
            projectName: selectedProject.title || '未命名项目',
            downname: `${selectedProject.scriptData?.title}-角色-${char.name}`
          });
        }

        // 添加角色的所有造型图片
        if (char.variations) {
          char.variations.forEach((outfit, idx) => {
            if (outfit.referenceImage) {
              images.push({
                id: `char-${selectedProject.id}-${char.id}-outfit-${idx}`,
                imageUrl: outfit.referenceImage,
                title: `${char.name} - ${outfit.name || `造型 ${idx + 1}`}`,
                subtitle: `角色造型 - ${char.name}`,
                type: 'character',
                projectId: selectedProject.id,
                projectName: selectedProject.title || '未命名项目',
                downname: `${selectedProject.scriptData?.title}-角色-${char.name}-造型 ${idx + 1}`
              });
            }
          });
        }
      });
    }

    // 场景图片
    if (selectedProject.scriptData?.scenes) {
      selectedProject.scriptData.scenes.forEach(scene => {
        if (scene.referenceImage) {
          images.push({
            id: `scene-${selectedProject.id}-${scene.id}`,
            imageUrl: scene.referenceImage,
            title: scene.location,
            subtitle: `场景 - ${scene.id}`,
            type: 'scene',
            projectId: selectedProject.id,
            projectName: selectedProject.title || '未命名项目',
            downname: `${selectedProject.scriptData?.title}-场景-${scene.id}`
          });
        }
      });
    }

    // 关键帧图片
    if (selectedProject.shots) {
      selectedProject.shots.forEach((shot, shotIdx) => {
        const shotLabel = `镜头 ${shotIdx + 1}`;

        if (shot.keyframes) {
          shot.keyframes.forEach(kf => {
            if (kf.imageUrl) {
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
                downname: `${selectedProject.scriptData?.title}-镜头-${shot.id}-${kf.type}`
              });
            }
          });
        }
      });
    }

    return images;
  }, [allProjects, selectedProjectId]);

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
    keyframe: filteredImages.filter(i => i.type.startsWith('keyframe')).length
  }), [filteredImages]);

  // 处理图片点击预览
  const handleImageClick = (image: ImageItem) => {
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
            图库浏览
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-[12px] text-slate-400 font-mono uppercase">
            {displayImages.length} 图片
          </span>
        </div>
      </div>

      {/* 固定的控制区域 */}
      <div className="border-b border-slate-600 bg-slate-800 space-y-1 p-2 shrink-0">
        {/* 项目选择器和搜索框 */}
        <div className="bg-slate-800 border border-slate-600 rounded-xl p-2">
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
                className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-left text-slate-100 flex items-center justify-between hover:border-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="absolute z-10 w-full mt-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-64 overflow-y-auto"
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
                className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:border-slate-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* 标签页 */}
        <div className="bg-slate-800 border border-slate-600 rounded-xl p-2">
          <div className="flex gap-0">
            {(['all', 'character', 'scene', 'keyframe'] as const).map(tab => {
              const labels = {
                all: '全部',
                character: '角色',
                scene: '场景',
                keyframe: '关键帧'
              };
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-2 h-9 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center ${
                    activeTab === tab
                      ? 'bg-slate-900 text-slate-100'
                      : 'text-slate-400 hover:bg-slate-900'
                  }`}
                >
                  {labels[tab]} ({tabCounts[tab]})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 图片网格 - 可滚动 */}
      <div className="flex-1 overflow-y-auto p-2">
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
                  <img
                    src={image.imageUrl}
                    alt={image.title}
                    className="w-full h-full object-cover group-hover:scale-115 transition-transform duration-200"
                  />
                  {/* 悬停遮罩 */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-2">
                      <p className="text-xs font-medium text-white truncate">{image.title}</p>
                      <p className="text-[10px] text-white truncate">{image.subtitle}</p>
                    </div>
                  </div>
                </button>
                {/* 下载按钮 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadImage(image.imageUrl!, image.downname);
                  }}
                  className="absolute top-2 right-2 p-2 bg-slate-700/50 text-slate-50 rounded-full hover:bg-slate-800 hover:text-slate-50 transition-colors border border-white/10 backdrop-blur opacity-0 group-hover:opacity-100"
                  title="下载图片"
                >
                  <Download className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
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
