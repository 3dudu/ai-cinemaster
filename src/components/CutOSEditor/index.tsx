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
        <div className="rounded-lg border border-slate-600 bg-slate-950 p-6 shadow-xl max-w-md">
          <h3 className="mb-2 text-lg font-semibold text-slate-100">AI 剪辑</h3>
          <p className="mb-4 text-sm text-slate-300">
            暂无已完成的视频镜头，请先在导演阶段生成视频片段。
          </p>
          <button onClick={onClose} className='w-32 h-12 bg-blue-600 text-white hover:bg-blue-500 border border-blue-600 shadow-lg shadow-blue-600/20 rounded-lg flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-widest transition-all'>
            关闭
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-14 inset-0 z-50 flex flex-col bg-slate-950">
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
