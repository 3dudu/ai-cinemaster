/**
 * CutOS AI 剪辑模块 - 从 CutOS 项目迁移
 * 在成片与导出阶段提供视频剪辑、效果调整、导出功能
 */
import React from 'react';
import type { ProjectState } from '../../types';
import { EditorShell } from './editor-shell';
import { projectToCutOSTimeline } from './projectAdapter';

interface CutOSEditorProps {
  project: ProjectState;
  open: boolean;
  onClose: () => void;
  isMobile: boolean;
}

const CutOSEditor: React.FC<CutOSEditorProps> = ({ project, open, onClose,isMobile=false }) => {
  if (!open) return null;

  const { media, clips ,projectResolution} = projectToCutOSTimeline(project);

  if (media.length === 0 || clips.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="rounded-lg border border-slate-600 bg-[var(--bg-primary)] p-6 shadow-xl max-w-md">
          <h3 className="mb-2 text-lg font-semibold text-[var(--text-primary)]">AI 剪辑</h3>
          <p className="mb-4 text-sm text-[var(--text-secondary)]">
            暂无已完成的视频镜头，请先在导演阶段生成视频片段。
          </p>
          <button onClick={onClose} className='h-12 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover)] border border-[var(--btn-primary-bg)] shadow-lg shadow-[var(--btn-primary-shadow)] rounded-lg flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-widest transition-all'>
            关闭
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-14 inset-0 z-50 flex flex-col bg-[var(--bg-primary)]">
      <EditorShell
        initialData={{ media, clips, projectResolution }}
        projectTitle={project.title}
        onClose={onClose}
        isMobile={isMobile}
      />
    </div>
  );
};

export default CutOSEditor;
