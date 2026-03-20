import { Check, Download, Loader2, MapPin, RefreshCw, Sparkles, Upload, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { ModelService } from '../../services/modelService';
import { renderTemplate } from '../../services/promptTemplates';
import { addMediaHistory } from '../../services/storageService';
import { ProjectState, Scene } from '../../types';
import FileUploadModal, { downloadImage } from '../FileUploadModal';
import { useDialog } from '../dialog';

interface Props {
  scene: Scene | null;
  project: ProjectState;
  localStyle: string;
  imageSize: string;
  processingState: {id: string, type: 'character'|'scene'}|null;
  setProcessingState: (state: {id: string, type: 'character'|'scene'}|null) => void;
  updateProject: (updates: Partial<ProjectState>) => void;
  onClose: () => void;
  setPreviewImage: (image: string) => void;
}

const SceneEditModal: React.FC<Props> = ({
  scene,
  project,
  localStyle,
  imageSize,
  processingState,
  setProcessingState,
  updateProject,
  onClose,
  setPreviewImage
}) => {
  const dialog = useDialog();
  const [editingVisualPrompt, setEditingVisualPrompt] = useState("");
  const [fileUploadModalOpen, setFileUploadModalOpen] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);

  // Sync visual prompt when scene is selected
  useEffect(() => {
    if (scene) {
      setEditingVisualPrompt(scene.visualPrompt || '');
    }
  }, [scene]);

  const handleGenerateImage = async () => {
    if (!scene || !project.scriptData) return;

    setProcessingState({ id: scene.id, type: 'scene' });

    try {
      const prompt = scene.visualPrompt || await ModelService.generateVisualPrompts('scene', scene, project.scriptData?.genre || '剧情片', project.visualStyle);
      setEditingVisualPrompt(prompt);
      const enhancedPrompt = renderTemplate('GENERATE_SCENE_IMAGE',
        localStyle,
        prompt,
        scene.atmosphere
      );

      const imageUrl = await ModelService.generateImage(enhancedPrompt, [], "scene", localStyle, imageSize, 1, {}, project.id,scene.id);

      // Save to media history
      if (imageUrl) {
        await addMediaHistory(project.id, imageUrl, scene.location, 'image', 'scene', enhancedPrompt);
      }

      const newData = { ...project.scriptData };
      const s = newData.scenes.find(s => s.id === scene.id);
      if (s) {
        s.referenceImage = imageUrl;
        s.visualPrompt = prompt;
      }

      updateProject({ scriptData: newData });
    } catch (e) {
      console.error(e);
      await dialog.alert({ title: '错误', message: '场景图生成失败', type: 'error' });
    } finally {
      setProcessingState(null);
    }
  };

  const handleSaveVisualPrompt = () => {
    if (!project.scriptData || !scene) return;

    const newData = { ...project.scriptData };
    const s = newData.scenes.find(s => s.id === scene.id);
    if (s) {
      s.visualPrompt = editingVisualPrompt;
      updateProject({ scriptData: newData });
    }
  };

  const handleDownloadImage = async (imageUrl: string, name: string) => {
    if (downloadStatus) return;
    setDownloadStatus('downloading');
    try {
      await downloadImage(imageUrl, `${project.scriptData?.title}-${name}.png`, dialog);
    } finally {
      setDownloadStatus(null);
    }
  };

  const handleFileUploadSuccess = (fileUrl: string) => {
    if (!project.scriptData || !scene) return;

    const newData = { ...project.scriptData };
    const s = newData.scenes.find(s => s.id === scene.id);
    if (s) {
      s.referenceImage = fileUrl;
      updateProject({ scriptData: newData });
    }
    setFileUploadModalOpen(false);
  };

  if (!scene) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-700/80 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-600 w-full max-w-4xl max-h-[80vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="h-16 px-6 border-b border-slate-600 flex items-center justify-between shrink-0 bg-slate-600/80">
          <h3 className="text-lg font-bold text-slate-50 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-green-400" />场景编辑
          </h3>
          <button onClick={onClose} className="p-2 bg-slate-700 hover:bg-slate-800 rounded-full transition-colors cursor-pointer">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 p-2 md:p-6 bg-slate-700 space-y-5 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-[410px_1fr] gap-6">
            {/* Scene Image */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-green-400" />
                <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">场景图像</span>
              </h4>
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-600">
                <div 
                  className="aspect-[16/9] bg-slate-900 rounded-lg overflow-hidden mb-4 relative cursor-pointer" 
                  onClick={() => scene.referenceImage && setPreviewImage(scene.referenceImage)}
                >
                  {scene.referenceImage ? (
                    <img src={scene.referenceImage} className="w-full h-full object-cover hover:scale-105 transition-transform duration-200" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-600">
                      <MapPin className="w-8 h-8" />
                    </div>
                  )}
                  <div className="absolute top-2 left-2 px-2 py-1 bg-slate-700/60 backdrop-blur rounded text-[12px] text-slate-50 font-bold uppercase border border-white/10">
                    {scene.location}
                  </div>
                  {scene.referenceImage && (
                    <div className="absolute inset-0 bg-slate-700/0 hover:bg-slate-700/20 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                      <span className="text-slate-50/80 text-xs font-bold uppercase tracking-wider">点击预览</span>
                    </div>
                  )}
                  {processingState?.type === 'scene' && processingState?.id === scene.id && (
                    <div className="absolute inset-0 bg-slate-700/60 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-slate-50 animate-spin" />
                    </div>
                  )}
                  {/* Action Buttons */}
                  <div className="absolute bottom-2 right-2 flex items-center justify-center gap-1">
                    {scene.referenceImage && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownloadImage(scene.referenceImage!, scene.location); }}
                        className="p-2 bg-slate-700/50 text-slate-50 rounded-full hover:bg-slate-800 hover:text-slate-50 transition-colors border border-white/10 backdrop-blur"
                        title="下载图片"
                        disabled={!!downloadStatus}
                      >
                        <Download className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setFileUploadModalOpen(true); }}
                      disabled={!!processingState}
                      className="p-2 bg-slate-700/50 text-slate-50 rounded-full hover:bg-slate-800 hover:text-slate-50 transition-colors border border-white/10 backdrop-blur disabled:opacity-50 disabled:cursor-not-allowed"
                      title="上传图片"
                    >
                      <Upload className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <button
                  onClick={handleGenerateImage}
                  disabled={!!processingState}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-3 h-3 ${processingState?.type === 'scene' && processingState?.id === scene.id ? 'animate-spin' : ''}`} />
                  {processingState?.type === 'scene' && processingState?.id === scene.id ? '生成中...' : scene.referenceImage ? '重新生成' : '生成场景图'}
                </button>
              </div>
            </div>

            {/* Scene Info */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Check className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">场景信息</span>
              </h4>
              <div className="space-y-4">
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-600">
                  <label className="text-[12px] text-slate-300 uppercase tracking-wider font-bold block mb-2">地点</label>
                  <p className="text-sm text-slate-50">{scene.location}</p>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-600">
                  <label className="text-[12px] text-slate-300 uppercase tracking-wider font-bold block mb-2">时间</label>
                  <p className="text-sm text-slate-50">{scene.time}</p>
                </div>
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-600">
                  <label className="text-[12px] text-slate-300 uppercase tracking-wider font-bold block mb-2">氛围</label>
                  <p className="text-sm text-slate-50">{scene.atmosphere}</p>
                </div>
              </div>
            </div>
          </div>
          {/* Visual Prompt */}
          <div className="mt-6">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">视觉提示</span>
            </h4>
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-600">
              <textarea
                value={editingVisualPrompt}
                onChange={(e) => setEditingVisualPrompt(e.target.value)}
                onBlur={handleSaveVisualPrompt}
                placeholder="输入场景的视觉描述..."
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-slate-50 placeholder:text-slate-600 focus:border-slate-500 focus:outline-none transition-all resize-none h-32 font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* File Upload Modal */}
      <FileUploadModal
        isOpen={fileUploadModalOpen}
        onClose={() => setFileUploadModalOpen(false)}
        onUploadSuccess={handleFileUploadSuccess}
        filePath="scene/upload"
        acceptTypes="image/png,image/jpeg,image/jpg"
        title="上传场景图片"
        projectid={project.id}
        project={project}
        filterType='scene'
      />
    </div>
  );
};

export default SceneEditModal;
