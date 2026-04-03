import { Download, ListVideo, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Segment } from '../../types';

interface SegmentPreviewModalProps {
  segments: Segment[];
  projectTitle?: string;
  isOpen: boolean;
  onClose: () => void;
  getSegmentThumbnail?: (segment: Segment) => string | undefined;
}

const SegmentPreviewModal: React.FC<SegmentPreviewModalProps> = ({
  segments,
  projectTitle,
  isOpen,
  onClose,
  getSegmentThumbnail,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const segmentRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  // Get segments with video URLs
  const videoSegments = React.useMemo(() => {
    return segments.filter(segment => segment.videoUrl);
  }, [segments]);

  const videoUrls = React.useMemo(() => {
    return videoSegments.map(segment => segment.videoUrl!);
  }, [videoSegments]);

  // Reset index when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentVideoIndex(0);
    }
  }, [isOpen]);

  // Auto-scroll selected segment into view
  useEffect(() => {
    if (currentVideoIndex) {
      const element = segmentRefs.current.get(currentVideoIndex);
      const container = thumbnailContainerRef.current;
      if (element && container) {
        const elementRect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const isOverflowing = elementRect.left < containerRect.left || elementRect.right > containerRect.right;

        if (isOverflowing) {
          element.scrollIntoView({
            behavior: 'smooth',
            inline: 'center',
            block: 'nearest',
          });
        }
      }
    }
  }, [currentVideoIndex]);

  // Handle video ended - auto play next
  const handleVideoEnded = useCallback(() => {
    if (currentVideoIndex < videoUrls.length - 1) {
      setCurrentVideoIndex(prev => prev + 1);
    }
  }, [currentVideoIndex, videoUrls.length]);

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
      const url = videoUrls[i];
      const segment = videoSegments[i];

      try {
        const response = await fetch(url);
        if (!response.ok) continue;

        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.target = '_blank';
        a.download = `${projectTitle || 'segment'}-${String(i + 1).padStart(3, '0')}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
      } catch (e) {
        console.error('Download failed:', e);
      }

      // Small delay between downloads
      if (i < videoUrls.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    setIsDownloading(false);
  }, [isDownloading, videoUrls, videoSegments, projectTitle]);

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

  if (!isOpen || videoUrls.length === 0) return null;

  return (
    <div className="fixed inset-0 z-60 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 select-text">
      <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl w-full lg:max-w-6xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="min-h-16 px-6 border-b border-slate-600 flex items-center justify-between bg-slate-700/50">
          <h3 className="text-lg font-bold text-slate-50 flex items-center gap-2">
            <ListVideo className="w-5 h-5 text-slate-500" />
            {projectTitle ? `${projectTitle} - ` : ' - '}{videoSegments[currentVideoIndex]?.name}
          </h3>
          <button
            onClick={handleClose}
            className="p-2 bg-slate-700 hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Player */}
        <div className="flex-1 bg-slate-900 overflow-hidden flex flex-col items-center justify-center px-2 pt-2 md:px-4 md:pt-4">
          <div className="w-full aspect-[16/9] bg-slate-700 rounded-lg overflow-hidden relative">
            <video
              ref={videoRef}
              controls
              autoPlay
              className="w-full h-full object-contain"
              src={videoUrls[currentVideoIndex]}
              onEnded={handleVideoEnded}
              onError={handleVideoEnded}
            >
              您的浏览器不支持视频播放。
            </video>

            {/* Video Counter */}
            <div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs text-slate-300 font-mono">
              {currentVideoIndex + 1} / {videoUrls.length}
            </div>
          </div>
          {/* Segment Info */}
          <div className="w-full mt-2 bg-slate-900/80 backdrop-blur-sm px-4 py-2 rounded-lg">
            <p className="text-sm text-slate-200 line-clamp-2">
              {videoSegments[currentVideoIndex]?.description || `片段 ${currentVideoIndex + 1}`}
            </p>
          </div>
        </div>

        {/* Thumbnail Strip */}
        <div className="md:p-4 p-2 bg-slate-800 border-t border-slate-600">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-slate-400 font-mono">
              片段序列 ({videoUrls.length} 个视频)
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
            {videoSegments.map((segment: Segment, idx: number) => {
              const thumbnail = getSegmentThumbnail ? getSegmentThumbnail(segment) : undefined;
              return (
                <button
                  key={segment.id}
                  ref={(el) => {
                    if (el) {
                      segmentRefs.current.set(idx, el);
                    } else {
                      segmentRefs.current.delete(idx);
                    }
                  }}
                  onClick={() => setCurrentVideoIndex(idx)}
                  className={`relative flex-shrink-0 w-24 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                    idx === currentVideoIndex
                      ? 'border-indigo-400 ring-2 ring-indigo-500/30'
                      : 'border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {thumbnail ? (
                    <img
                      src={thumbnail}
                      alt={`片段 ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                      <ListVideo className="w-6 h-6 text-slate-600" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-slate-900/60 text-[10px] text-center text-slate-300 py-0.5">
                    {idx + 1}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SegmentPreviewModal;
