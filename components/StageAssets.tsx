import { AlertCircle, Check, Download, Drama, Expand, Image, Loader2, MapPin, RefreshCw, Shirt, Sparkles, Upload, User, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { ModelService } from '../services/modelService';
import { addMediaHistory } from '../services/storageService';
import { ProjectState } from '../types';
import FileUploadModal, { downloadImage } from './FileUploadModal';
import WardrobeModal from './WardrobeModal';
import { useDialog } from './dialog';


interface Props {
  project: ProjectState;
  updateProject: (updates: Partial<ProjectState>) => void;
}

const StageAssets: React.FC<Props> = ({ project, updateProject }) => {
  const dialog = useDialog();
  const [processingState, setProcessingState] = useState<{id: string, type: 'character'|'scene'}|null>(null);
  const [batchProgress, setBatchProgress] = useState<{current: number, total: number} | null>(null);
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [localStyle, setLocalStyle] = useState(project.visualStyle || '真人写实');
  const [imageSize, setImageSize] = useState(project.imageSize || '2560x1440');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [fileUploadModalOpen, setFileUploadModalOpen] = useState(false);
  const [uploadingItem, setUploadingItem] = useState<{id: string, type: 'character'|'scene'}|null>(null);

  // Variation Form State
  const [editingSceneVisualPrompt, setEditingSceneVisualPrompt] = useState("");

  // Sync local state with project settings
  useEffect(() => {
    setLocalStyle(project.visualStyle || '真人写实');
    setImageSize(project.imageSize || '2560x1440');
  }, [project.visualStyle, project.imageSize]);

  // Sync visual prompt when scene is selected
  useEffect(() => {
    if (selectedSceneId && project.scriptData) {
      const scene = project.scriptData.scenes.find(s => s.id === selectedSceneId);
      if (scene) {
        setEditingSceneVisualPrompt(scene.visualPrompt || '');
      }
    }
  }, [selectedSceneId, project.scriptData]);

  const handleGenerateAsset = async (type: 'character' | 'scene', id: string, skipConfirm?: boolean) => {
    // Check if item already has a reference image (regenerate)
    const existingImage = type === 'character'
      ? project.scriptData?.characters.find(c => String(c.id) === String(id))?.referenceImage
      : project.scriptData?.scenes.find(s => String(s.id) === String(id))?.referenceImage;

    if (existingImage && !skipConfirm) {
      const itemName = type === 'character'
        ? project.scriptData?.characters.find(c => String(c.id) === String(id))?.name
        : project.scriptData?.scenes.find(s => String(s.id) === String(id))?.location;

      const confirmed = await dialog.confirm({
        title: '确认重新生成',
        message: `确定要重新生成${type === 'character' ? '角色' : '场景'}"${itemName}"的图片吗？`,
        type: 'warning',
      });

      if (!confirmed) {
        setProcessingState(null);
        return;
      }
    }

    setProcessingState({ id, type });
    let imageUrl: string | null = null;
    let prompt = "";
    try {
      // Find the item
      let imagesize = '2560x1440';
      if (type === 'character') {
        imagesize = '1728x2304';
        const char = project.scriptData?.characters.find(c => String(c.id) === String(id));
        if (char) prompt = char.visualPrompt || await ModelService.generateVisualPrompts('character', char, project.scriptData?.genre || '剧情片',project.visualStyle);
      } else {
        const scene = project.scriptData?.scenes.find(s => String(s.id) === String(id));
        if (scene) prompt = scene.visualPrompt || await ModelService.generateVisualPrompts('scene', scene, project.scriptData?.genre || '剧情片',project.visualStyle);
      }

      // Real API Call
      imageUrl = await ModelService.generateImage(prompt, [], type, localStyle, imagesize,1,null,project.id,id);

      // Save to media history
      if (imageUrl) {
        const fileName = type === 'character'
          ? `角色_${project.scriptData?.characters.find(c => String(c.id) === String(id))?.name || id}`
          : `场景_${project.scriptData?.scenes.find(s => String(s.id) === String(id))?.id || id}`;
        await addMediaHistory(project.id, imageUrl, fileName, 'image', type);
      }

    } catch (e) {
      console.error(e);
      if(e.message?.includes("enough")){
        await dialog.alert({ title: '错误', message: '余额不足，请充值', type: 'error' });
      }else{
        await dialog.alert({ title: '错误', message: '生成失败，请重试。'+e?.message, type: 'error' });
      }
    } finally {
      // Update state
      if (project.scriptData) {
        const newData = { ...project.scriptData };
        if (type === 'character') {
          const c = newData.characters.find(c => String(c.id) === String(id));
          if (c) {
            c.referenceImage = imageUrl;
            c.visualPrompt = prompt;
          }
        } else {
          const s = newData.scenes.find(s => String(s.id) === String(id));
          if (s) {
            s.referenceImage = imageUrl;
            s.visualPrompt = prompt;
          }
        }
        updateProject({ scriptData: newData });
      }
      setProcessingState(null);
    }
  };

  const handleBatchGenerate = async (type: 'character' | 'scene') => {
    const items = type === 'character' 
      ? project.scriptData?.characters 
      : project.scriptData?.scenes;
    
    if (!items) return;

    // Filter items that need generation
    const itemsToGen = items.filter(i => !i.referenceImage);
    const isRegenerate = itemsToGen.length === 0;

    if (isRegenerate) {
       const confirmed = await dialog.confirm({
         title: '确认重新生成',
         message: `确定要重新生成所有${type === 'character' ? '角色' : '场景'}图吗？`,
         type: 'warning',
       });
       if (!confirmed) return;
    }

    const targetItems = isRegenerate ? items : itemsToGen;

    setBatchProgress({ current: 0, total: targetItems.length });

    for (let i = 0; i < targetItems.length; i++) {
      // Rate Limit Mitigation: 3s delay
      if (i > 0) await new Promise(r => setTimeout(r, 3000));

      await handleGenerateAsset(type, targetItems[i].id, true);
      setBatchProgress({ current: i + 1, total: targetItems.length });
    }

    setBatchProgress(null);
  };

  const handleFileUploadClick = (itemId: string, itemType: 'character' | 'scene') => {
    setUploadingItem({ id: itemId, type: itemType });
    setFileUploadModalOpen(true);
  };

  const handleFileUploadSuccess = (fileUrl: string) => {
    if (!project.scriptData || !uploadingItem) return;

    const newData = { ...project.scriptData };

    if (uploadingItem.type === 'character') {
      const char = newData.characters.find(c => c.id === uploadingItem.id);
      if (char) {
        char.referenceImage = fileUrl;
      }
    } else {
      const scene = newData.scenes.find(s => s.id === uploadingItem.id);
      if (scene) {
        scene.referenceImage = fileUrl;
      }
    }

    updateProject({ scriptData: newData });
    setUploadingItem(null);
  };

  const handleSaveSceneVisualPrompt = () => {
    if (!project.scriptData || !selectedSceneId) return;

    const newData = { ...project.scriptData };
    const scene = newData.scenes.find(s => s.id === selectedSceneId);
    if (scene) {
      scene.visualPrompt = editingSceneVisualPrompt;
      updateProject({ scriptData: newData });
    }
  };

  const handleDownloadImage = async (imageUrl: string, charName: string) => {
    await downloadImage(imageUrl, `${project.scriptData?.title}-${charName}.png`, dialog);
  };

  if (!project.scriptData) return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 bg-slate-900">
          <AlertCircle className="w-12 h-12 mb-4 opacity-50"/>
          <p>暂无镜头数据，请先制作剧本并完成成分镜。</p>
      </div>
  );
  
  const allCharactersReady = project.scriptData.characters.every(c => c.referenceImage);
  const allScenesReady = project.scriptData.scenes.every(s => s.referenceImage);
  const selectedChar = project.scriptData.characters.find(c => c.id === selectedCharId);

  return (
    <div className="flex flex-col h-full bg-slate-900 relative overflow-hidden">

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 bg-slate-700/95 flex items-center justify-center backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setPreviewImage(null)}>
          <button onClick={() => setPreviewImage(null)} className="absolute top-4 right-4 p-2 bg-slate-800/10 hover:bg-slate-800/20 rounded-full transition-colors cursor-pointer">
            <X className="w-6 h-6 text-slate-50" />
          </button>
          <img src={previewImage} alt="Preview" className="max-w-[90vw] max-h-[90vh] object-contain" />
        </div>
      )}

      {/* Global Progress Overlay */}
      {batchProgress && (
        <div className="absolute inset-0 z-50 bg-slate-700/80 flex flex-col items-center justify-center backdrop-blur-md animate-in fade-in">
          <Loader2 className="w-12 h-12 text-slate-500 animate-spin mb-6" />
          <h3 className="text-xl font-bold text-slate-50 mb-2">正在批量生成资源...</h3>
          <div className="w-64 h-1.5 bg-slate-800 rounded-full overflow-hidden mb-2">
             <div className="h-full bg-slate-500 transition-all duration-300" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}></div>
          </div>
          <p className="text-slate-400 font-mono text-xs">进度: {batchProgress.current} / {batchProgress.total}</p>
        </div>
      )}

      {/* Wardrobe Modal */}
      {selectedChar && project.scriptData && (
        <WardrobeModal
          character={project.scriptData.characters.find(c => c.id === selectedCharId) || null}
          project={project}
          localStyle={localStyle}
          imageSize={imageSize}
          processingState={processingState}
          setProcessingState={setProcessingState}
          updateProject={updateProject}
          onClose={() => setSelectedCharId(null)}
          setPreviewImage={setPreviewImage}
        />
      )}

      {/* Scene Edit Modal */}
      {selectedSceneId && project.scriptData && (() => {
        const selectedScene = project.scriptData.scenes.find(s => s.id === selectedSceneId);
        if (!selectedScene) return null;

        return (
          <div className="absolute inset-0 z-40 bg-slate-700/90 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-600 w-full max-h-[80vh] max-w-2xl rounded-2xl flex flex-col shadow-2xl overflow-hidden">
              {/* Modal Header */}
              <div className="h-16 px-8 border-b border-slate-600 flex items-center justify-between shrink-0 bg-slate-700">
                <div className="flex items-center gap-4">
                  <MapPin className="w-10 h-10 rounded-full bg-slate-800 p-2.5 text-emerald-500" />
                  <div>
                    <h3 className="text-lg font-bold text-slate-50">{selectedScene.location}</h3>
                  </div>
                </div>
                <button onClick={() => setSelectedSceneId(null)} className="p-2 bg-slate-700 hover:bg-slate-800 rounded-full transition-colors cursor-pointer">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Scene Image */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <MapPin className="w-4 h-4" /> 场景图像
                    </h4>
                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-600">
                      <div className="aspect-[16/9] bg-slate-900 rounded-lg overflow-hidden mb-4 relative cursor-pointer" onClick={() => setPreviewImage(selectedScene.referenceImage)}>
                        {selectedScene.referenceImage ? (
                          <img src={selectedScene.referenceImage} className="w-full h-full object-cover hover:scale-105 transition-transform duration-200" />
                        ) : (
                          <div className="flex items-center justify-center h-full text-slate-600">无图像</div>
                        )}
                        {selectedScene.referenceImage && (
                          <div className="absolute inset-0 bg-slate-700/0 hover:bg-slate-700/20 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                            <span className="text-slate-50/80 text-xs font-bold uppercase tracking-wider">点击预览</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Scene Info */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Check className="w-4 h-4" /> 场景信息
                    </h4>
                    <div className="space-y-4">
                      <div className="bg-slate-800 p-4 rounded-xl border border-slate-600">
                        <label className="text-[12px] text-slate-300 uppercase tracking-wider font-bold block mb-2">时间</label>
                        <p className="text-sm text-slate-50">{selectedScene.time}</p>
                      </div>
                      <div className="bg-slate-800 p-4 rounded-xl border border-slate-600">
                        <label className="text-[12px] text-slate-300 uppercase tracking-wider font-bold block mb-2">氛围</label>
                        <p className="text-sm text-slate-50">{selectedScene.atmosphere}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Visual Prompt */}
                <div className="mt-6">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> 视觉提示
                  </h4>
                  <div className="bg-slate-800 p-4 rounded-xl border border-slate-600">
                    <textarea
                      value={editingSceneVisualPrompt}
                      onChange={(e) => setEditingSceneVisualPrompt(e.target.value)}
                      onBlur={handleSaveSceneVisualPrompt}
                      placeholder="输入场景的视觉描述..."
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-sm text-slate-50 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors resize-none h-32 font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Header - Consistent with Director */}
      <div className="h-14 border-b border-slate-600 bg-slate-700 md:px-6 px-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold text-slate-50 flex items-center gap-3">
                  <Drama className="w-5 h-5 text-slate-500" />
                  角色与场景
              </h2>
          </div>
          <div className="flex items-center gap-3">
             <div className="flex gap-2">
                 <span className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-[12px] text-slate-400 font-mono uppercase">
                    {project.scriptData.characters.length} 角色
                 </span>
                 <span className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-[12px] text-slate-400 font-mono uppercase">
                    {project.scriptData.scenes.length} 场景
                 </span>
             </div>
          </div>
      </div>

      <div className="flex-1 overflow-y-auto md:p-6 p-2 space-y-6">
        {/* Characters Section */}
        <section>
          <div className="flex items-end justify-between mb-6 border-b border-slate-600 pb-4">
            <div>
               <h3 className="text-sm font-bold text-slate-50 uppercase tracking-widest flex items-center gap-2">
                 <div className="w-1.5 h-1.5 bg-slate-500 rounded-full"></div>
                 角色定妆
               </h3>
               <p className="text-xs text-slate-500 mt-1 pl-3.5">为剧本角色生成一致参考图</p>
            </div>
            <button 
              onClick={() => handleBatchGenerate('character')}
              disabled={!!batchProgress}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all flex items-center gap-2 cursor-pointer ${
                  allCharactersReady
                    ? 'bg-slate-900 text-slate-400 border border-slate-600 hover:text-slate-50 hover:border-slate-300 hover:bg-slate-500'
                    : 'bg-slate-800 text-slate-50 hover:bg-slate-400 shadow-lg shadow-white/5'
              }`}
            >
              {allCharactersReady ? <RefreshCw className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
              {allCharactersReady ? '重新批量生成' : '生成所有角色'}
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {project.scriptData.characters.map((char) => (
              <div key={char.id} className="bg-slate-900 border border-slate-600 rounded-xl overflow-hidden flex flex-col group hover:border-slate-300 transition-all hover:shadow-lg">
                <div className="aspect-[3/4] bg-slate-900 relative overflow-hidden">
                  {char.referenceImage ? (
                    <>
                      <img src={char.referenceImage} alt={char.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                      {processingState?.type === 'character' && processingState?.id === char.id ? (
                        <div className="absolute inset-0 bg-slate-700/80 flex items-center justify-center backdrop-blur-sm">
                          <Loader2 className="w-8 h-8 text-slate-50 animate-spin" />
                        </div>
                      ) : (
                        <div className={`absolute inset-0 bg-slate-700/60 opacity-0 transition-opacity flex items-center justify-center gap-2 backdrop-blur-sm ${batchProgress || processingState ? 'pointer-events-none opacity-50' : 'group-hover:opacity-80'}`}>
                          <button
                            onClick={() => { setPreviewImage(char.referenceImage); }}
                            disabled={!!batchProgress || !!processingState}
                            className="px-3 py-1.5 bg-slate-700/50 text-slate-50 text-[12px] font-bold uppercase flex items-center gap-2 tracking-wider rounded border border-white/20 hover:bg-slate-800 hover:text-slate-50 transition-colors backdrop-blur disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <Expand className="w-3 h-3" />
                            全屏预览
                          </button>
                        </div>
                      )}
                      <div className="absolute top-2 right-2 p-1 bg-green-500 text-slate-50 rounded shadow-lg backdrop-blur">
                        <Check className="w-3 h-3" />
                      </div>
                    </>
                  ) : (
                     <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 p-4 text-center">
                       <User className="w-10 h-10 mb-3 opacity-10" />
                       <button
                          onClick={() => handleGenerateAsset('character', char.id)}
                          disabled={processingState?.type === 'character' && processingState?.id === char.id || !!batchProgress || !!processingState}
                          className="px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded text-xs font-bold transition-all border border-slate-600 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                       >
                         {processingState?.type === 'character' && processingState?.id === char.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Image className="w-3 h-3" />}
                         {processingState?.type === 'character' && processingState?.id === char.id ? '生成中...' : '生成'}
                       </button>
                     </div>
                  )}
                  <div className="absolute bottom-0 right-0 flex items-center justify-center gap-1 p-1"> 
                  {/* Action Buttons */}
                  {char.referenceImage && (
                    <>
                      {/* Preview Button */}
                      <button
                        onClick={(e) => handleGenerateAsset('character', char.id) }
                        className="p-2 bg-slate-700/50 text-slate-50 rounded-full hover:bg-slate-800 hover:text-slate-50 transition-colors border border-white/10 backdrop-blur cursor-pointer"
                        title="重新生成"
                      >
                        <Image className="w-3 h-3" />
                      </button>
                      {/* Download Button */}
                      <button
                        onClick={(e) => { handleDownloadImage(char.referenceImage!, '角色-'+char.name); }}
                        className="p-2 bg-slate-700/50 text-slate-50 rounded-full hover:bg-slate-800 hover:text-slate-50 transition-colors border border-white/10 backdrop-blur cursor-pointer"
                        title="下载图片"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                    </>
                  )}
                  <button
                            onClick={(e) => { handleFileUploadClick(char.id, 'character'); }}
                            disabled={!!batchProgress || !!processingState}
                            className="p-2 bg-slate-700/50 text-slate-50 rounded-full hover:bg-slate-800 hover:text-slate-50 transition-colors border border-white/10 backdrop-blur cursor-pointer"
                          >
                            <Upload className="w-3 h-3" />
                  </button>
                  <button
                     onClick={(e) => { setSelectedCharId(char.id); }}
                     className="p-2 bg-slate-700/50 text-slate-50 rounded-full hover:bg-slate-800 hover:text-slate-50 transition-colors border border-white/10 backdrop-blur cursor-pointer"
                     title="管理造型"
                  >
                      <Shirt className="w-3 h-3" />
                  </button>
                  </div>
                </div>
                <div className="p-3 border-t border-slate-600 bg-slate-900">
                  <div className="flex items-center justify-between mb-1">
                  <div  className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-slate-200 truncate text-sm">{char.name}</h3>
                  {char.gender!='未指定' && <span className="px-1.5 py-0.5 bg-slate-900 text-slate-500 text-[11px] rounded border border-slate-600 uppercase font-mono">{char.gender}</span>}
                  {char.age!='未指定' && <span className="px-1.5 py-0.5 bg-slate-900 text-slate-500 text-[11px] rounded border border-slate-600 uppercase font-mono">{char.age}</span>}
                     {char.variations && char.variations.length > 0 && (
                         <span className="px-1.5 py-0.5 text-[11px] rounded border border-slate-600 uppercase text-slate-400 font-mono flex items-center gap-1">
                             <Shirt className="w-2.5 h-2.5" /> +{char.variations.length}
                         </span>
                     )}
                  </div>
                  </div>
                  <p className="text-[12px] text-slate-500 line-clamp-1">{char.personality}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Scenes Section */}
        <section>
          <div className="flex items-end justify-between mb-6 border-b border-slate-600 pb-4">
            <div>
               <h3 className="text-sm font-bold text-slate-50 uppercase tracking-widest flex items-center gap-2">
                 <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                 场景概念
               </h3>
               <p className="text-xs text-slate-500 mt-1 pl-3.5">为剧本场景生成环境参考图</p>
            </div>
            <button 
              onClick={() => handleBatchGenerate('scene')}
              disabled={!!batchProgress}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all flex items-center gap-2 cursor-pointer ${
                  allScenesReady
                    ? 'bg-slate-900 text-slate-400 border border-slate-600 hover:text-slate-50 hover:border-slate-300 hover:bg-slate-500'
                    : 'bg-slate-800 text-slate-50 hover:bg-slate-600 shadow-lg shadow-white/5'
              }`}
            >
              {allScenesReady ? <RefreshCw className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
              {allScenesReady ? '重新批量生成' : '生成所有场景'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6">
            {project.scriptData.scenes.map((scene) => (
              <div key={scene.id} className="bg-slate-900 border border-slate-600 rounded-xl overflow-hidden flex flex-col group hover:border-slate-300 transition-all hover:shadow-lg">
                <div className="aspect-[16/9] bg-slate-800/50 relative overflow-hidden">
                  {scene.referenceImage ? (
                    <>
                      <img src={scene.referenceImage} alt={scene.location} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                      {processingState?.type === 'scene' && processingState?.id === scene.id ? (
                        <div className="absolute inset-0 bg-slate-700/80 flex items-center justify-center backdrop-blur-sm">
                          <Loader2 className="w-8 h-8 text-slate-50 animate-spin" />
                        </div>
                      ) : (
                        <div className={`absolute inset-0 bg-slate-700/60 opacity-0 transition-opacity flex items-center justify-center gap-2 backdrop-blur-sm ${batchProgress || processingState ? 'pointer-events-none opacity-50' : 'group-hover:opacity-80'}`}>
                          <button
                            onClick={(e) => {setPreviewImage(scene.referenceImage); }}
                            disabled={!!batchProgress || !!processingState}
                            className="px-3 py-1.5 bg-slate-700/50 text-slate-50 text-[12px] font-bold uppercase tracking-wider rounded flex items-center gap-2 border border-white/20 hover:bg-slate-800 hover:text-slate-50 transition-colors backdrop-blur disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <Expand className="w-3 h-3" />
                            全屏预览
                          </button>
                        </div>
                      )}
                      <div className="absolute top-2 right-2 p-1 bg-green-300 text-slate-50 rounded shadow-lg backdrop-blur">
                        <Check className="w-3 h-3" />
                      </div>
                    </>
                  ) : (
                     <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 p-4 text-center">
                       <MapPin className="w-10 h-10 mb-3 opacity-10" />
                       <button
                          onClick={(e) => { handleGenerateAsset('scene', scene.id); }}
                          disabled={processingState?.type === 'scene' && processingState?.id === scene.id || !!batchProgress || !!processingState}
                          className="px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded text-xs font-bold transition-all border border-slate-600 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                       >
                          {processingState?.type === 'scene' && processingState?.id === scene.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Image className="w-3 h-3" />}
                          {processingState?.type === 'scene' && processingState?.id === scene.id ? '生成中...' : '生成'}
                       </button>
                     </div>
                  )}
                      {/* Preview Button */}
                      <div className="absolute bottom-0 right-0 flex items-center justify-center gap-1 p-1"> 
                      {scene.referenceImage && (
                          <>
                      <button
                        onClick={(e) => {handleGenerateAsset('scene', scene.id); }}
                        className="p-2 bg-slate-700/50 text-slate-50 rounded-full hover:bg-slate-800 hover:text-slate-50 transition-colors border border-white/10 backdrop-blur cursor-pointer"
                        title="重新生成"
                      >
                        <Image className="w-3 h-3" />
                      </button>
                      {/* Download Button */}
                      <button
                        onClick={(e) => { handleDownloadImage(scene.referenceImage!, '场景-'+scene.location); }}
                        className="p-2 bg-slate-700/50 text-slate-50 rounded-full hover:bg-slate-800 hover:text-slate-50 transition-colors border border-white/10 backdrop-blur cursor-pointer"
                        title="下载图片"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                      </>
                      )}
                    {/* Upload Button */}
                    <button
                      onClick={(e) => { handleFileUploadClick(scene.id, 'scene'); }}
                      disabled={!!batchProgress || !!processingState}
                      className="p-2 bg-slate-700/50 text-slate-50 rounded-full hover:bg-slate-800 hover:text-slate-50 transition-colors border border-white/10 backdrop-blur cursor-pointer"
                      title="上传图片"
                      >
                      <Upload className="w-3 h-3" />
                    </button>
                    </div>
                </div>
                <div className="p-3 border-t border-slate-600 bg-slate-900">
                  <div className="flex justify-between items-center mb-1">
                     <h3 className="font-bold text-slate-200 text-sm truncate">{scene.location}</h3>
                     <span className="px-1.5 py-0.5 bg-slate-900 text-slate-500 text-[11px] rounded border border-slate-600 uppercase font-mono whitespace-nowrap">{scene.time}</span>
                  </div>
                  <p className="text-[12px] text-slate-500 line-clamp-1 mb-2">{scene.atmosphere}</p>
                  {scene.visualPrompt && (
                    <div className="mt-2 pt-2 border-t border-slate-600/50">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] text-slate-300 font-mono line-clamp-2 flex-1">{scene.visualPrompt}</p>
                        <button
                          onClick={() => setSelectedSceneId(scene.id)}
                          className="text-[11px] text-emerald-400 hover:text-emerald-300 flex-shrink-0 font-bold uppercase tracking-wider cursor-pointer"
                        >
                          编辑
                        </button>
                      </div>
                    </div>
                  )}
                  {!scene.visualPrompt && scene.referenceImage && (
                    <div className="mt-2 pt-2 border-t border-slate-600/50">
                      <button
                        onClick={() => setSelectedSceneId(scene.id)}
                        className="w-full text-[11px] text-slate-500 hover:text-emerald-400 font-mono text-center py-1 border border-dashed border-slate-600 rounded hover:border-emerald-500/50 transition-colors cursor-pointer"
                      >
                        + 添加视觉提示
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* File Upload Modal */}
      <FileUploadModal
        isOpen={fileUploadModalOpen}
        onClose={() => setFileUploadModalOpen(false)}
        onUploadSuccess={handleFileUploadSuccess}
        fileType={uploadingItem?.type === 'scene' ? 'scene' : 'character'}
        acceptTypes="image/png,image/jpeg,image/jpg"
        title={uploadingItem?.type === 'scene' ? '上传场景图片' : '上传角色图片'}
        projectid={project.id}
        project={project}
        filterType={uploadingItem?.type === 'scene' ? 'scene' : 'character'}
      />

      {/* Fullscreen Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[100] bg-slate-700/90 backdrop-blur-sm flex items-center justify-center"
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={previewImage}
            alt="Full screen preview"
            className="max-w-[95vw] max-h-[95vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-6 right-6 p-3 bg-slate-900/80 hover:bg-slate-800 text-slate-50 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

    </div>
  );
};

export default StageAssets;