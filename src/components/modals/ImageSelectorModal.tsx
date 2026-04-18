/**
 * Image Selector Modal - 桌面端 Modal 式图片选择器
 * 薄壳包装 ImageLibrary，用于桌面端各种选择图片场景
 */

import React from 'react';
import { ProjectState } from '../../types';
import ImageLibrary from '../common/ImageLibrary';

interface ImageSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  project?: ProjectState;
  updateProject?: (updates: Partial<ProjectState>) => void;
  onSelectImage: (imageUrl: string, allImages?: string[]) => void;
  filterType?: 'character' | 'scene' | 'keyframe' | 'prop' | 'all' | 'video';
  previewMode?: boolean;
  showVideo?: boolean;
}

const ImageSelectorModal: React.FC<ImageSelectorModalProps> = ({
  isOpen,
  onClose,
  project,
  updateProject,
  onSelectImage,
  filterType = 'all',
  previewMode = false,
  showVideo = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 select-text">
      {/* Modal 内容 */}
      <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl overflow-hidden w-full max-w-6xl h-[80vh] flex flex-col">
        {/* 标题栏 */}
        <div className="h-16 px-6 border-b border-slate-600 flex items-center justify-between bg-slate-600/80">
          <h3 className="text-lg font-bold text-slate-50 flex items-center gap-2">
            {showVideo ? '媒体' : '图片'}库
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 bg-slate-700 hover:text-slate-100 hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col">
          {/* 项目选择器和搜索框 */}
          <div className="px-2 md:px-6 py-2 md:py-4 border-b border-slate-600 bg-slate-700">
            {/* 项目选择器由 ImageLibrary 内部提供，这里只需要传递 filterType */}
            <div className="h-8 flex items-center">
              <span className="text-sm text-slate-400">
                选择{filterType === 'all' ? '全部' : filterType === 'character' ? '角色' : filterType === 'scene' ? '场景' : filterType === 'prop' ? '道具' : filterType === 'keyframe' ? '关键帧' : '视频'}图片
              </span>
            </div>
          </div>

          {/* ImageLibrary */}
          <ImageLibrary
            project={project}
            updateProject={updateProject}
            previewMode={previewMode}
            showVideoDefault={showVideo}
            onSelectImage={onSelectImage}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
};

export default ImageSelectorModal;
