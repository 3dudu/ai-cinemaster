import { CheckCircle, Save } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Dashboard from './components/Dashboard';
import { DialogProvider } from './components/dialog';
import ApiKeyModal from './components/modals/ApiKeyModal'; // 新增
import SeriesManagerModal from './components/modals/SeriesManagerModal';
import Sidebar from './components/Sidebar';
import SidebarMobile from './components/SidebarMobile';
import StageAssets from './components/StageAssets';
import StageDirector from './components/StageDirector';
import StageExport from './components/StageExport';
import StageImage from './components/StageImage';
import StageScript from './components/StageScript';
import StageSegments from './components/StageSegments';
import { initializeCozeConfig } from './services/modelproviders/cozeService';
import { ModelService } from './services/modelService';
import { loadSeriesFromDB, saveProjectToDB, saveSeriesToDB } from './services/storageService';
import { ProjectState, SeriesRecord } from './types';

function App() {
  const [project, setProject] = useState<ProjectState | null>(null);
  const [series, setSeries] = useState<SeriesRecord | null>(null); // Series state for episode mode
  const [apiKey, setApiKey] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMd, setIsMd] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showSeriesManager, setShowSeriesManager] = useState(false);

  // Ref to hold debounce timer
  const saveTimeoutRef = useRef<any>(null);

  // Check if currently in series episode mode
  const isSeriesMode = useMemo(() => {
    return !!series && !!project?.seriesRefId;
  }, [series, project]);

  // Load API Key from localStorage on mount
  useEffect(() => {
    const storedKey = localStorage.getItem('cinegen_api_key');
    if (storedKey) {
      setApiKey(storedKey);
      ModelService.setApiKey('doubao', storedKey);
    }
    // Initialize Coze service config
    initializeCozeConfig();
    // Initialize ModelService (包括MinIO)
    ModelService.initialize().catch(err => {
      console.error('ModelService初始化失败:', err);
    });

    // 定义媒体查询
    let mdQuery = window.matchMedia('(max-width: 768px)');
    let lgQuery = window.matchMedia('(min-width: 1280px)');
    // 更新状态的函数
    const updateBreakpoints = () => {

      // 定义媒体查询
      mdQuery = window.matchMedia('(max-width: 768px)');
      lgQuery = window.matchMedia('(min-width: 1280px)');
      ////console.log('md (mobile):', mdQuery.matches);
      ////console.log('lg (desktop):', lgQuery.matches);
      setIsMobile(mdQuery.matches);
      setIsMd(!lgQuery.matches);
    };

    // 初始化执行+添加监听
    updateBreakpoints();
    mdQuery.addListener(updateBreakpoints);
    lgQuery.addListener(updateBreakpoints);

    // 卸载移除监听
    return () => {
      mdQuery.removeListener(updateBreakpoints);
      lgQuery.removeListener(updateBreakpoints);
    };
  }, []);

  // Auto-save logic
  useEffect(() => {
    if (!project) return;

    setSaveStatus('unsaved');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await saveProjectToDB(project);
        setSaveStatus('saved');
      } catch (e) {
        console.error("Auto-save failed", e);
      }
    }, 1000); // Debounce 1s

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [project]);

  const handleSaveKey = (newKey: string) => {
    if (!newKey.trim()) return;
    setApiKey(newKey);
    ModelService.setApiKey('doubao', newKey);
  };

  const updateProject = (updates: Partial<ProjectState>) => {
    if (!project) return;
    setProject(prev => prev ? ({ ...prev, ...updates }) : null);
    ModelService.setCurrentProjectProviders(project?.modelProviders);
  };

  const updateSeries = (updatedSeries: SeriesRecord) => {
    setSeries(updatedSeries);
    // Auto-save series
    saveSeriesToDB(updatedSeries).catch(err => {
      console.error('Failed to auto-save series:', err);
    });
  };

  const setStage = (stage: 'script' | 'assets' | 'director' | 'segments' | 'export') => {
    updateProject({ stage });
  };

  const handleOpenProject = async (proj: ProjectState) => {
    // 设置项目的模型供应商配置
    setProject(proj);
    ModelService.setCurrentProjectProviders(proj.modelProviders);
    // If project belongs to a series, load the series
    if (proj.seriesRefId) {
      try {
        const loadedSeries = await loadSeriesFromDB(proj.seriesRefId);
        setSeries(loadedSeries);
      } catch (err) {
        console.error('Failed to load series:', err);
        setSeries(null);
      }
    } else {
      setSeries(null);
    }
  };

  const handleClearKey = () => {
      localStorage.removeItem('cinegen_api_key');
      setApiKey('');
      ModelService.setApiKey('doubao', '');
      setProject(null);
  };

  const handleExitProject = async () => {
    // Force save before exiting
    if (project) {
        await saveProjectToDB(project);
    }
    // Save series if in series mode
    if (series) {
        // Update currentEpisodeId before saving
        if (project?.seriesRefId === series.id) {
            const updatedSeries = { ...series, currentEpisodeId: project.id };
            await saveSeriesToDB(updatedSeries);
        } else {
            await saveSeriesToDB(series);
        }
    }
    // 清除项目供应商配置
    ModelService.setCurrentProjectProviders(null);
    setProject(null);
    setSeries(null);
  };

  const renderStage = () => {
    if (!project) return null;
    switch (project.stage) {
      case 'script':
        return (
          <StageScript 
            project={project} 
            updateProject={updateProject} 
            isMobile={isMobile}
            series={series}
            updateSeries={updateSeries}
          />
        );
      case 'assets':
        return (
          <StageAssets 
            project={project} 
            updateProject={updateProject}
            series={series}
            updateSeries={updateSeries}
          />
        );
      case 'director':
        return (
          <StageDirector
            project={project}
            updateProject={updateProject}
            isMobile={isMobile}
            series={series}
            updateSeries={updateSeries}
          />
        );
      case 'segments':
        return (
          <StageSegments
            project={project}
            updateProject={updateProject}
            isMobile={isMobile}
            series={series}
            updateSeries={updateSeries}
          />
        );
      case 'export':
        return <StageExport project={project} updateProject={updateProject} />;
      case 'images':
        return <StageImage project={project} updateProject={updateProject} />;
      default:
        return <div className="text-slate-50">未知阶段</div>;
    }
  };

  // API Key Entry Screen (Industrial Design)
  if (!apiKey) {
    return (
      <DialogProvider>
        <div className="h-screen bg-slate-900 flex items-center justify-center p-8 relative overflow-hidden">
          {/* Background Accents */}
          <div className="absolute top-0 right-0 p-64 bg-slate-900/5 blur-[150px] rounded-full pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 p-48 bg-slate-900/10 blur-[120px] rounded-full pointer-events-none"></div>

          <ApiKeyModal
            isOpen={true}
            onClose={() => {}}
            onSave={handleSaveKey}
          />
        </div>
      </DialogProvider>
    );
  }

  // Dashboard View
  if (!project) {
    return (
      <DialogProvider>
        <Dashboard onOpenProject={handleOpenProject} isMobile={isMobile} onClearKey={handleClearKey} />
      </DialogProvider>
    );
  }

  // Workspace View
  return (
    <DialogProvider>
      <div className={`${isMobile?'':'flex'} h-screen overflow-hidden bg-slate-600 min-h-screen font-sans text-slate-50`} style={{paddingTop: 'env(safe-area-inset-top)'}}>
        {isMobile ? (
          <>
            <SidebarMobile
              currentStage={project.stage}
              setStage={setStage}
              onExit={handleExitProject}
              onOpenSettings={() => setShowSettings(true)}
              projectName={project.title}
              project={project}
              updateProject={updateProject}
              isSeriesMode={isSeriesMode}
              onOpenSeriesManager={() => setShowSeriesManager(true)}
              serieName={series?.title}
            />
          </>
        ) : (
          <>
            <Sidebar
              currentStage={project.stage}
              setStage={setStage}
              onExit={handleExitProject}
              onOpenSettings={() => setShowSettings(true)}
              onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
              collapsed={isMd||sidebarCollapsed}
              projectName={project.title}
              project={project}
              updateProject={updateProject}
              isSeriesMode={isSeriesMode}
              onOpenSeriesManager={() => setShowSeriesManager(true)}
              serieName={series?.title}
            />
          </>
        )}

        {/* Series Manager Modal */}
        {series && (
          <SeriesManagerModal
            isOpen={showSeriesManager}
            onClose={() => setShowSeriesManager(false)}
            series={series}
            onSeriesUpdate={setSeries}
            onSwitchEpisode={handleOpenProject}
            isMobile={isMobile}
          />
        )}

      <main className={`transition-allduration-300 ease-in-out ${isMobile ? 'ml-0' : (sidebarCollapsed ? 'ml-20' : 'xl:ml-72 ml-20')} flex-1 h-screen overflow-hidden relative`}
      style={ isMobile ? { paddingBottom: 'calc(112px + env(safe-area-inset-top))'} : {}}>
        {renderStage()}
        {showSettings && (
          <>
  <ApiKeyModal
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            onSave={handleSaveKey}
          />
        {/* Save Status Indicator */}
        <div className="relative top-4 right-6 pointer-events-none opacity-50 flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-700/50 px-2 py-1 rounded-full backdrop-blur-sm z-50">
           {saveStatus === 'saving' ? (
             <>
               <Save className="w-3 h-3 animate-pulse" />
               保存中...
             </>
           ) : (
             <>
               <CheckCircle className="w-3 h-3 text-green-500" />
               已保存
             </>
           )}
        </div>
        </>
        )}
      </main>
      
      </div>
    </DialogProvider>
  );
}

export default App;
