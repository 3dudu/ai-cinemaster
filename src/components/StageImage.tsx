/**
 * Stage Image - 移动端全屏图片库 Stage
 * 作为移动端底部导航的一个 Stage 页面
 * 薄壳包装 ImageLibrary
 */

import React, { useMemo } from 'react';
import { Cloud, Loader2 } from 'lucide-react';
import { ProjectState } from '../types';
import ImageLibrary from './ImageLibrary';

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
          renderHeader={({ remoteImageCount, handleBatchUpload, uploadingStatus, showVideo, setShowVideo, displayImagesLength }) => (
            <div className="h-14 border-b border-slate-600 bg-slate-700 md:px-6 px-2 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-bold text-slate-50 flex items-center gap-3">
                  媒体库
                </h2>
              </div>
              <div className="flex items-center gap-3">
                {remoteImageCount > 0 && (
                  <button
                    onClick={handleBatchUpload}
                    disabled={!!uploadingStatus}
                    className="px-3 py-1 rounded text-[12px] font-mono transition-colors cursor-pointer bg-orange-600 text-white hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {uploadingStatus ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {uploadingStatus}
                      </>
                    ) : (
                      <>
                        <Cloud className="w-3 h-3" />
                        上传 ({remoteImageCount})
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={() => setShowVideo(!showVideo)}
                  className={`px-3 py-1 rounded text-[12px] font-mono transition-colors cursor-pointer ${
                    showVideo
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  视频 {showVideo ? '开启' : '关闭'}
                </button>
                <span className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-[12px] text-slate-400 font-mono">
                  {displayImagesLength} 媒体
                </span>
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
};

export default StageImage;
