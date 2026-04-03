import { Calendar, ChevronLeft, ChevronRight, Download, Edit3, Film, Loader2, Play, Plus, Settings, Trash2, Upload, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createSeriesEpisode, getEffectiveScriptData, importProjectAsEpisode } from '../../services/seriesService';
import { deleteProjectFromDB, exportProjectToFile, getEpisodesBySeriesId, importFromFile, saveProjectToDB, saveSeriesToDB } from '../../services/storageService';
import { ProjectState, Segment, SeriesRecord } from '../../types';
import { useDialog } from '../dialog';
import EpisodePreviewModal from './EpisodePreviewModal';
import ProjectSettingsModal from './ProjectSettingsModal';
import SegmentPreviewModal from './SegmentPreviewModal';
import SeriesSettingsModal from './SeriesSettingsModal';

interface SeriesManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  series: SeriesRecord;
  onSeriesUpdate: (updatedSeries: SeriesRecord) => void;
  onSwitchEpisode: (project: ProjectState) => void;
  allProjects?: ProjectState[]; // Deprecated: no longer needed, episodes are fetched from DB
  onProjectsUpdate?: (projects: ProjectState[]) => void; // Deprecated: no longer used
  isMobile?: boolean;
}

const SeriesManagerModal: React.FC<SeriesManagerModalProps> = ({
  isOpen,
  onClose,
  series,
  onSeriesUpdate,
  onSwitchEpisode,
  isMobile = false
}) => {
  const dialog = useDialog();
  const [importing, setImporting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showProjectSettingsModal, setShowProjectSettingsModal] = useState(false);
  const [editingEpisode, setEditingEpisode] = useState<ProjectState | null>(null);

  // Video preview state
  const [previewingEpisode, setPreviewingEpisode] = useState<ProjectState | null>(null);

  // Episodes state - fetched from DB by seriesRefId
  const [episodes, setEpisodes] = useState<ProjectState[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  // Fetch episodes when series changes
  useEffect(() => {
    if (isOpen && series.id) {
      setLoadingEpisodes(true);
      getEpisodesBySeriesId(series.id)
        .then(fetchedEpisodes => {
          // Sort by episodeOrder
          const ordered = series.episodeOrder
            .map(id => fetchedEpisodes.find(e => e.id === id))
            .filter((p): p is ProjectState => p !== undefined);
          setEpisodes(ordered);
        })
        .catch(err => {
          console.error('Failed to fetch episodes:', err);
          setEpisodes([]);
        })
        .finally(() => setLoadingEpisodes(false));
    }
  }, [isOpen, series.id, series.episodeOrder]);

  // Format date - ✅ Use useCallback
  const formatDate = useCallback((ts: number) => {
    return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  }, []);

  // Get project images for preview - ✅ Use useCallback with flatMap
  const getProjectImages = useCallback((proj: ProjectState): string[] => {
    // In series mode, get images from library via refId
    const charImages = proj.scriptData?.characters?.flatMap(char => {
      const libChar = series.library?.characters?.find(c => c.id === char.refId);
      if (!libChar) return [];
      return [
        libChar.referenceImage,
        ...(libChar.variations?.map(v => v.referenceImage) || [])
      ].filter(Boolean);
    }) || [];

    // Collect scene images from library via refId
    const sceneImages = proj.scriptData?.scenes?.flatMap(scene => {
      const libScene = series.library?.scenes?.find(s => s.id === scene.refId);
      return libScene?.referenceImage ? [libScene.referenceImage] : [];
    }) || [];

    // Collect keyframe images (shots are stored in project directly)
    const keyframeImages = proj.shots?.flatMap(shot =>
      shot.keyframes?.map(kf => kf.imageUrl).filter(Boolean) || []
    ) || [];

    // Shuffle the combined images
    const allImages = [...charImages, ...sceneImages, ...keyframeImages].filter(Boolean);
    for (let i = allImages.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allImages[i], allImages[j]] = [allImages[j], allImages[i]];
    }
    return allImages;
  }, [series.library?.characters, series.library?.scenes]);

  // Get episode stats - ✅ Use useCallback
  const getEpisodeStats = useCallback((proj: ProjectState) => {
    const charCount = proj.scriptData?.characters?.length || 0;
    const sceneCount = proj.scriptData?.scenes?.length || 0;
    const shotCount = proj.shots?.length || 0;
    return { charCount, sceneCount, shotCount };
  }, []);

  // Handle import episode from file - ✅ Use useCallback
  const handleImportEpisode = useCallback(async () => {
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
    } catch (error) {
      console.error('Import failed:', error);
      const errorMessage = error instanceof Error ? error.message : '导入失败';
      if (errorMessage !== 'Import cancelled' && errorMessage !== 'No file selected') {
        dialog.toast({ message: errorMessage || '导入失败', type: 'error' });
      }
    } finally {
      setImporting(false);
    }
  }, [series, onSeriesUpdate, dialog]);

  // Handle create new episode - ✅ Use useCallback
  const handleCreateEpisode = useCallback(async () => {
    const newProject = createSeriesEpisode(series);

    const updatedSeries: SeriesRecord = {
      ...series,
      episodeOrder: [...series.episodeOrder, newProject.id],
      updatedAt: Date.now()
    };

    await saveProjectToDB(newProject);
    await saveSeriesToDB(updatedSeries);

    onSeriesUpdate(updatedSeries);
    // Refresh projects list to update the grid
    // Don't close the modal, just update the grid
  }, [series, onSeriesUpdate]);

  // Handle delete episode - ✅ Use useCallback
  const handleDeleteEpisode = useCallback(async (projectId: string, deleteData: boolean) => {
    try {
      if (deleteData) {
        // Delete project from DB
        await deleteProjectFromDB(projectId);
      } else {
        // Just remove series reference
        const proj = episodes.find(p => p.id === projectId);
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
  }, [series, onSeriesUpdate, dialog]);

  // Handle move episode - ✅ Use useCallback
  const handleMoveEpisode = useCallback((episodeId: string, direction: 'forward' | 'backward') => {
    const currentIndex = series.episodeOrder.indexOf(episodeId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'forward' ? currentIndex + 1 : currentIndex - 1;
    
    // Check bounds
    if (newIndex < 0 || newIndex >= series.episodeOrder.length) return;

    // Create new order by swapping episodes
    const newOrder = [...series.episodeOrder];
    [newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]];

    const updatedSeries: SeriesRecord = {
      ...series,
      episodeOrder: newOrder,
      updatedAt: Date.now()
    };

    saveSeriesToDB(updatedSeries);
    onSeriesUpdate(updatedSeries);
  }, [series, onSeriesUpdate]);

  // Handle export episode with resolved references
  const handleExportEpisode = useCallback((ep: ProjectState) => {
    // Resolve references: merge library data into episode
    const effectiveScriptData = getEffectiveScriptData(ep, series);
    
    // Create a standalone project with resolved data
    const resolvedProject: ProjectState = {
      ...ep,
      seriesRefId: undefined, // Detach from series
      scriptData: effectiveScriptData ? {
        ...effectiveScriptData,
        // Clear refIds since they're now standalone
        characters: effectiveScriptData.characters?.map(c => ({ ...c, refId: undefined })),
        scenes: effectiveScriptData.scenes?.map(s => ({ ...s, refId: undefined })),
      } : ep.scriptData
    };
    
    exportProjectToFile(resolvedProject);
    dialog.toast({ message: '单集导出成功', type: 'success' });
  }, [series, dialog]);

  // Get video URLs for preview (shots with videoUrl or segments with videoUrl)
  const getEpisodeVideoUrls = useCallback((ep: ProjectState): string[] => {
    if (ep.isSegmentMode) {
      // Segment mode: get videoUrls from segments
      return (ep.segments || [])
        .filter(segment => segment.videoUrl)
        .map(segment => segment.videoUrl!);
    }
    // Shot mode: get videoUrls from shots
    return ep.shots
      .filter(shot => shot.interval?.videoUrl)
      .map(shot => shot.interval!.videoUrl!);
  }, []);

  // Handle preview episode videos
  const handlePreviewEpisode = useCallback((ep: ProjectState, e: React.MouseEvent) => {
    e.stopPropagation();
    const videoUrls = getEpisodeVideoUrls(ep);
    if (videoUrls.length === 0) {
      dialog.toast({ message: '该分集暂无视频', type: 'warning' });
      return;
    }
    setPreviewingEpisode(ep);
  }, [getEpisodeVideoUrls, dialog]);

  // Handle open episode - ✅ Use useCallback
  const handleOpenEpisode = useCallback((proj: ProjectState) => {
    if(series.currentEpisodeId !== proj.id){
      const updatedSeries: SeriesRecord = {
        ...series,
        currentEpisodeId: proj.id
      };
  
      saveSeriesToDB(updatedSeries);
      onSeriesUpdate(updatedSeries);
    }
    onSwitchEpisode(proj);
    onClose();
  }, [series, onSeriesUpdate, onSwitchEpisode, onClose]);

  // Handle save series settings - ✅ Use useCallback
  const handleSaveSeriesSettings = useCallback((updatedSeries: SeriesRecord) => {
    saveSeriesToDB(updatedSeries);
    onSeriesUpdate(updatedSeries);
  }, [onSeriesUpdate]);

  // Handle save episode settings - ✅ Use useCallback
  const handleSaveEpisodeSettings = useCallback((updates: Partial<ProjectState>) => {
    if (!editingEpisode) return;

    const updatedProject: ProjectState = {
      ...editingEpisode,
      ...updates,
      lastModified: Date.now()
    };

    saveProjectToDB(updatedProject).then(() => {
      dialog.toast({ message: '分集设置已保存', type: 'success' });
    }).catch((error) => {
      console.error('Failed to save episode settings:', error);
      dialog.toast({ message: '保存分集设置失败', type: 'error' });
    });
  }, [editingEpisode, dialog]);

  const getSegmentThumbnail = useCallback(
      (segment: Segment): string | undefined => {
        const sceneid = segment.sceneIds[0];
        if (sceneid) {
          // In series mode, get scene from library for full assets
          if(series?.library?.scenes) {
          const libraryScene = series.library.scenes.find((s) => s.id === sceneid);
          if (libraryScene?.referenceImage) {
            return libraryScene.referenceImage;
          }
        }
      }},
      [series?.library?.scenes],
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 select-text">
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
            className="group flex flex-col items-center justify-center md:min-h-[200px] p-4 border-2 border-dashed border-slate-600 hover:border-slate-500 bg-slate-800/30 hover:bg-slate-800/50 rounded-xl transition-all"
          >
            <div className="w-12 h-12 rounded-full bg-slate-700/50 flex items-center justify-center mb-3 group-hover:bg-slate-600/20 group-hover:scale-110 transition-all">
              <Plus className="w-6 h-6 text-slate-400 group-hover:text-slate-400" />
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
                className={`group relative bg-slate-800 border rounded-xl overflow-hidden transition-all hover:border-slate-500/50 cursor-pointer flex flex-col h-full ${
                  isDeleting ? 'border-red-500/50' : 'border-slate-600'
                }`}
              >
                {/* Delete Confirmation Overlay */}
                {isDeleting && (
                  <div className="absolute inset-0 z-20 bg-slate-800/95 flex flex-col items-center justify-center p-4 space-y-3">
                    <p className="text-slate-50 text-sm font-medium">删除此分集?</p>
                    <div className="flex gap-2 w-full">
                      <button
                        onClick={(e) => {setDeleteConfirmId(null);e.stopPropagation()}}
                        className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg"
                      >
                        取消
                      </button>
                      <button
                        onClick={(e) => {handleDeleteEpisode(ep.id, false);e.stopPropagation()}}
                        className="flex-1 py-2 bg-slate-600 hover:bg-slate-500 text-slate-200 text-xs rounded-lg"
                      >
                        保留
                      </button>
                      <button
                        onClick={(e) => {handleDeleteEpisode(ep.id, true);e.stopPropagation()}}
                        className="flex-1 py-2 bg-red-600/50 hover:bg-red-600/70 text-red-100 text-xs rounded-lg"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                )}

                {/* Card Header */}
                <div className="p-4 pb-2 flex-1 flex flex-col">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1">
                      <h3 className="text-sm font-medium text-slate-200 line-clamp-1 flex-1">
                        {ep.title}
                      </h3>
                    </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingEpisode(ep); setShowProjectSettingsModal(true); }}
                    className="p-1.5 hover:bg-slate-600/20 text-slate-400 hover:text-slate-300 rounded-lg transition-all relative z-20"
                    title="编辑分集信息"
                  >
                    <Edit3 className="w-4 h-4" />
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
                  <div className="flex items-center gap-1 text-xs text-slate-500 py-1.5">
                    <Calendar className="w-3 h-3" />
                    {formatDate(ep.lastModified)}
                  </div>
                  {series.currentEpisodeId != ep.id && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(ep.id); }}
                    className="p-1.5 hover:bg-red-600/20 text-slate-500 hover:text-red-400 rounded-lg transition-all relative z-20"
                    title="删除分集"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  )}
                      {/* Preview Episode Button */}
                      <button
                        onClick={(e) => handlePreviewEpisode(ep, e)}
                        disabled={getEpisodeVideoUrls(ep).length === 0}
                        className="p-1 hover:bg-slate-600/20 text-slate-400 hover:text-slate-300 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        title="预览视频"
                      >
                        <Play className="w-4 h-4" />
                      </button>

                      {/* Export Episode Button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleExportEpisode(ep); }}
                        className="p-1 hover:bg-slate-600/20 text-slate-400 hover:text-slate-300 rounded-lg transition-all"
                        title="导出单集"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      {/* Move Backward Button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMoveEpisode(ep.id, 'backward'); }}
                        disabled={index === 0}
                        className="p-1 hover:bg-slate-600/20 text-slate-400 hover:text-slate-300 rounded-lg transition-all disabled:opacity-0 disabled:cursor-not-allowed"
                        title="向前移动"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      {/* Move Forward Button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMoveEpisode(ep.id, 'forward'); }}
                        disabled={index === episodes.length - 1}
                        className="p-1 hover:bg-slate-600/20 text-slate-400 hover:text-slate-300 rounded-lg transition-all disabled:opacity-0 disabled:cursor-not-allowed"
                        title="向后移动"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="p-2 md:p-4 border-t border-slate-700 flex flex-col md:flex-row justify-between items-center text-sm text-slate-400 bg-slate-600/80">
        <div className="flex items-center gap-4 pb-2">
          <span className="text-slate-400">
            角色库: <span className="text-slate-200 font-mono">{series.library.characters.length}</span>
          </span>
          <span className="text-slate-400">
            场景库: <span className="text-slate-200 font-mono">{series.library.scenes.length}</span>
          </span>
          <span className="text-slate-400">
            共 <span className="text-slate-200 font-mono">{episodes.length}</span> 集
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4" />
            设置
          </button>
          <button
            onClick={handleImportEpisode}
            disabled={importing}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
{/* Episode (Project) Settings Modal */}
{editingEpisode && (
  <ProjectSettingsModal
    isOpen={showProjectSettingsModal}
    onClose={() => { setShowProjectSettingsModal(false); setEditingEpisode(null); }}
    project={editingEpisode}
    updateProject={handleSaveEpisodeSettings}
  />
)}

{/* Series Settings Modal */}
<SeriesSettingsModal
  isOpen={showSettingsModal}
  onClose={() => setShowSettingsModal(false)}
  series={series}
  onSave={handleSaveSeriesSettings}
/>

{/* Video Preview Modal */}
{previewingEpisode?.isSegmentMode ? (
  <SegmentPreviewModal
    segments={previewingEpisode.segments || []}
    projectTitle={previewingEpisode.title}
    isOpen={!!previewingEpisode}
    onClose={() => setPreviewingEpisode(null)}
    getSegmentThumbnail={getSegmentThumbnail}
  />
) : (
  <EpisodePreviewModal
    episode={previewingEpisode}
    isOpen={!!previewingEpisode}
    onClose={() => setPreviewingEpisode(null)}
  />
)}
    </div>
);

};

export default SeriesManagerModal;
