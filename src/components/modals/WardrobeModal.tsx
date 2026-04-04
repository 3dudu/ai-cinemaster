import { Download, Edit2, Loader2, Plus, RefreshCw, Shirt, Sparkles, Upload, User, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { ModelService } from '../../services/modelService';
import { renderTemplate } from '../../services/promptTemplates';
import { addMediaHistory } from '../../services/storageService';
import { Character, CharacterVariation, ProjectState, SeriesRecord } from '../../types';
import { useDialog } from '../dialog';
import FileUploadModal, { downloadImage } from './FileUploadModal';

interface Props {
  character: Character | null;
  series?: SeriesRecord | null;
  updateSeries?: (series: SeriesRecord) => void;
  project: ProjectState;
  localStyle: string;
  imageSize: string;
  processingState: {id: string, type: 'character'|'scene'}|null;
  setProcessingState: (state: {id: string, type: 'character'|'scene'}|null) => void;
  updateProject: (updates: Partial<ProjectState>) => void;
  onClose: () => void;
  setPreviewImage: (image:string)=>void;
}

const WardrobeModal: React.FC<Props> = ({
  character,
  series,
  updateSeries,
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
  const [fileUploadModalOpen, setFileUploadModalOpen] = useState(false);
  const [uploadingVariationId, setUploadingVariationId] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  // Edit State
  const [editingVariationId, setEditingVariationId] = useState<string | null>(null);
  const [editVarName, setEditVarName] = useState("");
  const [editVarPrompt, setEditVarPrompt] = useState("");
  // AI Generation State
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

  // Check if in series mode
  const isSeriesMode = !!series && !!updateSeries;

  // Memoized characters to prevent re-calculation
  const characters = useMemo(() => {
    if (isSeriesMode && series?.library?.characters) {
      return series.library.characters;
    }
    return project.scriptData?.characters || [];
  }, [isSeriesMode, series?.library?.characters, project.scriptData?.characters]);

  // Helper: Get character data source (project scriptData or series library)
  const getCharacters = (): Character[] => {
    return characters;
  };

  // Helper: Update character data
  const updateCharacter = (updatedChar: Character) => {
    if (isSeriesMode && series && updateSeries) {
      const newLibrary = { ...series.library };
      const charIndex = newLibrary.characters?.findIndex(c => c.id === updatedChar.id);
      if (charIndex !== undefined && charIndex >= 0) {
        newLibrary.characters[charIndex] = updatedChar;
        updateSeries({ ...series, library: newLibrary });
      }
    } else {
      const newData = { ...project.scriptData! };
      const charIndex = newData.characters.findIndex(c => c.id === updatedChar.id);
      if (charIndex >= 0) {
        newData.characters[charIndex] = updatedChar;
        updateProject({ scriptData: newData });
      }
    }
  };

  const handleAddVariation = () => {
      if (!character) return;
      const characters = getCharacters();
      const char = characters.find(c => c.id === character.id);
      if (!char) return;

      const newVar: CharacterVariation = {
          id: `var-${Date.now()}`,
          name: newVarName || "New Outfit",
          visualPrompt: newVarPrompt || character.visualPrompt || "",
          referenceImage: undefined
      };

      const updatedChar = { ...char };
      if (!updatedChar.variations) updatedChar.variations = [];
      updatedChar.variations = [...updatedChar.variations, newVar];

      updateCharacter(updatedChar);
      setNewVarName("");
      setNewVarPrompt("");
  };

  const handleStartEdit = (variation: CharacterVariation) => {
      setEditingVariationId(variation.id);
      setEditVarName(variation.name);
      setEditVarPrompt(variation.visualPrompt || "");
  };

  const handleCancelEdit = () => {
      setEditingVariationId(null);
      setEditVarName("");
      setEditVarPrompt("");
  };

  const handleSaveEdit = () => {
      if (!character || !editingVariationId) return;
      const characters = getCharacters();
      const char = characters.find(c => c.id === character.id);
      if (!char) return;

      const updatedChar = { ...char };
      const variation = updatedChar.variations?.find(v => v.id === editingVariationId);
      if (variation) {
          variation.name = editVarName || variation.name;
          variation.visualPrompt = editVarPrompt;
          updateCharacter(updatedChar);
      }

      setEditingVariationId(null);
      setEditVarName("");
      setEditVarPrompt("");
  };

  const handleGenerateEditPrompt = async () => {
      if (!character) return;
      setIsGeneratingPrompt(true);
      try {
          const prompt = await ModelService.generateVisualPrompts(
              'variation',
              {
                  ...character,
                  styleName: editingVariationId?editVarName:newVarName,
                  stylePrompt: editingVariationId?editVarPrompt:newVarPrompt
              },
              project.scriptData?.genre || '剧情片',
              localStyle,
              editingVariationId?editVarName:newVarName,
              editingVariationId?editVarPrompt:newVarPrompt
          );
          if (prompt) {
              editingVariationId?setEditVarPrompt(prompt):setNewVarPrompt(prompt);
          }
      } catch (error) {
          console.error('生成视觉提示词失败:', error);
          await dialog.alert({ title: '错误', message: '生成视觉提示词失败', type: 'error' });
      } finally {
          setIsGeneratingPrompt(false);
      }
  };

  const handleGenerateVariation = async (varId: string) => {
      if (!character) return;
      const variation = character?.variations?.find(v => v.id === varId);
      if (!character || !variation) return;

      setProcessingState({ id: varId, type: 'character' });

      try {
          // IMPORTANT: Use Base Look as reference to maintain facial consistency
          const refImages = character.referenceImage ? [character.referenceImage] : [];
          const prompt = character.visualPrompt || await ModelService.generateVisualPrompts('character', character, project.scriptData?.genre || '剧情片',project.visualStyle);

          // Enhance prompt to emphasize character consistency
          const enhancedPrompt = renderTemplate('GENERATE_CHARACTER_VARIATION',
            character.name,
            localStyle,
            variation.visualPrompt,
            prompt
          );

          const imageUrl = await ModelService.generateImage(enhancedPrompt, refImages, "variation", localStyle, '2560x1440',1,{},project.id,character.id);

          // Save to media history
          if (imageUrl) {
            const variation = character.variations?.find(v => v.id === varId);
            const fileName = variation ? `${variation.name}_${character.name}` : `造型_${varId}_${character.name}`;
            await addMediaHistory(isSeriesMode?series.id:project.id, imageUrl, fileName, 'image', 'character',enhancedPrompt);
          }

          const characters = getCharacters();
          const c = characters.find(c => c.id === character.id);
          if (c) {
            const updatedChar = { ...c };
            const v = updatedChar.variations?.find(v => v.id === varId);
            if (v) {
              v.referenceImage = imageUrl;
              updateCharacter(updatedChar);
            }
          }
      } catch (e) {
          console.error(e);
          await dialog.alert({ title: '错误', message: '造型图生成失败', type: 'error' });
      } finally {
          setProcessingState(null);
      }
  };

  const handleDeleteVariation = async (varId: string) => {
     if (!project.scriptData || !character) return;

     const confirmed = await dialog.confirm({
       title: '确认删除',
       message: '确定要删除此造型吗？此操作不可撤销。',
       type: 'warning',
     });

     if (!confirmed) return;

      const characters = getCharacters();
      const char = characters.find(c => c.id === character.id);
      if (!char) return;

      const updatedChar = { ...char };
      updatedChar.variations = (updatedChar.variations || []).filter(v => v.id !== varId);
      updateCharacter(updatedChar);
  };

  const handleDownloadImage = async (imageUrl: string, name: string) => {
    if(downloadStatus)return;
    setDownloadStatus('downloading');
    try{
        await downloadImage(imageUrl, `${project.scriptData?.title}-${character.name}-造型-${name}.png`, dialog);
    }finally{
        setDownloadStatus(null);
    }

  };

  const handleFileUploadClick = (varId: string) => {
    setUploadingVariationId(varId);
    setFileUploadModalOpen(true);
  };

  const handleFileUploadSuccess = (fileUrl: string) => {
    if (!character || !uploadingVariationId) return;

    const characters = getCharacters();
    const char = characters.find(c => c.id === character.id);
    if (char) {
      const variation = char.variations?.find(v => v.id === uploadingVariationId);
      if (variation) {
        const updatedChar = { ...char };
        const updatedVariation = updatedChar.variations?.find(v => v.id === uploadingVariationId);
        if (updatedVariation) {
          updatedVariation.referenceImage = fileUrl;
          updateCharacter(updatedChar);
        }
      }
    }
    setUploadingVariationId(null);
  };

  if (!character) return null;

  return (
    <div className="absolute inset-0 z-45 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in duration-200">
        <div className="bg-slate-800 border border-slate-600 w-full max-w-4xl max-h-[80vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="h-16 px-6 border-b border-slate-600 flex items-center justify-between shrink-0 bg-slate-600/80">
                <h3 className="text-lg font-bold text-slate-50 flex items-center gap-2">
                    <Shirt className="w-5 h-5 text-slate-400" />服装造型
                </h3>
                <button onClick={onClose} className="p-2 bg-slate-700 hover:bg-slate-800 rounded-full transition-colors cursor-pointer">
                    <X className="w-5 h-5 text-slate-500" />
                </button>
            </div>
            {/* Modal Body */}
            <div className="flex-1 p-2 md:p-6 bg-slate-700 space-y-5 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-6">
                    {/* Base Look */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-slate-400 tracking-widest mb-4 flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-400" /> <h4 className="text-sm font-bold text-slate-300 tracking-wider">基础形象</h4>
                        </h4>
                        <div className="bg-slate-800 p-4 rounded-xl border border-slate-600">
                            <div className="aspect-[16/9] bg-slate-900 rounded-lg overflow-hidden mb-4 relative cursor-pointer" onClick={() =>  setPreviewImage(character.referenceImage)}>
                                {character.referenceImage ? (
                                    <img src={character.referenceImage} className="w-full h-full object-cover hover:scale-105 transition-transform duration-200" />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-slate-600">无图像</div>
                                )}
                                <div className="absolute top-2 left-2 px-2 py-1 bg-slate-700/60 backdrop-blur rounded text-[12px] text-slate-50 font-bold border border-white/10">{character.name}</div>
                                {character.referenceImage && (
                                    <div className="absolute inset-0 bg-slate-700/0 hover:bg-slate-700/20 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                                        <span className="text-slate-50/80 text-xs font-bold tracking-wider">点击预览</span>
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
                                            <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                                                <Edit2 className="w-3 h-3" /> 编辑造型
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
                                            placeholder="造型名称"
                                            value={editVarName}
                                            onChange={e => setEditVarName(e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-xs text-slate-50 placeholder:text-slate-600 focus:border-slate-500 focus:outline-none transition-all"
                                        />
                                        <div className={`relative ${isGeneratingPrompt ? 'ai-generating-border' : ''}`}>
                                            <textarea
                                                placeholder="服饰 / 状态的视觉描述……"
                                                value={editVarPrompt}
                                                onChange={e => setEditVarPrompt(e.target.value)}
                                                className={`w-full bg-slate-800 border rounded px-3 py-2 pb-10 text-xs text-slate-50 placeholder:text-slate-600 focus:outline-none transition-all resize-none h-49 ${
                                                  isGeneratingPrompt ? 'border-transparent' : 'border-slate-600 focus:border-slate-500'
                                                }`}
                                            />
                                            {/* 底部浮动按钮 */}
                                            <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-slate-800/80 backdrop-blur-sm border border-slate-600 rounded-b flex items-center justify-between">
                                                {/* 左边字数统计 */}
                                                <span className="text-[10px] text-slate-400 font-mono">
                                                    {editVarPrompt.length} 字
                                                </span>
                                                {/* AI生成按钮 */}
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
                                        <button
                                            onClick={handleSaveEdit}
                                            disabled={!editVarName.trim()}
                                            className="w-full py-2 bg-amber-600/80 hover:bg-amber-600 text-slate-50 rounded text-xs font-bold tracking-wider flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Edit2 className="w-3 h-3" /> 保存修改
                                        </button>
                                    </div>
                                ) : (
                                    // Add Mode
                                    <div className="space-y-3">
                                        <input
                                            type="text"
                                            placeholder="造型名称（示例：穿校服）"
                                            value={newVarName}
                                            onChange={e => setNewVarName(e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-xs text-slate-50 placeholder:text-slate-600 focus:border-slate-500 focus:outline-none transition-all"
                                        />
                                                                                <div className={`relative ${isGeneratingPrompt ? 'ai-generating-border' : ''}`}>
                                        <textarea
                                            placeholder="服饰 / 状态的视觉描述……"
                                            value={newVarPrompt}
                                            onChange={e => setNewVarPrompt(e.target.value)}
                                            className={`w-full bg-slate-800 border rounded px-3 py-2 text-xs text-slate-50 placeholder:text-slate-600 focus:outline-none transition-all resize-none h-56 ${
                                              isGeneratingPrompt ? 'border-transparent' : 'border-slate-600 focus:border-slate-500'
                                            }`}
                                        />
                                                                                    {/* 底部浮动按钮 */}
                                            <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-slate-800/80 backdrop-blur-sm border border-slate-600 rounded-b flex items-center justify-between">
                                                {/* 左边字数统计 */}
                                                <span className="text-[10px] text-slate-400 font-mono">
                                                    {editVarPrompt.length} 字
                                                </span>
                                                {/* AI生成按钮 */}
                                                <button
                                                    onClick={handleGenerateEditPrompt}
                                                    disabled={isGeneratingPrompt || !newVarPrompt.trim()}
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
                                        <button
                                            onClick={handleAddVariation}
                                            disabled={!newVarName || !newVarPrompt}
                                            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-bold tracking-wider flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Plus className="w-3 h-3" /> 添加造型
                                        </button>
                                    </div>
                                )}
                            </div>
                    </div>

                    {/* Variations */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-xs font-bold text-slate-400 tracking-widest flex items-center gap-2">
                                <Shirt className="w-4 h-4 text-slate-400" /> <h4 className="text-sm font-bold text-slate-300 tracking-wider">服装造型</h4>
                            </h4>
                        </div>

                        <div className="space-y-4">
                            <div className="overflow-y-auto h-[45vh]"> 
                            <div className="grid grid-cols-2 gap-4"> 
                            {/* List */}
                            {(character.variations || []).map((variation) => (
                                <div key={variation.id} className="flex aspect-square overflow-hidden flex-col gap-4 p-4 bg-slate-800 border border-slate-600 rounded-xl group hover:border-slate-300 transition-colors">
                                    <div className={`aspect-[16/9] bg-slate-900 rounded-lg flex-shrink-0 overflow-hidden relative border border-slate-600 ${variation.referenceImage && !(processingState?.type === 'character' && processingState?.id === variation.id) ? 'cursor-pointer' : ''}`} onClick={variation.referenceImage && !(processingState?.type === 'character' && processingState?.id === variation.id) ? () => setPreviewImage(variation.referenceImage) : undefined}>
                                        {variation.referenceImage ? (
                                            <img src={variation.referenceImage} className="w-full h-full object-contain hover:scale-105 transition-transform duration-200" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Shirt className="w-6 h-6 text-slate-600" />
                                            </div>
                                        )}
                                        {variation.referenceImage && !(processingState?.type === 'character' && processingState?.id === variation.id) && (
                                            <div className="absolute inset-0 bg-slate-700/0 hover:bg-slate-700/20 transition-colors flex items-center justify-center opacity-0 hover:opacity-100 pointer-events-none">
                                                <span className="text-slate-50/80 text-[10px] font-bold tracking-wider">预览</span>
                                            </div>
                                        )}
                                        {processingState?.type === 'character' && processingState?.id === variation.id && (
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
                                        <button onClick={(e) => { e.stopPropagation(); handleStartEdit(variation); }} className="p-2 rounded-full bg-slate-700/50 text-slate-50  hover:bg-slate-800 hover:text-amber-400 cursor-pointer" title="编辑"><Edit2 className="w-3 h-3"/></button>
                                        <button onClick={() => handleDeleteVariation(variation.id)} className="p-2 rounded-full bg-slate-700/50 p-1 text-slate-50  hover:bg-slate-800 hover:text-red-500 cursor-pointer" title="删除"><X className="w-3 h-3"/></button>
</div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-2">
                                            <h5 className="font-bold text-slate-200 text-sm line-clamp-2">{variation.name}</h5>
                                        <button
                                            onClick={() => handleGenerateVariation(variation.id)}
                                            disabled={!!processingState}
                                            className="text-[12px] font-bold tracking-wider text-slate-400 hover:text-slate-50 flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <RefreshCw className={`w-3 h-3 ${processingState?.type === 'character' && processingState?.id === variation.id ? 'animate-spin' : ''}`} />
                                            {processingState?.type === 'character' && processingState?.id === variation.id ? '生成中...' : variation.referenceImage ? '重新生成' : '生成造型'}
                                        </button>
                                        </div>
                                        <p className="text-[12px] text-slate-500 line-clamp-3 font-mono">{variation.visualPrompt}</p>
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
          filePath="variation/upload"
          acceptTypes="image/png,image/jpeg,image/jpg"
          title="上传造型图片"
          projectid={project.id}
          project={project}
          filterType='character'
        />
    </div>
  );
};

export default WardrobeModal;
