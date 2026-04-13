"use client"

import { AnimatePresence, motion } from "framer-motion"
import { AlertCircle, Captions, Clock, Cloud, CloudOff, Eye, EyeOff, Film, FolderOpen, GripVertical, Loader2, Play, Search, Upload, Wand2, X, Zap } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { generateVideoThumbnail } from "../../utils/imageUtils"
import type { TimelineClip } from "./editor-context"
import { DEFAULT_CLIP_EFFECTS, DEFAULT_CLIP_TRANSFORM, MediaFile, useEditor } from "./editor-context"
import type { ClipEffects, ClipTransform, EffectPreset } from "./types"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion"
import { ColorPicker } from "./ui/color-picker"


export function MediaPanel() {
  const [activeTab, setActiveTab] = useState("media")
  const { mediaFiles, addMediaFiles, removeMediaFile, projectId, reindexMedia, updateMediaThumbnail } = useEditor()

  const tabs = [
    { id: "media", label: "媒体", icon: FolderOpen },
    { id: "effects", label: "效果", icon: Wand2 },
  ]

  return (
    <div className="flex h-full flex-col">
      {/* Custom Animated Tabs */}
      <div className="border-b border-slate-600 px-3 py-2">
        <div className="relative grid w-full grid-cols-2 rounded-md bg-[var(--bg-secondary)] p-1">
          {/* Animated background indicator */}
          <motion.div
            className="absolute inset-y-1 rounded-sm bg-[var(--bg-primary)] shadow-sm"
            initial={false}
            animate={{
              x: activeTab === "media" ? "0%" : "100%",
              width: "calc(50% - 2px)",
            }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 30,
            }}
            style={{ left: 2 }}
          />

          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id

            return (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative z-10 flex items-center justify-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${isActive ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <motion.div
                  animate={isActive ? {
                    scale: [1, 1.2, 1],
                    rotate: tab.id === "agent" ? [0, 15, -15, 0] : 0,
                  } : { scale: 1, rotate: 0 }}
                  transition={{
                    duration: 0.4,
                    ease: "easeInOut",
                  }}
                >
                  <Icon className="h-3.5 w-3.5" />
                </motion.div>
                <span>{tab.label}</span>
                {isActive && tab.id === "agent" && (
                  <motion.div
                    className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-[var(--accent)]"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 20 }}
                  />
                )}
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Animated Tab Content */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {activeTab === "media" && (
            <motion.div
              key="media"
              className="h-full"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <MediaTab
                mediaFiles={mediaFiles}
                onFilesAdded={addMediaFiles}
                onRemoveFile={removeMediaFile}
                projectId={projectId}
                onReindexMedia={reindexMedia}
                onUpdateThumbnail={updateMediaThumbnail}
              />
            </motion.div>
          )}
          {activeTab === "effects" && (
            <motion.div
              key="effects"
              className="h-full"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <EffectsTab />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// TwelveLabs search result type
interface NLPSearchResult {
  videoId: string // TwelveLabs video ID
  mediaId?: string // Our local media ID (mapped)
  start: number
  end: number
  rank: number
  media?: MediaFile // Reference to the matched media
}

interface MediaTabProps {
  mediaFiles: MediaFile[]
  onFilesAdded: (files: MediaFile[]) => void
  onRemoveFile: (id: string) => void
  projectId: string | null
  onReindexMedia: (mediaId: string) => Promise<void>
  onUpdateThumbnail: (mediaId: string, thumbnail: string | null) => void
}

function MediaTab({ mediaFiles, onFilesAdded, onRemoveFile, projectId, onReindexMedia, onUpdateThumbnail }: MediaTabProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // NLP Search state
  const [nlpResults, setNlpResults] = useState<NLPSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showNlpResults, setShowNlpResults] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Preview state for NLP results
  const [previewResult, setPreviewResult] = useState<NLPSearchResult | null>(null)
  const previewVideoRef = useRef<HTMLVideoElement>(null)

  // Auto-generate thumbnails for videos that don't have one
  useEffect(() => {
    const generateMissingThumbnails = async () => {
      for (const media of mediaFiles) {
        // Only process video files without thumbnails but with a valid URL
        if (
          !media.thumbnail &&
          media.type.startsWith("video/") &&
          media.objectUrl
        ) {
          const thumbnail = await generateVideoThumbnail(media.objectUrl,1)
          if (thumbnail) {
            onUpdateThumbnail(media.id, thumbnail)
          }
        }
      }
    }

    generateMissingThumbnails()
  }, [mediaFiles, onUpdateThumbnail])
  
  // Format time for display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }
  
  // Perform NLP search
  const performNlpSearch = useCallback(async (query: string) => {
    if (!projectId || !query.trim()) {
      setNlpResults([])
      setShowNlpResults(false)
      return
    }
    
    // 无 projectId 时 TwelveLabs 不可用（CutOS 依赖 Supabase 项目）
    if (!projectId) {
      setNlpResults([])
      setShowNlpResults(false)
      return
    }
    const indexedMedia = mediaFiles.filter(m => m.twelveLabsStatus === "ready")
    if (indexedMedia.length === 0) {
      setNlpResults([])
      setShowNlpResults(false)
      return
    }
    
    setIsSearching(true)
    
    try {
      const response = await fetch("/api/twelvelabs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          query: query.trim(),
          videoIds: indexedMedia.map(m => m.twelveLabsVideoId).filter(Boolean),
        }),
      })
      
      if (!response.ok) {
        console.error("NLP search failed")
        setNlpResults([])
        setShowNlpResults(false)
        return
      }
      
      const data = await response.json()
      
      // Map results to include local media reference
      const mappedResults: NLPSearchResult[] = data.results.map((r: { videoId: string; start: number; end: number; rank: number }) => {
        const media = mediaFiles.find(m => m.twelveLabsVideoId === r.videoId)
        return {
          ...r,
          mediaId: media?.id,
          media,
        }
      }).filter((r: NLPSearchResult) => r.media) // Only show results we can display
      
      setNlpResults(mappedResults)
      setShowNlpResults(mappedResults.length > 0)
    } catch (error) {
      console.error("NLP search error:", error)
      setNlpResults([])
      setShowNlpResults(false)
    } finally {
      setIsSearching(false)
    }
  }, [projectId, mediaFiles])
  
  // Debounced search effect
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    // If query is empty or too short, clear results
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setNlpResults([])
      setShowNlpResults(false)
      return
    }
    
    // First check name matches
    const nameMatches = mediaFiles.filter(file =>
      file.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    
    // If we have name matches, don't do NLP search
    if (nameMatches.length > 0) {
      setNlpResults([])
      setShowNlpResults(false)
      return
    }
    
    // Debounce NLP search (wait 500ms after typing stops)
    searchTimeoutRef.current = setTimeout(() => {
      performNlpSearch(searchQuery)
    }, 500)
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery, mediaFiles, performNlpSearch])

  const generateThumbnail = useCallback((file: File): Promise<string | null> => {
    return new Promise((resolve) => {
      const video = document.createElement("video")
      video.preload = "metadata"
      video.muted = true
      video.playsInline = true

      // Timeout after 10 seconds
      const timeout = setTimeout(() => {
        console.warn("Thumbnail generation timeout for:", file.name)
        URL.revokeObjectURL(video.src)
        resolve(null)
      }, 10000)

      video.onloadeddata = () => {
        video.currentTime = 1 // Seek to 1 second for thumbnail
      }

      video.onseeked = () => {
        clearTimeout(timeout)
        const canvas = document.createElement("canvas")
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext("2d")
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL("image/jpeg", 0.7))
        } else {
          resolve(null)
        }
        URL.revokeObjectURL(video.src)
      }

      video.onerror = () => {
        clearTimeout(timeout)
        console.error("Error loading video for thumbnail:", file.name)
        resolve(null)
        URL.revokeObjectURL(video.src)
      }

      video.src = URL.createObjectURL(file)
    })
  }, [])

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const getVideoDuration = useCallback((file: File): Promise<{ formatted: string; seconds: number }> => {
    return new Promise((resolve) => {
      const video = document.createElement("video")
      video.preload = "metadata"

      // Timeout after 10 seconds
      const timeout = setTimeout(() => {
        console.warn("Duration loading timeout for:", file.name)
        URL.revokeObjectURL(video.src)
        resolve({ formatted: "00:00", seconds: 0 })
      }, 10000)

      video.onloadedmetadata = () => {
        clearTimeout(timeout)
        resolve({ formatted: formatDuration(video.duration), seconds: video.duration })
        URL.revokeObjectURL(video.src)
      }

      video.onerror = () => {
        clearTimeout(timeout)
        console.error("Error loading video metadata:", file.name)
        resolve({ formatted: "00:00", seconds: 0 })
        URL.revokeObjectURL(video.src)
      }

      video.src = URL.createObjectURL(file)
    })
  }, [])

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const videoFiles = Array.from(files).filter((file) => {
        // Accept video files or mp4/mov/webm/avi by extension if MIME type is missing
        const isVideoType = file.type.startsWith("video/")
        const hasVideoExt = /\.(mp4|mov|webm|avi|mkv|m4v)$/i.test(file.name)
        return isVideoType || hasVideoExt
      })

      if (videoFiles.length === 0) {
        console.warn("No video files found in selection")
        return
      }

      const processedFiles: MediaFile[] = []

      for (const file of videoFiles) {
        try {
          const [thumbnail, durationData] = await Promise.all([
            generateThumbnail(file).catch(() => null),
            getVideoDuration(file).catch(() => ({ formatted: "00:00", seconds: 0 })),
          ])

          processedFiles.push({
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            file,
            name: file.name,
            duration: durationData.formatted,
            durationSeconds: durationData.seconds,
            thumbnail,
            type: file.type || "video/mp4", // Default to mp4 if type is missing
            objectUrl: URL.createObjectURL(file),
            twelveLabsVideoId:'',
            twelveLabsStatus: 'idle',
            captions: null,
            captionsGenerating: false,
            twelveLabsError: null,
          })
        } catch (err) {
          console.error("Error processing file:", file.name, err)
          // Still add the file even if thumbnail/duration fails
          processedFiles.push({
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            file,
            name: file.name,
            duration: "00:00",
            durationSeconds: 0,
            thumbnail: null,
            type: file.type || "video/mp4",
            objectUrl: URL.createObjectURL(file),
            twelveLabsVideoId:'',
            twelveLabsStatus: 'idle',
            captions: null,
            captionsGenerating: false,
            twelveLabsError: null,
          })
        }
      }

      if (processedFiles.length > 0) {
        console.log("Adding", processedFiles.length, "files to media pool")
        onFilesAdded(processedFiles)
      }
    },
    [generateThumbnail, getVideoDuration, onFilesAdded]
  )

  const handleMediaDragStart = useCallback((e: React.DragEvent, media: MediaFile) => {
    e.dataTransfer.setData("application/x-media-id", media.id)
    e.dataTransfer.effectAllowed = "copy"
    
    // Create a custom drag preview
    const dragPreview = document.createElement('div')
    dragPreview.style.cssText = `
      position: absolute;
      top: -1000px;
      left: -1000px;
      padding: 12px 16px;
      background: linear-gradient(135deg, rgb(59, 130, 246), rgb(37, 99, 235));
      color: white;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2);
      pointer-events: none;
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 8px;
      z-index: 9999;
    `
    dragPreview.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
        <line x1="7" y1="2" x2="7" y2="22"></line>
        <line x1="17" y1="2" x2="17" y2="22"></line>
        <line x1="2" y1="12" x2="22" y2="12"></line>
        <line x1="2" y1="7" x2="7" y2="7"></line>
        <line x1="2" y1="17" x2="7" y2="17"></line>
        <line x1="17" y1="17" x2="22" y2="17"></line>
        <line x1="17" y1="7" x2="22" y2="7"></line>
      </svg>
      <span>📹 ${media.name}</span>
    `
    document.body.appendChild(dragPreview)
    e.dataTransfer.setDragImage(dragPreview, 20, 20)
    
    // Clean up the preview after a short delay
    setTimeout(() => {
      document.body.removeChild(dragPreview)
    }, 0)
  }, [])

  // Handle drag start for NLP search results (with specific time range)
  const handleNlpResultDragStart = useCallback((e: React.DragEvent, result: NLPSearchResult) => {
    if (!result.media) return
    
    e.dataTransfer.setData("application/x-media-id", result.media.id)
    e.dataTransfer.setData("application/x-clip-start", result.start.toString())
    e.dataTransfer.setData("application/x-clip-end", result.end.toString())
    e.dataTransfer.effectAllowed = "copy"
    
    // Create a custom drag preview for NLP results
    const duration = result.end - result.start
    const dragPreview = document.createElement('div')
    dragPreview.style.cssText = `
      position: absolute;
      top: -1000px;
      left: -1000px;
      padding: 12px 16px;
      background: linear-gradient(135deg, rgb(34, 197, 94), rgb(22, 163, 74));
      color: white;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2);
      pointer-events: none;
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 8px;
      z-index: 9999;
    `
    dragPreview.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"></circle>
        <path d="m21 21-4.35-4.35"></path>
      </svg>
      <span>🎯 AI Match (${duration.toFixed(1)}s)</span>
    `
    document.body.appendChild(dragPreview)
    e.dataTransfer.setDragImage(dragPreview, 20, 20)
    
    // Clean up the preview after a short delay
    setTimeout(() => {
      document.body.removeChild(dragPreview)
    }, 0)
  }, [])

  // Handle preview of NLP search result
  const handlePreviewResult = useCallback((result: NLPSearchResult) => {
    setPreviewResult(result)
  }, [])

  // Handle video time update during preview - pause at end time
  const handlePreviewTimeUpdate = useCallback(() => {
    if (!previewVideoRef.current || !previewResult) return
    
    if (previewVideoRef.current.currentTime >= previewResult.end) {
      previewVideoRef.current.pause()
      previewVideoRef.current.currentTime = previewResult.start
    }
  }, [previewResult])

  // Set video to start time when preview opens
  useEffect(() => {
    if (previewResult && previewVideoRef.current) {
      previewVideoRef.current.currentTime = previewResult.start
      previewVideoRef.current.play().catch(() => {
        // Autoplay may be blocked, user can click to play
      })
    }
  }, [previewResult])

  // Close preview on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && previewResult) {
        setPreviewResult(null)
      }
    }
    
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [previewResult])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const files = e.dataTransfer.files
      if (files.length > 0) {
        processFiles(files)
      }
    },
    [processFiles]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0) {
        processFiles(files)
      }
      // Reset input so same file can be selected again
      e.target.value = ""
    },
    [processFiles]
  )

  const filteredFiles = mediaFiles.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // NLP 搜索仅在 projectId 存在时可用（TwelveLabs 依赖 Supabase 项目）
  const nlpAvailable = !!projectId
  const hasIndexedMedia = nlpAvailable && mediaFiles.some(m => m.twelveLabsStatus === "ready")
  const indexingCount = nlpAvailable ? mediaFiles.filter(m => m.twelveLabsStatus === "indexing" || m.twelveLabsStatus === "pending").length : 0

  return (
    <div className="flex h-full flex-col">
      {/* Search with NLP support */}
      <div className="border-b border-slate-600 p-3">
        <div className="relative">
          {isSearching ? (
            <Loader2 className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--accent)] animate-spin" />
          ) : (
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--text-muted)]" />
          )}
          <input
            type="text"
            placeholder={hasIndexedMedia ? "按名称搜索或描述你要找的内容..." : "搜索媒体..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-[var(--border-secondary)] bg-[var(--bg-primary)] pl-8 pr-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
          />
        </div>
        {/* NLP Search hint */}
        {hasIndexedMedia && searchQuery.length > 0 && filteredFiles.length === 0 && !isSearching && !showNlpResults && (
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <Zap className="h-3 w-3" />
            <span>试试自然语言："人走路"、"日落场景"等</span>
          </div>
        )}
        {indexingCount > 0 && (
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>正在为 AI 搜索索引 {indexingCount} 个视频...</span>
          </div>
        )}
      </div>

      {/* Drop zone & media grid */}
      <div
        className={`flex-1 overflow-y-auto p-3 scrollbar-thin transition-colors ${isDragOver ? "bg-[var(--accent-bg)]" : ""
          }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        {mediaFiles.length === 0 ? (
          /* Empty state - drop zone */
          <div
            className={`flex h-full flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors cursor-pointer ${isDragOver
                ? "border-[var(--accent)] bg-[var(--accent-bg)]"
                : "border-slate-600 hover:border-[var(--text-muted)]"
              }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload
              className={`h-10 w-10 mb-3 transition-colors ${isDragOver ? "text-[var(--accent)]" : "text-[var(--text-muted)]"
                }`}
            />
            <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
              拖放视频到此处
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              或点击浏览
            </p>
            <p className="text-[10px] text-[var(--text-muted)]/60 mt-2">
              MP4, MOV, WebM, AVI
            </p>
          </div>
        ) : (
          /* Media grid */
          <div className="space-y-2">
            {/* Add more button */}
            <motion.button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 rounded-md border border-dashed border-slate-600 py-2 text-xs text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors cursor-pointer"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Upload className="h-3.5 w-3.5" />
              添加更多视频
            </motion.button>

            {/* Media items */}
            <AnimatePresence mode="popLayout">
              {filteredFiles.map((media, index) => (
                <motion.div
                  key={media.id}
                  layout
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                  transition={{
                    duration: 0.2,
                    delay: index * 0.05,
                    layout: { duration: 0.2 }
                  }}
                  whileHover={{ scale: media.isUploading ? 1 : 1.02, y: media.isUploading ? 0 : -2 }}
                  className={`group relative aspect-video overflow-hidden rounded border bg-[var(--bg-deep)] ${
                    media.isUploading
                      ? "border-[var(--accent)]/50 opacity-70"
                      : "border-slate-600 hover:border-[var(--accent)] cursor-grab active:cursor-grabbing"
                  }`}
                  draggable={!media.isUploading}
                  onDragStart={(e) => !media.isUploading && handleMediaDragStart(e as unknown as React.DragEvent<Element>, media)}
                >
                  {media.thumbnail ? (
                    <img
                      src={media.thumbnail}
                      alt={media.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Film className="h-8 w-8 text-[var(--text-muted)]" />
                    </div>
                  )}

                  {/* Upload progress overlay */}
                  {media.isUploading && (
                    <motion.div
                      className="absolute inset-0 flex items-center justify-center bg-black/40"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <Loader2 className="h-6 w-6 text-white animate-spin" />
                        <span className="text-[10px] text-white">上传中...</span>
                      </div>
                    </motion.div>
                  )}

                  {/* Play icon overlay */}
                  {!media.isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <motion.div
                        className="rounded-full bg-black/60 p-2"
                        initial={{ scale: 0.8 }}
                        whileHover={{ scale: 1.1 }}
                      >
                        <Play className="h-4 w-4 text-white fill-white" />
                      </motion.div>
                    </div>
                  )}

                  {/* Status indicators */}
                  <div className="absolute top-1.5 left-1.5 flex gap-1">
                    {/* Cloud status */}
                    {media.storageUrl ? (
                      <motion.div
                        className="rounded-full bg-emerald-500/80 p-1"
                        title="已保存到云端"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 25 }}
                      >
                        <Cloud className="h-2.5 w-2.5 text-white" />
                      </motion.div>
                    ) : !media.isUploading && (
                      <div className="rounded-full bg-amber-500/80 p-1" title="未保存">
                        <CloudOff className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}

                    {/* TwelveLabs indexing status */}
                    {media.twelveLabsStatus === "indexing" || media.twelveLabsStatus === "pending" ? (
                      <motion.div
                        className="rounded-full bg-cyan-500/80 p-1"
                        title="索引中..."
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 25 }}
                      >
                        <Loader2 className="h-2.5 w-2.5 text-white animate-spin" />
                      </motion.div>
                    ) : media.twelveLabsStatus === "ready" ? (
                      <motion.div
                        className="rounded-full bg-cyan-500/80 p-1"
                        title="可搜索"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 25 }}
                      >
                        <Search className="h-2.5 w-2.5 text-white" />
                      </motion.div>
                    ) : media.twelveLabsStatus === "failed" ? (
                      <motion.div
                        className="rounded-full bg-red-500/80 p-1"
                        title={media.twelveLabsError ? `Failed: ${media.twelveLabsError}` : "Indexing failed"}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 25 }}
                      >
                        <AlertCircle className="h-2.5 w-2.5 text-white" />
                      </motion.div>
                    ) : null}
                  </div>

                  {/* Action buttons */}
                  <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Index button - show if not indexed, failed, or no status (and has storageUrl) */}
                    {media.storageUrl && (!media.twelveLabsStatus || media.twelveLabsStatus === "failed") && (
                      <motion.button
                        onClick={(e) => {
                          e.stopPropagation()
                          onReindexMedia(media.id)
                        }}
                        className="rounded-full bg-cyan-500/80 p-1 hover:bg-cyan-500 cursor-pointer"
                        title={media.twelveLabsStatus === "failed" ? "重试索引" : "设为可搜索"}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Search className="h-3 w-3 text-white" />
                      </motion.button>
                    )}

                    {/* Remove button */}
                    <motion.button
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveFile(media.id)
                      }}
                      className="rounded-full bg-black/60 p-1 hover:bg-black/80 cursor-pointer"
                      title="移除"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <X className="h-3 w-3 text-white" />
                    </motion.button>
                  </div>

                  {/* Info overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-2">
                    <div className="text-xs font-medium text-white truncate">
                      {media.name}
                    </div>
                    <div className="text-[10px] text-white/60">{media.duration}</div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {filteredFiles.length === 0 && searchQuery && !showNlpResults && !isSearching && (
              <div className="text-center py-8 text-xs text-[var(--text-muted)]">
                没有匹配"{searchQuery}"的媒体
                {nlpAvailable && hasIndexedMedia && (
                  <div className="mt-2 text-[10px]">
                    尝试使用自然语言搜索视频内容
                  </div>
                )}
              </div>
            )}

            {/* NLP Search Results - 仅 projectId 存在时显示 */}
            {nlpAvailable && showNlpResults && nlpResults.length > 0 && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--text-muted)]">
                  <Zap className="h-3 w-3 text-[var(--accent)]" />
                  <span>AI 找到 {nlpResults.length} 个匹配片段</span>
                </div>
                <AnimatePresence mode="popLayout">
                  {nlpResults.map((result, index) => (
                    <motion.div
                      key={`nlp-${result.videoId}-${result.start}-${index}`}
                      layout
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                      className="group relative overflow-hidden rounded border border-[var(--accent)]/30 bg-[var(--accent-bg)] hover:border-[var(--accent)] hover:bg-[var(--accent-bg)] transition-colors cursor-pointer"
                      draggable={!!result.media}
                      onDragStart={(e) => handleNlpResultDragStart(e as unknown as React.DragEvent<Element>, result)}
                      onClick={() => handlePreviewResult(result)}
                    >
                      <div className="flex gap-2 p-2">
                        {/* Drag handle */}
                        <div 
                          className="flex items-center text-[var(--text-muted)]/50 group-hover:text-[var(--accent)]/70 transition-colors cursor-grab active:cursor-grabbing"
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <GripVertical className="h-4 w-4" />
                        </div>
                        
                        {/* Thumbnail with play overlay */}
                        <div className="relative w-16 h-10 rounded overflow-hidden bg-[var(--bg-deep)] shrink-0">
                          {result.media?.thumbnail ? (
                            <img
                              src={result.media.thumbnail}
                              alt={result.media.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center">
                              <Film className="h-4 w-4 text-[var(--text-muted)]" />
                            </div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                            <Play className="h-3 w-3 text-white fill-white" />
                          </div>
                        </div>
                        
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-medium text-[var(--text-primary)] truncate">
                            {result.media?.name}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <div className="flex items-center gap-1 text-[10px] text-[var(--accent)]">
                              <Clock className="h-3 w-3" />
                              <span>{formatTime(result.start)} - {formatTime(result.end)}</span>
                            </div>
                            <div className="text-[9px] text-[var(--text-muted)]">
                              Rank #{result.rank}
                            </div>
                          </div>
                        </div>
                        
                        {/* Click to preview hint */}
                        <div className="flex items-center text-[9px] text-[var(--text-muted)]/60 group-hover:text-[var(--accent)]/60 transition-colors whitespace-nowrap">
                          点击预览
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* NLP Result Preview Modal */}
      <AnimatePresence>
        {previewResult && previewResult.media && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
            onClick={() => setPreviewResult(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-2xl w-full mx-4 bg-[var(--bg-primary)] rounded-lg overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-3 border-b">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{previewResult.media.name}</div>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <Clock className="h-3 w-3" />
                    <span>{formatTime(previewResult.start)} - {formatTime(previewResult.end)}</span>
                    <span className="text-[var(--text-muted)]/60">({Math.round(previewResult.end - previewResult.start)}s)</span>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewResult(null)}
                  className="p-1.5 rounded-full hover:bg-[var(--bg-deep)] transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              
              {/* Video */}
              <div className="relative aspect-video bg-black">
                <video
                  ref={previewVideoRef}
                  src={previewResult.media.objectUrl || previewResult.media.storageUrl}
                  className="w-full h-full object-contain"
                  controls
                  onTimeUpdate={handlePreviewTimeUpdate}
                  onEnded={() => {
                    if (previewVideoRef.current && previewResult) {
                      previewVideoRef.current.currentTime = previewResult.start
                    }
                  }}
                />
              </div>
              
              {/* Footer with drag hint */}
              <div className="p-3 border-t flex items-center justify-between">
                <div className="text-xs text-[var(--text-muted)]">
                  按 Esc 或点击外部关闭
                </div>
                <div 
                  className="flex items-center gap-2 text-xs text-[var(--accent)] cursor-grab active:cursor-grabbing px-3 py-1.5 rounded border border-[var(--accent)]/30 hover:bg-[var(--accent-bg)] transition-colors"
                  draggable
                  onDragStart={(e) => handleNlpResultDragStart(e as unknown as React.DragEvent<Element>, previewResult)}
                >
                  <GripVertical className="h-3 w-3" />
                  <span>拖到时间轴</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const EFFECT_PRESETS: { id: EffectPreset; label: string }[] = [
  { id: "none", label: "无" },
  { id: "grayscale", label: "黑白" },
  { id: "sepia", label: "复古棕" },
  { id: "invert", label: "反色" },
  { id: "cyberpunk", label: "赛博朋克" },
  { id: "noir", label: "黑色电影" },
  { id: "vhs", label: "VHS 复古" },
  { id: "glitch", label: "故障风" },
  { id: "ascii", label: "梦幻" },
]

function EffectsTab() {
  const { 
    selectedClipId, 
    timelineClips, 
    updateClip, 
    mediaFiles,
    generateCaptions,
    showCaptions,
    setShowCaptions,
    captionStyle,
    setCaptionStyle,
  } = useEditor()

  const selectedClip = timelineClips.find(c => c.id === selectedClipId)
  
  if (!selectedClip) {
    return (
      <div className="flex h-full items-center justify-center p-3">
        <p className="text-xs text-[var(--text-muted)]">选择一个片段进行编辑</p>
      </div>
    )
  }
  
  const transform = selectedClip.transform ?? DEFAULT_CLIP_TRANSFORM
  const effects = selectedClip.effects ?? DEFAULT_CLIP_EFFECTS

  const handleTransformChange = (key: keyof ClipTransform, value: number) => {
    if (!selectedClipId) return
    updateClip(selectedClipId, {
      transform: { ...transform, [key]: value }
    })
  }

  const handlePresetChange = (preset: EffectPreset) => {
    if (!selectedClipId) return
    console.log("[Effects] Changing preset for clip:", selectedClipId, "from", effects.preset, "to", preset)
    updateClip(selectedClipId, {
      effects: { ...effects, preset }
    })
  }

  const handleEffectChange = (key: keyof ClipEffects, value: number) => {
    if (!selectedClipId) return
    console.log("[Effects] Changing", key, "for clip:", selectedClipId, "to", value)
    updateClip(selectedClipId, {
      effects: { ...effects, [key]: value }
    })
  }

  const handleChromakeyToggle = (enabled: boolean) => {
    if (!selectedClipId) return
    const currentChromakey = effects.chromakey ?? {
      enabled: false,
      keyColor: "#00FF00",
      similarity: 0.4,
      smoothness: 0.1,
      spill: 0.3,
    }
    updateClip(selectedClipId, {
      effects: {
        ...effects,
        chromakey: {
          ...currentChromakey,
          enabled,
        },
      },
    })
  }

  const handleChromakeyChange = (key: "keyColor" | "similarity" | "smoothness" | "spill", value: string | number) => {
    if (!selectedClipId) return
    const currentChromakey = effects.chromakey ?? {
      enabled: false,
      keyColor: "#00FF00",
      similarity: 0.4,
      smoothness: 0.1,
      spill: 0.3,
    }
    updateClip(selectedClipId, {
      effects: {
        ...effects,
        chromakey: {
          ...currentChromakey,
          [key]: value,
        },
      },
    })
  }

  const resetAll = () => {
    if (!selectedClipId) return
    updateClip(selectedClipId, { 
      transform: DEFAULT_CLIP_TRANSFORM,
      effects: DEFAULT_CLIP_EFFECTS 
    })
  }

  const currentPresetLabel = EFFECT_PRESETS.find(p => p.id === effects.preset)?.label ?? "None"

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="px-3 py-2 border-b border-slate-600 flex items-center justify-between">
        <motion.span
          className="text-xs font-medium text-[var(--text-primary)] truncate max-w-[60%]"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          {selectedClip.label}
        </motion.span>
        <motion.button
          onClick={resetAll}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
          whileHover={{ scale: 1.05, x: -2 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          全部重置
        </motion.button>
      </div>
      
      <Accordion type="multiple" className="w-full">
        {/* Transform Accordion */}
        <AccordionItem value="transform" className="border-slate-600">
          <AccordionTrigger className="px-3 py-2 text-xs font-medium hover:no-underline">
            变换
          </AccordionTrigger>
          <AccordionContent className="px-3 pb-3">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">位置 X</label>
                  <input
                    type="number"
                    value={transform.positionX}
                    onChange={(e) => handleTransformChange("positionX", parseInt(e.target.value) || 0)}
                    className="w-full rounded border border-[var(--border-secondary)] bg-[var(--bg-primary)] px-2 py-1 text-xs text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">位置 Y</label>
                  <input
                    type="number"
                    value={transform.positionY}
                    onChange={(e) => handleTransformChange("positionY", parseInt(e.target.value) || 0)}
                    className="w-full rounded border border-[var(--border-secondary)] bg-[var(--bg-primary)] px-2 py-1 text-xs text-[var(--text-primary)]"
                  />
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-[var(--text-muted)]">缩放</span>
                  <span className="text-[var(--text-muted)]">{transform.scale}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="200"
                  value={transform.scale}
                  onChange={(e) => handleTransformChange("scale", parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-[var(--text-muted)]">不透明度</span>
                  <span className="text-[var(--text-muted)]">{transform.opacity}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={transform.opacity}
                  onChange={(e) => handleTransformChange("opacity", parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Presets Accordion */}
        <AccordionItem value="presets" className="border-slate-600">
          <AccordionTrigger className="px-3 py-2 text-xs font-medium hover:no-underline">
            <div className="flex items-center justify-between w-full pr-2">
              <span>预设</span>
              <span className="text-[var(--text-muted)] font-normal">{currentPresetLabel}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-3 pb-3">
            <div className="flex flex-col gap-0.5">
              {EFFECT_PRESETS.map((preset, index) => (
                <motion.button
                  key={preset.id}
                  onClick={() => handlePresetChange(preset.id)}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors cursor-pointer ${
                    effects.preset === preset.id
                      ? "bg-[var(--accent-bg)] text-[var(--accent)]"
                      : "text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 25,
                    delay: index * 0.03
                  }}
                  whileHover={{ x: 4, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <motion.span
                    animate={effects.preset === preset.id ? { scale: [1, 1.05, 1] } : {}}
                    transition={{ duration: 0.2 }}
                  >
                    {preset.label}
                  </motion.span>
                  {effects.preset === preset.id && (
                    <motion.div
                      className="inline-block ml-2 w-1.5 h-1.5 rounded-full bg-[var(--accent)]"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 20 }}
                    />
                  )}
                </motion.button>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Adjustments Accordion */}
        <AccordionItem value="adjustments" className="border-slate-600">
          <AccordionTrigger className="px-3 py-2 text-xs font-medium hover:no-underline">
            调整
          </AccordionTrigger>
          <AccordionContent className="px-3 pb-3">
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">模糊</span>
                  <span className="text-[var(--text-muted)]">{effects.blur}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={effects.blur}
                  onChange={(e) => handleEffectChange("blur", parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
              
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">亮度</span>
                  <span className="text-[var(--text-muted)]">{effects.brightness}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={effects.brightness}
                  onChange={(e) => handleEffectChange("brightness", parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">对比度</span>
                  <span className="text-[var(--text-muted)]">{effects.contrast}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={effects.contrast}
                  onChange={(e) => handleEffectChange("contrast", parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">饱和度</span>
                  <span className="text-[var(--text-muted)]">{effects.saturate}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={effects.saturate}
                  onChange={(e) => handleEffectChange("saturate", parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">色相旋转</span>
                  <span className="text-[var(--text-muted)]">{effects.hueRotate}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={effects.hueRotate}
                  onChange={(e) => handleEffectChange("hueRotate", parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Chromakey Accordion */}
        <AccordionItem value="chromakey" className="border-slate-600">
          <div className="flex items-center justify-between border-b border-slate-600 px-3 py-2">
            <AccordionTrigger className="flex-1 text-xs font-medium hover:no-underline py-0">
              <span>绿幕</span>
            </AccordionTrigger>
            <motion.button
              type="button"
              onClick={() => handleChromakeyToggle(!(effects.chromakey?.enabled ?? false))}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                effects.chromakey?.enabled
                  ? "bg-[var(--accent-bg)] text-[var(--accent)] hover:bg-[var(--accent)]/20"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <AnimatePresence mode="wait">
                {effects.chromakey?.enabled ? (
                  <motion.div
                    key="on"
                    className="flex items-center gap-1.5"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  >
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 0.3 }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </motion.div>
                    <span>开</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="off"
                    className="flex items-center gap-1.5"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                    <span>关</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
          <AccordionContent className="px-3 pb-3">
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[var(--text-muted)] mb-1 block">键颜色</label>
                <ColorPicker
                  value={effects.chromakey?.keyColor ?? "#00FF00"}
                  onChange={(color) => handleChromakeyChange("keyColor", color)}
                  disabled={!effects.chromakey?.enabled}
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">相似度</span>
                  <span className="text-[var(--text-muted)]">{((effects.chromakey?.similarity ?? 0.4) * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={((effects.chromakey?.similarity ?? 0.4) * 100)}
                  onChange={(e) => handleChromakeyChange("similarity", parseInt(e.target.value) / 100)}
                  className="w-full accent-primary"
                  disabled={!effects.chromakey?.enabled}
                />
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">颜色需要多接近才会被移除</p>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">平滑度</span>
                  <span className="text-[var(--text-muted)]">{((effects.chromakey?.smoothness ?? 0.1) * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={((effects.chromakey?.smoothness ?? 0.1) * 100)}
                  onChange={(e) => handleChromakeyChange("smoothness", parseInt(e.target.value) / 100)}
                  className="w-full accent-primary"
                  disabled={!effects.chromakey?.enabled}
                />
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">边缘柔化</p>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">溢出抑制</span>
                  <span className="text-[var(--text-muted)]">{((effects.chromakey?.spill ?? 0.3) * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={((effects.chromakey?.spill ?? 0.3) * 100)}
                  onChange={(e) => handleChromakeyChange("spill", parseInt(e.target.value) / 100)}
                  className="w-full accent-primary"
                  disabled={!effects.chromakey?.enabled}
                />
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">去除边缘的颜色溢出</p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Captions Accordion */}
        <AccordionItem value="captions" className="border-slate-600">
          <div className="flex items-center justify-between border-b border-slate-600 px-3 py-2">
            <AccordionTrigger className="flex-1 text-xs font-medium hover:no-underline py-0">
              <div className="flex items-center gap-1.5">
                <Captions className="h-3.5 w-3.5" />
                <span>字幕</span>
              </div>
            </AccordionTrigger>
            <motion.button
              type="button"
              onClick={() => setShowCaptions(!showCaptions)}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                showCaptions
                  ? "bg-[var(--accent-bg)] text-[var(--accent)] hover:bg-[var(--accent)]/20"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <AnimatePresence mode="wait">
                {showCaptions ? (
                  <motion.div
                    key="show"
                    className="flex items-center gap-1.5"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  >
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 0.3 }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </motion.div>
                    <span>显示</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="hide"
                    className="flex items-center gap-1.5"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                    <span>隐藏</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
          <AccordionContent className="px-3 pb-3">
            <CaptionsSection 
              selectedClip={selectedClip} 
              mediaFiles={mediaFiles} 
              generateCaptions={generateCaptions}
              captionStyle={captionStyle}
              setCaptionStyle={setCaptionStyle}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

const LANGUAGES = [
  { code: "", label: "自动检测" },
  { code: "en", label: "英语" },
  { code: "es", label: "西班牙语" },
  { code: "fr", label: "法语" },
  { code: "de", label: "德语" },
  { code: "it", label: "意大利语" },
  { code: "pt", label: "葡萄牙语" },
  { code: "nl", label: "荷兰语" },
  { code: "ja", label: "日语" },
  { code: "ko", label: "韩语" },
  { code: "zh", label: "中文" },
  { code: "ar", label: "阿拉伯语" },
  { code: "hi", label: "印地语" },
  { code: "ru", label: "俄语" },
]

interface CaptionsSectionProps {
  selectedClip: TimelineClip
  mediaFiles: MediaFile[]
  generateCaptions: (mediaId: string, options?: { language?: string; prompt?: string }) => Promise<void>
  captionStyle: "classic" | "tiktok"
  setCaptionStyle: (style: "classic" | "tiktok") => void
}

function CaptionsSection({ selectedClip, mediaFiles, generateCaptions, captionStyle, setCaptionStyle }: CaptionsSectionProps) {
  const [selectedLanguage, setSelectedLanguage] = useState("")
  const media = mediaFiles.find((m) => m.id === selectedClip.mediaId)
  
  if (!media) {
    return (
      <p className="text-xs text-[var(--text-muted)]">未找到媒体</p>
    )
  }

  const hasCaptions = media.captions && media.captions.length > 0
  const isGenerating = media.captionsGenerating ?? false
  const isVideoType = media.type.startsWith("video")

  if (!isVideoType) {
    return (
      <p className="text-xs text-[var(--text-muted)]">字幕仅对带音频的视频片段可用</p>
    )
  }

  const handleGenerate = async () => {
    if (!media.storageUrl) {
      return
    }
    await generateCaptions(media.id, {
      language: selectedLanguage || undefined,
    })
  }

  return (
    <div className="space-y-3">
      {!media.storageUrl ? (
        <p className="text-xs text-[var(--text-muted)]">请先将媒体上传到云端以生成字幕</p>
      ) : (
        <>
          {/* Language Selector */}
          <div>
            <label className="text-xs text-[var(--text-muted)] mb-1.5 block">语言</label>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              disabled={isGenerating}
              className="w-full rounded border border-[var(--border-secondary)] bg-[var(--bg-primary)] px-2 py-1.5 text-xs text-[var(--text-primary)] disabled:opacity-50"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">指定语言可提高准确度</p>
          </div>

          <motion.button
            onClick={handleGenerate}
            disabled={isGenerating}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-xs font-medium transition-colors cursor-pointer ${
              isGenerating
                ? "bg-[var(--bg-secondary)] text-[var(--text-muted)] cursor-not-allowed"
                : "bg-[var(--accent)] text-[var(--accent-on)] hover:bg-[var(--accent)]/90"
            }`}
            whileHover={!isGenerating ? { scale: 1.02 } : {}}
            whileTap={!isGenerating ? { scale: 0.98 } : {}}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <AnimatePresence mode="wait">
              {isGenerating ? (
                <motion.div
                  key="generating"
                  className="flex items-center gap-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Loader2 className="h-3.5 w-3.5" />
                  </motion.div>
                  <span>生成中...</span>
                </motion.div>
              ) : hasCaptions ? (
                <motion.span
                  key="regenerate"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                >
                  重新生成字幕
                </motion.span>
              ) : (
                <motion.span
                  key="generate"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                >
                  生成字幕
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          {hasCaptions && (
            <div className="space-y-3">
              {/* Caption Style Selector */}
              <div>
                <label className="text-xs text-[var(--text-muted)] mb-1.5 block">风格</label>
                <div className="relative flex rounded-md border border-slate-600 bg-[var(--bg-secondary)]/30 p-0.5">
                  {/* Animated background indicator */}
                  <motion.div
                    className="absolute inset-y-0.5 rounded bg-[var(--accent)]"
                    initial={false}
                    animate={{
                      x: captionStyle === "classic" ? "2px" : "calc(100% + 2px)",
                      width: "calc(50% - 4px)",
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                    }}
                    style={{ left: 0 }}
                  />
                  <motion.button
                    onClick={() => setCaptionStyle("classic")}
                    className={`relative z-10 flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                      captionStyle === "classic"
                        ? "text-[var(--accent-on)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  >
                    经典
                  </motion.button>
                  <motion.button
                    onClick={() => setCaptionStyle("tiktok")}
                    className={`relative z-10 flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                      captionStyle === "tiktok"
                        ? "text-[var(--accent-on)]"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  >
                    TikTok
                  </motion.button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">检测到的词数</span>
                <span className="text-[var(--text-primary)] font-medium">{media.captions!.length}</span>
              </div>
              
              <div className="max-h-32 overflow-y-auto rounded border border-slate-600 bg-[var(--bg-secondary)]/30 p-2">
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  {media.captions!.map((c) => c.word).join(" ")}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
