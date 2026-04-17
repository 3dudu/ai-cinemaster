/**
 * CutOS 编辑器外壳 - 本地状态，无 Supabase
 * 布局、文案、动效与 CutOS 原版保持一致
 */
import { motion } from 'framer-motion';
import { Download, Loader2, Save } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { EditorProvider, useEditor } from './editor-context';
import { ExportModal } from './export-modal';
import { InspectorPanel } from './inspector-panel';
import { MediaPanel } from './media-panel';
import type { CutOSTimelineData } from './projectAdapter';
import { Timeline } from './timeline';
import { Button } from './ui/button';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './ui/resizable';
import { VideoPreview } from './video-preview';

interface EditorShellProps {
  initialData: CutOSTimelineData;
  projectTitle?: string;
  onClose: () => void;
  isMobile: boolean;
}

function EditorContent({
  onClose,
  projectTitle,
  projectResolution,
  isMobile=false,
}: {
  onClose: () => void;
  projectTitle?: string;
  projectResolution?: string;
  isMobile: boolean;
}) {
  const [showExportModal, setShowExportModal] = useState(false);
  const [showMediaPanel, setShowMediaPanel] = useState(false);
  const [showInspectorPanel, setShowInspectorPanel] = useState(false);
  const {
    hasUnsavedChanges,
    saveProject,
    isSaving,
    sortedVideoClips,
    currentTime,
    timelineEndTime,
    activeClip,
    splitClip,
    selectedClipId,
    removeClip,
    undo,
    redo,
    canUndo,
    canRedo,
    copyClip,
    pasteClip,
    canPaste,
    isPlaying,
    setIsPlaying,
    setCurrentTime,
  } = useEditor();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        if (canRedo) redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        const clipId = selectedClipId || activeClip?.id;
        if (clipId) copyClip(clipId);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        if (canPaste) pasteClip();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const clipId = selectedClipId || activeClip?.id;
        if (clipId) {
          e.preventDefault();
          removeClip(clipId);
          return;
        }
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (!sortedVideoClips.length) return;
        if (currentTime >= timelineEndTime) setCurrentTime(0);
        setIsPlaying(!isPlaying);
      }
      if (e.code === 'KeyS' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const canCut = activeClip && (!selectedClipId || activeClip.id === selectedClipId);
        if (canCut) splitClip(activeClip.id, currentTime);
      }
      if (e.code === 'KeyD' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const clipId = selectedClipId || activeClip?.id;
        if (clipId) {
          copyClip(clipId);
          pasteClip();
        }
      }
    },
    [
      canUndo,
      canRedo,
      canPaste,
      selectedClipId,
      activeClip,
      currentTime,
      timelineEndTime,
      sortedVideoClips.length,
      isPlaying,
      undo,
      redo,
      copyClip,
      pasteClip,
      removeClip,
      splitClip,
      setIsPlaying,
      setCurrentTime,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const resolutionDisplay = projectResolution
    ? `${projectResolution.replace('x', '×')} • 24 fps`
    : '1920×1080 • 24 fps';

  return (
    <div className="flex h-full w-full min-h-0 flex-col overflow-hidden bg-[var(--bg-primary)]">
      {/* Top Bar - 与 CutOS 一致 */}
      <div className="h-12 border-b border-slate-600 bg-slate-700 md:px-4 px-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-[var(--text-primary)] line-clamp-2">
            {projectTitle || 'AI 剪辑'}
          </span>
          <span className="text-xs text-[var(--text-muted)]">{resolutionDisplay}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={saveProject}
            disabled={isSaving || !hasUnsavedChanges}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSaving ? '保存中...' : hasUnsavedChanges ? '保存' : '已保存'}
          </Button>
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          >
            <Button size="sm" className="gap-2" onClick={() => setShowExportModal(true)}>
              <Download className="h-4 w-4" />
              导出
            </Button>
          </motion.div>
        </div>
      </div>

      <ExportModal open={showExportModal} onOpenChange={setShowExportModal} />

      {/* Main Content - 与 CutOS 相同：左媒体库 | 中预览 | 右 Inspector */}
      {/* v2 API: defaultSize 为数字 1-100 表示百分比 */}
      <ResizablePanelGroup direction="vertical" className="flex-1 min-h-0">
        <ResizablePanel defaultSize={isMobile?25:60} minSize={40}>
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {(!isMobile || showMediaPanel) && (
            <ResizablePanel defaultSize={isMobile?55:15} minSize={15} maxSize={isMobile?55:20}>
              <div className="h-full min-w-0 border-r border-slate-600 bg-[var(--bg-elevated)] overflow-hidden flex flex-col">
                <MediaPanel />
              </div>
            </ResizablePanel>
            )}
            <ResizableHandle withHandle onClick={()=>{setShowMediaPanel(!showMediaPanel);setShowInspectorPanel(false)}}/>
            <ResizablePanel defaultSize={45} minSize={50}>
              <div className="h-full min-w-0 overflow-hidden flex flex-col">
                <VideoPreview />
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle onClick={()=>{setShowInspectorPanel(!showInspectorPanel);setShowMediaPanel(false)}}/>
            {(!isMobile || showInspectorPanel)  && (
            <ResizablePanel defaultSize={isMobile?55:15} minSize={15} maxSize={isMobile?55:20}>
              <div className="h-full min-w-0 border-l border-slate-600 bg-[var(--bg-elevated)] overflow-hidden flex flex-col">
                <InspectorPanel />
              </div>
            </ResizablePanel>
            )}
            </ResizablePanelGroup>
        </ResizablePanel>
        <ResizableHandle className="bg-transparent after:bg-transparent hover:bg-slate-400/50 transition-colors" />
        <ResizablePanel defaultSize={20} minSize={isMobile?35:25}>
          <div className="border-t border-slate-600 bg-[var(--bg-elevated)] overflow-x-hidden overflow-y-auto h-full">
            <Timeline />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

export function EditorShell({ initialData, projectTitle, onClose,isMobile=false }: EditorShellProps) {
  return (
    <EditorProvider>
      <EditorContentWithData
        initialData={initialData}
        projectTitle={projectTitle}
        onClose={onClose}
        isMobile={isMobile}
      />
    </EditorProvider>
  );
}

function EditorContentWithData({
  initialData,
  projectTitle,
  onClose,
  isMobile=false,
}: {
  initialData: CutOSTimelineData;
  projectTitle?: string;
  onClose: () => void;
  isMobile: boolean
}) {
  const { loadTimelineData } = useEditor();

  useEffect(() => {
    const data = {
      media: initialData.media.map((m) => ({
        ...m,
        objectUrl: m.objectUrl,
        storageUrl: m.storageUrl,
      })),
      clips: initialData.clips,
      projectResolution: initialData.projectResolution,
    };
    loadTimelineData(data);
  }, [initialData, loadTimelineData]);

  return <EditorContent onClose={onClose} projectTitle={projectTitle} projectResolution={initialData.projectResolution} isMobile={isMobile} />;
}
