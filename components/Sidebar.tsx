import { Aperture, ChevronLeft, Clapperboard, Edit, FileText, Film, Github as GithubIcon, Image, PanelLeft, PanelRight, Settings, Sparkles, Type, Users } from 'lucide-react';
import React, { useState } from 'react';
import { ProjectState } from '../types';
import ImageSelectorModal from './ImageSelectorModal';
import ModalSettings from './ModalSettings';
import ProjectSettingsModal from './ProjectSettingsModal';
import PromptTemplateModal from './PromptTemplateModal';
import { ThemeToggle } from './ThemeToggle';

interface Props {
  project: ProjectState;
  updateProject: (updates: Partial<ProjectState>) => void;
}

interface SidebarProps {
  currentStage: string;
  setStage: (stage: 'script' | 'assets' | 'director' | 'export') => void;
  onExit: () => void;
  onOpenSettings: () => void;
  onToggleSidebar: () => void;
  collapsed?: boolean;
  projectName?: string;
  project?: ProjectState;
  updateProject?: (updates: Partial<ProjectState>) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentStage, setStage, onExit, onOpenSettings, onToggleSidebar, collapsed = false, projectName, project, updateProject }) => {
  const [showModelSettings, setShowModelSettings] = useState(false);
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [showImageBrowser, setShowImageBrowser] = useState(false);
  const [showPromptTemplates, setShowPromptTemplates] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  const navItems = [
    { id: 'script', label: '剧本与故事', icon: FileText, sub: '制作脚本' },
    { id: 'assets', label: '角色与场景', icon: Users, sub: '角色布景' },
    { id: 'director', label: '导演工作台', icon: Clapperboard, sub: '拍摄制作' },
    { id: 'export', label: '成片与导出', icon: Film, sub: '剪辑合成' },
  ];

  return (
    <aside className={`${collapsed ? 'w-20' : 'xl:w-72 md:w-20'} bg-slate-800 border-r border-slate-600 h-screen fixed left-0 top-0 flex flex-col z-50 select-none
    shadow-2xl animate-in slide-in-from-right-10 duration-300 transition-all ease-in-out`}>
      {/* Header */}
      <div className="p-6 border-b border-slate-900">
        {!collapsed ? (
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-slate-700 text-slate-50 flex items-center justify-center flex-shrink-0">
              <Aperture className="w-5 h-5" />
            </div>
            <div className="overflow-hidden">
              <h1 className="text-[16px] font-bold text-slate-50 tracking-wider uppercase">AI漫剧工场</h1>
            </div>
          </div>
        ) : (
          <div className="flex justify-center mb-4">
            <div className="w-8 h-8 bg-slate-800 text-slate-50 flex items-center justify-center flex-shrink-0">
              <Aperture className="w-5 h-5" />
            </div>
          </div>
        )}
        <button
          onClick={onExit}
          className={`flex ${collapsed ? 'flex-col' : 'flex-row'} cursor-pointer items-center gap-2 hover:scale-110 transition-transform text-slate-500 hover:text-slate-50 transition-colors text-xs font-mono uppercase tracking-wide group w-full`}
        >
          <ChevronLeft className="w-5 h-5" />
          {!collapsed && <span>返回项目列表</span>}
        </button>
      </div>

      {/* Project Status */}
      {!collapsed ? (
        <div className="px-6 py-2 border-b border-slate-900">
           <div className="text-[12px] text-slate-500 uppercase tracking-widest mb-1">当前项目</div>
           <div className=" overflow-hidden pr-2 flex items-center">
             <h1 className="text-xs font-bold text-slate-50 line-clamp-1 tracking-wide uppercase">{projectName || '未命名项目'}</h1>
           <button
                onClick={() => setShowProjectSettings(true)}
                className="text-xs font-bold text-slate-400 hover:text-slate-50 items-center gap-2 px-2 py-2 cursor-pointer"
                >
                <Edit className="w-4 h-4" />
           </button>
          </div>
        </div>
      ):(
        <div className="px-6 py-2 border-b border-slate-900 flex items-center flex-col">
          <button
                onClick={() => setShowProjectSettings(true)}
                className="text-xs font-bold text-slate-500 hover:text-slate-50 cursor-pointer"
                >
                <Edit className="w-4 h-4 group-hover:-translate-1 transition-transform" />
           </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-6 space-y-1">
        {navItems.map((item) => {
          const isActive = currentStage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setStage(item.id as any)}
              className={`w-full flex ${collapsed ? 'flex-col' : 'flex-row'} cursor-pointer flex-col items-center justify-between px-6 py-4 transition-all duration-200 group relative border-l-2 ${
                isActive
                  ? 'border-white bg-slate-700 text-slate-50 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
              }`}
              title={collapsed ? item.label : ''}
            >
              <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
                <item.icon className={`w-4 h-4 ${isActive ? 'text-slate-50' : 'text-slate-400 group-hover:text-slate-300'}`} />
                {!collapsed && <span className={`${isActive ? 'font-bold' : 'font-medium'} text-xs tracking-wider uppercase`}>{item.label}</span>}
              </div>
              {!collapsed && <span className={`text-[12px] font-mono ${isActive ? 'text-slate-400' : 'text-slate-500'}`}>{item.sub}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-900 space-y-2">
        {!collapsed ? (
          <>
          <button
            onClick={() => setShowImageBrowser(true)}
            className="flex items-center justify-between text-slate-500 hover:text-slate-50 cursor-pointer transition-colors w-full px-3 py-2 hover:bg-slate-900/30 rounded-lg"
          >
              <span className="font-mono text-[12px] uppercase tracking-widest">图片视频库</span>
              <Image className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowPromptTemplates(true)}
              className="flex items-center justify-between text-slate-500 hover:text-slate-50 cursor-pointer transition-colors w-full px-3 py-2 hover:bg-slate-900/30 rounded-lg"
            >
              <span className="font-mono text-[12px] uppercase tracking-widest">提示词模板</span>
              <Type className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowModelSettings(true)}
              className="flex items-center justify-between text-slate-500 hover:text-slate-50 cursor-pointer transition-colors w-full px-3 py-2 hover:bg-slate-900/30 rounded-lg"
            >
              <span className="font-mono text-[12px] uppercase tracking-widest">模型管理</span>
              <Sparkles className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenSettings}
              className="flex items-center justify-between text-slate-500 hover:text-slate-50 cursor-pointer transition-colors w-full px-3 py-2 hover:bg-slate-900/30 rounded-lg"
            >
              <span className="font-mono text-[12px] uppercase tracking-widest">系统设置</span>
              <Settings className="w-4 h-4" />
            </button>

            {/* 社交媒体链接 */}
            <div className="pt-2 border-t border-slate-900/50">
              <div className="flex items-center justify-center gap-3">
                {process.env.HIDE_GITHUB!='true' && (
                <a
                  href="https://github.com/3dudu/comic_master/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-500 hover:text-slate-50 transition-colors p-2 hover:bg-slate-900/30 rounded-lg"
                  title="GitHub"
                >
                  <GithubIcon className="w-4 h-4" />
                </a>
                )}
                <ThemeToggle size="sm"  />
              </div>
            </div>
          </>
        ) : (
            <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => setShowImageBrowser(true)}
            className="flex justify-center text-slate-500 hover:text-slate-50 cursor-pointer transition-colors p-2 hover:bg-slate-900/30 rounded-lg"
            title="图片视频库"
          >
            <Image className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowPromptTemplates(true)}
            className="flex justify-center text-slate-500 hover:text-slate-50 cursor-pointer transition-colors p-2 hover:bg-slate-900/30 rounded-lg"
            title="提示词模板"
          >
            <Type className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowModelSettings(true)}
            className="flex justify-center text-slate-500 hover:text-slate-50 cursor-pointer transition-colors p-2 hover:bg-slate-900/30 rounded-lg"
            title="模型管理"
          >
            <Sparkles className="w-4 h-4" />
          </button>
          <button
              onClick={onOpenSettings} title="系统设置"
              className="flex justify-center text-slate-500 hover:text-slate-50 cursor-pointer transition-colors p-2 hover:bg-slate-900/30 rounded-lg"
            >
            <Settings className="w-4 h-4" />
          </button>

          {/* 社交媒体链接 - 折叠状态 */}
          <div className="pt-2 border-t border-slate-900/50">
            <div className="flex flex-col items-center gap-2">
          {process.env.HIDE_GITHUB!='true' && (
              <a
                href="https://github.com/3dudu/comic_master/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-500 hover:text-slate-50 transition-colors p-2 hover:bg-slate-900/30 rounded-lg"
                title="GitHub"
              >
                <GithubIcon className="w-4 h-4" />
              </a>
            )}
              <ThemeToggle size="sm" />
            </div>
          </div>
          </div>
        )}
      </div>

      {/* Collapse Toggle Button */}
      <button
        onClick={onToggleSidebar}
        className="md:hidden xl:block absolute -right-3 top-20 bg-slate-800 border border-slate-600 text-slate-400 hover:text-slate-50 hover:bg-slate-700 transition-all rounded-full p-1.5 z-50 cursor-pointer"
        title={collapsed ? '展开侧边栏' : '折叠侧边栏'}
      >
        {collapsed ? <PanelRight className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
      </button>

          {/* Model Settings Modal */}
      <ModalSettings
        isOpen={showModelSettings}
        onClose={() => setShowModelSettings(false)}
      />

      {/* Prompt Template Modal */}
      <PromptTemplateModal
        isOpen={showPromptTemplates}
        onClose={() => setShowPromptTemplates(false)}
      />

      {/* Project Settings Modal */}
      <ProjectSettingsModal
        isOpen={showProjectSettings}
        onClose={() => setShowProjectSettings(false)}
        project={project}
        updateProject={updateProject}
      />

      {/* Image Browser Modal */}
      {project && (
        <ImageSelectorModal
          isOpen={showImageBrowser}
          onClose={() => setShowImageBrowser(false)}
          project={project}
          onSelectImage={(imageUrl, allImages) => {
            // 在浏览模式下，点击图片是预览而不是选择
            setPreviewImage(imageUrl);
            setPreviewImages(allImages || []);
            setPreviewIndex(allImages ? allImages.indexOf(imageUrl) : 0);
          }}
          filterType="all"
          previewMode={true}
          showVideo={true}
        />
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[60] bg-slate-700/95 flex items-center justify-center backdrop-blur-sm"
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
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* 图片信息 */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-900/80 text-slate-50 rounded-full text-sm">
            {previewImages.length > 1 ? `${previewIndex + 1} / ${previewImages.length}` : '预览'}
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
