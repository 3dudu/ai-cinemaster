import { ArrowDown, ArrowUp, Check, Cloud, Loader2, RefreshCw, Trash2, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { getAllProjectsMetadata, getAllSeriesFromDB, saveProjectToDB, saveSeriesToDB } from '../../services/storageService';
import { deleteProject, downloadProject, downloadSeries, getServerFiles, initSync, SyncFileInfo, uploadProject, uploadSeries } from '../../services/syncService';
import { ProjectState, SeriesRecord } from '../../types';
import { useDialog } from '../dialog';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete: () => void;
}

interface ConflictItem {
  localProject?: ProjectState;
  localSeries?: SeriesRecord;
  serverFile: SyncFileInfo;
  action: 'upload' | 'download' | 'conflict' | null;
  projectName?: string;
  projectId: string;
  lastModified: number;
  createdAt: number;
  conflict: -1 | 0 | 1;   // -1: 服务器新，0: 相同，1: 本地新
  syncStatus?: 'pending' | 'syncing' | 'success' | 'failed';  // 同步状态
  isSeries: boolean;      // 是否为剧集
}

const SyncModal: React.FC<SyncModalProps> = ({ isOpen, onClose, onSyncComplete }) => {
  const dialog = useDialog();
  const [syncKey, setSyncKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string>('');
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [serverFiles, setServerFiles] = useState<SyncFileInfo[]>([]);

  // 从 localStorage 加载 syncKey
  useEffect(() => {
    const savedKey = localStorage.getItem('cinegen_sync_key') || '';
    setSyncKey(savedKey);
    if (isOpen) {
      // 如果已有 syncKey，自动开始同步
      if (savedKey) {
        handleStartSync();
      }
    }
  }, [isOpen]);

  const handleStartSync = async () => {
    setIsLoading(true);
    setIsInitialized(false);
    setInitError('');
    setConflicts([]);

    try {
      let actualSyncKey = syncKey.trim();

      // 始终执行初始化
      const initResult = await initSync(actualSyncKey);

      if (!initResult.success) {
        setInitError(initResult.error || '初始化失败');
        setIsInitialized(false);
        return;
      }

      // 初始化成功，标记为已初始化
      setIsInitialized(true);

      // 使用服务器返回的 syncKey（如果有的话）
      if (initResult.syncKey) {
        actualSyncKey = initResult.syncKey;
        setSyncKey(actualSyncKey);
      }

      // 保存 syncKey 到 localStorage
      if (actualSyncKey) {
        localStorage.setItem('cinegen_sync_key', actualSyncKey);
      } else {
        throw new Error('服务器未返回同步密钥');
      }

      // 获取本地项目列表和剧集列表
      const [localProjects, localSeriesList] = await Promise.all([
        getAllProjectsMetadata(),
        getAllSeriesFromDB()
      ]);

      // 获取服务器文件列表
      const files = await getServerFiles(actualSyncKey);
      setServerFiles(files);

      // 比较本地和服务器文件，取并集
      const conflictItems: ConflictItem[] = [];

      // 从服务器文件名中提取项目 ID
      const serverProjectIds = new Map<string, SyncFileInfo>();
      const serverSeriesIds = new Map<string, SyncFileInfo>();
      for (const file of files) {
        // 如果文件有 id 字段，直接使用；否则从文件名解析
        const id = file.id || file.fileName.match(/^(.+)_([a-f0-9-]+)\.json$/i)?.[2];
        if (id) {
          // 区分剧集和项目文件
          if (file.fileName.startsWith('series_')) {
            serverSeriesIds.set(id.toLowerCase(), file);
          } else {
            serverProjectIds.set(id.toLowerCase(), file);
          }
        }
      }

      // 本地项目集合（只包含单剧，不包含剧集分集）
      const localProjectMap = new Map<string, ProjectState>();
      for (const project of localProjects) {
        // 只同步单剧（没有 seriesRefId 的项目）
        if (!project.seriesRefId) {
          localProjectMap.set(project.id.toLowerCase(), project);
        }
      }

      // 本地剧集集合
      const localSeriesMap = new Map<string, SeriesRecord>();
      for (const series of localSeriesList) {
        localSeriesMap.set(series.id.toLowerCase(), series);
      }

      // 收集所有项目 ID（并集）
      const allProjectIds = new Set([...localProjectMap.keys(), ...serverProjectIds.keys()]);

      for (const id of allProjectIds) {
        const localProject = localProjectMap.get(id);
        const serverFile = serverProjectIds.get(id);

        if (localProject && serverFile) {
          // ID 相同，比较修改时间
          const conflict = localProject.lastModified > serverFile.lastModified ? 1 :
            localProject.lastModified < serverFile.lastModified ? -1 : 0;

          conflictItems.push({
            localProject,
            serverFile,
            action: conflict === 0 ? null : 'conflict', // 时间相同则不选中
            projectName: localProject.title,
            projectId: localProject.id,
            lastModified: localProject.lastModified,
            createdAt: localProject.createdAt,
            conflict: conflict,
            isSeries: false
          });
        } else if (localProject) {
          // 本地独有，默认上传
          conflictItems.push({
            localProject,
            serverFile: null as any,
            action: 'upload',
            projectName: localProject.title,
            projectId: localProject.id,
            lastModified: localProject.lastModified,
            createdAt: localProject.createdAt,
            conflict: 1,
            isSeries: false
          });
        } else if (serverFile) {
          // 服务器独有，用户可选择下载
          const title = serverFile.title || serverFile.fileName.replace(/_[a-f0-9-]+\.json$/i, '');
          const createdAt = serverFile.createdAt || 0;

          conflictItems.push({
            localProject: undefined,
            serverFile,
            action: null, // 默认不选中
            projectName: title,
            projectId: serverFile.id || serverFile.fileName,
            lastModified: serverFile.lastModified,
            createdAt: createdAt,
            conflict: -1,
            isSeries: false
          });
        }
      }

      // 收集所有剧集 ID（并集）
      const allSeriesIds = new Set([...localSeriesMap.keys(), ...serverSeriesIds.keys()]);

      for (const id of allSeriesIds) {
        const localSeries = localSeriesMap.get(id);
        const serverFile = serverSeriesIds.get(id);

        if (localSeries && serverFile) {
          // ID 相同，比较修改时间
          const conflict = localSeries.updatedAt > serverFile.lastModified ? 1 :
            localSeries.updatedAt < serverFile.lastModified ? -1 : 0;

          conflictItems.push({
            localSeries,
            serverFile,
            action: conflict === 0 ? null : 'conflict', // 时间相同则不选中
            projectName: localSeries.title,
            projectId: localSeries.id,
            lastModified: localSeries.updatedAt,
            createdAt: localSeries.createdAt,
            conflict: conflict,
            isSeries: true
          });
        } else if (localSeries) {
          // 本地独有，默认上传
          conflictItems.push({
            localSeries,
            serverFile: null as any,
            action: 'upload',
            projectName: localSeries.title,
            projectId: localSeries.id,
            lastModified: localSeries.updatedAt,
            createdAt: localSeries.createdAt,
            conflict: 1,
            isSeries: true
          });
        } else if (serverFile) {
          // 服务器独有，用户可选择下载
          const title = serverFile.title || serverFile.fileName.replace(/series_|_[a-f0-9-]+\.json$/gi, '');
          const createdAt = serverFile.createdAt || 0;

          conflictItems.push({
            localSeries: undefined,
            serverFile,
            action: null, // 默认不选中
            projectName: title,
            projectId: serverFile.id || serverFile.fileName,
            lastModified: serverFile.lastModified,
            createdAt: createdAt,
            conflict: -1,
            isSeries: true
          });
        }
      }

      if (conflictItems.length === 0) {
        // 没有需要同步的项目
        dialog.toast({ message: '没有需要同步的项目', type: 'info' });
        setSyncKey("");
        localStorage.setItem('cinegen_sync_key', '');
      } else {
        // 始终显示文件列表，让用户查看和确认
        setConflicts(conflictItems);
      }
    } catch (err) {
      setInitError(err instanceof Error ? err.message : '同步失败');
      setIsInitialized(false);
    } finally {
      setIsLoading(false);
    }
  };

  const executeSync = async (items: ConflictItem[]) => {
    setIsLoading(true);

    // 初始化所有待同步项的状态为 pending
    const updatedConflicts = conflicts.map(c => {
      if (items.find(i => i.projectId === c.projectId)) {
        return { ...c, syncStatus: 'pending' as const };
      }
      return c;
    });
    setConflicts(updatedConflicts);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const direction = getSyncDirection(item);

      // 设置当前项为 syncing
      setConflicts(prev => prev.map(c => 
        c.projectId === item.projectId ? { ...c, syncStatus: 'syncing' as const } : c
      ));

      let success = false;

      if (item.isSeries) {
        // 同步剧集（SeriesRecord）
        if (direction === 'upload' && item.localSeries) {
          // 上传剧集：先上传所有分集，再上传剧集本身
          try {
            // 获取本地分集数据
            const localProjects = await getAllProjectsMetadata();
            const episodes = localProjects.filter(p => p.seriesRefId === item.localSeries!.id);
            
            // 上传所有分集
            for (const episode of episodes) {
              const result = await uploadProject(episode, syncKey);
              if (!result.success) {
                console.error('Upload episode failed:', result.error);
              }
            }
            
            // 上传剧集
            const result = await uploadSeries(item.localSeries, syncKey);
            success = result.success;
            if (!result.success) {
              console.error('Upload series failed:', result.error);
            }
          } catch (err) {
            console.error('Upload series error:', err);
          }
        } else if (direction === 'download' && item.serverFile) {
          // 下载剧集：先下载剧集，再下载所有分集
          try {
            // 下载剧集
            const series = await downloadSeries(syncKey, item.serverFile.id);
            
            // 获取本地项目列表用于更新分集信息
            const localProjects = await getAllProjectsMetadata();
            
            // 下载所有分集并保存
            for (const episodeId of series.episodeOrder) {
              try {
                const episode = await downloadProject(syncKey, episodeId);
                await saveProjectToDB(episode, true);
              } catch (err) {
                console.error('Download episode failed:', err);
              }
            }
            
            // 保存剧集
            await saveSeriesToDB(series);
            success = true;
          } catch (err) {
            console.error('Download series failed:', err);
          }
        }
      } else {
        // 同步单剧（ProjectState）
        if (direction === 'upload' && item.localProject) {
          const result = await uploadProject(item.localProject, syncKey);
          success = result.success;
          if (!result.success) {
            console.error('Upload failed:', result.error);
          }
        } else if (direction === 'download' && item.serverFile) {
          try {
            const project = await downloadProject(syncKey, item.serverFile.id);
            await saveProjectToDB(project, true);
            success = true;
          } catch (err) {
            console.error('Download failed:', err);
          }
        }
      }

      // 更新同步结果
      if (success) {
        successCount++;
        setConflicts(prev => prev.map(c =>
          c.projectId === item.projectId ? { ...c, syncStatus: 'success' as const, action: null } : c
        ));
      } else {
        failCount++;
        setConflicts(prev => prev.map(c =>
          c.projectId === item.projectId ? { ...c, syncStatus: 'failed' as const } : c
        ));
      }

      // 延迟500毫秒后继续下一个
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsLoading(false);

    if (failCount === 0) {
      dialog.toast({ message: `同步成功！已处理 ${successCount} 个项目`, type: 'success' });
    } else {
      dialog.toast({ message: `同步完成：成功 ${successCount} 个，失败 ${failCount} 个`, type: 'warning' });
    }

    onSyncComplete();
  };

  const handleSetAction = (index: number, action: 'upload' | 'download' | 'conflict' | null) => {
    const newConflicts = [...conflicts];
    newConflicts[index].action = action;
    setConflicts(newConflicts);
  };

  const handleDeleteProject = async (index: number) => {
    const item = conflicts[index];
    if (!item.serverFile) return;

    const confirmed = await dialog.confirm({
      title: '确认删除',
      message: `确定要删除服务器上的项目「${item.projectName}」吗？此操作不可撤销。`,
      type: 'warning',
    });
    if (!confirmed) return;

    setIsLoading(true);

    try {
      const result = await deleteProject(syncKey, item.serverFile.id || item.projectId);
      if (result.success) {
        // 从列表中移除该项
        const newConflicts = conflicts.filter((_, i) => i !== index);
        setConflicts(newConflicts);
        if (newConflicts.length === 0) {
          dialog.toast({ message: '没有需要同步的项目', type: 'info' });
          handleClose();
        }
      } else {
        dialog.toast({ message: result.error || '删除失败', type: 'error' });
      }
    } catch (err) {
      dialog.toast({ message: err instanceof Error ? err.message : '删除失败', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const getSyncDirection = (item: ConflictItem): 'upload' | 'download' => {
    if (item.action === 'upload' || item.action === 'conflict') {
      return 'upload';
    } else {
      return 'download';
    }
  };

  const handleConfirmSync = () => {
    // 获取所有已选择的项目
    const itemsWithAction = conflicts.filter(item => item.action !== null);

    if (itemsWithAction.length === 0) {
      dialog.toast({ message: '请至少选择一个操作', type: 'warning' });
      return;
    }
    executeSync(itemsWithAction);
  };

  const handleClose = () => {
    setIsInitialized(false);
    setInitError('');
    setSyncKey('');
    setConflicts([]);
    setServerFiles([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-800 border border-slate-600 w-full max-w-2xl max-h-[85vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="h-16 px-6 border-b border-slate-600 flex items-center justify-between shrink-0 bg-slate-600/80">
          <h3 className="text-lg font-bold text-slate-50 flex items-center gap-2">
            <Cloud className="w-5 h-5 text-slate-400" />
            数据同步
            <p className="text-[12px] text-slate-400 mt-1">同步项目数据到云端服务器</p>
          </h3>
          <button onClick={onClose} className="p-2 bg-slate-700 hover:bg-slate-800 rounded-full transition-colors cursor-pointer">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Input Section */}
          <div className="flex-1 overflow-y-auto md:p-6 p-2 bg-slate-700 space-y-5">
            <div className="space-y-4">
              <label className="block text-[12px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                同步密钥（可选，同步密钥用于标识您的账户。留空则服务器会自动生成并保存到本地。）
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={syncKey}
                  onChange={(e) => setSyncKey(e.target.value)}
                  placeholder="留空则自动生成新的同步密钥"
                  className="flex-1 bg-slate-800 border border-slate-600 text-slate-50 px-4 py-2 text-sm rounded-lg focus:border-slate-500 focus:outline-none transition-all font-mono placeholder:text-slate-400"
                />
                <button
                  onClick={handleStartSync}
                  disabled={isLoading}
                className="py-2 px-6 bg-slate-800 text-slate-300 font-bold uppercase tracking-widest text-xs rounded-lg hover:bg-slate-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>连接</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4" />
                      <span>同步</span>
                    </div>
                  )}
                </button>
              </div>
            </div>
          </div>

        {/* File List Section */}
        <div className="p-2 md:p-6 pt-0 md:pt-0 space-y-5 flex-1 overflow-y-auto bg-slate-700">
            {initError && (
              <div className="bg-red-900/30 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm">
                {initError}
              </div>
            )}
            <div className="max-h-[50vh] overflow-y-auto">
              <div className="space-y-2">
                {conflicts.map((item, index) => {
                  const isLocalOnly = !item.serverFile || !item.serverFile.lastModified;
                  const isServerOnly = !item.localProject && !item.localSeries;
                  const isLocalNew = item.conflict === 1;
                  const isServerNew = item.conflict === -1;
                  const isSame = item.conflict === 0;

                  const localTime = item.localProject 
                    ? new Date(item.localProject.lastModified) 
                    : item.localSeries 
                      ? new Date(item.localSeries.updatedAt) 
                      : null;
                  const serverTime = item.serverFile && item.serverFile.lastModified > 0 ? new Date(item.serverFile.lastModified) : null;
                  const createTime = new Date(item.createdAt);

                  // 获取状态显示
                  const getStatusLabel = () => {
                    if (isSame) return { icon: Check, label: '已同步', color: 'text-slate-400 bg-green-300' };
                    if (isLocalOnly) return { icon: ArrowUp, label: '仅本地', color: 'text-red-400 bg-red-300' };
                    if (isServerOnly) return { icon: ArrowDown, label: '仅服务器', color: 'text-purple-400 bg-purple-300' };
                    if (isLocalNew) return { icon: RefreshCw, label: '本地较新', color: 'text-green-400 bg-green-300' };
                    if (isServerNew) return { icon: RefreshCw, label: '服务器较新', color: 'text-yellow-500 bg-yellow-300' };
                    return { icon: RefreshCw, label: '未知', color: 'text-slate-500' };
                  };

                  const status = getStatusLabel();
                  const StatusIcon = status.icon;

                  return (
                    <div key={index} className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border ${
                      item.syncStatus === 'syncing' ? 'bg-slate-700/70 border-blue-500/50' :
                      item.syncStatus === 'success' ? 'bg-green-900/20 border-green-500/30' :
                      item.syncStatus === 'failed' ? 'bg-red-900/20 border-red-500/30' :
                      'bg-slate-800/50 border-slate-700/50'
                    }`}>
                      {/* 项目名称 */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-slate-50 truncate flex items-center gap-2">
                          {item.isSeries && <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[10px] rounded">剧集</span>}
                          {item.projectName}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{createTime.toLocaleString('zh-CN')}</div>
                      </div>

                      {/* 更新时间和状态 */}
                      <div className="flex items-center gap-3 sm:w-[200px]">
                        <div className="flex-1 text-slate-400 font-mono text-sm">
                          <div className="text-[10px] flex items-center gap-1">
                            <ArrowUp className="w-3 h-3" />
                            <span>{localTime ? localTime.toLocaleString('zh-CN') : '-'}</span>
                          </div>
                          <div className="text-[10px] flex items-center gap-1 mt-1">
                            <ArrowDown className="w-3 h-3" />
                            <span>{serverTime ? serverTime.toLocaleString('zh-CN') : '-'}</span>
                          </div>
                        </div>
                        <div className={`p-1.5 rounded-full border ${status.color} border-slate-600 shrink-0`}>
                          <StatusIcon className="w-4 h-4" />
                        </div>
                      </div>

                      {/* 操作按钮 / 同步状态 */}
                      <div className="flex gap-1 shrink-0 items-end justify-end min-w-[120px]">
                        {item.syncStatus === 'syncing' ? (
                          <div className="flex items-center gap-2 text-blue-400 text-[11px]">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>同步中...</span>
                          </div>
                        ) : item.syncStatus === 'success' ? (
                          <div className="flex items-center gap-2 text-green-400 text-[11px]">
                            <Check className="w-4 h-4" />
                            <span>已完成</span>
                          </div>
                        ) : item.syncStatus === 'failed' ? (
                          <div className="flex items-center gap-2 text-red-400 text-[11px]">
                            <X className="w-4 h-4" />
                            <span>失败</span>
                          </div>
                        ) : (
                          <>
                            {isServerOnly ? (
                              <button
                                onClick={() => handleDeleteProject(index)}
                                disabled={isLoading}
                                className="py-1.5 px-3 rounded text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1 border border-slate-400 bg-slate-600 text-slate-500 hover:bg-slate-700"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span className="hidden sm:inline">删除</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSetAction(index, item.action === 'upload' || item.action === 'conflict' ? null : 'upload')}
                                className={`py-1.5 px-3 rounded text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1 ${
                                  item.action === 'upload' || item.action === 'conflict'
                                    ? 'bg-red-900/40 text-red-800 border border-red-900/50'
                                    : 'bg-slate-600 text-slate-500 border border-slate-400 hover:bg-slate-700'
                                }`}
                              >
                                <ArrowUp className="w-3 h-3" />
                                <span className="hidden sm:inline">上传</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleSetAction(index, item.action === 'download' ? null : 'download')}
                              disabled={isLocalOnly}
                              className={`py-1.5 px-3 rounded text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1 ${
                                item.action === 'download'
                                  ? 'bg-green-900/40 text-green-800 border border-green-900/50'
                                  : 'bg-slate-600 text-slate-500 border border-slate-400 hover:bg-slate-700'
                              }`}
                            >
                              <ArrowDown className="w-3 h-3" />
                              <span className="hidden sm:inline">下载</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
        </div>

        <div className="px-6 py-2 border-t border-slate-600 flex items-center justify-between gap-3 shrink-0 bg-slate-600/80">
          <div className="flex items-start gap-2 text-slate-400 text-[12px] flex-col">
            <div>发现 {conflicts.length} 个项目需要同步</div>
            <div>已选择 {conflicts.filter(i => i.action !== null).length} / {conflicts.length}</div>
          </div>
          <button
            onClick={handleConfirmSync}
            disabled={!isInitialized || conflicts.filter(i => i.action !== null).length === 0 || isLoading}
            className="py-3 px-6 bg-slate-800 text-slate-300 font-bold uppercase tracking-widest text-xs rounded-lg hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>确认同步</span>
          </button>
        </div>
        </div>
      </div>
  );
};

export default SyncModal;
