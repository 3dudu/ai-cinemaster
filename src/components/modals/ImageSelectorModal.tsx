/**
 * Image Selector Modal - 桌面端 Modal 式图片选择器
 * 薄壳包装 ImageLibrary
 */

import { X } from 'lucide-react';
import React from 'react';
import { ProjectState } from '../../types';
import ImageLibrary from '../common/ImageLibrary';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  project?: ProjectState;
  updateProject?: (updates: Partial<ProjectState>) => void;
  onSelectImage: (imageUrl: string, allImages?: string[]) => void;
  filterType?: 'character' | 'scene' | 'keyframe' | 'prop' | 'all' | 'video';
  previewMode?: boolean;
  showVideo?: boolean;
}

const ImageSelectorModal: React.FC<Props> = ({
  isOpen,
  onClose,
  project,
  updateProject,
  onSelectImage,
  filterType = 'all',
  previewMode = false,
  showVideo = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 select-text">
      {/* Modal 内容 */}
      <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl overflow-hidden w-full max-w-6xl h-[80vh] flex flex-col">
        {/* ImageLibrary 负责渲染内部内容 */}
        <ImageLibrary
          project={project}
          updateProject={updateProject}
          filterType={filterType}
          showVideoDefault={showVideo}
          onSelectImage={onSelectImage}
          onClose={onClose}
          closeOnSelect={!previewMode}
          modalMode={true}
          showSearch={true}
          showProjectSelector={true}
          showFooter={true}
        />
      </div>
    </div>
  );
};

export default ImageSelectorModal;
