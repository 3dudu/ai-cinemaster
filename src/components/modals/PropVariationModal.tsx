import { Box, Copy, Download, Edit2, Loader2, Plus, RefreshCw, Sparkles, Upload, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { renderTemplate } from '../../prompt/promptTemplates';
import { ModelService } from '../../services/modelService';
import { addMediaHistory } from '../../services/storageService';
import { ProjectState, Properties, PropertieVariation, SeriesRecord } from '../../types';
import { useDialog } from '../dialog';
import FileUploadModal, { downloadImage } from './FileUploadModal';

interface Props {
  prop: Properties | null;
  series?: SeriesRecord | null;
  updateSeries?: (series: SeriesRecord) => void;
  project: ProjectState;
  localStyle: string;
  imageSize: string;
  processingState: { id: string; type: 'character' | 'scene' | 'prop' } | null;
  setProcessingState: (state: { id: string; type: 'character' | 'scene' | 'prop' } | null) => void;
  updateProject: (updates: Partial<ProjectState>) => void;
  onClose: () => void;
  setPreviewImage: (image: string) => void;
}

const PropVariationModal: React.FC<Props> = ({
  prop,
  series,
  updateSeries,
  project,
  localStyle,
  imageSize,
  processingState,
  setProcessingState,
  updateProject,
  onClose,
  setPreviewImage,
}) => {
  const dialog = useDialog();
  // Variation Form State
  const [newVarName, setNewVarName] = useState('');
  const [newVarPrompt, setNewVarPrompt] = useState('');
  const [fileUploadModalOpen, setFileUploadModalOpen] = useState(false);
  const [uploadingVariationId, setUploadingVariationId] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  // Edit State
  const [editingVariationId, setEditingVariationId] = useState<string | null>(null);
  const [editVarName, setEditVarName] = useState('');
  const [editVarPrompt, setEditVarPrompt] = useState('');
  // AI Generation State
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

  // Check if in series mode
  const isSeriesMode = !!series && !!updateSeries;

  // Memoized props to prevent re-calculation
  const activeProps = useMemo(() => {
    if (isSeriesMode && series?.library?.props) {
      return series.library.props;
    }
    return project.scriptData?.props || [];
  }, [isSeriesMode, series?.library?.props, project.scriptData?.props]);

  // Helper: Get props data
  const getProps = (): Properties[] => {
    return activeProps;
  };

  // Helper: Update prop data
  const updateProp = (updatedProp: Properties) => {
    if (isSeriesMode && series && updateSeries) {
      const newLibrary = { ...series.library };
      const propIndex = newLibrary.props?.findIndex((p) => p.id === updatedProp.id);
      if (propIndex !== undefined && propIndex >= 0) {
        newLibrary.props[propIndex] = updatedProp;
        updateSeries({ ...series, library: newLibrary });
      }
    } else {
      const newData = { ...project.scriptData! };
      const propIndex = newData.props?.findIndex((p) => p.id === updatedProp.id);
      if (propIndex !== undefined && propIndex >= 0) {
        newData.props[propIndex] = updatedProp;
        updateProject({ scriptData: newData });
      }
    }
  };

  const handleAddVariation = () => {
    if (!prop) return;
    const props = getProps();
    const currentProp = props.find((p) => p.id === prop.id);
    if (!currentProp) return;

    const newVar: PropertieVariation = {
      id: `propvar-${Date.now()}`,
      name: newVarName || '新形态',
      visualPrompt: newVarPrompt || prop.visualPrompt || '',
      referenceImage: undefined,
    };

    const updatedProp = { ...currentProp };
    if (!updatedProp.variations) updatedProp.variations = [];
    updatedProp.variations = [...updatedProp.variations, newVar];

    updateProp(updatedProp);
    setNewVarName('');
    setNewVarPrompt('');
  };

  const handleStartEdit = (variation: PropertieVariation) => {
    setEditingVariationId(variation.id);
    setEditVarName(variation.name);
    setEditVarPrompt(variation.visualPrompt || '');
  };

  const handleCancelEdit = () => {
    setEditingVariationId(null);
    setEditVarName('');
    setEditVarPrompt('');
  };

  const handleSaveEdit = () => {
    if (!prop || !editingVariationId) return;
    const props = getProps();
    const currentProp = props.find((p) => p.id === prop.id);
    if (!currentProp) return;

    const updatedProp = { ...currentProp };
    const variation = updatedProp.variations?.find((v) => v.id === editingVariationId);
    if (variation) {
      variation.name = editVarName || variation.name;
      variation.visualPrompt = editVarPrompt;
      updateProp(updatedProp);
    }

    setEditingVariationId(null);
    setEditVarName('');
    setEditVarPrompt('');
  };

  const handleGenerateEditPrompt = async () => {
    if (!prop) return;
    setIsGeneratingPrompt(true);
    try {
      const prompt = await ModelService.generateVisualPrompts(
        'prop',
        {
          ...prop,
          name: editingVariationId ? editVarName : newVarName,
          visualPrompt: editingVariationId ? editVarPrompt : newVarPrompt,
        },
        project.scriptData?.genre || '剧情片',
        localStyle,
        project.globalSettings
      );
      if (prompt) {
        if (editingVariationId) {
          setEditVarPrompt(prompt);
        } else {
          setNewVarPrompt(prompt);
        }
      }
    } catch (error) {
      console.error('生成视觉提示词失败:', error);
      await dialog.alert({ title: '错误', message: '生成视觉提示词失败', type: 'error' });
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handleGenerateVariation = async (varId: string) => {
    if (!prop) return;
    const variation = prop?.variations?.find((v) => v.id === varId);
    if (!prop || !variation) return;

    setProcessingState({ id: varId, type: 'prop' });

    try {
      // Use base image as reference for consistency
      const refImages = prop.referenceImage ? [prop.referenceImage] : [];
      const basePrompt =
        prop.visualPrompt ||
        (await ModelService.generateVisualPrompts(
          'prop',
          prop,
          project.scriptData?.genre || '剧情片',
          project.visualStyle,
          project.globalSettings
        ));

      // Enhance prompt for prop variation
      const enhancedPrompt = renderTemplate(
        'GENERATE_PROP_VARIATION',
        prop.name,
        localStyle,
        variation.visualPrompt,
        basePrompt
      );

      const imageUrl = await ModelService.generateImage(
        enhancedPrompt,
        refImages,
        'variation',
        localStyle,
        '2560x1440',
        1,
        {},
        project.id,
        prop.id
      );

      // Save to media history
      if (imageUrl) {
        const fileName = variation
          ? `${variation.name}_${prop.name}`
          : `形态_${varId}_${prop.name}`;
        await addMediaHistory(
          isSeriesMode ? series.id : project.id,
          imageUrl,
          fileName,
          'image',
          'prop',
          enhancedPrompt
        );
      }

      const props = getProps();
      const p = props.find((p) => p.id === prop.id);
      if (p) {
        const updatedProp = { ...p };
        const v = updatedProp.variations?.find((v) => v.id === varId);
        if (v) {
          v.referenceImage = imageUrl;
          updateProp(updatedProp);
        }
      }
    } catch (e) {
      console.error(e);
      await dialog.alert({ title: '错误', message: '道具形态图生成失败', type: 'error' });
    } finally {
      setProcessingState(null);
    }
  };

  const handleDeleteVariation = async (varId: string) => {
    if (!project.scriptData || !prop) return;

    const confirmed = await dialog.confirm({
      title: '确认删除',
      message: '确定要删除此道具形态吗？此操作不可撤销。',
      type: 'warning',
    });

    if (!confirmed) return;

    const props = getProps();
    const currentProp = props.find((p) => p.id === prop.id);
    if (!currentProp) return;

    const updatedProp = { ...currentProp };
    updatedProp.variations = (updatedProp.variations || []).filter((v) => v.id !== varId);
    updateProp(updatedProp);
  };

  const handleDownloadImage = async (imageUrl: string, name: string) => {
    if (downloadStatus) return;
    setDownloadStatus('downloading');
    try {
      await downloadImage(
        imageUrl,
        `${project.scriptData?.title}-${prop?.name}-形态-${name}.png`,
        dialog
      );
    } finally {
      setDownloadStatus(null);
    }
  };

  const handleFileUploadClick = (varId: string) => {
    setUploadingVariationId(varId);
    setFileUploadModalOpen(true);
  };

  const handleFileUploadSuccess = (fileUrl: string) => {
    if (!prop || !uploadingVariationId) return;

    const props = getProps();
    const currentProp = props.find((p) => p.id === prop.id);
    if (currentProp) {
      const variation = currentProp.variations?.find((v) => v.id === uploadingVariationId);
      if (variation) {
        const updatedProp = { ...currentProp };
        const updatedVariation = updatedProp.variations?.find((v) => v.id === uploadingVariationId);
        if (updatedVariation) {
          updatedVariation.referenceImage = fileUrl;
          updateProp(updatedProp);
        }
      }
    }
    setUploadingVariationId(null);
  };

  if (!prop) return null;

  return (
    <div className="absolute inset-0 z-45 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in duration-200">
        <div className="bg-slate-800 border border-slate-600 w-full max-w-4xl max-h-[80vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="h-16 px-6 border-b border-slate-600 flex items-center justify-between shrink-0 bg-slate-600/80">
          <h3 className="text-lg font-bold text-slate-50 flex items-center gap-2">
            <Box className="w-5 h-5 text-slate-300" />
            道具形态管理
          </h3>
          <button
            onClick={onClose}
            className="p-2 bg-slate-700 hover:bg-slate-900 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 text-slate-300" />
          </button>
        </div>
        {/* Modal Body */}
        <div className="flex-1 p-2 md:p-6 bg-slate-700 space-y-5 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-6">
            {/* Base Look */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-300 tracking-widest mb-4 flex items-center gap-2">
                <Box className="w-4 h-4 text-slate-300" />
                <span className="text-sm font-bold text-slate-200 tracking-wider">基础形象</span>
              </h4>
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-600">
                <div
                  className="aspect-[16/9] bg-slate-900 rounded-lg overflow-hidden mb-4 relative cursor-pointer"
                  onClick={() => setPreviewImage(prop.referenceImage)}
                >
                  {prop.referenceImage ? (
                    <img
                      src={prop.referenceImage}
                      className="w-full h-full object-contain hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-500">
                      无图像
                    </div>
                  )}
                  <div className="absolute top-2 left-2 px-2 py-1 bg-slate-700/60 backdrop-blur rounded text-[12px] text-slate-50 font-bold border border-white/10">
                    {prop.name}
                  </div>
                  {prop.referenceImage && (
                    <div className="absolute inset-0 bg-slate-700/0 hover:bg-slate-700/20 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                      <span className="text-slate-50/80 text-xs font-bold tracking-wider">
                        点击预览
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {/* Add New / Edit Form */}
              <div className="p-4 border border-dashed border-slate-600 rounded-xl bg-slate-800/20">
                {editingVariationId ? (
                  // Edit Mode
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                        <Edit2 className="w-3 h-3" /> 编辑形态
                      </span>
                      <button
                        onClick={handleCancelEdit}
                        className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        取消
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="形态名称"
                      value={editVarName}
                      onChange={(e) => setEditVarName(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none transition-all"
                    />
                    <div className={`relative ${isGeneratingPrompt ? 'ai-generating-border' : ''}`}>
                      <textarea
                        placeholder="道具形态的视觉描述……"
                        value={editVarPrompt}
                        onChange={(e) => setEditVarPrompt(e.target.value)}
                        className={`w-full bg-slate-800 border rounded px-3 py-2 pb-10 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none transition-all resize-none h-49 ${
                          isGeneratingPrompt
                            ? 'border-transparent'
                            : 'border-slate-600 focus:border-slate-500'
                        }`}
                      />
                      {/* 底部浮动按钮 */}
                      <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-slate-800/80 backdrop-blur-sm border border-slate-600 rounded-b flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-mono">
                          {editVarPrompt.length} 字
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => navigator.clipboard.writeText(editVarPrompt)}
                            disabled={!editVarPrompt.trim()}
                            className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-slate-200 text-[10px] font-bold tracking-wider rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                            title="复制提示词"
                          >
                            <Copy className="w-2.5 h-2.5" />
                          </button>
                          <button
                            onClick={handleGenerateEditPrompt}
                            disabled={isGeneratingPrompt || !editVarName.trim()}
                            className="px-2 py-1 bg-slate-600 hover:bg-slate-500 text-slate-50 text-[10px] font-bold tracking-wider rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                            title="AI生成视觉提示"
                          >
                            {isGeneratingPrompt ? (
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            ) : (
                              <Sparkles className="w-2.5 h-2.5" />
                            )}
                            {isGeneratingPrompt ? '生成中...' : 'AI补齐'}
                          </button>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleSaveEdit}
                      disabled={!editVarName.trim()}
                      className="w-full py-2 bg-slate-600/80 hover:bg-slate-600 text-slate-50 rounded text-xs font-bold tracking-wider flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Edit2 className="w-3 h-3" /> 保存修改
                    </button>
                  </div>
                ) : (
                  // Add Mode
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="形态名称（示例：破损状态）"
                      value={newVarName}
                      onChange={(e) => setNewVarName(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none transition-all"
                    />
                    <div className={`relative ${isGeneratingPrompt ? 'ai-generating-border' : ''}`}>
                      <textarea
                        placeholder="道具形态的视觉描述……"
                        value={newVarPrompt}
                        onChange={(e) => setNewVarPrompt(e.target.value)}
                        className={`w-full bg-slate-800 border rounded px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none transition-all resize-none h-56 ${
                          isGeneratingPrompt
                            ? 'border-transparent'
                            : 'border-slate-600 focus:border-slate-500'
                        }`}
                      />
                      {/* 底部浮动按钮 */}
                      <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-slate-800/80 backdrop-blur-sm border border-slate-600 rounded-b flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-mono">
                          {newVarPrompt.length} 字
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => navigator.clipboard.writeText(newVarPrompt)}
                            disabled={!newVarPrompt.trim()}
                            className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-slate-200 text-[10px] font-bold tracking-wider rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                            title="复制提示词"
                          >
                            <Copy className="w-2.5 h-2.5" />
                          </button>
                          <button
                            onClick={handleGenerateEditPrompt}
                            disabled={isGeneratingPrompt || !newVarName.trim()}
                            className="px-2 py-1 bg-slate-600 hover:bg-slate-500 text-slate-50 text-[10px] font-bold tracking-wider rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                            title="AI生成视觉提示"
                          >
                            {isGeneratingPrompt ? (
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            ) : (
                              <Sparkles className="w-2.5 h-2.5" />
                            )}
                            {isGeneratingPrompt ? '生成中...' : 'AI补齐'}
                          </button>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleAddVariation}
                      disabled={!newVarName || !newVarPrompt}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-bold tracking-wider flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-3 h-3" /> 添加形态
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Variations */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-xs font-bold text-slate-300 tracking-widest flex items-center gap-2">
                  <Box className="w-4 h-4 text-slate-300" />
                  <span className="text-sm font-bold text-slate-200 tracking-wider">道具形态</span>
                </h4>
              </div>

              <div className="space-y-4">
                <div className="overflow-y-auto h-[45vh]">
                  <div className="grid grid-cols-2 gap-2 md:gap-4">
                    {/* List */}
                    {(prop.variations || []).map((variation) => (
                      <div
                        key={variation.id}
                        className="flex flex-col md:gap-4 md:p-4 p-2 gap-2 bg-slate-800 border border-slate-600 rounded-xl group hover:border-slate-300 transition-colors"
                      >
                        <div
                          className={`aspect-[16/9] flex-shrink-0 bg-slate-900 rounded-lg overflow-hidden relative border border-slate-600 ${
                            variation.referenceImage &&
                            !(processingState?.type === 'prop' && processingState?.id === variation.id)
                              ? 'cursor-pointer'
                              : ''
                          }`}
                          onClick={
                            variation.referenceImage &&
                            !(processingState?.type === 'prop' && processingState?.id === variation.id)
                              ? () => setPreviewImage(variation.referenceImage!)
                              : undefined
                          }
                        >
                          {variation.referenceImage ? (
                            <img
                              src={variation.referenceImage}
                              className="object-contain hover:scale-105 transition-transform duration-200"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Box className="w-6 h-6 text-slate-600" />
                            </div>
                          )}
                          {variation.referenceImage &&
                            !(processingState?.type === 'prop' && processingState?.id === variation.id) && (
                              <div className="absolute inset-0 bg-slate-700/0 hover:bg-slate-700/20 transition-colors flex items-center justify-center opacity-0 hover:opacity-100 pointer-events-none">
                                <span className="text-slate-50/80 text-[10px] font-bold tracking-wider">
                                  预览
                                </span>
                              </div>
                            )}
                          {processingState?.type === 'prop' && processingState?.id === variation.id && (
                            <div className="ai-generating-overlay"></div>
                          )}
                          <div className="absolute bottom-0 right-0 flex items-center justify-center gap-1 p-1">
                            {variation.referenceImage && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadImage(variation.referenceImage!, variation.name);
                                }}
                                className="p-2 bg-slate-700/50 text-slate-50 rounded-full hover:bg-slate-800 hover:text-slate-50 transition-colors border border-white/10 backdrop-blur"
                                title="下载图片"
                                disabled={!!downloadStatus}
                              >
                                <Download className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFileUploadClick(variation.id);
                              }}
                              disabled={!!processingState}
                              className="p-2 bg-slate-700/50 text-slate-50 rounded-full hover:bg-slate-800 hover:text-slate-50 transition-colors border border-white/10 backdrop-blur disabled:opacity-50 disabled:cursor-not-allowed"
                              title="上传图片"
                            >
                              <Upload className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(variation);
                              }}
                              className="p-2 rounded-full bg-slate-700/50 text-slate-50 hover:bg-slate-800 hover:text-slate-400 cursor-pointer"
                              title="编辑"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteVariation(variation.id)}
                              className="p-2 rounded-full bg-slate-700/50 p-1 text-slate-50 hover:bg-slate-800 hover:text-red-500 cursor-pointer"
                              title="删除"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <h5 className="font-bold text-slate-200 text-sm line-clamp-2">
                              {variation.name}
                            </h5>
                            <button
                              onClick={() => handleGenerateVariation(variation.id)}
                              disabled={!!processingState}
                              className="text-[12px] font-bold tracking-wider text-slate-400 hover:text-slate-50 flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <RefreshCw
                                className={`w-3 h-3 ${
                                  processingState?.type === 'prop' && processingState?.id === variation.id
                                    ? 'animate-spin'
                                    : ''
                                }`}
                              />
                              {processingState?.type === 'prop' && processingState?.id === variation.id
                                ? '生成中...'
                                : variation.referenceImage
                                ? '重新生成'
                                : '生成形态'}
                            </button>
                          </div>
                          <p className="text-[12px] text-slate-500 line-clamp-3 font-mono">
                            {variation.visualPrompt}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
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
        filePath="prop-variation/upload"
        acceptTypes="image/png,image/jpeg,image/jpg"
        title="上传道具形态图片"
        projectid={project.id}
        project={project}
        filterType="prop"
      />
    </div>
  );
};

export default PropVariationModal;
