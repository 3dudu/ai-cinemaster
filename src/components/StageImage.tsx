/**
 * Stage Image - 移动端全屏图片库 Stage
 * 作为移动端底部导航的一个 Stage 页面
 * 薄壳包装 ImageLibrary
 */

import React from 'react';
import { ProjectState } from '../types';
import ImageLibrary from './common/ImageLibrary';

interface StageImageProps {
  project: ProjectState;
  updateProject?: (updates: Partial<ProjectState>) => void;
}

const StageImage: React.FC<StageImageProps> = ({ project, updateProject }) => {
  return (
    <div className="flex flex-col h-full bg-slate-900 relative overflow-hidden">
      {/* ImageLibrary content */}
      <div className="flex-1 overflow-y-auto">
        <ImageLibrary
          project={project}
          updateProject={updateProject}
          previewMode={true}
          showVideoDefault={true}
          modalMode={false}
          showSearch={true}
          showProjectSelector={true}
          showFooter={false}
        />
      </div>
    </div>
  );
};

export default StageImage;
