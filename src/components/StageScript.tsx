import { AlertCircle, Aperture, BookOpen, BrainCircuit, Clock, Edit, Film, Image, List, MapPin, Plus, ScrollText, Sparkles, TextQuote, Trash, Users, Wand2 } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getEnabledConfigByType } from '../services/modelConfigService';
import { ModelService } from '../services/modelService';
import { createCharacterRef, createLightweightCharacters, createLightweightScenes, createSceneRef, generateId, mergeCharactersToLibrary, mergeScenesToLibrary, mergeToLibrary, remapScriptDataRefs, updateLibraryCharacter } from '../services/seriesService';
import { getAllModelConfigs } from '../services/storageService';
import { Character, ProjectState, Scene, SeriesRecord } from '../types';
import CustomSelect from './common/CustomSelect';
import { useDialog } from './dialog';
import { DURATION_OPTIONS, GENRE_OPTIONS, IMAGE_COUNT_OPTIONS, IMAGE_SIZE_OPTIONS, LANGUAGE_OPTIONS, STYLE_OPTIONS } from './modals/ProjectSettingsModal';
import ShotEditModal from './modals/ShotEditModal';
import StoryParagraphsModal from './modals/StoryParagraphsModal';

interface Props {
  project: ProjectState;
  updateProject: (updates: Partial<ProjectState>) => void;
  isMobile: boolean;
  series?: SeriesRecord | null;
  updateSeries?: (series: SeriesRecord) => void;
}

type TabMode = 'story' | 'script';

const StageScript: React.FC<Props> = ({ 
  project, 
  updateProject, 
  isMobile=false,
  series,
  updateSeries
}) => {
  const dialog = useDialog();
  const [activeTab, setActiveTab] = useState<TabMode>(project.scriptData ? 'script' : 'story');

  const [localScript, setLocalScript] = useState(project.rawScript);
  const [localTitle, setLocalTitle] = useState(project.title);
  const [localDuration, setLocalDuration] = useState(project.targetDuration || '60s');
  const [localLanguage, setLocalLanguage] = useState(project.language || '中文');
  const [localStyle, setLocalStyle] = useState(project.visualStyle || '真人写实');
  const [localGenre, setLocalGenre] = useState(project?.genre || '剧情片');
  const [customGenreInput, setCustomGenreInput] = useState('');
  const [localImageSize, setLocalImageSize] = useState(project.imageSize || '2560x1440');
  const [localImageCount, setLocalImageCount] = useState(project.imageCount || 0);
  const [customDurationInput, setCustomDurationInput] = useState('');
  const [customStyleInput, setCustomStyleInput] = useState('');

  const [modelConfigs, setModelConfigs] = useState<any[]>([]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scriptPrompt, setScriptPrompt] = useState('');
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [regeneratingSceneId, setRegeneratingSceneId] = useState<string | null>(null);

  // Editing states
  const [editingLogline, setEditingLogline] = useState(false);
  const [tempLogline, setTempLogline] = useState('');
  const [editingGenre, setEditingGenre] = useState(false);
  const [tempGenre, setTempGenre] = useState('');
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [tempCharacter, setTempCharacter] = useState<Partial<Character>>({});
  const [showAddCharacter, setShowAddCharacter] = useState(false);
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [tempScene, setTempScene] = useState<Partial<Scene>>({});
  const [showAddScene, setShowAddScene] = useState(false);
  const [editingShotId, setEditingShotId] = useState<string | null>(null);
  const [addingShotForSceneId, setAddingShotForSceneId] = useState<string | null>(null);
  const [storyParagraphsModalOpen, setStoryParagraphsModalOpen] = useState(false);
  const [editingStoryParagraphsSceneId, setEditingStoryParagraphsSceneId] = useState<string | null>(null);

  const [localLlmProvider, setLocalLlmProvider] = useState(project.modelProviders?.llm || '');
  const [localText2imageProvider, setLocalText2imageProvider] = useState(project.modelProviders?.text2image || '');
  const [localImage2videoProvider, setLocalImage2videoProvider] = useState(project.modelProviders?.image2video || '');
  const [scriptSourceMode, setScriptSourceMode] = useState<'generate' | 'import'>('generate');

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLocalScript(project.rawScript);
    setLocalTitle(project.title);

    const currentDuration = project.targetDuration || '60s';
    const isCustomDuration = !DURATION_OPTIONS.some(opt => opt.value === project.targetDuration);
    setLocalDuration(isCustomDuration ? 'custom' : currentDuration);
    setCustomDurationInput(isCustomDuration ? currentDuration : '');

    setLocalLanguage(project.language || '中文');

    const currentStyle = project.visualStyle || '真人写实';
    const isCustomStyle = !STYLE_OPTIONS.some(opt => opt.value === currentStyle);
    setLocalStyle(isCustomStyle ? 'custom' : currentStyle);
    setCustomStyleInput(isCustomStyle ? currentStyle : '');

    const currentGenre = project.genre || '剧情片';
    const isCustomGenre = !GENRE_OPTIONS.some(opt => opt.value === currentGenre);
    setCustomGenreInput(isCustomGenre ? currentGenre : '');
    setLocalGenre(isCustomGenre?'custom':currentGenre);

    setLocalImageSize(project.imageSize || '2560x1440');
    setLocalImageCount(project.imageCount || 0);

    // 加载模型配置
    loadModelConfigs();
    // initSystemModelProviders();
  }, [project.id, project.title, project.targetDuration, project.language, project.visualStyle, project.imageSize, project.imageCount]);

  const initSystemModelProviders = async () => {
      const llm = await getEnabledConfigByType('llm');
      const text2image = await getEnabledConfigByType('text2image');
      const image2video = await getEnabledConfigByType('image2video');
      setLocalLlmProvider(project.modelProviders?.llm || llm.id);
      setLocalText2imageProvider(project.modelProviders?.text2image || text2image.id);
      setLocalImage2videoProvider(project.modelProviders?.image2video || image2video.id);
  };
  const loadModelConfigs = async () => {
    try {
      const configs = await getAllModelConfigs();
      setModelConfigs(configs);
    } catch (error) {
      console.error('Failed to load model configs:', error);
    }
  };

  // 自动保存 localScript
  useEffect(() => {
    // 清除之前的定时器
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // 如果 localScript 为空或与项目中的值相同，则不保存
    if (!localScript || localScript === project.rawScript) {
      return;
    }
    // ✅ Removed: project.lastModified = 0; (direct mutation)

    // 设置新的定时器，延迟 2 秒后保存
    autoSaveTimerRef.current = setTimeout(() => {
      updateProject({
        rawScript: localScript,
        lastModified: Date.now()
      });
    }, 2000);

    // 清理函数：组件卸载时清除定时器
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [localScript, project.rawScript, updateProject]);

  const handleDurationSelect = (val: string) => {
    setLocalDuration(val);
  };

  const getFinalDuration = () => {
    return localDuration === 'custom' ? customDurationInput : localDuration;
  };

  const handleStyleSelect = (val: string) => {
    setLocalStyle(val);
  };

  const getFinalStyle = () => {
    return localStyle === 'custom' ? customStyleInput : localStyle;
  };

  // Logline editing
  const startEditLogline = () => {
    setTempLogline(project.scriptData?.logline || '');
    setEditingLogline(true);
  };

  const saveLogline = () => {
    if (!project.scriptData) return;
    updateProject({
      scriptData: {
        ...project.scriptData,
        logline: tempLogline
      }
    });
    setEditingLogline(false);
  };

  const startEditGenre = () => {
    setTempGenre(project.scriptData?.genre || '剧情片');
    setEditingGenre(true);
  };

  const saveGenre = () => {
    if (!project.scriptData) return;
    updateProject({
      scriptData: {
        ...project.scriptData,
        genre: tempGenre
      }
    });
    setEditingGenre(false);
  };

  const startEditCharacter = useCallback((char: Character) => {
    setTempCharacter({ ...char });
    setEditingCharacterId(char.id);
  }, []);

  const saveCharacter = useCallback(() => {
    if (!project.scriptData || !editingCharacterId || !tempCharacter.name) return;
    tempCharacter.visualPrompt = "";
    const updatedCharacters = project.scriptData.characters.map(c =>
      c.id === editingCharacterId ? { ...c, ...tempCharacter } as Character : c
    );
    updateProject({
      scriptData: {
        ...project.scriptData,
        characters: updatedCharacters
      }
    });
    // 连续剧模式：同步更新到 library
    if (series && updateSeries) {
      const updatedChar = updatedCharacters.find(c => c.id === editingCharacterId);
      if (updatedChar?.refId) {
        const updatedSeries = updateLibraryCharacter(series, updatedChar.refId, {
          name: updatedChar.name,
          gender: updatedChar.gender,
          age: updatedChar.age,
          personality: updatedChar.personality
        });
        updateSeries(updatedSeries);
      }
    }
    setEditingCharacterId(null);
    setTempCharacter({});
  }, [project.scriptData, editingCharacterId, tempCharacter.name, tempCharacter, updateProject, series, updateSeries]);

  const addCharacter = useCallback(() => {
    if (!project.scriptData || !tempCharacter.name) return;

    if (series && updateSeries) {
      // 连续剧模式：先合并到 library（自动去重），再创建引用
      const newChar: Character = {
        id: generateId('char'), // ✅ Use unified ID generator
        name: tempCharacter.name,
        gender: tempCharacter.gender || '未知',
        age: tempCharacter.age || '未知',
        personality: tempCharacter.personality || '',
        variations: []
      };

      const { updatedSeries, charIdMapping } = mergeCharactersToLibrary(series, [newChar]);
      const libraryCharId = charIdMapping.get(newChar.id);

      if (libraryCharId) {
        const libraryChar = updatedSeries.library.characters.find(c => c.id === libraryCharId)!;
        const episodeRef = createCharacterRef(libraryChar);

        updateSeries(updatedSeries);
        updateProject({
          scriptData: {
            ...project.scriptData,
            characters: [...project.scriptData.characters, episodeRef]
          }
        });
      }
    } else {
      // 独立模式：直接添加到项目
      const newCharacter: Character = {
        id: generateId('char'), // ✅ Use unified ID generator
        name: tempCharacter.name,
        gender: tempCharacter.gender || '未知',
        age: tempCharacter.age || '未知',
        personality: tempCharacter.personality || '',
        variations: []
      };
      updateProject({
        scriptData: {
          ...project.scriptData,
          characters: [...project.scriptData.characters, newCharacter]
        }
      });
    }

    setShowAddCharacter(false);
    setTempCharacter({});
  }, [project.scriptData, tempCharacter.name, tempCharacter, series, updateSeries, updateProject]);

  const deleteCharacter = useCallback(async (charId: string) => {
    if (!project.scriptData) return;
    const confirmed = await dialog.confirm({
      title: '确认删除',
      message: '确定要删除这个角色吗？',
      type: 'warning',
    });
    if (!confirmed) return;
    const updatedCharacters = project.scriptData.characters.filter(c => c.id !== charId);
    updateProject({
      scriptData: {
        ...project.scriptData,
        characters: updatedCharacters
      }
    });
  }, [project.scriptData, updateProject, dialog]);

  // Scene editing
  const startEditScene = useCallback((scene: Scene) => {
    setTempScene({ ...scene });
    setEditingSceneId(scene.id);
  }, []);

  const saveScene = useCallback(() => {
    if (!project.scriptData || !editingSceneId || !tempScene.location) return;
    tempScene.visualPrompt = "";
    const updatedScenes = project.scriptData.scenes.map(s =>
      s.id === editingSceneId ? { ...s, ...tempScene } as Scene : s
    );
    updateProject({
      scriptData: {
        ...project.scriptData,
        scenes: updatedScenes
      }
    });
    setEditingSceneId(null);
    setTempScene({});
  }, [project.scriptData, editingSceneId, tempScene.location, tempScene, updateProject]);

  const addScene = useCallback(() => {
    if (!project.scriptData || !tempScene.location) return;

    if (series && updateSeries) {
      // 连续剧模式：先合并到 library（自动去重），再创建引用
      const newScene: Scene = {
        id: generateId('scene'), // ✅ Use unified ID generator
        location: tempScene.location,
        time: tempScene.time || '日间',
        atmosphere: tempScene.atmosphere || ''
      };

      const { updatedSeries, sceneIdMapping } = mergeScenesToLibrary(series, [newScene]);
      const librarySceneId = sceneIdMapping.get(newScene.id);

      if (librarySceneId) {
        const libraryScene = updatedSeries.library.scenes.find(s => s.id === librarySceneId)!;
        const episodeRef = createSceneRef(libraryScene);

        updateSeries(updatedSeries);
        updateProject({
          scriptData: {
            ...project.scriptData,
            scenes: [...project.scriptData.scenes, episodeRef]
          }
        });
      }
    } else {
      // 独立模式：直接添加到项目
      const newScene: Scene = {
        id: generateId('scene'), // ✅ Use unified ID generator
        location: tempScene.location,
        time: tempScene.time || '日间',
        atmosphere: tempScene.atmosphere || ''
      };
      updateProject({
        scriptData: {
          ...project.scriptData,
          scenes: [...project.scriptData.scenes, newScene]
        }
      });
    }

    setShowAddScene(false);
    setTempScene({});
  }, [project.scriptData, tempScene.location, tempScene, series, updateSeries, updateProject]);

  const deleteScene = useCallback(async (sceneId: string) => {
    if (!project.scriptData) return;
    const confirmed = await dialog.confirm({
      title: '确认删除',
      message: '确定要删除这个场景吗？',
      type: 'warning',
    });
    if (!confirmed) return;
    const updatedScenes = project.scriptData.scenes.filter(s => s.id !== sceneId);
    updateProject({
      scriptData: {
        ...project.scriptData,
        scenes: updatedScenes
      }
    });
  }, [project.scriptData, updateProject, dialog]);

  // Shot editing
  const startEditShot = useCallback((shot: any) => {
    setEditingShotId(shot.id);
  }, []);

  const startAddShot = useCallback((sceneId: string) => {
    setAddingShotForSceneId(sceneId);
  }, []);

  const saveShot = useCallback((updatedShot: Partial<any>) => {
    if (editingShotId) {
      // 编辑现有 shot
      const updatedShots = project.shots.map(s =>
        s.id === editingShotId ? { ...s, ...updatedShot } : s
      );
      updateProject({ shots: updatedShots });
      setEditingShotId(null);
    } else if (addingShotForSceneId) {
      // 添加新 shot
      const newShot: any = {
        id: `shot-${Date.now()}`,
        sceneId: addingShotForSceneId,
        actionSummary: updatedShot.actionSummary || '',
        dialogue: updatedShot.dialogue || [],
        cameraMovement: updatedShot.cameraMovement || '固定',
        shotSize: updatedShot.shotSize || 'MED',
        interval:{duration: updatedShot.duration || 5},
        characters: updatedShot.characters || [],
        keyframes: updatedShot.keyframes || []
      };
      updateProject({ shots: [...project.shots, newShot] });
      setAddingShotForSceneId(null);
    }
  }, [editingShotId, addingShotForSceneId, project.shots, updateProject]);

  const deleteShot = useCallback(async (shotId: string) => {
    const confirmed = await dialog.confirm({
      title: '确认删除',
      message: '确定要删除这个分镜吗？',
      type: 'warning',
    });
    if (!confirmed) return;
    const updatedShots = project.shots.filter(s => s.id !== shotId);
    updateProject({ shots: updatedShots });
  }, [project.shots, updateProject, dialog]);

  const handleRegenerateSceneShots = async (sceneId: string, sceneIndex: number) => {
    if (!project.scriptData) return;

    const scene = project.scriptData.scenes.find(s => s.id === sceneId);
    if (!scene) return;

    const confirmed = await dialog.confirm({
      title: '确认重新生成',
      message: '确定要重新生成该场景的分镜吗？这将替换该场景的所有分镜。',
      type: 'warning',
    });
    if (!confirmed) return;

    setRegeneratingSceneId(sceneId);
    try {
      const newShots = await ModelService.generateShotListForScene(project.scriptData, scene, sceneIndex ,project.imageCount);
      if(newShots && newShots.length > 0){
        // 删除该场景的旧分镜
        const otherShots = project.shots.filter(s => s.sceneId !== sceneId);
  
        // 重新索引新分镜
        const indexedShots = newShots.map((s, idx) => ({
          ...s,
          id: `shot-regen-${Date.now()}-${idx}`,
          sceneId: sceneId,
          keyframes: Array.isArray(s.keyframes)
            ? s.keyframes.map((k: any) => ({
                ...k,
                id: `kf-regen-${idx}-${k.type}`,
                status: "pending",
              }))
            : [],
        }));
  
        updateProject({
          shots: [...otherShots, ...indexedShots]
        });
  
        // 清理可能失效的编辑状态
        setEditingShotId(null);
        setAddingShotForSceneId(null);
        setEditingSceneId(null);
      }else{
        await dialog.alert({
          title: '错误',
          message: `重新生成分镜失败"}`,
          type: 'error',
        });
      }
    } catch (err: any) {
      console.error(err);
      await dialog.alert({
        title: '错误',
        message: `重新生成分镜失败: ${err.message || "AI 连接失败"}`,
        type: 'error',
      });
    } finally {
      setRegeneratingSceneId(null);
    }
  };

  const handleGenerateScript = async () => {
    if (!scriptPrompt.trim()) {
      dialog.alert({
        title: '错误',
        message: '请输入剧本提示词。',
        type: 'error',
      });
      return;
    }

    setIsGeneratingScript(true);
    try {
      ModelService.setCurrentProjectProviders(project.modelProviders);
      const finalGenre = localGenre === 'custom' ? customGenreInput : localGenre;

      const generatedScript = await ModelService.generateScript(
        scriptPrompt,
        finalGenre || project.scriptData?.genre || '剧情片',
        getFinalDuration(),
        localLanguage
      );
      if(generatedScript){
        setLocalScript(generatedScript);
      }else{
        dialog.alert({
          title: '错误',
          message: '生成剧本失败。请检查模型是否正常。',
          type: 'error',
        });
      }
      setIsGeneratingScript(false);
    } catch (err: any) {
      setIsGeneratingScript(false);
      console.error(err);
      dialog.alert({
        title: '错误',
        message: `剧本生成失败: ${err.message || "AI 连接失败"}`,
        type: 'error',
      });
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const handleAnalyze = async () => {
    if (!localScript.trim()) {
      dialog.alert({
        title: '错误',
        message: '请输入剧本内容。',
        type: 'error',
      });
      return;
    }

    const finalDuration = getFinalDuration();
    if (!finalDuration) {
      dialog.alert({
        title: '错误',
        message: '请选择目标时长。',
        type: 'error',
      });
      return;
    }

    setIsProcessing(true);
    setProcessingStep('正在分析剧本结构...');
    try {
      const finalGenre = localGenre === 'custom' ? customGenreInput : localGenre;
      updateProject({
        title: localTitle,
        rawScript: localScript,
        targetDuration: getFinalDuration(),
        language: localLanguage,
        visualStyle: getFinalStyle(),
        imageSize: localImageSize,
        imageCount: localImageCount,
        genre: finalGenre || project.scriptData?.genre || '剧情片',
      });
      ModelService.setCurrentProjectProviders(project.modelProviders);
      let scriptData = await ModelService.parseScriptToData(localScript, localLanguage,localGenre);
      console.log('scriptData', scriptData);
      if(scriptData.scenes.length > 0){
        updateProject({ isParsingScript: true });
  
        scriptData.targetDuration = finalDuration;
        scriptData.language = localLanguage;
  
        if (localTitle && localTitle !== "未命名项目") {
          scriptData.title = localTitle;
        }
        scriptData.genre = localGenre;

        // Series mode: merge to library and create lightweight refs
        if (series && updateSeries) {
          setProcessingStep('正在同步到剧集库...');
          const { series: updatedSeries, charIdMapping, sceneIdMapping } = 
            mergeToLibrary(series, scriptData.characters, scriptData.scenes);
          
          // Remap references in scriptData
          scriptData = remapScriptDataRefs(scriptData, charIdMapping, sceneIdMapping);
          
          // Create lightweight characters/scenes for episode
          scriptData.characters = createLightweightCharacters(scriptData.characters, charIdMapping);
          scriptData.scenes = createLightweightScenes(scriptData.scenes, sceneIdMapping);
          
          // Update series
          updateSeries(updatedSeries);
        }

        // 逐场景生成分镜
        const allShots: any[] = [];
        const totalScenes = scriptData.scenes.length;
  
        for (let i = 0; i < totalScenes; i++) {
          const scene = scriptData.scenes[i];
          setProcessingStep(`正在生成第 ${i + 1}/${totalScenes} 场的分镜...`);
  
          const sceneShots = await ModelService.generateShotListForScene(scriptData, scene, i,project.imageCount);
          allShots.push(...sceneShots);
  
          // 短暂延迟，避免请求过快
          if (i < totalScenes - 1) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }
  
        // 重新索引 shots
        const shots = allShots.map((s, idx) => ({
          ...s,
          id: `shot-${idx + 1}`,
          keyframes: Array.isArray(s.keyframes)
            ? s.keyframes.map((k: any) => ({
                ...k,
                id: `kf-${idx + 1}-${k.type}`,
                status: "pending",
              }))
            : [],
        }));
  
        setProcessingStep('正在保存分镜数据...');
        updateProject({
          scriptData,
          shots,
          title: scriptData.title,
          genre: scriptData.genre || finalGenre
        });
  
        setActiveTab('script');
        setProcessingStep('');
      }else{
        setProcessingStep('');
        await dialog.alert({
          title: '错误',
          message: `分析剧本失败`,
          type: 'error',
        });
        return;
      }

    } catch (err: any) {
      console.error(err);
      dialog.alert({
        title: '错误',
        message: `错误: ${err.message || "AI 连接失败"}`,
        type: 'error',
      });
      setProcessingStep('');
    } finally {
      setIsProcessing(false);
    }
  };


  const handleImport = async () => {
    if (!localScript.trim()) {
      dialog.alert({
        title: '错误',
        message: '请输入剧本内容。',
        type: 'error',
      });
      return;
    }

    const finalDuration = getFinalDuration();
    if (!finalDuration) {
      dialog.alert({
        title: '错误',
        message: '请选择目标时长。',
        type: 'error',
      });
      return;
    }

    setIsProcessing(true);
    setProcessingStep('正在提取剧本结构...');
    try {
      const finalGenre = localGenre === 'custom' ? customGenreInput : localGenre;
      updateProject({
        title: localTitle,
        rawScript: localScript,
        targetDuration: getFinalDuration(),
        language: localLanguage,
        visualStyle: getFinalStyle(),
        imageSize: localImageSize,
        imageCount: localImageCount,
        genre: finalGenre || project.scriptData?.genre || '剧情片',
      });
      ModelService.setCurrentProjectProviders(project.modelProviders);
      let scriptData = await ModelService.importScriptToData(localScript, localLanguage,localGenre);
      console.log('scriptData', scriptData);
      if(scriptData.scenes.length > 0){
        updateProject({ isParsingScript: true });
  
        scriptData.targetDuration = finalDuration;
        scriptData.language = localLanguage;
  
        if (localTitle && localTitle !== "未命名项目") {
          scriptData.title = localTitle;
        }
        scriptData.genre = localGenre;

        // Series mode: merge to library and create lightweight refs
        if (series && updateSeries) {
          setProcessingStep('正在同步到剧集库...');
          const { series: updatedSeries, charIdMapping, sceneIdMapping } = 
            mergeToLibrary(series, scriptData.characters, scriptData.scenes);
          
          // Remap references in scriptData
          scriptData = remapScriptDataRefs(scriptData, charIdMapping, sceneIdMapping);
          
          // Create lightweight characters/scenes for episode
          scriptData.characters = createLightweightCharacters(scriptData.characters, charIdMapping);
          scriptData.scenes = createLightweightScenes(scriptData.scenes, sceneIdMapping);
          
          // Update series
          updateSeries(updatedSeries);
        }

        // 逐场景生成分镜
        const allShots: any[] = [];
  
        const sceneShots = await ModelService.importShotList(scriptData,project.imageCount,localScript);
        allShots.push(...sceneShots);
  
        // 重新索引 shots
        const shots = allShots.map((s, idx) => ({
          ...s,
          id: `shot-${idx + 1}`,
          keyframes: Array.isArray(s.keyframes)
            ? s.keyframes.map((k: any) => ({
                ...k,
                id: `kf-${idx + 1}-${k.type}`,
                status: "pending",
              }))
            : [],
        }));
  
        setProcessingStep('正在保存分镜数据...');
        updateProject({
          scriptData,
          shots,
          title: scriptData.title,
          genre: scriptData.genre || finalGenre
        });
  
        setActiveTab('script');
        setProcessingStep('');
      }else{
        setProcessingStep('');
        await dialog.alert({
          title: '错误',
          message: `分析剧本失败`,
          type: 'error',
        });
        return;
      }

    } catch (err: any) {
      console.error(err);
      dialog.alert({
        title: '错误',
        message: `错误: ${err.message || "AI 连接失败"}`,
        type: 'error',
      });
      setProcessingStep('');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderStoryInput = () => (
    <div className={`flex h-full overflow-y-auto bg-slate-900 text-slate-300 ${isMobile ? 'flex-col' : 'flex-row'}`}>
      {/* Right: Text Editor - Optimized */}
      <div className="h-full flex-1 flex flex-col bg-slate-900 relative">
        <div className="h-14 border-b border-slate-600 flex items-center justify-between md:px-6 px-2 bg-slate-700 shrink-0">
           <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-slate-50 tracking-tight flex items-center gap-3">
              <BookOpen className="w-5 h-5 text-slate-500" />
              剧本和故事
            </h2>
           </div>
           {isMobile && project.scriptData && (
           <button
               onClick={() => setActiveTab('script')}
               className="px-4 py-2 rounded-lg border border-slate-600 bg-slate-600 text-slate-50 text-xs font-bold tracking-wide transition-all flex items-center gap-2 hover:bg-slate-500 shadow-lg shadow-slate-600/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
             >
               <List className="w-3 h-3" />
               分镜列表
            </button>
           )}
        </div>

        {/* AI Script Generation Input */}
        <div className="border-b border-slate-600/50 bg-slate-700 md:p-4 p-2">
           <div className="mx-auto">
              <div className="flex gap-2">
                 <input
                    type="text"
                    value={scriptPrompt}
                    onChange={(e) => setScriptPrompt(e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-600 text-slate-50 px-4 py-2.5 text-sm rounded-lg focus:border-slate-500 focus:outline-none transition-all placeholder:text-slate-600"
                    placeholder="输入简单提示词（如：一个关于青春校园的励志故事）..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleGenerateScript();
                      }
                    }}
                 />
                 <button
                    onClick={handleGenerateScript}
                    disabled={isGeneratingScript || !scriptPrompt.trim()}
                    className={`px-5 py-2.5 rounded-lg text-xs font-bold tracking-wider transition-all flex items-center gap-2 shrink-0 ${
                      isGeneratingScript
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-slate-600 text-slate-50 hover:bg-slate-500 shadow-lg shadow-slate-600/20'
                    } ${!scriptPrompt.trim() ? 'opacity-50' : ''}`}
                 >
                    <Sparkles className={`w-3.5 h-3.5 ${isGeneratingScript ? 'animate-spin' : ''}`} />
                    {isGeneratingScript ? '生成中...' : 'AI 生成剧本'}
                 </button>
              </div>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto md:px-4 px-2 bg-slate-700">
           <div className={`mx-auto ${isMobile ? 'h-[600px]' : 'h-full'} flex flex-col py-2`}>
              <textarea
                  value={localScript}
                  onChange={(e) => setLocalScript(e.target.value)}
                  className="px-2 flex-1 rounded-lg bg-slate-800 text-slate-200 font-serif text-lg leading-loose focus:outline-none resize-none placeholder:text-slate-600"
                  placeholder="在此输入故事大纲或直接粘贴剧本..."
                  spellCheck={false}
              />
           </div>
        </div>

        {/* Editor Status Footer */}
        <div className="h-8 border-t border-slate-600 bg-slate-700 px-4 flex items-center justify-end gap-4 text-[12px] text-slate-400 font-mono select-none">
           <span>{localScript.length} 字符</span>
           <span>{localScript.split('\n').length} 行</span>
           <div className="flex items-center gap-1.5">
             <div className={`w-1.5 h-1.5 rounded-full ${project.lastModified ? 'bg-green-800':'bg-red-800'}`}></div>
             {project.lastModified ? '已自动保存' : '准备就绪'}
           </div>
        </div>
      </div>
      {/* Middle Column: Config Panel - Adjusted Width to w-96 */}
      <div className={`${isMobile ? 'w-full' : 'w-96'} h-full border-l border-slate-600 flex flex-col bg-slate-700 shadow-2xl animate-in slide-in-from-right-10 duration-300 transition-all ease-in-out`}>
        {/* Header - Fixed Height 56px */}
        <div className="h-14 md:px-6 px-2 border-b border-slate-600 bg-slate-700 flex items-center justify-between shrink-0">
            <h2 className="text-lg font-bold text-slate-50 tracking-tight flex items-center gap-3">
              项目配置
            </h2>
            {project.scriptData && (
            <button
               onClick={() => setActiveTab('script')}
               className="px-4 py-2 rounded-lg border border-slate-600 bg-slate-600 text-slate-50 text-xs font-bold tracking-wide transition-all flex items-center gap-2 hover:bg-slate-500 shadow-lg shadow-slate-600/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
             >
               <List className="w-3 h-3" />
               分镜列表
            </button>
            )}
        </div>

        <div className="flex-1 overflow-y-auto md:p-6 md:pt-2 p-2 space-y-6">
            {/* Title Input */}
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-slate-500 tracking-widest">项目标题</label>
              <input 
                type="text"
                value={localTitle}
                onChange={(e) => setLocalTitle(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 text-slate-50 px-4 py-2.5 text-sm rounded-md focus:border-slate-500 focus:outline-none transition-all placeholder:text-slate-600"
                placeholder="输入项目名称..."
              />
            </div>

            {/* Language Selection */}
            <div className="space-y-2">
              <CustomSelect
                options={LANGUAGE_OPTIONS}
                value={localLanguage}
                onChange={setLocalLanguage}
                className="w-full"
              />
            </div>

            {/* Visual Style Selection */}
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-slate-500 tracking-widest flex items-center gap-2">
                画面风格
              </label>
              <div className="grid grid-cols-2 gap-3">
              <CustomSelect
                options={STYLE_OPTIONS}
                value={localStyle}
                onChange={handleStyleSelect}
                className="w-full"
              />
              <div className="relative"> 
              {localStyle === 'custom' && (
                <input
                  type="text"
                  value={customStyleInput}
                  onChange={(e) => setCustomStyleInput(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 text-slate-50 px-4 py-2.5 text-sm rounded-md focus:border-slate-500 focus:outline-none transition-all placeholder:text-slate-600"
                  placeholder="输入自定义画面风格..."
                />
              )}
              </div>
              </div>
            </div>

            {/* Genre Selection */}
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-slate-500 tracking-widest">题材类型</label>
              <div className="grid grid-cols-2 gap-3">
              <CustomSelect
                options={GENRE_OPTIONS}
                value={localGenre}
                onChange={setLocalGenre}
                className="w-full"
              />
              <div className="relative"> 
              {localGenre === 'custom' && (
                <input
                type="text"
                value={customGenreInput}
                onChange={(e) => setCustomGenreInput(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 text-slate-50 px-4 py-2.5 text-sm rounded-md focus:border-slate-500 focus:outline-none transition-all placeholder:text-slate-600"
                placeholder="输入自定义类型..."
                />
              )}
              </div>
              </div>
            </div>

            {/* Image Size Selection */}
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-slate-500 tracking-widest flex items-center gap-2">
                图片尺寸
              </label>
              <CustomSelect
                options={IMAGE_SIZE_OPTIONS}
                value={localImageSize}
                onChange={setLocalImageSize}
                className="w-full"
              />
            </div>

            {/* Image Count Selection */}
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-slate-500 tracking-widest flex items-center gap-2">
                出图数量
              </label>
              <CustomSelect
                options={IMAGE_COUNT_OPTIONS}
                value={localImageCount.toString()}
                onChange={(value) => setLocalImageCount(Number(value))}
                className="w-full"
              />
            </div>

            {/* Duration Selection */}
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-slate-500 tracking-widest flex items-center gap-2">
                目标时长
              </label>
              <div className="grid grid-cols-2 gap-2">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleDurationSelect(opt.value)}
                    className={`px-2 py-2.5 text-[11px] font-medium rounded-md transition-all text-center border ${
                      localDuration === opt.value
                        ? 'bg-slate-200/50 text-slate-50 border-slate-400 shadow-sm'
                        : 'bg-transparent border-slate-600 text-slate-400 hover:border-slate-300 hover:text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              {localDuration === 'custom' && (
                <div>
                  <input
                    type="text"
                    value={customDurationInput}
                    onChange={(e) => setCustomDurationInput(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 text-slate-50 px-4 py-2.5 text-sm rounded-md focus:border-slate-500 focus:outline-none font-mono placeholder:text-slate-600"
                    placeholder="输入时长 (如: 90s, 3m)"
                  />
                </div>
              )}
              </div>
            </div>

            {/* Import or Create Switch Selection */}
            <div className="space-y-3">
              <p className="text-[12px] font-bold text-slate-500 tracking-widest mb-3">分镜来源</p>
              <div className="flex bg-slate-800/50 p-1 rounded-lg border border-slate-600">
                <button
                  onClick={() => setScriptSourceMode('generate')}
                  className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-2 ${
                    scriptSourceMode === 'generate'
                      ? 'bg-slate-600 text-slate-50 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  AI生成
                </button>
                <button
                  onClick={() => setScriptSourceMode('import')}
                  className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-2 ${
                    scriptSourceMode === 'import'
                      ? 'bg-slate-600 text-slate-50 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  导入脚本
                </button>
              </div>
              <p className="text-[10px] text-slate-500">
                {scriptSourceMode === 'generate'
                  ? 'AI将根据剧本内容自动分析并生成分镜脚本'
                  : '导入已有的分镜脚本，系统将解析并应用'}
              </p>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-600 pt-4">
              <p className="text-[12px] font-bold text-slate-500 tracking-widest mb-4">模型供应商</p>
            </div>

            {/* LLM Provider Selection */}
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-slate-500 tracking-widest flex items-center gap-2">
                <Sparkles className="w-3 h-3" />
                大语言模型 (LLM)
              </label>
              <CustomSelect
                options={[{ value: '', label: '系统默认模型' }, ...modelConfigs.filter(c => c.modelType === 'llm' && c.apiKey).map(config => ({
                  value: config.id,
                  label: `${config.provider} - ${config.description || config.model}${config.enabled ? '✅' : ''}`
                }))]}
                value={project.modelProviders?.llm || localLlmProvider}
                onChange={(value) => {
                  const currentProviders = project.modelProviders || {};
                  updateProject({
                    modelProviders: {
                      ...currentProviders,
                      llm: value || undefined
                    }
                  });
                }}
                className="w-full"
              />
            </div>

            {/* Text2Image Provider Selection */}
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-slate-500 tracking-widest flex items-center gap-2">
                <Image className="w-3 h-3" />
                文生图模型
              </label>
              <CustomSelect
                options={[{ value: '', label: '系统默认模型' }, ...modelConfigs.filter(c => c.modelType === 'text2image' && c.apiKey).map(config => ({
                  value: config.id,
                  label: `${config.provider} - ${config.description || config.model}${config.enabled ? '✅' : ''}`
                }))]}
                value={project.modelProviders?.text2image || localText2imageProvider}
                onChange={(value) => {
                  const currentProviders = project.modelProviders || {};
                  updateProject({
                    modelProviders: {
                      ...currentProviders,
                      text2image: value || undefined
                    }
                  });
                }}
                className="w-full"
              />
            </div>

            {/* Image2Video Provider Selection */}
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-slate-500 tracking-widest flex items-center gap-2">
                <Film className="w-3 h-3" />
                图生视频模型
              </label>
              <CustomSelect
                options={[{ value: '', label: '系统默认模型' }, ...modelConfigs.filter(c => c.modelType === 'image2video' && c.apiKey).map(config => ({
                  value: config.id,
                  label: `${config.provider} - ${config.description || config.model}${config.enabled ? '✅' : ''}`
                }))]}
                value={project.modelProviders?.image2video || localImage2videoProvider}
                onChange={(value) => {
                  const currentProviders = project.modelProviders || {};
                  updateProject({
                    modelProviders: {
                      ...currentProviders,
                      image2video: value || undefined
                    }
                  });
                }}
                className="w-full"
              />
            </div>

        </div>

        {/* Footer Action */}
        <div className="p-4 border-t border-slate-600 bg-slate-900">
           <button
              onClick={scriptSourceMode === 'generate' ? handleAnalyze : handleImport}
              disabled={isProcessing}
              className={`w-full py-2 rounded-lg font-bold border border-slate-600 text-md tracking-widest flex items-center justify-center gap-2 transition-all  ${
                isProcessing
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-slate-800 text-slate-50 hover:bg-slate-700 shadow-white/5'
              }`}
            >
              {isProcessing ? (
                <>
                  <BrainCircuit className="w-4 h-4 animate-spin" />
                  {processingStep || (scriptSourceMode === 'generate' ? '智能分析中...' : '导入解析中...')}
                </>
              ) : (
                <>
                  {scriptSourceMode === 'generate' ? (
                    <>
                      <Wand2 className="w-4 h-4" />
                      生成分镜脚本
                    </>
                  ) : (
                    <>
                      <BookOpen className="w-4 h-4" />
                      导入分镜脚本
                    </>
                  )}
                </>
              )}
            </button>
            {error && (
              <div className="mt-4 p-3 bg-red-900/10 border border-red-900/50 text-red-500 text-xs rounded flex items-center gap-2">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                {error}
              </div>
            )}
        </div>
      </div>
    </div>
  );

  const renderScriptBreakdown = () => {
    // Always use local characters/scenes from project.scriptData
    const localCharacters = project.scriptData?.characters || [];
    const localScenes = project.scriptData?.scenes || [];
    
    // Deduplication Logic
    const seenLocations = new Set();
    const uniqueScenesList = localScenes.filter(scene => {
      const normalizedLoc = scene.location.trim().toLowerCase();
      seenLocations.add(normalizedLoc);
      return true;
    });

    return (
      <div className="flex flex-col h-full bg-slate-900 animate-in fade-in duration-500">
        {/* Header */}
        <div className="h-14 md:px-6 px-2 border-b border-slate-600 bg-slate-700 flex items-center justify-between shrink-0 z-20">
           <div className="flex items-center gap-6">
              <h2 className="text-lg font-bold text-slate-50 tracking-tight flex items-center gap-3">
                 <ScrollText className="w-5 h-5 text-slate-500" />
                 拍摄清单
              </h2>
           </div>

           <div className="flex gap-2">
             <button
               onClick={() => setActiveTab('story')}
               className="px-4 py-2 rounded-lg border border-slate-600 bg-slate-600 text-slate-50 text-xs font-bold tracking-wide transition-all flex items-center gap-2 hover:bg-slate-500 shadow-lg shadow-slate-600/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
             >
               <BookOpen className="w-3 h-3" />
               剧本编辑
             </button>
           </div>
        </div>
  
        {/* Content Split View */}
      <div className={`flex-1 overflow-y-auto ${isMobile ? '' : 'flex'}`}>
                      {/* Main: Script & Shots */}
           <div className="h-full flex-1 overflow-y-auto bg-slate-900 p-0 ">
              <div className="max-w-5xl mx-auto pb-2">
                 {localScenes.map((scene, index) => {
                   const sceneShots = project.shots.filter(s => s.sceneId === scene.id);
                   //if (sceneShots.length === 0) return null;

                   return (
                     <div key={scene.id} className="border-b border-slate-600">
                        {/* Scene Header strip */}
                        <div className="sticky top-0 z-10 bg-slate-800 backdrop-blur border-b border-slate-600 shadow-lg shadow-black/20">
                           <div className="px-4 md:px-8 py-5 flex flex-col md:flex-row items-baseline justify-between">
                              <div className="flex items-center justify-between gap-6">
                                 <div className="flex items-center justify-between md:items-baseline gap-4">
                                    <span className="text-3xl font-bold text-slate-50/10 font-mono">{(index + 1).toString().padStart(2, '0')}</span>
                                    <h3 className="text-lg font-bold text-slate-50 tracking-wider line-clamp-1">
                                       {scene.location}
                                    </h3>
                                 </div>
                              </div>
                              <div className="flex items-center justify-between md:gap-4 gap-1 text-[11px] font-mono tracking-widest text-slate-500">
                                 <span className="flex items-center gap-1.5 whitespace-wrap"><Clock className="w-3 h-3"/> {scene.time}</span>
                                 <span className="text-slate-600">|</span>
                                 <span className="">{scene.atmosphere}</span>
                              </div>
                           </div>

                           {/* Action Buttons - Compact */}
                           <div className="px-4 md:px-8 pb-4 border-b border-slate-600">
                              <div className="flex gap-2">
                                 <button
                                    onClick={() => {
                                       setEditingStoryParagraphsSceneId(scene.id);
                                       setStoryParagraphsModalOpen(true);
                                    }}
                                    disabled={regeneratingSceneId === scene.id}
                                    className="px-2.5 py-1.5 text-[11px] font-medium text-slate-400 hover:text-slate-400 bg-slate-700/80 border hover:bg-slate-600/80 border-slate-600 hover:border-slate-300 rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                    title="编辑故事段落"
                                 >
                                    <ScrollText className="w-3 h-3" />
                                    <span>故事段落</span>
                                 </button>
                                 <button
                                    onClick={() => startAddShot(scene.id)}
                                    disabled={regeneratingSceneId === scene.id}
                                    className="px-2.5 py-1.5 text-[11px] font-medium text-slate-400 hover:text-slate-400 bg-slate-700/80 border hover:bg-slate-600/80 border-slate-600 hover:border-slate-300 rounded transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                    title="添加分镜"
                                 >
                                    <Plus className="w-3 h-3" />
                                    <span>新增分镜</span>
                                 </button>
                                 <button
                                    onClick={() => handleRegenerateSceneShots(scene.id, index)}
                                    disabled={regeneratingSceneId === scene.id}
                                    className="px-2.5 py-1.5 text-[11px] font-medium text-slate-400 hover:text-slate-400 bg-slate-700/80 border hover:bg-slate-600/80 border-slate-600 hover:border-slate-300 rounded transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="重新生成分镜"
                                 >
                                    <Wand2 className="w-3 h-3" />
                                    <span>{regeneratingSceneId === scene.id ? '生成中...' : '重新分镜'}</span>
                                 </button>
                              </div>
                           </div>
                        </div>
  
                        {/* Shot Rows */}
                        <div className="divide-y divide-slate-600">
                           {sceneShots.map((shot) => (
                             <div key={shot.id} className="group bg-slate-900 hover:bg-slate-700/40 transition-colors p-4 py-4 gap-4 md:p-8 flex flex-col md:flex-row items-start justify-around md:gap-8" >

<div className="w-full flex justify-between items-center gap-4 md:gap-8">
                                {/* Shot ID & Tech Data */}
                                <div className="md:w-32 flex-shrink-0 flex flex-col">
                                     <div className="flex gap-1 group-hover:opacity-100 transition-opacity items-center justify-between pb-1">
                                       <button
                                         onClick={() => startEditShot(shot)}
                                         className="p-1.5 hover:bg-slate-600 text-slate-400 group-hover:text-slate-500 rounded transition-colors cursor-pointer"
                                         title="编辑"
                                       >
                                         <Edit className="w-3.5 h-3.5" />
                                       </button>
                                       <button
                                         onClick={() => deleteShot(shot.id)}
                                         className="p-1.5 hover:bg-red-900/20 text-red-400 group-hover:text-red-600 rounded transition-colors cursor-pointer"
                                         title="删除"
                                       >
                                         <Trash className="w-3.5 h-3.5" />
                                       </button>
                                     </div>

                                   <div className="flex py-1 items-center justify-between flex-col pb-2">
                                     <div className="flex gap-1 items-center justify-between w-full">
                                       <div className="text-xs font-mono text-slate-500 group-hover:text-slate-50 transition-colors">
                                         分镜-{(sceneShots.indexOf(shot) + 1).toString().padStart(3, '0')}
                                       </div>
                                       {shot.interval?.duration && (
                                         <div className="text-xs font-mono text-slate-400">
                                           {shot.interval?.duration}s
                                         </div>
                                       )}
                                     </div>
                                   </div>
                                   <div className="flex flex-col gap-2">
                                     <div className="px-2 py-1 bg-slate-900 border border-slate-600 text-[12px] font-mono text-slate-400 text-center rounded">
                                       {shot.shotSize || 'MED'}
                                     </div>
                                     <div className="px-2 py-1 bg-slate-900 border border-slate-600 text-[12px] font-mono text-slate-400 text-center rounded">
                                       {shot.cameraMovement}
                                     </div>
                                   </div>
                                </div>

                                {/* Main Action */}
                                <div className="flex-1 space-y-0">
                                   <p className="text-slate-200 text-sm leading-7 font-medium max-w-2xl">
                                     {shot.actionSummary}
                                   </p>
                                   {shot.dialogue && shot.dialogue instanceof Array && shot.dialogue.length > 0 && (
                                      <div className="pl-6 border-l-2 border-slate-600 group-hover:border-slate-300 transition-colors py-1">
                                         {shot.dialogue.map((dlg, idx) => (
                                           <p key={idx} className="text-slate-400 font-serif italic text-sm mb-1">
                                             {dlg.character ? <span className="text-slate-300 font-medium">{dlg.character}:</span> : null} "{dlg.value}"
                                           </p>
                                         ))}
                                      </div>
                                   )}
                                   {/* Tags/Characters */}
                                   <div className="flex flex-wrap gap-2 pt-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                      {shot.characters.map(cid => {
                                        const char = localCharacters.find(c => c.id === cid);
                                        return char ? (
                                          <span key={cid} className="text-[12px] font-bold tracking-wider text-slate-500 border border-slate-600 px-2 py-0.5 rounded-full bg-slate-900">
                                              {char.name}
                                           </span>
                                         ) : null;
                                        })}
                                   </div>
                                </div>
                                        </div>

                                {/* Prompt Preview */}
                                <div className="w-full md:block pl-6 border-l border-slate-600 group-hover:border-slate-300">
                                   <div className="text-[12px] font-bold text-slate-400 tracking-widest mb-2 flex items-center gap-2">
                                      <Aperture className="w-3 h-3" /> 画面提示词
                                   </div>
                                   <p className="text-[12px] text-slate-500 font-mono leading-relaxed hover:text-slate-400 transition-all cursor-text bg-slate-900/30 p-2 rounded">
                                     {shot.keyframes[0]?.visualPrompt}
                                   </p>
                                   <p className="text-[12px] text-slate-500 font-mono leading-relaxed hover:text-slate-400 transition-all cursor-text bg-slate-900/30 p-2 rounded">
                                     {shot.keyframes[1]?.visualPrompt}
                                   </p>
                                </div>

                             </div>
                           ))}
                        </div>
                     </div>
                   );
                 })}
              </div>
           </div>
           {/* Sidebar: Index */}
           <div className="md:w-96 h-full overflow-y-auto w-full border-r border-slate-600 bg-slate-700 flex flex-col md:flex shadow-2xl animate-in slide-in-from-right-10 duration-300 transition-all ease-in-out">
              <div className="md:p-6 p-4 border-b border-slate-900">
                 {/* Logline */}
                 <div>
                   <div className="flex items-center justify-between mb-2">
                     <h3 className="text-[12px] font-bold text-slate-400 tracking-widest flex items-center gap-2">
                       <TextQuote className="w-3 h-3" /> 故事梗概
                     </h3>
                     {!editingLogline && (
                       <button onClick={startEditLogline} className="text-slate-500 hover:text-slate-50 cursor-pointer transition-colors">
                         <Edit className="w-3 h-3" />
                       </button>
                     )}
                   </div>
                   {editingLogline ? (
                     <div className="space-y-2">
                       <textarea
                         value={tempLogline}
                         onChange={(e) => setTempLogline(e.target.value)}
                         className="w-full h-32 bg-slate-800 border border-slate-600 text-slate-300 text-sm rounded p-2 focus:border-slate-500 focus:outline-none resize-none"
                         rows={3}
                       />
                       <div className="flex gap-2">
                         <button onClick={saveLogline} className="flex-1 py-1 bg-slate-500/60 text-slate-300 text-[11px] rounded hover:bg-slate-500/20 cursor-pointer">保存</button>
                         <button onClick={() => setEditingLogline(false)} className="flex-1 py-1 bg-slate-600 text-slate-300 text-[11px] rounded hover:bg-slate-600/50 transition-colors cursor-pointer">取消</button>
                       </div>
                     </div>
                   ) : (
                     <p className="text-sm text-slate-300 leading-relaxed font-serif cursor-text hover:text-slate-300" onClick={startEditLogline}>{project.scriptData?.logline}</p>
                   )}
                 </div>
              </div>

              <div className="flex-1 md:p-6 p-4 space-y-2">
                  {/* Characters */}
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-[12px] font-bold text-slate-400 tracking-widest flex items-center gap-2">
                         <Users className="w-3 h-3" /> 演员表
                      </h3>
                      <button onClick={() => setShowAddCharacter(true)} className="text-slate-500 hover:text-slate-50 cursor-pointer transition-colors">
                         <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      {showAddCharacter && (
                         <div className="space-y-2 p-2 bg-slate-800 rounded border border-slate-600">
                           <input
                             type="text"
                             value={tempCharacter.name || ''}
                             onChange={(e) => setTempCharacter({ ...tempCharacter, name: e.target.value })}
                             className="w-full bg-slate-900 border border-slate-600 text-slate-50 text-xs rounded px-2 py-1 focus:border-slate-500 focus:outline-none"
                             placeholder="角色名"
                           />
                           <CustomSelect
                             options={[
                               { value: '男', label: '男' },
                               { value: '女', label: '女' },
                               { value: '其他', label: '其他' }
                             ]}
                             value={tempCharacter.gender || '男'}
                             onChange={(value) => setTempCharacter({ ...tempCharacter, gender: value })}
                             className="w-full"
                             size="sm"
                           />
                           <input
                             type="text"
                             value={tempCharacter.age || ''}
                             onChange={(e) => setTempCharacter({ ...tempCharacter, age: e.target.value })}
                             className="w-full bg-slate-900 border border-slate-600 text-slate-300 text-xs rounded px-2 py-1 focus:border-slate-500 focus:outline-none"
                             placeholder="年龄"
                           />
                           <input
                             type="text"
                             value={tempCharacter.personality || ''}
                             onChange={(e) => setTempCharacter({ ...tempCharacter, personality: e.target.value })}
                             className="w-full bg-slate-900 border border-slate-600 text-slate-300 text-xs rounded px-2 py-1 focus:border-slate-500 focus:outline-none"
                             placeholder="性格特点"
                           />
                           <div className="flex gap-1">
                             <button onClick={addCharacter} className="flex-1 py-1 bg-slate-500/60 text-slate-300 text-[11px] rounded hover:bg-slate-500/20 cursor-pointer">添加</button>
                             <button onClick={() => { setShowAddCharacter(false); setTempCharacter({}); }} className="flex-1 py-1 bg-slate-600 text-slate-300 text-[11px] rounded hover:bg-slate-600/50 transition-colors cursor-pointer">取消</button>
                           </div>
                         </div>
                       )}
                       {localCharacters.map(c => (
                         <div key={c.id} className="flex justify-between gap-2 items-center group cursor-default p-2 rounded hover:bg-slate-900/100 transition-colors">
                            {editingCharacterId === c.id ? (
                              <div className="flex-1 space-y-2">
                                <input
                                  type="text"
                                  value={tempCharacter.name || ''}
                                  onChange={(e) => setTempCharacter({ ...tempCharacter, name: e.target.value })}
                                  className="w-full bg-slate-800 border border-slate-600 text-slate-50 text-xs rounded px-2 py-1 focus:border-slate-500 focus:outline-none"
                                  placeholder="角色名"
                                />
                                <CustomSelect
                                  options={[
                                    { value: '男', label: '男' },
                                    { value: '女', label: '女' },
                                    { value: '其他', label: '其他' }
                                  ]}
                                  value={tempCharacter.gender || '男'}
                                  onChange={(value) => setTempCharacter({ ...tempCharacter, gender: value })}
                                  className="w-full"
                                  size="sm"
                                />
                                <input
                                  type="text"
                                  value={tempCharacter.age || ''}
                                  onChange={(e) => setTempCharacter({ ...tempCharacter, age: e.target.value })}
                                  className="w-full bg-slate-800 border border-slate-600 text-slate-300 text-xs rounded px-2 py-1 focus:border-slate-500 focus:outline-none"
                                  placeholder="年龄"
                                />
                                <input
                                  type="text"
                                  value={tempCharacter.personality || ''}
                                  onChange={(e) => setTempCharacter({ ...tempCharacter, personality: e.target.value })}
                                  className="w-full bg-slate-800 border border-slate-600 text-slate-300 text-xs rounded px-2 py-1 focus:border-slate-500 focus:outline-none"
                                  placeholder="性格特点"
                                />
                                <div className="flex gap-1">
                                  <button onClick={saveCharacter} className="flex-1 py-1 bg-slate-500/60 text-slate-300 text-[11px] rounded hover:bg-slate-500/20 cursor-pointer">保存</button>
                                  <button onClick={() => { setEditingCharacterId(null); setTempCharacter({}); }} className="flex-1 py-1 bg-slate-600 text-slate-300 text-[11px] rounded hover:bg-slate-600/50 transition-colors cursor-pointer">取消</button>
                                </div>
                              </div>
                            ) : (
                              <>
                              <div className="flex-1 flex flex-col gap-0.5">
                                <div className="flex items-center justify-between text-sm text-slate-300 font-medium group-hover:text-slate-50">{c.name} 
                                  <span className="text-[11px] text-slate-500 font-mono">{c.gender} {c!.age}</span>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-slate-500">
                                  <span className="">{c!.personality}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => startEditCharacter(c)} className="text-slate-500 hover:text-slate-50 cursor-pointer"><Edit className="w-3 h-3" /></button>
                                  <button onClick={() => deleteCharacter(c.id)} className="text-slate-500 hover:text-red-400 cursor-pointer"><Trash className="w-3 h-3" /></button>
                               </div>
                              </>
                            )}
                         </div>
                       ))}
                    </div>
                  </section>

                  {/* Scenes */}
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-[12px] font-bold text-slate-400 tracking-widest flex items-center gap-2">
                         <MapPin className="w-3 h-3" /> 场景列表
                      </h3>
                      <button onClick={() => setShowAddScene(true)} className="text-slate-500 hover:text-slate-50 cursor-pointer transition-colors">
                         <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="space-y-1">
                      {showAddScene && (
                         <div className="space-y-2 p-2 bg-slate-800 rounded border border-slate-600">
                           <input
                             type="text"
                             value={tempScene.location || ''}
                             onChange={(e) => setTempScene({ ...tempScene, location: e.target.value })}
                             className="w-full bg-slate-900 border border-slate-600 text-slate-50 text-xs rounded px-2 py-1 focus:border-slate-500 focus:outline-none"
                             placeholder="场景名称"
                           />
                           <input
                             type="text"
                             value={tempScene.time || ''}
                             onChange={(e) => setTempScene({ ...tempScene, time: e.target.value })}
                             className="w-full bg-slate-900 border border-slate-600 text-slate-300 text-xs rounded px-2 py-1 focus:border-slate-500 focus:outline-none"
                             placeholder="时间 (如: 日间/夜间)"
                           />
                           <input
                             type="text"
                             value={tempScene.atmosphere || ''}
                             onChange={(e) => setTempScene({ ...tempScene, atmosphere: e.target.value })}
                             className="w-full bg-slate-900 border border-slate-600 text-slate-300 text-xs rounded px-2 py-1 focus:border-slate-500 focus:outline-none"
                             placeholder="氛围"
                           />
                           <div className="flex gap-1">
                             <button onClick={addScene} className="flex-1 py-1 bg-slate-500/60 text-slate-300 text-[11px] rounded hover:bg-slate-500/20 cursor-pointer">添加</button>
                             <button onClick={() => { setShowAddScene(false); setTempScene({}); }} className="flex-1 py-1 bg-slate-600 text-slate-300 text-[11px] rounded hover:bg-slate-600/50 transition-colors cursor-pointer">取消</button>
                           </div>
                         </div>
                       )}
                       {uniqueScenesList.map((s) => (
                         <div key={s!.id} className="flex justify-between items-center group cursor-default p-2 rounded hover:bg-slate-900/100 transition-colors">
                           {editingSceneId === s!.id ? (
                             <div className="flex-1 space-y-2">
                               <input
                                 type="text"
                                 value={tempScene.location || ''}
                                 onChange={(e) => setTempScene({ ...tempScene, location: e.target.value })}
                                 className="w-full bg-slate-800 border border-slate-600 text-slate-50 text-xs rounded px-2 py-1 focus:border-slate-500 focus:outline-none"
                                 placeholder="场景名称"
                               />
                               <input
                                 type="text"
                                 value={tempScene.time || ''}
                                 onChange={(e) => setTempScene({ ...tempScene, time: e.target.value })}
                                 className="w-full bg-slate-800 border border-slate-600 text-slate-300 text-xs rounded px-2 py-1 focus:border-slate-500 focus:outline-none"
                                 placeholder="时间"
                               />
                               <input
                                 type="text"
                                 value={tempScene.atmosphere || ''}
                                 onChange={(e) => setTempScene({ ...tempScene, atmosphere: e.target.value })}
                                 className="w-full bg-slate-800 border border-slate-600 text-slate-300 text-xs rounded px-2 py-1 focus:border-slate-500 focus:outline-none"
                                 placeholder="氛围"
                               />
                               <div className="flex gap-1">
                                 <button onClick={saveScene} className="flex-1 py-1 bg-slate-500/60 text-slate-300 text-[11px] rounded hover:bg-slate-500/20 cursor-pointer">保存</button>
                                 <button onClick={() => { setEditingSceneId(null); setTempScene({}); }} className="flex-1 py-1 bg-slate-600 text-slate-300 text-[11px] rounded hover:bg-slate-600/50 transition-colors cursor-pointer">取消</button>
                               </div>
                             </div>
                           ) : (
                             <>
                               <div className="flex flex-col gap-0.5">
                                 <span className="text-sm text-slate-300 font-medium group-hover:text-slate-50">{s!.location}</span>
                                 <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-slate-500">
                                   <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5"/> {s!.time}</span>
                                   <span className="text-slate-600">|</span>
                                   <span className="">{s!.atmosphere}</span>
                                 </div>
                               </div>
                               <div className="flex items-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                                 <button onClick={() => startEditScene(s!)} className="text-slate-500 hover:text-slate-50 cursor-pointer"><Edit className="w-3 h-3" /></button>
                                 <button onClick={() => deleteScene(s!.id)} className="text-slate-500 hover:text-red-400 cursor-pointer"><Trash className="w-3 h-3" /></button>
                               </div>
                             </>
                           )}
                         </div>
                       ))}
                    </div>
                  </section>
              </div>
           </div>
        </div>
      </div>
    );
  };

  const handleSaveStoryParagraphs = (paragraphs: { id: number; text: string; sceneRefId: string }[]) => {
    if (!project.scriptData || !editingStoryParagraphsSceneId) return;

    const newData = { ...project.scriptData };
    const sceneId = editingStoryParagraphsSceneId;

    // Remove existing paragraphs for this scene
    newData.storyParagraphs = newData.storyParagraphs.filter(
      p => String(p.sceneRefId) !== String(sceneId)
    );

    // Add new paragraphs
    newData.storyParagraphs = [...newData.storyParagraphs, ...paragraphs];

    updateProject({ scriptData: newData });
    setStoryParagraphsModalOpen(false);
    setEditingStoryParagraphsSceneId(null);
  };

  const renderStoryParagraphsModal = () => {
    if (!storyParagraphsModalOpen || !editingStoryParagraphsSceneId) return null;

    return (
      <StoryParagraphsModal
        isOpen={storyParagraphsModalOpen}
        onClose={() => {
          setStoryParagraphsModalOpen(false);
          setEditingStoryParagraphsSceneId(null);
        }}
        onSave={handleSaveStoryParagraphs}
        paragraphs={project.scriptData?.storyParagraphs || []}
        sceneId={editingStoryParagraphsSceneId}
      />
    );
  };

  const renderEditShotModal = () => {
    // Always use local characters from project.scriptData
    const localCharacters = project.scriptData?.characters || [];

    // 编辑现有 shot
    if (editingShotId) {
      const shot = project.shots.find(s => s.id === editingShotId);
      if (!shot) return null;

      return (
        <ShotEditModal
          shot={shot}
          characters={localCharacters}
          onSave={saveShot}
          onClose={() => {
            setEditingShotId(null);
          }}
          imageCount={project.imageCount}
        />
      );
    }

    // 添加新 shot
    if (addingShotForSceneId) {
      const newShot: any = {
        id: '',
        sceneId: addingShotForSceneId,
        actionSummary: '',
        dialogue: [],
        cameraMovement: '固定',
        shotSize: 'MED',
        duration: 5,
        characters: [],
        keyframes: []
      };

      return (
        <ShotEditModal
          shot={newShot}
          characters={localCharacters}
          onSave={saveShot}
          onClose={() => {
            setAddingShotForSceneId(null);
          }}
          imageCount={project.imageCount}
        />
      );
    }

    return null;
  };

  return (
    <div className="h-full bg-slate-900">
      {activeTab === 'story' ? renderStoryInput() : renderScriptBreakdown()}
      {renderEditShotModal()}
      {renderStoryParagraphsModal()}
    </div>
  );
};

export default StageScript;