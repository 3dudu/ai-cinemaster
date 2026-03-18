import { Download, Drill, Loader2, Package, Plus, RefreshCw, Upload, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { ModelService } from '../../services/modelService';
import { renderTemplate } from '../../services/promptTemplates';
import { addMediaHistory } from '../../services/storageService';
import { ProjectState, PropertieVariation, Properties } from '../../types';
import FileUploadModal, { downloadImage } from '../FileUploadModal';
import { useDialog } from '../dialog';

interface Props {
  prop: Properties | null;
  project: ProjectState;
  localStyle: string;
  imageSize: string;
  processingState: {id: string, type: 'character'|'scene'|'props'}|null;
  setProcessingState: (state: {id: string, type: 'character'|'scene'|'props'}|null) => void;
  updateProject: (updates: Partial<ProjectState>) => void;
  onClose: () => void;
  setPreviewImage: (image:string)=>void;
}

const PropsModal: React.FC<Props> = ({
  prop,
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

  // Variation Form State
  const [newVarName, setNewVarName] = useState("");
  const [newVarPrompt, setNewVarPrompt] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [fileUploadModalOpen, setFileUploadModalOpen] = useState(false);
  const [uploadingVariationId, setUploadingVariationId] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);

  // Sync description when prop is selected
  useEffect(() => {
    if (prop) {
      setEditingDescription(prop.description || '');
    }
  }, [prop]);

  const handleAddVariation = () => {
    if (!project.scriptData || !prop) return;
    const newData = { ...project.scriptData };
    const p = newData.props?.find(p => p.id === prop.id);
    if (!p) return;

    const newVar: PropertieVariation = {
      id: `var-${Date.now()}`,
      name: newVarName || "新造型",
      visualPrompt: newVarPrompt || prop.description || "",
      referenceImage: undefined
    };

    if (!p.variations) p.variations = [];
    p.variations.push(newVar);

    updateProject({ scriptData: newData });
    setNewVarName("");
    setNewVarPrompt("");
  };

  const handleGenerateVariation = async (varId: string) => {
    if (!prop) return;
    const variation = prop.variations?.find(v => v.id === varId);
    if (!variation) return;

    setProcessingState({ id: varId, type: 'props' });

    try {
      const refImages = prop.referenceImage ? [prop.referenceImage] : [];
      const basePrompt = prop.description;
      const prompt = basePrompt || await ModelService.generateVisualPrompts('props', prop, project.scriptData?.genre || '剧情片', project.visualStyle);

      const enhancedPrompt = renderTemplate('GENERATE_PROP_VARIATION', prop.name, localStyle, variation.visualPrompt, prompt);

      const imageUrl = await ModelService.generateImage(enhancedPrompt, refImages, "variation", localStyle, '1728x2304', 1, {}, project.id);

      // Save to media history
      if (imageUrl) {
        const variation = prop.variations?.find(v => v.id === varId);
        const fileName = variation ? `${variation.name}_${prop.name}` : `造型_${varId}_${prop.name}`;
        await addMediaHistory(project.id, imageUrl, fileName, 'image', 'props', enhancedPrompt);
      }

      const newData = { ...project.scriptData! };
      const p = newData.props?.find(p => p.id === prop.id);
      const v = p?.variations?.find(v => v.id === varId);
      if (v) v.referenceImage = imageUrl;

      updateProject({ scriptData: newData });
    } catch (e) {
      console.error(e);
      await dialog.alert({ title: '错误', message: '造型图生成失败', type: 'error' });
    } finally {
      setProcessingState(null);
    }
  };

  const handleDeleteVariation = async (varId: string) => {
    if (!project.scriptData || !prop) return;

    const confirmed = await dialog.confirm({
      title: '确认删除',
      message: '确定要删除此造型吗？此操作不可撤销。',
      type: 'warning',
    });

    if (!confirmed) return;

    const newData = { ...project.scriptData };
    const p = newData.props?.find(p => p.id === prop.id);
    if (!p || !p.variations) return;

    p.variations = p.variations.filter(v => v.id !== varId);
    updateProject({ scriptData: newData });
  };

  const handleSaveDescription = () => {
    if (!project.scriptData || !prop) return;

    const newData = { ...project.scriptData };
    const p = newData.props?.find(p => p.id === prop.id);
    if (p) {
      p.description = editingDescription;
      updateProject({ scriptData: newData });
    }
  };

  const handleDownloadImage = async (imageUrl: string, name: string) => {
    if (downloadStatus) return;
    setDownloadStatus('downloading');
    try {
      await downloadImage(imageUrl, `${project.scriptData?.title}-${prop.name}-造型-${name}.png`, dialog);
    } finally {
      setDownloadStatus(null);
    }
  };

  const handleFileUploadClick = (varId: string) => {
    setUploadingVariationId(varId);
    setFileUploadModalOpen(true);
  };

  const handleFileUploadSuccess = (fileUrl: string) => {
    if (!project.scriptData || !prop || !uploadingVariationId) return;

    const newData = { ...project.scriptData };
    const p = newData.props?.find(p => p.id === prop.id);
    if (p && p.variations) {
      const variation = p.variations.find(v => v.id === uploadingVariationId);
      if (variation) {
        variation.referenceImage = fileUrl;
        updateProject({ scriptData: newData });
      }
    }
    setUploadingVariationId(null);
  };

  if (!prop) return null;

  return (
    <div className="absolute inset-0 z-40 bg-slate-700/90 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in duration-200">
      <div className="bg-slate-800 border border-slate-600 w-full max-w-4xl max-h-[80vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="h-16 px-6 border-b border-slate-600 flex items-center justify-between shrink-0 bg-slate-600/80">
          <h3 className="text-lg font-bold text-slate-50 flex items-center gap-2">
            <Drill className="w-5 h-5 text-slate-400" /> 道具造型
          </h3>
          <button onClick={onClose} className="p-2 bg-slate-700 hover:bg-slate-800 rounded-full transition-colors cursor-pointer">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 p-2 md:p-6 bg-slate-700 space-y-5 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-6">
            {/* Base Look */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Package className="w-4 h-4 text-slate-400" /> <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">基础形象</span>
              </h4>
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-600">
                <div className="aspect-square bg-slate-900 rounded-lg overflow-hidden mb-4 relative cursor-pointer" onClick={() => setPreviewImage(prop.referenceImage)}>
                  {prop.referenceImage ? (
                    <img src={prop.referenceImage} className="w-full h-full object-cover hover:scale-105 transition-transform duration-200" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-600">无图像</div>
                  )}
                  <div className="absolute top-2 left-2 px-2 py-1 bg-slate-700/60 backdrop-blur rounded text-[12px] text-slate-50 font-bold uppercase border border-white/10">{prop.name}</div>
                  {prop.referenceImage && (
                    <div className="absolute inset-0 bg-slate-700/0 hover:bg-slate-700/20 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                      <span className="text-slate-50/80 text-xs font-bold uppercase tracking-wider">点击预览</span>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[12px] text-slate-300 uppercase tracking-wider font-bold">描述</label>
                  <textarea
                    value={editingDescription}
                    onChange={(e) => setEditingDescription(e.target.value)}
                    onBlur={handleSaveDescription}
                    placeholder="输入道具的描述..."
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-[12px] text-slate-50 placeholder:text-slate-600 focus:outline-none focus:border-slate-500 transition-colors resize-none h-24 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Variations */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Drill className="w-4 h-4 text-slate-400" /> <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">道具造型</span>
                </h4>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 overflow-y-auto max-h-[calc(40vh-155px)] py-2">
                  {/* List */}
                  {(prop.variations || []).map((variation) => (
                    <div key={variation.id} className="flex gap-4 p-4 bg-slate-800 border border-slate-600 rounded-xl group hover:border-slate-300 transition-colors">
                      <div className={`w-24 h-24 bg-slate-900 rounded-lg flex-shrink-0 overflow-hidden relative border border-slate-600 ${variation.referenceImage && !(processingState?.type === 'props' && processingState?.id === variation.id) ? 'cursor-pointer' : ''}`} onClick={variation.referenceImage && !(processingState?.type === 'props' && processingState?.id === variation.id) ? () => setPreviewImage(variation.referenceImage) : undefined}>
                        {variation.referenceImage ? (
                          <img src={variation.referenceImage} className="w-full h-full object-cover hover:scale-105 transition-transform duration-200" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-6 h-6 text-slate-600" />
                          </div>
                        )}
                        {variation.referenceImage && !(processingState?.type === 'props' && processingState?.id === variation.id) && (
                          <div className="absolute inset-0 bg-slate-700/0 hover:bg-slate-700/20 transition-colors flex items-center justify-center opacity-0 hover:opacity-100 pointer-events-none">
                            <span className="text-slate-50/80 text-[10px] font-bold uppercase tracking-wider">预览</span>
                          </div>
                        )}
                        {processingState?.type === 'props' && processingState?.id === variation.id && (
                          <div className="absolute inset-0 bg-slate-700/60 flex items-center justify-center">
                            <Loader2 className="w-4 h-4 text-slate-50 animate-spin" />
                          </div>
                        )}
                        <div className="absolute bottom-0 right-0 flex items-center justify-center gap-1 p-1">
                          {variation.referenceImage && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDownloadImage(variation.referenceImage!, variation.name); }}
                              className="p-2 bg-slate-700/50 text-slate-50 rounded-full hover:bg-slate-800 hover:text-slate-50 transition-colors border border-white/10 backdrop-blur"
                              title="下载图片"
                              disabled={!!downloadStatus}
                            >
                              <Download className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleFileUploadClick(variation.id); }}
                            disabled={!!processingState}
                            className="p-2 bg-slate-700/50 text-slate-50 rounded-full hover:bg-slate-800 hover:text-slate-50 transition-colors border border-white/10 backdrop-blur disabled:opacity-50 disabled:cursor-not-allowed"
                            title="上传图片"
                          >
                            <Upload className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-2">
                          <h5 className="font-bold text-slate-200 text-sm line-clamp-2">{variation.name}</h5>
                          <button onClick={() => handleDeleteVariation(variation.id)} className="text-slate-600 hover:text-red-500 cursor-pointer"><X className="w-3 h-3"/></button>
                        </div>
                        <p className="text-[12px] text-slate-500 line-clamp-3 mb-3 font-mono">{variation.visualPrompt}</p>
                        <button
                          onClick={() => handleGenerateVariation(variation.id)}
                          disabled={!!processingState}
                          className="text-[12px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-50 flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <RefreshCw className={`w-3 h-3 ${processingState?.type === 'props' && processingState?.id === variation.id ? 'animate-spin' : ''}`} />
                          {processingState?.type === 'props' && processingState?.id === variation.id ? '生成中...' : variation.referenceImage ? '重新生成' : '生成造型'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Add New */}
              <div className="p-4 border border-dashed border-slate-600 rounded-xl bg-slate-800/20">
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="造型名称（示例：红色版本）"
                    value={newVarName}
                    onChange={e => setNewVarName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-xs text-slate-50 placeholder:text-slate-600 focus:border-slate-500 focus:outline-none transition-all"
                  />
                  <textarea
                    placeholder="造型的视觉描述……"
                    value={newVarPrompt}
                    onChange={e => setNewVarPrompt(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-xs text-slate-50 placeholder:text-slate-600 focus:border-slate-500 focus:outline-none transition-all resize-none h-16"
                  />
                  <button
                    onClick={handleAddVariation}
                    disabled={!newVarName || !newVarPrompt}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2"
                  >
                    <Plus className="w-3 h-3" /> 添加造型
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* File Upload Modal */}
      <FileUploadModal
        isOpen={fileUploadModalOpen}
        onClose={() => setFileUploadModalOpen(false)}
        onUploadSuccess={handleFileUploadSuccess}
        fileType="wardrobe"
        acceptTypes="image/png,image/jpeg,image/jpg"
        title="上传造型图片"
        projectid={project.id}
        project={project}
        filterType='props'
      />
    </div>
  );
};

export default PropsModal;
