import { AlertTriangle, ArrowUpDown, Calendar, Check, ChevronRight, Copy, Download, Edit, Film, Loader2, Plus, Power, Settings, Sparkles, Trash2, Upload, Video } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createSeriesEpisode, importProjectAsEpisode } from '../services/seriesService';
import {
  createNewProjectState,
  deleteProjectFromDB,
  deleteSeriesFromDB,
  exportProjectToFile,
  exportSeriesToFile,
  getAllProjectsMetadata,
  getAllSeriesFromDB,
  importFromFile,
  saveProjectToDB,
  saveSeriesToDB
} from '../services/storageService';
import { ProjectState, SeriesRecord } from '../types';
import ApiKeyModal from './ApiKeyModal';
import { useDialog } from './dialog';
import CreateTypeDialog from './dialog/CreateTypeDialog';
import ModalSettings from './ModalSettings';
import ProjectSettingsModal from './ProjectSettingsModal';
import SeriesSettingsModal from './SeriesSettingsModal';
import SyncModal from './SyncModal';
import { ThemeToggle } from './ThemeToggle';
import { generateId } from '../services/seriesService';

interface Props {
  onOpenProject: (project: ProjectState) => void;
  isMobile: boolean;
  onClearKey: () => void;
}

const Dashboard: React.FC<Props> = ({ onOpenProject, isMobile=false, onClearKey }) => {
  const dialog = useDialog();
  const [projects, setProjects] = useState<ProjectState[]>([]);
  const [seriesList, setSeriesList] = useState<SeriesRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmSeriesId, setDeleteConfirmSeriesId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [showModelSettings, setShowModelSettings] = useState(false);
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [showSeriesSettings, setShowSeriesSettings] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [currentProject, setCurrentProject] = useState<ProjectState | null>(null);
  const [currentSeries, setCurrentSeries] = useState<SeriesRecord | null>(null);
  const [expandedSeries, setExpandedSeries] = useState<string | null>(null);
  // ✅ Use useCallback to prevent re-creation
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [projList, serList] = await Promise.all([
        getAllProjectsMetadata(),
        getAllSeriesFromDB()
      ]);
      setProjects(projList);
      setSeriesList(serList);
    } catch (e) {
      console.error("Failed to load data", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);



  const handleCreate = useCallback(() => {
    setShowCreateDialog(true);
  }, []);

  const handleCreateStandalone = useCallback(() => {
    setShowCreateDialog(false);
    const newProject = createNewProjectState();
    onOpenProject(newProject);
  }, [onOpenProject]);

  const handleCreateSeries = useCallback(() => {
    setShowCreateDialog(false);
    setCurrentSeries(null); // 新建模式
    setShowSeriesSettings(true);
  }, []);

  const handleEditSeries = useCallback((series: SeriesRecord) => {
    setCurrentSeries(series); // 编辑模式
    setShowSeriesSettings(true);
  }, []);

  const handleSaveSeries = useCallback(async (series: SeriesRecord) => {
    await saveSeriesToDB(series);
    await loadData();
  }, [loadData]);

  const handleCreateSeriesEpisode = useCallback(async (series: SeriesRecord) => {
    const newProject = createSeriesEpisode(series);
    await saveProjectToDB(newProject);
    
    // Add episode to series
    const updatedSeries = {
      ...series,
      episodeOrder: [...series.episodeOrder, newProject.id],
      updatedAt: Date.now()
    };
    await saveSeriesToDB(updatedSeries);
    await loadData();
    
    onOpenProject(newProject);
  }, [loadData, onOpenProject]);

  const requestDelete = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  }, []);

  const cancelDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(null);
  }, []);

  const confirmDelete = useCallback(async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
        await deleteProjectFromDB(id);
        await loadData();
    } catch (error) {
        console.error("Delete failed", error);
        dialog.toast({ message: '删除项目失败', type: 'error' });
    } finally {
        setDeleteConfirmId(null);
    }
  }, [loadData, dialog]);

  const requestDeleteSeries = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteConfirmSeriesId(id);
  }, []);

  const cancelDeleteSeries = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmSeriesId(null);
  }, []);

  const confirmDeleteSeries = useCallback(async (e: React.MouseEvent, id: string, deleteEpisodes: boolean) => {
    e.stopPropagation();
    try {
        await deleteSeriesFromDB(id, deleteEpisodes);
        await loadData();
        dialog.toast({ message: deleteEpisodes ? '剧集及所有分集已删除' : '剧集已删除，分集转为独立项目', type: 'success' });
    } catch (error) {
        console.error("Delete series failed", error);
        dialog.toast({ message: '删除剧集失败', type: 'error' });
    } finally {
        setDeleteConfirmSeriesId(null);
    }
  }, [loadData, dialog]);

  const formatDate = useCallback((ts: number) => {
    return new Date(ts).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }, []);

  const handleExport = useCallback((e: React.MouseEvent, proj: ProjectState) => {
    e.stopPropagation();
    exportProjectToFile(proj);
  }, []);

  const handleExportSeries = useCallback((e: React.MouseEvent, series: SeriesRecord) => {
    e.stopPropagation();
    // Get all episodes of this series
    const episodes = projects.filter(p => p.seriesRefId === series.id);
    exportSeriesToFile(series, episodes);
  }, [projects]);

  const handleImport = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setImporting(true);
      const result = await importFromFile();
      
      if (result.type === 'standalone' && result.project) {
        // Import standalone project - ✅ Create new object to avoid mutation
        const importedProject = {
          ...result.project,
          id: generateId('proj'),
          createdAt: Date.now(),
          lastModified: Date.now(),
          seriesRefId: undefined
        };
        await saveProjectToDB(importedProject);
        await loadData();
        onOpenProject(importedProject);
      } else if (result.type === 'series' && result.series) {
        // Import series with episodes
        let importedSeries = {
          ...result.series,
          id: generateId('series'),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          episodeOrder: []
        };
        
        // Process each episode with proper library merge
        if (result.projects) {
          for (const ep of result.projects) {
            const { updatedProject, updatedSeries } = importProjectAsEpisode(importedSeries, ep);
            importedSeries = updatedSeries;
            await saveProjectToDB(updatedProject);
          }
        }
        
        await saveSeriesToDB(importedSeries);
        await loadData();
        dialog.toast({ message: '剧集导入成功', type: 'success' });
      }
    } catch (error: any) {
      console.error('Import failed:', error);
      if (error.message !== 'Import cancelled' && error.message !== 'No file selected') {
        dialog.toast({ message: error.message || '导入失败', type: 'error' });
      }
    } finally {
      setImporting(false);
    }
  }, [loadData, onOpenProject, dialog]);
  
  const handleClearKey = useCallback(() => {
      onClearKey();
  }, [onClearKey]);

  // Handle import episode to existing series
  const handleImportEpisodeToSeries = useCallback(async (e: React.MouseEvent, series: SeriesRecord) => {
    e.stopPropagation();
    try {
      setImporting(true);
      const result = await importFromFile();
      
      if (result.type === 'standalone' && result.project) {
        // Import single project as episode
        const { updatedProject, updatedSeries } = importProjectAsEpisode(series, result.project);
        
        // Save to DB
        await saveProjectToDB(updatedProject);
        await saveSeriesToDB(updatedSeries);
        await loadData();
        
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
  }, [loadData, dialog]);

  const handleDuplicate = useCallback(async (e: React.MouseEvent, proj: ProjectState) => {
    e.stopPropagation();
    try {
      // 创建项目副本 - ✅ Use generateId for consistency
      const duplicatedProject = {
        ...JSON.parse(JSON.stringify(proj)),
        id: generateId('proj'),
        title: proj.title.endsWith(':副本') ? proj.title : proj.title + ':副本',
        seriesRefId: undefined,
        createdAt: Date.now(),
        lastModified: Date.now()
      };
      // 保存到数据库
      await saveProjectToDB(duplicatedProject);
      // 重新加载项目列表
      await loadData();
    } catch (error) {
      console.error('Duplicate project failed:', error);
      dialog.toast({ message: '复制项目失败', type: 'error' });
    }
  }, [loadData, dialog]);

  const startEditing = useCallback((e: React.MouseEvent, proj: ProjectState) => {
    e.stopPropagation();
    setEditingProjectId(proj.id);
    setEditingTitle(proj.title);
  }, []);

  const cancelEditing = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProjectId(null);
    setEditingTitle('');
  }, []);

  const saveTitle = useCallback(async (e: React.MouseEvent | React.KeyboardEvent, proj: ProjectState) => {
    e.stopPropagation();
    if (!editingTitle.trim()) {
      cancelEditing(e as React.MouseEvent);
      return;
    }
    try {
      const updatedProject = { ...proj, title: editingTitle.trim() };
      await saveProjectToDB(updatedProject);
      await loadData();
    } catch (error) {
      console.error('Failed to update title:', error);
      dialog.toast({ message: '更新项目名失败', type: 'error' });
    } finally {
      setEditingProjectId(null);
      setEditingTitle('');
    }
  }, [editingTitle, loadData, dialog]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, proj: ProjectState) => {
    if (e.key === 'Enter') {
      saveTitle(e, proj);
    } else if (e.key === 'Escape') {
      cancelEditing(e as any);
    }
  }, [saveTitle, cancelEditing]);

  const openProjectSettings = useCallback((e: React.MouseEvent, proj: ProjectState) => {
    e.stopPropagation();
    setCurrentProject(proj);
    setShowProjectSettings(true);
  }, []);

  const closeProjectSettings = useCallback(() => {
    setShowProjectSettings(false);
    setCurrentProject(null);
  }, []);

  const handleUpdateProject = useCallback(async (updates: Partial<ProjectState>) => {
    if (!currentProject) return;
    try {
      const updatedProject = { ...currentProject, ...updates, lastModified: Date.now() };
      await saveProjectToDB(updatedProject);
      await loadData();
      setCurrentProject(updatedProject);
    } catch (error) {
      console.error('Failed to update project:', error);
      dialog.toast({ message: '更新项目失败', type: 'error' });
    }
  }, [currentProject, loadData, dialog]);

  // Get standalone projects (not part of any series)
  const standaloneProjects = useMemo(() => {
    return projects.filter(p => !p.seriesRefId);
  }, [projects]);

  // Get episodes for a series
  const getSeriesEpisodes = (seriesId: string) => {
    return projects.filter(p => p.seriesRefId === seriesId);
  };

  // 从项目中收集所有可用的图片
  const getProjectImages = (proj: ProjectState): string[] => {
    const images: string[] = [];

    // 收集角色图片
    if (proj.scriptData?.characters) {
      proj.scriptData.characters.forEach(char => {
        // 基础形象
        if (char.referenceImage) {
          images.push(char.referenceImage);
        }
        // 角色变体
        if (char.variations) {
          char.variations.forEach(variation => {
            if (variation.referenceImage) {
              images.push(variation.referenceImage);
            }
          });
        }
      });
    }

    // 收集场景图片
    if (proj.scriptData?.scenes) {
      proj.scriptData.scenes.forEach(scene => {
        if (scene.referenceImage) {
          images.push(scene.referenceImage);
        }
      });
    }

    // 收集关键帧图片
    if (proj.shots) {
      proj.shots.forEach(shot => {
        if (shot.keyframes) {
          shot.keyframes.forEach(keyframe => {
            if (keyframe.imageUrl) {
              images.push(keyframe.imageUrl);
            }
          });
        }
      });
    }

    return images;
  };

  // 随机选择N张图片
  const getRandomImages = (images: string[], count: number): string[] => {
    if (images.length === 0) return [];

    // 如果图片数量不足，返回所有图片
    if (images.length <= count) {
      return [...images];
    }

    // 随机洗牌并取前N张
    const shuffled = [...images].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  };

  // 缓存每个项目的随机图片，避免重渲染时刷新
  const projectPreviewImages = useMemo(() => {
    const map = new Map<string, string[]>();
    projects.forEach(proj => {
      const allImages = getProjectImages(proj);
      map.set(proj.id, getRandomImages(allImages, 4));
    });
    return map;
  }, [projects]);

  // 连续剧预览图：从 library.characters + library.scenes 收集图片
  const seriesPreviewImages = useMemo(() => {
    const map = new Map<string, string[]>();
    seriesList.forEach(series => {
      const images: string[] = [];

      // 收集角色图片
      series.library.characters.forEach(char => {
        if (char.referenceImage) images.push(char.referenceImage);
        char.variations?.forEach(v => {
          if (v.referenceImage) images.push(v.referenceImage);
        });
      });

      // 收集场景图片
      series.library.scenes.forEach(scene => {
        if (scene.referenceImage) images.push(scene.referenceImage);
      });

      map.set(series.id, getRandomImages(images, 4));
    });
    return map;
  }, [seriesList]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-300 p-4 pt-2 md:p-12 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className={`border-b border-slate-900 pb-4 ${isMobile ? '' : 'mb-16 flex items-end'} justify-between`}>
          <div className='flex items-center justify-between'>
            <h1 className="text-3xl font-light text-slate-50 tracking-tight m-2 flex items-center gap-3">
              剧集库
            </h1>
<div className='flex items-center justify-between gap-3'>
            <ThemeToggle size="sm" className={`text-[12px] text-slate-600 hover:text-red-500 transition-colors uppercase font-mono tracking-widest`}/>
            <button onClick={handleClearKey} className={`z-50 text-[12px] flex items-center justify-center text-text-secondary w-8 h-8 p-1.5 transition-all duration-200 ease-in-out bg-bg-button rounded-lg text-slate-600 hover:text-red-500 transition-colors uppercase font-mono tracking-widest cursor-pointer`}>
            <Power className="w-4 h-4" />
            </button>
</div>
          </div>
          <div className="flex gap-2 md:gap-3 flex-end justify-end flex-wrap">
            <button
              onClick={handleCreate}
              className="group flex items-center gap-3 px-6 py-3 bg-slate-600/50 text-slate-50 hover:bg-slate-600 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {!isMobile && <span className="font-bold text-xs tracking-widest uppercase">新建</span>}
            </button>
            <button
              onClick={handleImport}
              disabled={importing}
              className="group flex items-center gap-3 px-6 py-3 bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              {!isMobile && <span className="font-bold text-xs tracking-widest uppercase">{importing ? '导入中...' : '导入'}</span>}
            </button>
            <button
              onClick={() => setShowSyncModal(true)}
              className="group flex items-center gap-3 px-6 py-3 bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-slate-50 transition-colors cursor-pointer"
              title="同步数据"
            >
              <ArrowUpDown className="w-4 h-4" />
              {!isMobile && <span className="font-bold text-xs tracking-widest uppercase">同步数据</span>}
            </button>
            <button
              onClick={() => setShowModelSettings(true)}
              className="group flex items-center gap-3 px-6 py-3 bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-slate-50 transition-colors cursor-pointer"
              title="模型管理"
            >
              <Sparkles className="w-4 h-4" />
              {!isMobile && <span className="font-bold text-xs tracking-widest uppercase">模型</span>}
            </button>
            <button
              onClick={() => setApiKeyModalOpen(true)}
              className="group flex items-center gap-3 px-6 py-3 bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-slate-50 transition-colors cursor-pointer"
              title="系统设置"
            >
              <Settings className="w-4 h-4" />
              {!isMobile && <span className="font-bold text-xs tracking-widest uppercase">设置</span>}
            </button>
          </div>
        </header>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 text-slate-600 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">

            {/* Create New Card */}
            {(!isMobile || (standaloneProjects.length + seriesList.length) === 0) && (
              <div
                onClick={handleCreate}
                className="group cursor-pointer border border-slate-600/50 hover:border-slate-400 bg-slate-800 flex flex-col items-center justify-center min-h-[280px] transition-all"
              >
                <div className="w-12 h-12 border border-slate-600/50 flex items-center justify-center mb-6 group-hover:bg-slate-900/20 transition-colors">
                  <Plus className="w-5 h-5 text-slate-400 group-hover:text-slate-300" />
                </div>
                <span className="text-slate-400 font-mono text-[12px] uppercase tracking-widest group-hover:text-slate-300">新建</span>
              </div>
            )}

            {/* Series List */}
            {seriesList.map((series) => (
                <div 
                  key={series.id}
                  className="group bg-slate-800 border border-slate-600 hover:border-slate-300 p-0 flex flex-col cursor-pointer transition-all relative overflow-hidden h-[280px]"
                  onClick={() => {
                    if (series.currentEpisodeId) {
                      const episode = projects.find(p => p.id === series.currentEpisodeId);
                      if (episode) {
                        onOpenProject(episode);
                      }else{
                        const firstEpisode = series.episodeOrder[0];
                        const episode = projects.find(p => p.id === firstEpisode);
                        onOpenProject(episode);
                      }
                    }
                  }}
                >
                {/* Delete Confirmation Overlay */}
                {deleteConfirmSeriesId === series.id && (
                  <div 
                      className="absolute inset-0 z-20 bg-slate-800 flex flex-col items-center justify-center p-6 space-y-4 animate-in fade-in duration-200"
                      onClick={(e) => e.stopPropagation()} 
                  >
                      <div className="w-10 h-10 bg-red-900/20 flex items-center justify-center rounded-full">
                         <AlertTriangle className="w-5 h-5 text-red-500" />
                      </div>
                      <div className="text-center">
                          <p className="text-slate-50 font-bold text-xs uppercase tracking-widest">删除剧集？</p>
                          <p className="text-slate-500 text-[12px] mt-1 font-mono">是否同时删除所有分集？</p>
                      </div>
                      <div className="flex gap-2 w-full pt-2">
                          <button 
                              onClick={cancelDeleteSeries}
                              className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-50 text-[12px] font-bold uppercase tracking-wider transition-colors border border-slate-600 cursor-pointer"
                          >
                              取消
                          </button>
                          <button 
                              onClick={(e) => confirmDeleteSeries(e, series.id, false)}
                              className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-slate-50 text-[12px] font-bold uppercase tracking-wider transition-colors border border-slate-500 cursor-pointer"
                          >
                              保留分集
                          </button>
                          <button 
                              onClick={(e) => confirmDeleteSeries(e, series.id, true)}
                              className="flex-1 py-3 bg-red-900/20 hover:bg-red-900/40 text-red-400 hover:text-red-200 text-[12px] font-bold uppercase tracking-wider transition-colors border border-red-900/30 cursor-pointer"
                          >
                              全部删除
                          </button>
                      </div>
                  </div>
                )}

                {/* Series Content */}
                <div className="flex-1 px-6 pt-2 relative flex flex-col">
                   <div className='flex flex-row items-center justify-end gap-1'>
                     {/* Edit Button */}
                     <button
                        onClick={(e) => handleEditSeries(series)}
                        className="group-hover:opacity-100 p-2 hover:bg-slate-900/30 text-slate-400 hover:text-slate-300 transition-all rounded-sm z-10 cursor-pointer"
                        title="编辑剧集"
                     >
                        <Edit className="w-4 h-4" />
                     </button>
                     {/* Import Episode Button */}
                     <button
                        onClick={(e) => handleImportEpisodeToSeries(e, series)}
                        className="group-hover:opacity-100 p-2 hover:bg-slate-900/30 text-slate-400 hover:text-slate-300 transition-all rounded-sm z-10 cursor-pointer"
                        title="导入单集"
                     >
                        <Upload className="w-4 h-4" />
                     </button>
                     {/* Export Button */}
                     <button
                        onClick={(e) => handleExportSeries(e, series)}
                        className="group-hover:opacity-100 p-2 hover:bg-slate-900/30 text-slate-400 hover:text-slate-300 transition-all rounded-sm z-10 cursor-pointer"
                        title="导出剧集"
                     >
                        <Download className="w-4 h-4" />
                     </button>
                     {/* Delete Button */}
                     <button
                        onClick={(e) => requestDeleteSeries(e, series.id)}
                        className="group-hover:opacity-100 p-2 hover:bg-slate-900/30 text-slate-400 hover:text-red-400 transition-all rounded-sm z-10 cursor-pointer"
                        title="删除剧集"
                     >
                        <Trash2 className="w-4 h-4" />
                     </button>
                   </div> 
                   <div className="flex-1">
                      <h3 className="text-sm font-bold text-slate-300 mb-2 line-clamp-1 tracking-wide flex items-center gap-2">
                        <Film className="w-4 h-4" />
                        {series.title}
                      </h3>
                      <p className="text-[11px] text-slate-400/70 font-mono mb-2">
                        {series.episodeOrder.length} 集
                      </p>
                      <div className="text-[12px] text-slate-500 line-clamp-2 leading-relaxed font-mono border-l border-slate-600/50 pl-2">
                        角色库: {series.library.characters.length} | 场景库: {series.library.scenes.length}
                      </div>
                         <div className="px-2 pt-4 border-t border-slate-900 flex gap-1 items-center justify-center">
                    <div className="flex gap-1">
                      {seriesPreviewImages.get(series.id)?.map((imgUrl, idx) => (
                        <div
                          key={idx}
                          className="w-14 h-14 bg-slate-900 rounded overflow-hidden flex-shrink-0 border border-slate-600 hover:border-slate-300 transition-colors cursor-pointer group/img"
                        >
                          <img
                            src={imgUrl}
                            alt={`Preview ${idx + 1}`}
                            className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-200"
                          />
                        </div>
                      ))}
                      </div></div>
                   </div>
                </div>

                <div className="px-6 py-3 border-t border-slate-900 flex items-center justify-between bg-slate-700">
                  <div className="flex items-center gap-2 text-[11px] text-slate-400/50 font-mono uppercase tracking-widest">
                      <Calendar className="w-3 h-3" />
                      {formatDate(series.updatedAt)}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreateSeriesEpisode(series);
                    }}
                    className="text-[10px] px-2 py-1 bg-slate-600/50 text-slate-200 hover:bg-slate-600 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> 新分集
                  </button>
                </div>
              </div>
            ))}

            {/* Standalone Project List */}
            {standaloneProjects.map((proj) => (
              <div 
                key={proj.id}
                onClick={() => onOpenProject(proj)}
                className="group bg-slate-800 border border-slate-600 hover:border-slate-300 p-0 flex flex-col cursor-pointer transition-all relative overflow-hidden h-[280px]"
              >
                  {/* Delete Confirmation Overlay */}
                  {deleteConfirmId === proj.id && (
                    <div 
                        className="absolute inset-0 z-20 bg-slate-800 flex flex-col items-center justify-center p-6 space-y-4 animate-in fade-in duration-200"
                        onClick={(e) => e.stopPropagation()} 
                    >
                        <div className="w-10 h-10 bg-red-900/20 flex items-center justify-center rounded-full">
                           <AlertTriangle className="w-5 h-5 text-red-500" />
                        </div>
                        <div className="text-center">
                            <p className="text-slate-50 font-bold text-xs uppercase tracking-widest">确认删除？</p>
                            <p className="text-slate-500 text-[12px] mt-1 font-mono">此操作无法撤销。</p>
                        </div>
                        <div className="flex gap-2 w-full pt-2">
                            <button 
                                onClick={cancelDelete}
                                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-50 text-[12px] font-bold uppercase tracking-wider transition-colors border border-slate-600 cursor-pointer"
                            >
                                取消
                            </button>
                            <button 
                                onClick={(e) => confirmDelete(e, proj.id)}
                                className="flex-1 py-3 bg-red-900/20 hover:bg-red-900/40 text-red-400 hover:text-red-200 text-[12px] font-bold uppercase tracking-wider transition-colors border border-red-900/30 cursor-pointer"
                            >
                                删除
                            </button>
                        </div>
                    </div>
                  )}

                  {/* Normal Content */}
                  <div className="flex-1 px-6 pt-2 relative flex flex-col">
                     {/* Edit Button */}
                     <div className='flex flex-row items-center justify-end gap-1'>
                     {editingProjectId !== proj.id ? (
                     <button
                        onClick={(e) => openProjectSettings(e, proj)}
                        className="group-hover:opacity-100 p-2 hover:bg-slate-700 text-slate-400 hover:text-slate-400 transition-all rounded-sm z-10 cursor-pointer"
                        title="编辑项目"
                     >
                        <Edit className="w-4 h-4" />
                     </button>
                     ) : null}

                     {/* Duplicate Button */}
                     {editingProjectId === null ? (
                     <button
                        onClick={(e) => handleDuplicate(e, proj)}
                        className="group-hover:opacity-100 p-2 hover:bg-slate-700 text-slate-400 hover:text-slate-400 transition-all rounded-sm z-10 cursor-pointer"
                        title="复制项目"
                     >
                        <Copy className="w-4 h-4" />
                     </button>
                     ) : null}

                     {/* Export Button */}
                     {editingProjectId === null ? (
                     <button
                        onClick={(e) => handleExport(e, proj)}
                        className="group-hover:opacity-100 p-2 hover:bg-slate-700 text-slate-400 hover:text-slate-400 transition-all rounded-sm z-10 cursor-pointer"
                        title="导出项目"
                     >
                        <Download className="w-4 h-4" />
                     </button>
                     ) : null}

                     {/* Delete Button */}
                     {editingProjectId === null ? (
                     <button
                        onClick={(e) => requestDelete(e, proj.id)}
                        className="group-hover:opacity-100 p-2 hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-all rounded-sm z-10 cursor-pointer"
                        title="删除项目"
                     >
                        <Trash2 className="w-4 h-4" />
                     </button>
                      ) : null}
                     </div> 
                     <div className="flex-1">
                        {editingProjectId === proj.id ? (
                          <div className="mb-2 flex items-center gap-2">
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, proj)}
                              onClick={(e) => e.stopPropagation()}
                              className="flex-1 bg-slate-900 border border-slate-600 text-slate-50 text-sm px-2 py-1 focus:outline-none focus:border-slate-500"
                              autoFocus
                            />
                            <button
                              onClick={(e) => saveTitle(e, proj)}
                              className="p-1.5 hover:bg-slate-800 text-slate-500 hover:text-green-400 transition-all rounded-sm cursor-pointer"
                              title="保存"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                      <h3 className="text-sm font-bold text-slate-300 mb-2 line-clamp-1 tracking-wide flex items-center gap-2">
                            <Video className="w-4 h-4" />{proj.title}</h3>
                        )}

                        <div className="flex flex-wrap gap-2 mb-3">
                            {proj.visualStyle && (
                              <span className="text-[11px] text-green-600 bg-slate-900/50 border border-green-800/50 px-1.5 py-0.5 rounded-full">
                                {proj.visualStyle}
                              </span>
                            )}
                            {proj.imageSize && (
                              <span className="text-[11px] text-pink-600 bg-slate-900/50 border border-pink-800/50 px-1.5 py-0.5 rounded-full font-mono">
                                {proj.imageSize}
                              </span>
                            )}
                            {proj.targetDuration && (
                              <span className="text-[11px] text-yellow-600 bg-slate-900/50 border border-yellow-800/50 px-1.5 py-0.5 rounded-full font-mono">
                                {proj.targetDuration}
                              </span>
                            )}
                        </div>
                        {proj.scriptData?.logline && (
                            <p className="text-[12px] text-slate-500 line-clamp-2 leading-relaxed font-mono border-l border-slate-600 pl-2">
                            {proj.scriptData.logline}
                            </p>
                        )}

                         {/* 图片预览 */}
                  <div className="px-2 pt-4 border-t border-slate-900 flex gap-1 items-center justify-center">
                    <div className="flex gap-1">
                      {projectPreviewImages.get(proj.id)?.map((imgUrl, idx) => (
                        <div
                          key={idx}
                          className="w-14 h-14 bg-slate-900 rounded overflow-hidden flex-shrink-0 border border-slate-600 hover:border-slate-300 transition-colors cursor-pointer group/img"
                        >
                          <img
                            src={imgUrl}
                            alt={`Preview ${idx + 1}`}
                            className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-200"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                     </div>
                  </div>

                  <div className="px-6 py-3 border-t border-slate-900 flex items-center justify-between bg-slate-700">
                    <div className="flex items-center gap-2 py-1 text-[11px] text-slate-500/50 font-mono uppercase tracking-widest group-hover:text-slate-50 ">
                        <Calendar className="w-3 h-3" />
                        {formatDate(proj.lastModified)}
                    </div>
                    <ChevronRight className="w-3 h-3 text-slate-500/50 group-hover:text-slate-50 transition-colors" />
                  </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Model Settings Modal */}
      <ModalSettings
        isOpen={showModelSettings}
        onClose={() => setShowModelSettings(false)}
        isMobile={isMobile}
      />

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={apiKeyModalOpen}
        onClose={() => setApiKeyModalOpen(false)}
      />

      {/* Sync Modal */}
      <SyncModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        onSyncComplete={loadData}
      />

      {/* Project Settings Modal */}
      <ProjectSettingsModal
        isOpen={showProjectSettings}
        onClose={closeProjectSettings}
        project={currentProject}
        updateProject={handleUpdateProject}
      />

      {/* Series Settings Modal */}
      <SeriesSettingsModal
        isOpen={showSeriesSettings}
        onClose={() => {
          setShowSeriesSettings(false);
          setCurrentSeries(null);
        }}
        series={currentSeries}
        onSave={handleSaveSeries}
      />

      {/* Create Type Dialog */}
      <CreateTypeDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSelectStandalone={handleCreateStandalone}
        onSelectSeries={handleCreateSeries}
      />
    </div>
  );
};

export default Dashboard;