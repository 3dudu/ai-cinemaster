import { ArrowRightLeft, Film, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ProjectState, Shot } from '../../types';

interface EpisodePreviewModalProps {
  episode: ProjectState | null;
  isOpen: boolean;
  onClose: () => void;
}

const EpisodePreviewModal: React.FC<EpisodePreviewModalProps> = ({
  episode,
  isOpen,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [tranVideoIndex, setTranVideoIndex] = useState(0);

  // Get shots with video URLs
  const videoShots = React.useMemo(() => {
    if (!episode) return [];
    return episode.shots.filter(shot => shot.interval?.videoUrl);
  }, [episode]);

  const videoUrls = React.useMemo(() => {
    return videoShots.map(shot => shot.transitionUrl
      ? [shot.interval!.videoUrl!, shot.transitionUrl]
      : [shot.interval!.videoUrl!]
    );
  }, [videoShots]);

  // Reset index when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentVideoIndex(0);
    }
  }, [isOpen]);

  // Handle video ended - auto play next
  const handleVideoEnded = useCallback(() => {
    if(tranVideoIndex==0 && videoUrls[currentVideoIndex][1]){
      setTranVideoIndex(1);
    }else{
      if (currentVideoIndex < videoUrls.length - 1) {
        setCurrentVideoIndex(prev => prev + 1);
      } else {
        // All videos played, reset or close
        //onClose();
      }
    }
  }, [currentVideoIndex, videoUrls.length, onClose]);

  // Handle close with cleanup
  const handleClose = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    onClose();
  }, [onClose]);

  // Handle wheel event for horizontal scrolling
  const handleThumbnailWheel = useCallback((e: React.WheelEvent) => {
    if (thumbnailContainerRef.current) {
      e.preventDefault();
      thumbnailContainerRef.current.scrollLeft += e.deltaY;
    }
  }, []);

  // Handle keyboard escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen || !episode || videoUrls.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/95 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl overflow-hidden w-full max-w-4xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="h-14 px-6 border-b border-slate-600 flex items-center justify-between bg-slate-700/50">
          <h3 className="text-lg font-bold text-slate-50 flex items-center gap-2">
            <Film className="w-5 h-5 text-slate-500" />
            {episode.title} - 预览
          </h3>
          <button
            onClick={handleClose}
            className="p-2 bg-slate-700 hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Player */}
        <div className="flex-1 bg-slate-900 flex flex-col items-center justify-center px-4 pt-4">
          <div className="w-full aspect-video bg-slate-950 rounded-lg overflow-hidden relative">
            <video
              ref={videoRef}
              controls
              autoPlay
              className="w-full h-full object-contain"
              src={videoUrls[currentVideoIndex][tranVideoIndex]}
              onEnded={handleVideoEnded}
            >
              您的浏览器不支持视频播放。
            </video>

            {/* Video Counter */}
            <div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs text-slate-300 font-mono">
              {currentVideoIndex + 1} / {videoUrls.length}
            </div>
          </div>
            {/* Shot Info */}
            <div className="bottom-4 left-4 right-4 bg-slate-900/80 backdrop-blur-sm px-4 py-2 rounded-lg">
              <p className="text-sm text-slate-200 line-clamp-1">
                {videoShots[currentVideoIndex]?.actionSummary || '镜头预览'}
              </p>
            </div>
        </div>

        {/* Thumbnail Strip */}
        <div className="p-4 bg-slate-800 border-t border-slate-600">
          <div className="text-xs text-slate-400 mb-2 font-mono">
            镜头序列 ({videoUrls.length} 个视频)
          </div>
          <div
            ref={thumbnailContainerRef}
            onWheel={handleThumbnailWheel}
            className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar flex-shrink-0"
          >
            {videoShots.map((shot: Shot, idx: number) => (
              <button
                key={shot.id}
                onClick={() => setCurrentVideoIndex(idx)}
                className={`relative flex-shrink-0 w-24 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                  idx === currentVideoIndex
                    ? 'border-slate-400 ring-2 ring-slate-500/30'
                    : 'border-slate-700 hover:border-slate-500'
                }`}
              >
                {shot.keyframes[0]?.imageUrl ? (
                  <img
                    src={shot.keyframes[0]?.imageUrl}
                    alt={`镜头 ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                    <Film className="w-6 h-6 text-slate-600" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-slate-900/60 text-[10px] text-center text-slate-300 py-0.5">
                  {idx + 1}
                </div>
                {videoUrls[idx].length>1 && (
                <div className="absolute top-0 right-0 bg-slate-900/60 text-[10px] text-center text-indigo-300 py-0.5">
                <ArrowRightLeft className="w-3 h-3" />
                </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EpisodePreviewModal;
