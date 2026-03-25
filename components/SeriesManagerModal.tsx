import { ArrowRight, Calendar, Film, Loader2, Plus, Trash2, Upload, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { importProjectAsEpisode } from '../services/seriesService';
import { importFromFile, saveProjectToDB, saveSeriesToDB } from '../services/storageService';
import { ProjectState, SeriesRecord } from '../types';
import { useDialog } from './dialog';

interface SeriesManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  series: SeriesRecord;
  onSeriesUpdate: (updatedSeries: SeriesRecord) => void;
  onSwitchEpisode: (project: ProjectState) => void;
  allProjects: ProjectState[];
  isMobile?: boolean;
}

const SeriesManagerModal: React.FC<SeriesManagerModalProps> = ({
  isOpen,
  onClose,
  series,
  onSeriesUpdate,
  onSwitchEpisode,
  allProjects,
  isMobile = false
}) => {
  const dialog = useDialog();
  const [importing, setImporting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Get episodes for this series
  const episodes = useMemo(() => {
    const projectMap = new Map(allProjects.map(p => [p.id, p]));
    return series.episodeOrder
      .map(id => projectMap.get(id))
      .filter((p): p is ProjectState => p !== undefined);
  }, [series.episodeOrder, allProjects]);

  // Format date
  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  // Get project images for preview
  const getProjectImages = (proj: ProjectState): string[] => {
    const images: string[] = [];

    // Collect character images
    if (proj.scriptData?.characters) {
      proj.scriptData.characters.forEach(char => {
        if (char.referenceImage) images.push(char.referenceImage);
        if (char.variations) {
          char.variations.forEach(v => {
            if (v.referenceImage) images.push(v.referenceImage);
          });
        }
      });
    }

    // Collect scene images
    if (proj.scriptData?.scenes) {
      proj.scriptData.scenes.forEach(scene => {
        if (scene.referenceImage) images.push(scene.referenceImage);
      });
    }

    // Collect keyframe images
    if (proj.shots) {
      proj.shots.forEach(shot => {
        if (shot.keyframes) {
          shot.keyframes.forEach(kf => {
            if (kf.imageUrl) images.push(kf.imageUrl);
          });
        }
      });
    }

    return images;
  };

  // Get episode stats
  const getEpisodeStats = (proj: ProjectState) => {
    const charCount = proj.scriptData?.characters?.length || 0;
    const sceneCount = proj.scriptData?.scenes?.length || 0;
    const shotCount = proj.shots?.length || 0;
    return { charCount, sceneCount, shotCount };
  };

  // Handle import episode from file
  const handleImportEpisode = async () => {
    try {
      setImporting(true);
      const result = await importFromFile();

      if (result.type === 'standalone' && result.project) {
        // Import single project as episode
        const { updatedProject, updatedSeries } = importProjectAsEpisode(series, result.project);

        // Save to DB
        await saveProjectToDB(updatedProject);
        await saveSeriesToDB(updatedSeries);

        // Update parent
        onSeriesUpdate(updatedSeries);

        dialog.toast({ message: '分集导入成功', type: 'success' });
      } else if (result.type === 'series') {
        dialog.toast({ message: '请选择单个项目文件导入，不支持导入整套剧集', type: 'error' });
      }
    } catch (error: any) {
      console.error('Import failed:', error);
      if (error.message !== 'Import cancelled' && error.message !== 'No file selected') {
        dialog.toast({ message: error.message || '导入失败', type: 'error' });
      }
    } finally {
      setImporting(false);
    }
  };

  // Handle create new episode
  const handleCreateEpisode = async () => {
    const newProject: ProjectState = {
      id: 'proj_' + Date.now().toString(36),
      title: `${series.title} - 第${episodes.length + 1}集`,
      stage: 'script',
      shots: [],
      createdAt: Date.now(),
      lastModified: Date.now(),
      seriesRefId: series.id,
      targetDuration: '60s',
      language: '中文', // Default language
      genre: '剧情片',
      visualStyle: '真人写实',
      imageSize: '2560x1440',
      imageCount: 1,
      scriptData: null,
      isParsingScript: false,
      rawScript: `标题：示例剧本`
    };

    const updatedSeries: SeriesRecord = {
      ...series,
      episodeOrder: [...series.episodeOrder, newProject.id],
      updatedAt: Date.now()
    };

    await saveProjectToDB(newProject);
    await saveSeriesToDB(updatedSeries);

    onSeriesUpdate(updatedSeries);
    onSwitchEpisode(newProject);
    onClose();
  };

  // Handle delete episode
  const handleDeleteEpisode = async (projectId: string, deleteData: boolean) => {
    try {
      if (deleteData) {
        // Delete project from DB
        const { deleteProjectFromDB } = await import('../services/storageService');
        await deleteProjectFromDB(projectId);
      } else {
        // Just remove series reference
        const proj = allProjects.find(p => p.id === projectId);
        if (proj) {
          const updatedProj = { ...proj, seriesRefId: undefined };
          await saveProjectToDB(updatedProj);
        }
      }

      // Update series
      const updatedSeries: SeriesRecord = {
        ...series,
        episodeOrder: series.episodeOrder.filter(id => id !== projectId),
        updatedAt: Date.now()
      };

      await saveSeriesToDB(updatedSeries);
      onSeriesUpdate(updatedSeries);
      setDeleteConfirmId(null);

      dialog.toast({
        message: deleteData ? '分集已删除' : '分集已转为独立项目',
        type: 'success'
      });
    } catch (error) {
      console.error('Delete episode failed:', error);
      dialog.toast({ message: '删除分集失败', type: 'error' });
    }
  };

  // Handle open episode
  const handleOpenEpisode = (proj: ProjectState) => {
    onSwitchEpisode(proj);
    onClose();
  };

  if (!isOpen) return null;

  return (
   <div className="fixed inset-0 z-50 bg-slate-700/90 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in duration-200">

      {/* Modal 内容 */}
      <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl overflow-hidden w-full max-w-6xl h-[80vh] flex flex-col">
        <div className="h-16 px-6 border-b border-slate-600 flex items-center justify-between bg-slate-600/80">
          <h3 className="text-lg font-bold text-slate-50 flex items-center gap-2">
            <Film className="w-5 h-5 text-slate-500" />
            {series.title}
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 bg-slate-700 hover:text-slate-100 hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

      {/* Episode Grid */}
      <div className="flex-1 overflow-y-auto flex flex-col p-4">
        <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
          {/* New Episode Card */}
          <button
            onClick={handleCreateEpisode}
            className="group flex flex-col items-center justify-center min-h-[200px] border-2 border-dashed border-slate-600 hover:border-indigo-500 bg-slate-800/30 hover:bg-slate-800/50 rounded-xl transition-all"
          >
            <div className="w-12 h-12 rounded-full bg-slate-700/50 flex items-center justify-center mb-3 group-hover:bg-indigo-600/20 group-hover:scale-110 transition-all">
              <Plus className="w-6 h-6 text-slate-400 group-hover:text-indigo-400" />
            </div>
            <span className="text-slate-400 group-hover:text-slate-200 text-sm font-medium">新增分集</span>
          </button>

          {/* Episode Cards */}
          {episodes.map((ep, index) => {
            const stats = getEpisodeStats(ep);
            const images = getProjectImages(ep);
            const isDeleting = deleteConfirmId === ep.id;

            return (
              <div
                key={ep.id}
                onClick={() => handleOpenEpisode(ep)}
                className={`group relative bg-slate-800 border rounded-xl overflow-hidden transition-all hover:border-indigo-500/50 cursor-pointer ${
                  isDeleting ? 'border-red-500/50' : 'border-slate-600'
                }`}
              >
                {/* Delete Confirmation Overlay */}
                {isDeleting && (
                  <div className="absolute inset-0 z-20 bg-slate-800/95 flex flex-col items-center justify-center p-4 space-y-3">
                    <p className="text-slate-50 text-sm font-medium">删除此分集?</p>
                    <div className="flex gap-2 w-full">
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg"
                      >
                        取消
                      </button>
                      <button
                        onClick={() => handleDeleteEpisode(ep.id, false)}
                        className="flex-1 py-2 bg-slate-600 hover:bg-slate-500 text-slate-200 text-xs rounded-lg"
                      >
                        保留
                      </button>
                      <button
                        onClick={() => handleDeleteEpisode(ep.id, true)}
                        className="flex-1 py-2 bg-red-600/50 hover:bg-red-600/70 text-red-100 text-xs rounded-lg"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                )}

                {/* Card Header */}
                <div className="p-4 pb-2">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-indigo-400 bg-indigo-900/30 px-2 py-0.5 rounded">
                        EP{index + 1}
                      </span>
                      <h3 className="text-sm font-medium text-slate-200 line-clamp-1 flex-1">
                        {ep.title}
                      </h3>
                    </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOpenEpisode(ep); }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-indigo-600/20 text-slate-400 hover:text-indigo-400 rounded-lg transition-all relative z-20"
                    title="打开分集"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                    <span className="flex items-center gap-1">
                      <span className="text-slate-400">角色</span>
                      <span className="font-mono text-slate-300">{stats.charCount}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-slate-400">场景</span>
                      <span className="font-mono text-slate-300">{stats.sceneCount}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-slate-400">镜头</span>
                      <span className="font-mono text-slate-300">{stats.shotCount}</span>
                    </span>
                  </div>

                  {/* Image Preview */}
                  {images.length > 0 && (
                    <div className="grid grid-cols-4 gap-1 mb-3">
                      {images.slice(0, 4).map((img, idx) => (
                        <div
                          key={idx}
                          className="aspect-square bg-slate-900 rounded overflow-hidden"
                        >
                          <img
                            src={img}
                            alt=""
                            className="w-full h-full object-cover hover:scale-110 transition-transform"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div className="px-4 py-2 bg-slate-700/30 border-t border-slate-700/50 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Calendar className="w-3 h-3" />
                    {formatDate(ep.lastModified)}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(ep.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-600/20 text-slate-500 hover:text-red-400 rounded-lg transition-all relative z-20"
                    title="删除分集"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700 flex justify-between items-center text-sm text-slate-400 bg-slate-600/80">
        <span className="text-slate-400">
          角色库: <span className="text-slate-200 font-mono">{series.library.characters.length}</span>
        </span>
        <span className="text-slate-400">
          场景库: <span className="text-slate-200 font-mono">{series.library.scenes.length}</span>
        </span>
        <span className="text-slate-400">
          共 <span className="text-slate-200 font-mono">{episodes.length}</span> 集
        </span>
        <button
            onClick={handleImportEpisode}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600/50 hover:bg-indigo-600 text-indigo-100 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            导入单集
          </button>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors"
        >
          关闭
        </button>
      </div>
    </div>
    </div>
  );
};

export default SeriesManagerModal;
