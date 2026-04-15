import { ModelService } from '@/services/modelService';
import { AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Clock, Copy, Database, Eye, Film, Image, Link, Loader2, MessageSquare, Mic, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { addMediaHistory, clearOldLLMLogs, countLLMLogs, deleteLLMLog, getLLMLog, getLLMLogStats, LLMLogStats, loadProjectFromDB, queryLLMLogs, saveProjectToDB } from '../../services/storageService';
import { LLMCallLog, ProjectState } from '../../types';
import { uploadFileToService } from '../../utils/fileUploadUtils';
import CustomSelect from '../common/CustomSelect';
import { useDialog } from '../dialog';


interface Props {
  isOpen: boolean;
  onClose: () => void;
  isMobile?: boolean;
  project?: ProjectState;
  updateProject?: (updates: Partial<ProjectState>) => void;
}

const MODEL_TYPE_OPTIONS = [
  { value: '', label: '全部类型' },
  { value: 'llm', label: '大语言' },
  { value: 'text2image', label: '文生图' },
  { value: 'image2video', label: '图生视频' },
  { value: 'tts', label: '语音合成' },
  { value: 'stt', label: '语音识别' }
];

const SUCCESS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'true', label: '成功' },
  { value: 'false', label: '失败' }
];

const TIME_RANGE_OPTIONS = [
  { value: 'all', label: '全部时间' },
  { value: 'today', label: '今天' },
  { value: '7days', label: '最近7天' },
  { value: '30days', label: '最近30天' },
  { value: '90days', label: '最近90天' }
];

const CLEAR_OPTIONS = [
  { value: '7', label: '7天前' },
  { value: '30', label: '30天前' },
  { value: '90', label: '90天前' },
  { value: 'all', label: '全部日志' }
];

const PAGE_SIZE = 20;

// 模型类型颜色样式
const getModelTypeStyles = (modelType: LLMCallLog['modelType']) => {
  const styles = {
    llm: { text: 'text-green-400', bg: 'bg-green-900/60', border: 'border-green-500/30', icon: MessageSquare },
    text2image: { text: 'text-orange-400', bg: 'bg-orange-900/60', border: 'border-orange-500/30', icon: Image },
    image2video: { text: 'text-purple-400', bg: 'bg-purple-900/60', border: 'border-purple-500/30', icon: Film },
    tts: { text: 'text-blue-400', bg: 'bg-blue-900/60', border: 'border-blue-500/30', icon: Mic },
    stt: { text: 'text-yellow-400', bg: 'bg-yellow-900/60', border: 'border-yellow-500/30', icon: Mic }
  };
  return styles[modelType] || styles.llm;
};

// 格式化时间
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

// 格式化持续时间
const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
};

// JSON 格式化显示
const JsonDisplay: React.FC<{ data: any; maxHeight?: string }> = ({ data, maxHeight = '200px' }) => {
  const [expanded, setExpanded] = useState(false);
  const jsonStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  
  return (
    <div className="relative">
      <pre 
        className={`text-xs text-slate-300 bg-slate-900 p-3 rounded-lg overflow-auto font-mono ${expanded ? '' : maxHeight}`}
        style={{ maxHeight: expanded ? 'none' : maxHeight }}
      >
        {jsonStr}
      </pre>
      
      <button
        onClick={() => navigator.clipboard.writeText(jsonStr)}
        className="absolute bottom-2 right-12 text-xs text-indigo-400 hover:text-indigo-300"
      >
        复制
      </button>
      <button
        onClick={() => setExpanded(!expanded)}
        className="absolute bottom-2 right-2 text-xs text-indigo-400 hover:text-indigo-300"
      >
        {expanded ? '收起' : '展开'}
      </button>
    </div>
  );
};

const LLMLogsModal: React.FC<Props> = ({ isOpen, onClose, isMobile = false, project, updateProject }) => {
  const dialog = useDialog();
  const [logs, setLogs] = useState<LLMCallLog[]>([]);
  const [stats, setStats] = useState<LLMLogStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  
  // 筛选条件
  const [timeRange, setTimeRange] = useState('all');
  const [modelType, setModelType] = useState('');
  const [successFilter, setSuccessFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // 详情弹窗
  const [selectedLog, setSelectedLog] = useState<LLMCallLog | null>(null);
  
  // 清理选项
  const [clearOption, setClearOption] = useState('30');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // 刷新任务状态
  const [refreshingTaskId, setRefreshingTaskId] = useState<string | null>(null);
  const [associatingUrl, setAssociatingUrl] = useState<string | null>(null);

  // 将结果URL关联到Shot或Segment
  const handleAssociateUrl = async (log: LLMCallLog) => {
    if (!log.resultUrl || !log.projectId) {
      dialog.toast({ message: '缺少必要信息：结果URL或项目ID', type: 'error' });
      return;
    }

    const confirmed = await dialog.confirm({
      title: '关联视频URL',
      message: `确定要将此视频URL关联到项目中的${log.shotId ? '镜头' : '片段'}吗？这将覆盖现有视频。`,
      type: 'warning'
    });
    if (!confirmed) return;

    setAssociatingUrl(log.id);
    try {
      // 先将外部 URL 转换成本地服务器文件
      let finalUrl = log.resultUrl;
      const fileType = `${log.projectId}/video/${log.shotId || 'unknown'}`

      try {
        const uploadResponse = await uploadFileToService({
          fileType,
          fileUrl: log.resultUrl
        });

        if (uploadResponse.success && uploadResponse.data?.fileUrl) {
          finalUrl = uploadResponse.data.fileUrl;
        } else {
          console.warn(`文件上传失败: ${uploadResponse.error}，使用原始URL`);
        }
      } catch (uploadError) {
        console.warn(`文件上传出错:`, uploadError, '，使用原始URL');
      }

      // 判断是否更新当前打开的项目
      const isCurrentProject = project && project.id === log.projectId;
      const targetProject = isCurrentProject ? project : await loadProjectFromDB(log.projectId);

      if (!targetProject) {
        dialog.toast({ message: '未找到项目', type: 'error' });
        return;
      }

      let updated = false;
      const segments = targetProject.segments || [];

      // 先尝试从 segments 中查找匹配的 segment（shotId 可能是 segmentId）
      const matchingSegment = segments.find(seg => seg.id === log.shotId);
      if (matchingSegment) {
        const updatedSegments = segments.map((seg) =>
          seg.id === log.shotId ? { ...seg, videoUrl: finalUrl } : seg
        );
        await saveProjectToDB({ ...targetProject, segments: updatedSegments });

        // 通知其他组件刷新
        if (isCurrentProject && updateProject) {
          updateProject({ segments: updatedSegments });
        }

        updated = true;
        const fileName = `Segment_${log.shotId}_video`;
        await addMediaHistory(targetProject.id, finalUrl, fileName, 'video', 'video',log.requestParams.content[0].text);
        dialog.toast({ message: `已关联到片段 ${matchingSegment.name || matchingSegment.id}`, type: 'success' });
      } else {
        // 如果在 segments 中没找到，再尝试关联到 Shot.interval.videoUrl
        const updatedShots = targetProject.shots.map((shot) => {
          if (shot.id === log.shotId) {
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

          // 通知其他组件刷新
          if (isCurrentProject && updateProject) {
            updateProject({ shots: updatedShots });
          }

          const fileName = `Shot_${log.shotId}_video`;
          await addMediaHistory(targetProject.id, finalUrl, fileName, 'video', 'video',log.requestParams.content[0].text);
          dialog.toast({ message: `已关联到镜头 ${log.shotId}`, type: 'success' });
        } else {
          dialog.toast({ message: '未找到对应镜头', type: 'warning' });
        }
      }
    } catch (error: any) {
      console.error('Failed to associate URL:', error);
      dialog.toast({ message: `关联失败: ${error.message}`, type: 'error' });
    } finally {
      setAssociatingUrl(null);
    }
  };

  // 手动刷新异步任务状态
  const handleRefreshTaskStatus = async (log: LLMCallLog) => {
    if (!log.taskId || !log.provider) return;

    setRefreshingTaskId(log.id);
    try {
      // 目前只支持 doubao provider
      if (log.provider === 'doubao' || log.provider === 'yunwu') {
        
        const provider = await ModelService.getImage2VideoConfigByProvider(log.provider);
        const result = (await ModelService.getProviderModule('doubao')).fetchVideoTaskStatus(log.taskId, log.id);

        if (result.status === 'complesucceededted' && result.content?.videoUrl) {
          dialog.toast({ message: '任务已完成，视频URL已更新', type: 'success' });
        } else if (result.status === 'failed') {
          dialog.toast({ message: `任务失败: ${result.error}`, type: 'error' });
        } else {
          dialog.toast({ message: '任务仍在处理中...', type: 'info' });
        }
      } else {
        dialog.toast({ message: `暂不支持 ${log.provider} 的手动刷新`, type: 'warning' });
      }

      // 刷新列表
      loadLogs();

      // 如果当前正在查看详情，也更新详情
      if (selectedLog?.id === log.id) {
        const updatedLog = await getLLMLog(log.id);
        if (updatedLog) {
          setSelectedLog(updatedLog);
        }
      }
    } catch (error: any) {
      console.error('Failed to refresh task status:', error);
      dialog.toast({ message: `刷新失败: ${error.message}`, type: 'error' });
    } finally {
      setRefreshingTaskId(null);
    }
  };

  // 计算时间范围
  const getTimeRange = useCallback(() => {
    const now = Date.now();
    switch (timeRange) {
      case 'today':
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        return { startTime: todayStart.getTime(), endTime: now };
      case '7days':
        return { startTime: now - 7 * 24 * 60 * 60 * 1000, endTime: now };
      case '30days':
        return { startTime: now - 30 * 24 * 60 * 60 * 1000, endTime: now };
      case '90days':
        return { startTime: now - 90 * 24 * 60 * 60 * 1000, endTime: now };
      default:
        return {};
    }
  }, [timeRange]);

  // 加载日志
  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const timeFilter = getTimeRange();
      const filter: any = {
        ...timeFilter,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE
      };
      
      if (modelType) filter.modelType = modelType;
      if (successFilter) filter.success = successFilter === 'true';
      
      const [logsResult, countResult, statsResult] = await Promise.all([
        queryLLMLogs(filter),
        countLLMLogs(filter),
        getLLMLogStats(timeFilter)
      ]);
      
      // 如果有搜索词，过滤结果
      let filteredLogs = logsResult;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredLogs = logsResult.filter(log => 
          log.provider.toLowerCase().includes(term) ||
          log.modelId.toLowerCase().includes(term) ||
          log.taskId?.toLowerCase().includes(term) ||
          log.errorMessage?.toLowerCase().includes(term)
        );
      }
      
      setLogs(filteredLogs);
      setTotalCount(countResult);
      setStats(statsResult);
    } catch (error) {
      console.error('Failed to load logs:', error);
      dialog.toast({ message: '加载日志失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, modelType, successFilter, timeRange, searchTerm, getTimeRange, dialog]);

  useEffect(() => {
    if (isOpen) {
      loadLogs();
    }
  }, [isOpen, loadLogs]);

  // 清理旧日志
  const handleClearLogs = async () => {
    try {
      let deletedCount = 0;
      if (clearOption === 'all') {
        const allLogs = await queryLLMLogs({});
        deletedCount = allLogs.length;
        for (const log of allLogs) {
          await deleteLLMLog(log.id);
        }
      } else {
        const days = parseInt(clearOption);
        deletedCount = await clearOldLLMLogs(Date.now() - days * 24 * 60 * 60 * 1000);
      }
      
      dialog.toast({ message: `已清理 ${deletedCount} 条日志`, type: 'success' });
      setShowClearConfirm(false);
      setPage(1);
      loadLogs();
    } catch (error) {
      console.error('Failed to clear logs:', error);
      dialog.toast({ message: '清理日志失败', type: 'error' });
    }
  };

  // 删除单条日志
  const handleDeleteLog = async (id: string) => {
    const confirmed = await dialog.confirm({
      title: '删除确认',
      message: '确定要删除这条日志吗？',
      type: 'warning'
    });
    
    if (!confirmed) return;
    
    try {
      await deleteLLMLog(id);
      dialog.toast({ message: '删除成功', type: 'success' });
      loadLogs();
    } catch (error) {
      console.error('Failed to delete log:', error);
      dialog.toast({ message: '删除失败', type: 'error' });
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl overflow-hidden w-full max-w-5xl h-[85vh] flex flex-col select-text">
        {/* Header */}
        <div className="h-14 px-4 md:px-6 border-b border-slate-600 flex items-center justify-between bg-slate-700/80 shrink-0">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-bold text-slate-50">API 调用日志</h3>
            {stats && (
              <span className="text-xs text-slate-400 bg-slate-600 px-2 py-0.5 rounded-full">
                {stats.totalLogs} 条记录
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-full text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-2 md:p-4 border-b border-slate-700 bg-slate-800/50 shrink-0">
          <div className="flex flex-wrap gap-2 items-center">
            {/* 搜索 */}
            <div className="relative flex-1 min-w-[150px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜索供应商/模型/任务ID..."
                className="w-full bg-slate-700 border border-slate-600 text-slate-200 pl-9 pr-3 py-2 text-sm rounded-lg focus:border-indigo-500 focus:outline-none"
              />
            </div>
            {/* 时间范围 */}
            <div className="w-28">
              <CustomSelect
                options={TIME_RANGE_OPTIONS}
                value={timeRange}
                onChange={setTimeRange}
                placeholder="时间范围"
              />
            </div>
            
            {/* 模型类型 */}
            <div className="w-28">
              <CustomSelect
                options={MODEL_TYPE_OPTIONS}
                value={modelType}
                onChange={setModelType}
                placeholder="模型类型"
              />
            </div>
            
            {/* 状态 */}
            <div className="w-28">
              <CustomSelect
                options={SUCCESS_OPTIONS}
                value={successFilter}
                onChange={setSuccessFilter}
                placeholder="状态"
              />
            </div>
            
            {/* 刷新 */}
            <button
              onClick={loadLogs}
              disabled={loading}
              className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              title="刷新"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            
            {/* 清理 */}
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-1 px-2 py-2 bg-slate-700 hover:bg-red-200 text-red-400 hover:text-red-800 text-[10px] rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              清理
            </button>
          </div>
          
          {/* 统计信息 */}
          {stats && stats.totalLogs > 0 && (
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                成功: {stats.successCount}
              </span>
              <span className="flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                失败: {stats.failedCount}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                平均耗时: {formatDuration(stats.avgDuration)}
              </span>
            </div>
          )}
        </div>

        {/* Log List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <Database className="w-12 h-12 mb-4" />
              <p>暂无日志记录</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {logs.map((log) => {
                const typeStyles = getModelTypeStyles(log.modelType);
                const TypeIcon = typeStyles.icon;
                
                return (
                  <div 
                    key={log.id} 
                    className="p-2 md:p-4 hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* 左侧信息 */}
                      <div className="flex-1 min-w-0">
                        {/* 标题行 */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${typeStyles.bg} ${typeStyles.text} ${typeStyles.border} border`}>
                            <TypeIcon className="w-3 h-3" />
                            {log.modelType}
                          </span>
                          <span className="text-sm font-medium text-slate-200">{log.provider}</span>
                          <span className="text-xs text-slate-500 font-mono">{log.modelId}</span>
                          
                          {/* 状态标记 */}
                          {log.success ? (
                            <span className="flex items-center gap-1 text-xs text-green-400">
                              <CheckCircle className="w-3.5 h-3.5" />
                              成功
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-red-400">
                              <AlertCircle className="w-3.5 h-3.5" />
                              失败
                            </span>
                          )}
                          
                          {/* 异步任务标记 */}
                          {log.isAsyncTask && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              log.taskStatus === 'completed' ? 'bg-green-900/50 text-green-400' :
                              log.taskStatus === 'failed' ? 'bg-red-900/50 text-red-400' :
                              'bg-yellow-900/50 text-yellow-400'
                            }`}>
                              {log.taskStatus === 'completed' ? '已完成' :
                               log.taskStatus === 'failed' ? '已失败' :
                               log.taskStatus === 'processing' ? '处理中' : '等待中'}
                            </span>
                          )}
                        </div>
                        
                        {/* 详情行 */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 mb-2">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(log.requestTime)}
                          </span>
                          <span>耗时: {formatDuration(log.duration)}</span>
                          {log.taskId && (
                            <span className="font-mono text-slate-500">
                              任务ID: {log.taskId.substring(0, 12)}...
                            </span>
                          )}
                          {log.pollCount !== undefined && log.pollCount > 0 && (
                            <span>轮询: {log.pollCount}次</span>
                          )}
                        </div>
                        
                        {/* 错误信息 */}
                        {log.errorMessage && (
                          <div className="text-xs text-red-400 bg-red-900/30 px-2 py-1 rounded truncate">
                            {log.errorMessage}
                          </div>
                        )}
                        
                        {/* 关联ID */}
                        <div className="flex flex-wrap gap-2 mt-2 text-xs text-slate-500">
                          {log.seriesId && <span>连续剧: {log.seriesId.substring(0, 8)}...</span>}
                          {log.projectId && <span>剧集: {log.projectId.substring(0, 8)}...</span>}
                          {log.shotId && <span>镜头: {log.shotId.substring(0, 8)}...</span>}
                        </div>
                      </div>
                      
                      {/* 右侧操作 */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* 异步任务刷新按钮 - 仅限超过20分钟的pending/processing任务 */}
                        {log.isAsyncTask && log.taskId && (log.taskStatus === 'pending' || log.taskStatus === 'processing' || log.taskStatus === 'failed') && (Date.now() - log.requestTime > 20 * 60 * 1000) && (
                          <button
                            onClick={() => handleRefreshTaskStatus(log)}
                            disabled={refreshingTaskId === log.id}
                            className="p-2 hover:bg-indigo-900/50 text-indigo-400 hover:text-indigo-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            title="刷新任务状态"
                          >
                            {refreshingTaskId === log.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-2 hover:bg-slate-600 text-slate-400 hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
                          title="查看详情"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteLog(log.id)}
                          className="p-2 hover:bg-red-900/50 text-slate-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-700 bg-slate-800/50 flex items-center justify-between shrink-0">
            <span className="text-sm text-slate-400">
              共 {totalCount} 条，第 {page}/{totalPages} 页
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-slate-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-slate-300 w-20 text-center">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-slate-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-[60] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col select-text">
            <div className="h-12 px-4 border-b border-slate-700 flex items-center justify-between bg-slate-700/50 shrink-0">
              <h4 className="text-sm font-bold text-slate-200">日志详情</h4>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 hover:bg-slate-600 text-slate-400 hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="text-slate-500 text-xs">请求时间</span>
                  <p className="text-slate-200">{formatTime(selectedLog.requestTime)}</p>
                </div>
                <div>
                  <span className="text-slate-500 text-xs">响应时间</span>
                  <p className="text-slate-200">{formatTime(selectedLog.responseTime)}</p>
                </div>
                <div>
                  <span className="text-slate-500 text-xs">耗时</span>
                  <p className="text-slate-200">{formatDuration(selectedLog.duration)}</p>
                </div>
                <div>
                  <span className="text-slate-500 text-xs">供应商</span>
                  <p className="text-slate-200">{selectedLog.provider}</p>
                </div>
                <div>
                  <span className="text-slate-500 text-xs">模型ID</span>
                  <p className="text-slate-200 font-mono text-xs">{selectedLog.modelId}</p>
                </div>
                <div>
                  <span className="text-slate-500 text-xs">API URL</span>
                  <p className="text-slate-200 font-mono text-xs truncate">{selectedLog.apiUrl}</p>
                </div>
                {selectedLog.taskId && (
                  <>
                    <div>
                      <span className="text-slate-500 text-xs">任务ID</span>
                      <p className="text-slate-200 font-mono text-xs break-all">{selectedLog.taskId}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs">任务状态</span>
                      <div className="flex items-center gap-2">
                        <p className="text-slate-200">{selectedLog.taskStatus}</p>
                        {/* 刷新按钮 - 仅限超过20分钟的pending/processing任务 */}
                        {selectedLog.isAsyncTask && (selectedLog.taskStatus === 'pending' || selectedLog.taskStatus === 'processing' || selectedLog.taskStatus === 'failed') && (Date.now() - selectedLog.requestTime > 20 * 60 * 1000) && (
                          <button
                            onClick={() => handleRefreshTaskStatus(selectedLog)}
                            disabled={refreshingTaskId === selectedLog.id}
                            className="p-1 hover:bg-indigo-900/50 text-indigo-400 hover:text-indigo-300 rounded transition-colors cursor-pointer disabled:opacity-50"
                            title="刷新任务状态"
                          >
                            {refreshingTaskId === selectedLog.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 text-xs">轮询次数</span>
                      <p className="text-slate-200">{selectedLog.pollCount || 0}</p>
                    </div>
                  </>
                )}
              </div>
              
              {/* 关联ID */}
              {(selectedLog.seriesId || selectedLog.projectId || selectedLog.shotId) && (
                <div>
                  <span className="text-slate-500 text-xs">关联ID</span>
                  <div className="flex flex-wrap gap-2 mt-1 text-xs">
                    {selectedLog.seriesId && (
                      <span className="bg-slate-700 px-2 py-1 rounded text-slate-300">
                        连续剧: {selectedLog.seriesId}
                      </span>
                    )}
                    {selectedLog.projectId && (
                      <span className="bg-slate-700 px-2 py-1 rounded text-slate-300">
                        剧集: {selectedLog.projectId}
                      </span>
                    )}
                    {selectedLog.shotId && (
                      <span className="bg-slate-700 px-2 py-1 rounded text-slate-300">
                        镜头: {selectedLog.shotId}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* 结果URL */}
              {selectedLog.resultUrl && (
                <div>
                  <span className="text-slate-500 text-xs">结果URL</span>
                  <div className="mt-1 flex items-center gap-2">
                    <a
                      href={selectedLog.resultUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-indigo-400 hover:text-indigo-300 break-all underline line-clamp-1"
                    >
                      {selectedLog.resultUrl}
                    </a>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedLog.resultUrl || '');
                        dialog.toast({ message: '已复制到剪贴板', type: 'success' });
                      }}
                      className="p-1 hover:bg-slate-600 text-slate-400 hover:text-slate-200 rounded transition-colors cursor-pointer shrink-0"
                      title="复制URL"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    {/* 关联按钮 - 仅限有projectId且为视频/图片任务 */}
                    {selectedLog.projectId && selectedLog.shotId && selectedLog.modelType === 'image2video' && (
                      <button
                        onClick={() => handleAssociateUrl(selectedLog)}
                        disabled={associatingUrl === selectedLog.id}
                        className="p-1 hover:bg-green-900/50 text-green-400 hover:text-green-300 rounded transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                        title="关联到项目"
                      >
                        {associatingUrl === selectedLog.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Link className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                  {/* 视频预览 */}
                  {selectedLog.modelType === 'image2video' && selectedLog.resultUrl && (
                    <div className="mt-2">
                      <video
                        src={selectedLog.resultUrl}
                        controls
                        className="max-w-full max-h-48 rounded-lg bg-slate-900"
                      />
                    </div>
                  )}
                  {/* 图片预览 */}
                  {selectedLog.modelType === 'text2image' && selectedLog.resultUrl && (
                    <div className="mt-2">
                      <img
                        src={selectedLog.resultUrl}
                        alt="生成结果"
                        className="max-w-full max-h-48 rounded-lg"
                      />
                    </div>
                  )}
                </div>
              )}
              
              {/* 请求参数 */}
              <div>
                <span className="text-slate-500 text-xs">请求参数</span>
                <JsonDisplay data={selectedLog.requestParams} />
              </div>
              
              {/* 响应数据 */}
              {selectedLog.response && (
                <div>
                  <span className="text-slate-500 text-xs">响应数据</span>
                  <JsonDisplay data={selectedLog.response} />
                </div>
              )}
              
              {/* 错误信息 */}
              {selectedLog.errorMessage && (
                <div>
                  <span className="text-red-400 text-xs">错误信息</span>
                  <div className="mt-1 text-sm text-red-400 bg-red-900/30 p-3 rounded-lg">
                    {selectedLog.errorMessage}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Clear Confirm Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[60] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-md p-6">
            <h4 className="text-lg font-bold text-slate-200 mb-4">清理日志</h4>
            
            <div className="mb-4">
              <label className="text-sm text-slate-400 mb-2 block">选择清理范围</label>
              <CustomSelect
                options={CLEAR_OPTIONS}
                value={clearOption}
                onChange={setClearOption}
                placeholder="选择范围"
              />
            </div>
            
            <p className="text-sm text-slate-400 mb-6">
              {clearOption === 'all' 
                ? '将删除所有日志记录，此操作不可恢复。'
                : `将删除 ${clearOption} 天前的所有日志记录。`}
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2 bg-slate-700 text-slate-300 hover:bg-slate-600 rounded-lg transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleClearLogs}
                className="flex-1 py-2 bg-red-600 text-white hover:bg-red-500 rounded-lg transition-colors cursor-pointer"
              >
                确认清理
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LLMLogsModal;
