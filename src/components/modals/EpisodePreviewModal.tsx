import { ArrowRightLeft, Download, Film, X } from 'lucide-react';
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
  const [isDownloading, setIsDownloading] = useState(false);

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

  // Handle download all videos
  const handleDownloadAll = useCallback(async () => {
    if (isDownloading || videoUrls.length === 0) return;
    setIsDownloading(true);

    for (let i = 0; i < videoUrls.length; i++) {
      const urls = videoUrls[i];
      const shot = videoShots[i];

      for (let j = 0; j < urls.length; j++) {
        const url = urls[j];
        const isTransition = j === 1;

        try {
          const response = await fetch(url);
          if (!response.ok) continue;

          const blob = await response.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.target = '_blank';
          a.download = `${episode?.title || 'shot'}-${String(i + 1).padStart(3, '0')}${isTransition ? '-transition' : ''}.mp4`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(blobUrl);
        } catch (e) {
          console.error('Download failed:', e);
        }

        // Small delay between downloads
        if (i < videoUrls.length - 1 || j < urls.length - 1) {
          await new Promise(r => setTimeout(r, 500));
        }
      }
    }

    setIsDownloading(false);
  }, [isDownloading, videoUrls, videoShots, episode?.title]);

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
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-slate-400 font-mono">
              镜头序列 ({videoUrls.length} 个视频)
            </div>
            <button
              onClick={handleDownloadAll}
              disabled={isDownloading}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-[11px] font-bold tracking-wider rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
              title="下载所有视频"
            >
              {isDownloading ? (
                <>
                  <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  下载中...
                </>
              ) : (
                <>
                  <Download className="w-3 h-3" />
                  下载全部
                </>
              )}
            </button>
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
