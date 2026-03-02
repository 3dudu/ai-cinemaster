import { ChevronDown, Images, Search, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAllProjectsMetadata } from '../services/storageService';
import { ProjectState } from '../types';

interface ImageItem {
  id: string;
  imageUrl: string;
  title: string;
  subtitle: string;
  type: 'character' | 'scene' | 'keyframe-start' | 'keyframe-end' | 'keyframe-full';
  projectId: string;
  projectName: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  project?: ProjectState;
  onSelectImage: (imageUrl: string) => void;
  filterType?: 'character' | 'scene' | 'keyframe' | 'all';
}

const ImageSelectorModal: React.FC<Props> = ({
  isOpen,
  onClose,
  project,
  onSelectImage,
  filterType = 'all'
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'character' | 'scene' | 'keyframe'>('all');
  const [allProjects, setAllProjects] = useState<ProjectState[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 加载所有项目
  useEffect(() => {
    const loadProjects = async () => {
      if (isOpen) {
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
      }
    };

    loadProjects();
  }, [isOpen, project]);

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
            projectName: selectedProject.title || '未命名项目'
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
                projectName: selectedProject.title || '未命名项目'
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
            projectName: selectedProject.title || '未命名项目'
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
                projectName: selectedProject.title || '未命名项目'
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-700/90 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in duration-200">

      {/* Modal 内容 */}
      <div className="relative bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl overflow-hidden w-full max-w-6xl h-[80vh] flex flex-col">
        {/* 标题栏 */}
        <div className="h-16 px-6 border-b border-slate-600 flex items-center justify-between bg-slate-600/80">
          <h3 className="text-lg font-bold text-slate-50 flex items-center gap-2">
            <Images className="w-5 h-5 text-slate-500" />
            图库
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 项目选择器和搜索框 */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex gap-4 md:flex-row flex-col">
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
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:border-slate-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* 标签页 */}
        <div className="flex gap-2 p-4 border-b border-slate-700 h-12 items-center">
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
                className={`px-2 h-8 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center ${
                  activeTab === tab
                    ? 'bg-slate-700 text-slate-100'
                    : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                {labels[tab]} ({tabCounts[tab]})
              </button>
            );
          })}
        </div>

        {/* 图片网格 */}
        <div className="flex-1 overflow-y-auto p-4">
          {displayImages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Search className="w-12 h-12 mb-4 opacity-50" />
              <p>未找到匹配的图片</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {displayImages.map((image) => (
                <button
                  key={image.id}
                  onClick={() => {
                    onSelectImage(image.imageUrl);
                    onClose();
                  }}
                  className="group relative aspect-square bg-slate-800 rounded-lg overflow-hidden border border-slate-700 hover:border-slate-500 transition-all hover:shadow-lg"
                >
                  <img
                    src={image.imageUrl}
                    alt={image.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  {/* 悬停遮罩 */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-2">
                      <p className="text-xs font-medium text-slate-100 truncate">{image.title}</p>
                      <p className="text-[10px] text-slate-300 truncate">{image.subtitle}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 底部信息 */}
        <div className="p-4 border-t border-slate-700 flex justify-between items-center text-sm text-slate-400 bg-slate-600/80">
          <span>共 {displayImages.length} 张图片</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 text-slate-100 rounded-lg hover:bg-slate-600 transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageSelectorModal;
