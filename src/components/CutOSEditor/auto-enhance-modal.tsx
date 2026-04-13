"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Sparkles, Zap } from "lucide-react"

interface AutoEnhanceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onEnhance: (prompt: string) => void
}

export function AutoEnhanceModal({ open, onOpenChange, onEnhance }: AutoEnhanceModalProps) {
  const [prompt, setPrompt] = useState("")

  const handleEnhance = () => {
    if (!prompt.trim()) {
      onEnhance("Analyze my video timeline and automatically apply smart improvements. Look at all clips and suggest enhancements like: trimming dead air at the start/end, applying cinematic effects, removing green screens if present, improving pacing with strategic splits, and any other optimizations. Apply all suggested improvements automatically.")
    } else {
      onEnhance(`${prompt}\n\nBased on my request, automatically apply appropriate edits and enhancements to the timeline.`)
    }
    setPrompt("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            自动增强视频
          </DialogTitle>
          <DialogDescription>
            描述你想要的效果，或留空进行常规优化（裁剪、效果、节奏等）
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="enhance-prompt">你想要增强什么？（可选）</Label>
            <Input
              id="enhance-prompt"
              placeholder="例如：增加电影感、突出动作场景、去除绿幕..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="h-10"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            取消
          </Button>
          <Button onClick={handleEnhance} className="flex-1 bg-gradient-to-r from-primary to-primary/80">
            <Sparkles className="h-4 w-4 mr-2" />
            立即增强
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
