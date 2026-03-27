import { AlertCircle, Camera, Download, Drama, Edit2, Expand, Loader2, MapPin, Mic, Palette, Plus, RefreshCw, Shirt, Sparkles, Trash2, Upload, User, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { ModelService } from '../services/modelService';
import { renderTemplate } from "../services/promptTemplates";
import { addLibraryCharacter, addLibraryScene, deleteLibraryCharacter, deleteLibraryScene } from '../services/seriesService';
import { addMediaHistory } from '../services/storageService';
import { Character, ProjectState, Scene, SeriesRecord } from '../types';
import { useDialog } from './dialog';
import CharacterAddModal from './modals/CharacterAddModal';
import FileUploadModal, { downloadImage } from './modals/FileUploadModal';
import SceneAddModal from './modals/SceneAddModal';
import VoiceSynthesisModal from './modals/VoiceSynthesisModal';
import WardrobeModal from './modals/WardrobeModal';

interface Props {
  project: ProjectState;
  updateProject: (updates: Partial<ProjectState>) => void;
  series?: SeriesRecord | null;
  updateSeries?: (series: SeriesRecord) => void;
}

const StageAssets: React.FC<Props> = ({ 
  project, 
  updateProject, 
  series, 
  updateSeries
}) => {
  const dialog = useDialog();
  
  // Determine data source based on mode
  const isSeriesMode = !!series;
  const displayCharacters = isSeriesMode
    ? series?.library?.characters || []
    : project.scriptData?.characters || [];
  const displayScenes = isSeriesMode
    ? series?.library?.scenes || []
    : project.scriptData?.scenes || [];
  const [processingState, setProcessingState] = useState<{id: string, type: 'character'|'scene'}|null>(null);
  const [batchProgress, setBatchProgress] = useState<{current: number, total: number} | null>(null);
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [localStyle, setLocalStyle] = useState(project.visualStyle || '真人写实');
  const [imageSize, setImageSize] = useState(project.imageSize || '2560x1440');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [fileUploadModalOpen, setFileUploadModalOpen] = useState(false);
  const [uploadingItem, setUploadingItem] = useState<{id: string, type: 'character'|'scene'}|null>(null);
  const [voiceSynthesisModalOpen, setVoiceSynthesisModalOpen] = useState(false);
  const [selectedVoiceCharId, setSelectedVoiceCharId] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const [addCharacterModalOpen, setAddCharacterModalOpen] = useState(false);
  const [addSceneModalOpen, setAddSceneModalOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [editingScene, setEditingScene] = useState<Scene | null>(null);

  // Sync local state with project settings
  useEffect(() => {
    setLocalStyle(project.visualStyle || '真人写实');
    setImageSize(project.imageSize || '2560x1440');
  }, [project.visualStyle, project.imageSize]);

  const handleGenerateAsset = useCallback(async (type: 'character' | 'scene', id: string, skipConfirm?: boolean) => {
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
      let imagesize = '2304x1728';
      let new_prompt = prompt;
      if (type === 'character') {
        imagesize = '1728x2304';
        const char = project.scriptData?.characters.find(c => String(c.id) === String(id));
        imageUrl = char?.referenceImage;
        prompt = char?.visualPrompt;
        new_prompt = prompt;
        if (char) {
          prompt = char.visualPrompt || await ModelService.generateVisualPrompts('character', char, project.scriptData?.genre || '剧情片',project.visualStyle);
          new_prompt = renderTemplate('GENERATE_CHARACTER_IMAGE', localStyle, prompt,char.name);
        }
      } else {
        const scene = project.scriptData?.scenes.find(s => String(s.id) === String(id));
        imageUrl = scene?.referenceImage;
        prompt = scene?.visualPrompt;
        new_prompt = prompt;
        if (scene) {
          prompt = scene.visualPrompt || await ModelService.generateVisualPrompts('scene', scene, project.scriptData?.genre || '剧情片',project.visualStyle);
          new_prompt = renderTemplate('GENERATE_SCENE_IMAGE', localStyle, prompt,scene.atmosphere);
        }
      }

      // Real API Call
      imageUrl = await ModelService.generateImage(new_prompt, [], type, localStyle, imagesize,1,null,project.id,id);

      // Save to media history
      if (imageUrl) {
        const fileName = type === 'character'
          ? `角色_${project.scriptData?.characters.find(c => String(c.id) === String(id))?.name || id}`
          : `场景_${project.scriptData?.scenes.find(s => String(s.id) === String(id))?.id || id}`;
        await addMediaHistory(project.id, imageUrl, fileName, 'image', type,new_prompt);
      }
      // Update state
      if (project.scriptData) {
        // Find the item in project scriptData
        const scriptDataItem = type === 'character'
          ? project.scriptData.characters.find(c => String(c.id) === String(id))
          : project.scriptData.scenes.find(s => String(s.id) === String(id));
        
        if (!scriptDataItem) return;
        
        // Update project scriptData (lightweight ref)
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
        
        // In series mode, also update the library directly
        if (isSeriesMode && series && updateSeries) {
          const refId = (scriptDataItem as Character | Scene).refId;
          if (refId) {
            const newSeries = { ...series };
            if (type === 'character') {
              const charIndex = newSeries.library.characters.findIndex(c => c.id === refId);
              if (charIndex >= 0) {
                newSeries.library.characters[charIndex] = {
                  ...newSeries.library.characters[charIndex],
                  referenceImage: imageUrl,
                  visualPrompt: prompt
                };
              }
            } else {
              const sceneIndex = newSeries.library.scenes.findIndex(s => s.id === refId);
              if (sceneIndex >= 0) {
                newSeries.library.scenes[sceneIndex] = {
                  ...newSeries.library.scenes[sceneIndex],
                  referenceImage: imageUrl,
                  visualPrompt: prompt
                };
              }
            }
            updateSeries(newSeries);
          }
        }
      }
    } catch (e) {
      console.error(e);
      if(e.message?.includes("enough")){
        await dialog.toast({ message: '余额不足，请充值', type: 'error' });
      }else{
        await dialog.toast({ message: (type === 'character'?'角色 ':'场景 ')+id+' 生成失败，请重试。'+e?.message, type: 'error' });
      }
    } finally {
      setProcessingState(null);
    }
  }, [project.scriptData, localStyle, isSeriesMode, series, updateSeries, updateProject, dialog]);

  const handleBatchGenerate = useCallback(async (type: 'character' | 'scene') => {
    const items = type === 'character' 
      ? displayCharacters
      : displayScenes;
    
    if (!items || items.length === 0) return;

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
  }, [displayCharacters, displayScenes, handleGenerateAsset, dialog]);

  const handleFileUploadClick = useCallback((itemId: string, itemType: 'character' | 'scene') => {
    setUploadingItem({ id: itemId, type: itemType });
    setFileUploadModalOpen(true);
  }, []);

  const handleFileUploadSuccess = useCallback((fileUrl: string) => {
    if (!project.scriptData || !uploadingItem) return;

    const newData = { ...project.scriptData };
    let refId: string | undefined;

    if (uploadingItem.type === 'character') {
      const char = newData.characters.find(c => c.id === uploadingItem.id);
      if (char) {
        char.referenceImage = fileUrl;
        refId = char.refId;
      }
    } else {
      const scene = newData.scenes.find(s => s.id === uploadingItem.id);
      if (scene) {
        scene.referenceImage = fileUrl;
        refId = scene.refId;
      }
    }

    updateProject({ scriptData: newData });
    
    // In series mode, also update the library
    if (isSeriesMode && series && updateSeries && refId) {
      const newSeries = { ...series };
      if (uploadingItem.type === 'character') {
        const charIndex = newSeries.library.characters.findIndex(c => c.id === refId);
        if (charIndex >= 0) {
          newSeries.library.characters[charIndex] = {
            ...newSeries.library.characters[charIndex],
            referenceImage: fileUrl
          };
        }
      } else {
        const sceneIndex = newSeries.library.scenes.findIndex(s => s.id === refId);
        if (sceneIndex >= 0) {
          newSeries.library.scenes[sceneIndex] = {
            ...newSeries.library.scenes[sceneIndex],
            referenceImage: fileUrl
          };
        }
      }
      updateSeries(newSeries);
    }
    
    setUploadingItem(null);
  }, [project.scriptData, uploadingItem, isSeriesMode, series, updateSeries, updateProject]);

  const handleDownloadImage = useCallback(async (imageUrl: string, charName: string) => {
    if(downloadStatus)return;
    setDownloadStatus('downloading');
    try{
      await downloadImage(imageUrl, `${project.scriptData?.title}-${charName}.png`, dialog);
    }finally{
      setDownloadStatus(null);
    }
  }, [downloadStatus, project.scriptData?.title, dialog]);

  const handleDeleteCharacter = useCallback(async (charId: string) => {
    const char = isSeriesMode
      ? series?.library?.characters.find(c => c.id === charId)
      : project.scriptData?.characters.find(c => c.id === charId);
    if (!char) return;

    const confirmed = await dialog.confirm({
      title: '确认删除角色',
      message: `确定要删除角色"${char.name}"吗？此操作${isSeriesMode ? '将从全局资源库中移除该角色' : '将删除该角色'}，但不会影响已生成的图片。`,
      type: 'warning',
    });

    if (!confirmed) return;

    if (isSeriesMode && series && updateSeries) {
      const updatedSeries = deleteLibraryCharacter(series, charId);
      updateSeries(updatedSeries);
    } else if (project.scriptData) {
      const newData = { ...project.scriptData };
      newData.characters = newData.characters.filter(c => c.id !== charId);
      updateProject({ scriptData: newData });
    }
    await dialog.toast({ message: '角色已删除', type: 'success' });
  }, [isSeriesMode, series, updateSeries, project, updateProject, dialog]);

  const handleDeleteScene = useCallback(async (sceneId: string) => {
    const scene = isSeriesMode
      ? series?.library?.scenes.find(s => s.id === sceneId)
      : project.scriptData?.scenes.find(s => s.id === sceneId);
    if (!scene) return;

    const confirmed = await dialog.confirm({
      title: '确认删除场景',
      message: `确定要删除场景"${scene.location}"吗？此操作${isSeriesMode ? '将从全局资源库中移除该场景' : '将删除该场景'}，但不会影响已生成的图片。`,
      type: 'warning',
    });

    if (!confirmed) return;

    if (isSeriesMode && series && updateSeries) {
      const updatedSeries = deleteLibraryScene(series, sceneId);
      updateSeries(updatedSeries);
    } else if (project.scriptData) {
      const newData = { ...project.scriptData };
      newData.scenes = newData.scenes.filter(s => s.id !== sceneId);
      updateProject({ scriptData: newData });
    }
    await dialog.toast({ message: '场景已删除', type: 'success' });
  }, [isSeriesMode, series, updateSeries, project, updateProject, dialog]);

  const handleAddCharacter = useCallback(() => {
    setEditingCharacter(null);
    setAddCharacterModalOpen(true);
  }, []);

  const handleEditCharacter = useCallback((char: Character) => {
    setEditingCharacter(char);
    setAddCharacterModalOpen(true);
  }, []);

  const handleAddScene = useCallback(() => {
    setEditingScene(null);
    setAddSceneModalOpen(true);
  }, []);

  const handleEditScene = useCallback((scene: Scene) => {
    setEditingScene(scene);
    setAddSceneModalOpen(true);
  }, []);

  const handleSaveCharacter = useCallback((character: Character) => {
    if (isSeriesMode && series && updateSeries) {
      // Series mode: operate on series.library
      if (editingCharacter) {
        // Update existing character
        const updatedSeries = { ...series };
        const charIndex = updatedSeries.library.characters.findIndex(c => c.id === character.id);
        if (charIndex >= 0) {
          updatedSeries.library.characters[charIndex] = character;
          updateSeries(updatedSeries);
          dialog.toast({ message: '角色已更新', type: 'success' });
        }
      } else {
        // Add new character
        const updatedSeries = addLibraryCharacter(series, character);
        updateSeries(updatedSeries);
        dialog.toast({ message: '角色已添加', type: 'success' });
      }
    } else if (!isSeriesMode && project.scriptData) {
      // Standalone mode: operate on project.scriptData
      const newData = { ...project.scriptData };
      if (editingCharacter) {
        // Update existing character
        const charIndex = newData.characters.findIndex(c => c.id === character.id);
        if (charIndex >= 0) {
          newData.characters[charIndex] = character;
          updateProject({ scriptData: newData });
          dialog.toast({ message: '角色已更新', type: 'success' });
        }
      } else {
        // Add new character
        newData.characters = [...newData.characters, character];
        updateProject({ scriptData: newData });
        dialog.toast({ message: '角色已添加', type: 'success' });
      }
    }
    setAddCharacterModalOpen(false);
    setEditingCharacter(null);
  }, [isSeriesMode, series, updateSeries, project, updateProject, dialog, editingCharacter]);

  const handleSaveScene = useCallback((scene: Scene) => {
    if (isSeriesMode && series && updateSeries) {
      // Series mode: operate on series.library
      if (editingScene) {
        // Update existing scene
        const updatedSeries = { ...series };
        const sceneIndex = updatedSeries.library.scenes.findIndex(s => s.id === scene.id);
        if (sceneIndex >= 0) {
          updatedSeries.library.scenes[sceneIndex] = scene;
          updateSeries(updatedSeries);
          dialog.toast({ message: '场景已更新', type: 'success' });
        }
      } else {
        // Add new scene
        const updatedSeries = addLibraryScene(series, scene);
        updateSeries(updatedSeries);
        dialog.toast({ message: '场景已添加', type: 'success' });
      }
    } else if (!isSeriesMode && project.scriptData) {
      // Standalone mode: operate on project.scriptData
      const newData = { ...project.scriptData };
      if (editingScene) {
        // Update existing scene
        const sceneIndex = newData.scenes.findIndex(s => s.id === scene.id);
        if (sceneIndex >= 0) {
          newData.scenes[sceneIndex] = scene;
          updateProject({ scriptData: newData });
          dialog.toast({ message: '场景已更新', type: 'success' });
        }
      } else {
        // Add new scene
        newData.scenes = [...newData.scenes, scene];
        updateProject({ scriptData: newData });
        dialog.toast({ message: '场景已添加', type: 'success' });
      }
    }
    setAddSceneModalOpen(false);
    setEditingScene(null);
  }, [isSeriesMode, series, updateSeries, project, updateProject, dialog, editingScene]);

  if (!project.scriptData&&!isSeriesMode || (displayCharacters.length === 0 && displayScenes.length === 0)) return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 bg-slate-900">
          <AlertCircle className="w-12 h-12 mb-4 opacity-50"/>
          <p>暂无角色场景，请先在剧本阶段完成解析。</p>
      </div>
  );
  
  const allCharactersReady = displayCharacters.every(c => c.referenceImage);
  const allScenesReady = displayScenes.every(s => s.referenceImage);
  const selectedChar = displayCharacters.find(c => c.id === selectedCharId);

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
      {selectedChar && (
        <WardrobeModal
          character={selectedChar}
          series={series}
          updateSeries={updateSeries}
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
                 <span className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-[12px] text-slate-400 font-mono">
                    {displayCharacters.length} 角色
                 </span>
                 <span className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-[12px] text-slate-400 font-mono">
                    {displayScenes.length} 场景
                 </span>
             </div>
          </div>
      </div>

      <div className="flex-1 overflow-y-auto md:px-6 px-2 space-y-6">
        {/* Characters Section */}
        <section>
          <div className="flex items-end justify-between py-2 border-b border-slate-600 pb-4 sticky top-0 bg-slate-900 z-40">
            <div>
               <h3 className="text-sm font-bold text-slate-50 tracking-widest flex items-center gap-2">
                 <div className="w-1.5 h-1.5 bg-slate-500 rounded-full"></div>
                 角色定妆
               </h3>
               <p className="text-xs text-slate-500 mt-1 pl-3.5">为剧本角色生成一致参考图</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddCharacter}
                disabled={!!batchProgress}
                className="px-3 py-2 rounded-lg text-xs font-bold tracking-wide transition-all flex items-center gap-2 cursor-pointer bg-green-600 text-slate-50 hover:bg-green-500 shadow-lg shadow-green-500/20"
              >
                <Plus className="w-3 h-3" />
                新增
              </button>
              <button
              onClick={() => handleBatchGenerate('character')}
              disabled={!!batchProgress}
              className={`px-4 py-2 rounded-lg text-xs font-bold tracking-wide transition-all flex items-center gap-2 cursor-pointer ${
                  allCharactersReady
                    ? 'bg-slate-900 text-slate-400 border border-slate-600 hover:text-slate-50 hover:border-slate-300 hover:bg-slate-500'
                    : 'bg-slate-800 text-slate-50 hover:bg-slate-400 shadow-lg shadow-white/5 border border-slate-600'
              }`}
            >
              {allCharactersReady ? <RefreshCw className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
              {allCharactersReady ? '重新批量生成' : '生成所有角色'}
            </button>
            </div>
          </div>

          <div className="grid grid-cols-2 py-4 md:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-6 gap-6">
            {displayCharacters.map((char) => (
              <div key={char.id} className="bg-slate-900 border border-slate-600 rounded-xl overflow-hidden flex flex-col group hover:border-slate-300 transition-all hover:shadow-lg">
                <div className="aspect-[3/4] bg-slate-900 relative overflow-hidden">
                  {/* Edit & Delete Buttons - Top Left */}
                  <button
                    onClick={() => handleEditCharacter(char)}
                    disabled={!!batchProgress || !!processingState}
                    className="absolute top-2 left-2 p-2 bg-blue-600/50 text-slate-50 rounded-full hover:bg-blue-600 hover:text-slate-50 transition-colors border border-white/10 backdrop-blur cursor-pointer z-20"
                    title="编辑角色"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDeleteCharacter(char.id)}
                    disabled={!!batchProgress || !!processingState}
                    className="absolute top-10 left-2 p-2 bg-red-600/50 text-slate-50 rounded-full hover:bg-red-600 hover:text-slate-50 transition-colors border border-white/10 backdrop-blur cursor-pointer z-20"
                    title="删除角色"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
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
                            onClick={() => {
                              const charImages = displayCharacters
                                .filter(c => c.referenceImage)
                                .map(c => c.referenceImage);
                              const idx = charImages.indexOf(char.referenceImage);
                              setPreviewImages(charImages);
                              setPreviewIndex(idx >= 0 ? idx : 0);
                              setPreviewImage(char.referenceImage);
                            }}
                            disabled={!!batchProgress || !!processingState}
                            className="px-3 py-1.5 bg-slate-700/50 text-slate-50 text-[12px] font-bold flex items-center gap-2 tracking-wider rounded border border-white/20 hover:bg-slate-800 hover:text-slate-50 transition-colors backdrop-blur disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <Expand className="w-3 h-3" />
                            全屏预览
                          </button>
                        </div>
                      )}
                      <div className="absolute top-2 right-2 p-1 bg-green-500 text-slate-50 rounded shadow-lg backdrop-blur">
                        <Camera className="w-3 h-3" />
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
                         {processingState?.type === 'character' && processingState?.id === char.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Palette className="w-3 h-3" />}
                         {processingState?.type === 'character' && processingState?.id === char.id ? '生成中...' : '生成'}
                       </button>
                     </div>
                  )}
                  <div className="absolute bottom-0 right-0 flex flex-col xl:flex-row items-end gap-1 p-1">
                  {/* Action Buttons */}
                  {char.referenceImage && (
                    <>
                      {/* Preview Button */}
                      <button
                        onClick={() => handleGenerateAsset('character', char.id) }
                        className="p-2 bg-slate-700/50 text-slate-50 rounded-full hover:bg-slate-800 hover:text-slate-50 transition-colors border border-white/10 backdrop-blur cursor-pointer"
                        title="重新生成"
                      >
                        <Palette className="w-3 h-3" />
                      </button>
                      {/* Download Button */}
                      <button
                        onClick={() => { handleDownloadImage(char.referenceImage!, '角色-'+char.name); }}
                        disabled={!!downloadStatus}
                        className="p-2 bg-slate-700/50 text-slate-50 rounded-full hover:bg-slate-800 hover:text-slate-50 transition-colors border border-white/10 backdrop-blur cursor-pointer"
                        title="下载图片"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                    </>
                  )}
                  <button
                            onClick={() => { handleFileUploadClick(char.id, 'character'); }}
                            disabled={!!batchProgress || !!processingState}
                            className="p-2 bg-slate-700/50 text-slate-50 rounded-full hover:bg-slate-800 hover:text-slate-50 transition-colors border border-white/10 backdrop-blur cursor-pointer"
                          >
                            <Upload className="w-3 h-3" />
                  </button>
                  <button
                     onClick={() => { setSelectedCharId(char.id); }}
                     className="p-2 bg-slate-700/50 text-slate-50 rounded-full hover:bg-slate-800 hover:text-slate-50 transition-colors border border-white/10 backdrop-blur cursor-pointer"
                     title="管理造型"
                  >
                      <Shirt className="w-3 h-3" />
                  </button>
                  <button
                     onClick={() => { setSelectedVoiceCharId(char.id); setVoiceSynthesisModalOpen(true); }}
                     disabled={!!batchProgress || !!processingState}
                     className="p-2 bg-slate-700/50 text-slate-50 rounded-full hover:bg-slate-800 hover:text-slate-50 transition-colors border border-white/10 backdrop-blur cursor-pointer"
                     title="合成语音"
                  >
                      <Mic className="w-3 h-3" />
                  </button>
                  </div>
                </div>
                <div className="p-3 border-t border-slate-600 bg-slate-900">
                  <div className="flex items-center justify-between mb-1">
                  <div  className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-slate-200 truncate text-sm">{char.name}</h3>
                  {(char.gender!='未指定'&&char.gender!='未知') && <span className="px-1.5 py-0.5 bg-slate-900 text-slate-500 text-[11px] rounded border border-slate-600 font-mono">{char.gender}</span>}
                  {(char.age!='未指定'&&char.age!='未知') && <span className="px-1.5 py-0.5 bg-slate-900 text-slate-500 text-[11px] rounded border border-slate-600 font-mono">{char.age}</span>}
                     {char.variations && char.variations.length > 0 && (
                         <span className="px-1.5 py-0.5 text-[11px] rounded border border-slate-600 text-slate-400 font-mono flex items-center gap-1">
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
          <div className="flex items-end justify-between py-2 border-b border-slate-600 pb-4 sticky top-0 bg-slate-900 z-40">
            <div>
               <h3 className="text-sm font-bold text-slate-50 tracking-widest flex items-center gap-2">
                 <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                 场景概念
               </h3>
               <p className="text-xs text-slate-500 mt-1 pl-3.5">为剧本场景生成环境参考图</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddScene}
                disabled={!!batchProgress}
                className="px-3 py-2 rounded-lg text-xs font-bold tracking-wide transition-all flex items-center gap-2 cursor-pointer bg-green-600 text-slate-50 hover:bg-green-500 shadow-lg shadow-green-500/20"
              >
                <Plus className="w-3 h-3" />
                新增
              </button>
              <button
              onClick={() => handleBatchGenerate('scene')}
              disabled={!!batchProgress}
              className={`px-4 py-2 rounded-lg text-xs font-bold tracking-wide transition-all flex items-center gap-2 cursor-pointer ${
                  allScenesReady
                    ? 'bg-slate-900 text-slate-400 border border-slate-600 hover:text-slate-50 hover:border-slate-300 hover:bg-slate-500'
                    : 'bg-slate-800 text-slate-50 hover:bg-slate-600 shadow-lg shadow-white/5 border border-slate-600'
              }`}
            >
              {allScenesReady ? <RefreshCw className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
              {allScenesReady ? '重新批量生成' : '生成所有场景'}
            </button>
            </div>
          </div>

          <div className="grid grid-cols-1 py-4 md:grid-cols-3 xl:grid-cols-4 gap-6">
            {displayScenes.map((scene) => (
              <div key={scene.id} className="bg-slate-900 border border-slate-600 rounded-xl overflow-hidden flex flex-col group hover:border-slate-300 transition-all hover:shadow-lg">
                <div className="aspect-[16/9] bg-slate-800/50 relative overflow-hidden">
                  {/* Edit & Delete Buttons - Top Left */}
                  <button
                    onClick={() => handleEditScene(scene)}
                    disabled={!!batchProgress || !!processingState}
                    className="absolute top-2 left-2 p-2 bg-blue-600/50 text-slate-50 rounded-full hover:bg-blue-600 hover:text-slate-50 transition-colors border border-white/10 backdrop-blur cursor-pointer z-20"
                    title="编辑场景"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDeleteScene(scene.id)}
                    disabled={!!batchProgress || !!processingState}
                    className="absolute top-10 left-2 p-2 bg-red-600/50 text-slate-50 rounded-full hover:bg-red-600 hover:text-slate-50 transition-colors border border-white/10 backdrop-blur cursor-pointer z-20"
                    title="删除场景"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
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
                            onClick={(e) => {
                              const sceneImages = displayScenes
                                .filter(s => s.referenceImage)
                                .map(s => s.referenceImage);
                              const idx = sceneImages.indexOf(scene.referenceImage);
                              setPreviewImages(sceneImages);
                              setPreviewIndex(idx >= 0 ? idx : 0);
                              setPreviewImage(scene.referenceImage);
                            }}
                            disabled={!!batchProgress || !!processingState}
                            className="px-3 py-1.5 bg-slate-700/50 text-slate-50 text-[12px] font-bold tracking-wider rounded flex items-center gap-2 border border-white/20 hover:bg-slate-800 hover:text-slate-50 transition-colors backdrop-blur disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <Expand className="w-3 h-3" />
                            全屏预览
                          </button>
                        </div>
                      )}
                      <div className="absolute top-2 right-2 p-1 bg-green-300 text-slate-50 rounded shadow-lg backdrop-blur">
                        <Camera className="w-3 h-3" />
                      </div>
                    </>
                  ) : (
                     <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 p-4 text-center">
                       <MapPin className="w-10 h-10 mb-3 opacity-10" />
                       <button
                          onClick={() => { handleGenerateAsset('scene', scene.id); }}
                          disabled={processingState?.type === 'scene' && processingState?.id === scene.id || !!batchProgress || !!processingState}
                          className="px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded text-xs font-bold transition-all border border-slate-600 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                       >
                          {processingState?.type === 'scene' && processingState?.id === scene.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Palette className="w-3 h-3" />}
                          {processingState?.type === 'scene' && processingState?.id === scene.id ? '生成中...' : '生成'}
                       </button>
                     </div>
                  )}
                      {/* Preview Button */}
                      <div className="absolute bottom-0 right-0 flex items-center justify-center gap-1 p-1">
                      {scene.referenceImage && (
                          <>
                      <button
                        onClick={() => {handleGenerateAsset('scene', scene.id); }}
                        className="p-2 bg-slate-700/50 text-slate-50 rounded-full hover:bg-slate-800 hover:text-slate-50 transition-colors border border-white/10 backdrop-blur cursor-pointer"
                        title="重新生成"
                      >
                        <Palette className="w-3 h-3" />
                      </button>
                      {/* Download Button */}
                      <button
                        onClick={() => { handleDownloadImage(scene.referenceImage!, '场景-'+scene.location); }}
                        className="p-2 bg-slate-700/50 text-slate-50 rounded-full hover:bg-slate-800 hover:text-slate-50 transition-colors border border-white/10 backdrop-blur cursor-pointer"
                        title="下载图片"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                      </>
                      )}
                    {/* Upload Button */}
                    <button
                      onClick={() => { handleFileUploadClick(scene.id, 'scene'); }}
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
                     <span className="max-w-32 line-clamp-1 truncate px-1.5 py-0.5 bg-slate-900 text-slate-500 text-[11px] rounded border border-slate-600 font-mono whitespace-nowrap">{scene.time}</span>
                  </div>
                  <p className="text-[12px] text-slate-500 line-clamp-1 pt-2">{scene.atmosphere}</p>
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
        filePath={(uploadingItem?.type === 'scene' ? 'scene' : 'character')+'/upload'}
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
          onClick={() => { setPreviewImage(null); setPreviewImages([]); }}
        >
          {/* 左导航按钮 */}
          {previewImages.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const newIndex = previewIndex > 0 ? previewIndex - 1 : previewImages.length - 1;
                setPreviewIndex(newIndex);
                setPreviewImage(previewImages[newIndex]);
              }}
              className="absolute left-6 p-3 bg-slate-900/80 hover:bg-slate-800 text-slate-50 rounded-full transition-colors cursor-pointer"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          <img
            src={previewImage}
            alt="Full screen preview"
            className="max-w-[95vw] max-h-[95vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* 右导航按钮 */}
          {previewImages.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const newIndex = previewIndex < previewImages.length - 1 ? previewIndex + 1 : 0;
                setPreviewIndex(newIndex);
                setPreviewImage(previewImages[newIndex]);
              }}
              className="absolute right-16 p-3 bg-slate-900/80 hover:bg-slate-800 text-slate-50 rounded-full transition-colors cursor-pointer"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          <button
            onClick={() => { setPreviewImage(null); setPreviewImages([]); }}
            className="absolute top-6 right-6 p-3 bg-slate-900/80 hover:bg-slate-800 text-slate-50 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>

          {/* 图片信息 */}
          {previewImages.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-900/80 text-slate-50 rounded-full text-sm">
              {previewIndex + 1} / {previewImages.length}
            </div>
          )}
        </div>
      )}

      {/* Voice Synthesis Modal */}
      {voiceSynthesisModalOpen && selectedVoiceCharId && (
        <VoiceSynthesisModal
          isOpen={voiceSynthesisModalOpen}
          onClose={() => { setVoiceSynthesisModalOpen(false); setSelectedVoiceCharId(null); }}
          character={displayCharacters.find(c => c.id === selectedVoiceCharId)!}
          project={project}
          updateProject={updateProject}
        />
      )}

      {/* Add/Edit Character Modal */}
      <CharacterAddModal
        isOpen={addCharacterModalOpen}
        onClose={() => { setAddCharacterModalOpen(false); setEditingCharacter(null); }}
        onSave={handleSaveCharacter}
        character={editingCharacter}
        genre={project.scriptData?.genre}
        visualStyle={project.visualStyle}
      />

      {/* Add/Edit Scene Modal */}
      <SceneAddModal
        isOpen={addSceneModalOpen}
        onClose={() => { setAddSceneModalOpen(false); setEditingScene(null); }}
        onSave={handleSaveScene}
        scene={editingScene}
        genre={project.scriptData?.genre}
        visualStyle={project.visualStyle}
      />

    </div>
  );
};

export default StageAssets;
