// services/modelService.ts
// 模型调用包装类，根据启用的配置动态选择模型提供商

import { AIModelConfig, ScriptData, Shot } from "../types";
import { cleanJsonString } from "../utils/apiHelper";
import { uploadFileToService } from "../utils/fileUploadUtils";
import { imageUrlToBase64 } from "../utils/imageUtils";
import { getEnabledConfigByType } from "./modelConfigService";
import { renderTemplate } from "./promptTemplates";
import { getAllModelConfigs } from "./storageService";

const loadDeepseekModule = () => import("./modelproviders/deepseekService");
const loadGeminiModule = () => import("./modelproviders/geminiService");
const loadYunwuModule = () => import("./modelproviders/yunwuService");
const loadOpenaiModule = () => import("./modelproviders/openaiService");
const loadDoubaoModule = () => import("./modelproviders/doubaoService");
const loadMinimaxModule = () => import("./modelproviders/minimaxService");
const loadKlingModule = () => import("./modelproviders/klingService");
const loadSoraModule = () => import("./modelproviders/soraService");
const loadWanModule = () => import("./modelproviders/wanService");
const loadBigmoreModule = () => import("./modelproviders/bigmoreService");
const loadSkyreelsModule = () => import("./modelproviders/skyreelsService");
const loadBaiduTtsModule = () => import("./modelproviders/baiduTtsService");

const IMAGE_X = [
  '1','1x1','1x2','1x3','2x2','2x3','2x3','3x3','3x3','3x3'
];

/**
 * 模型包装服务
 * 根据启用的配置自动选择模型提供商
 */
export class ModelService {
  private static initialized = false;
  private static currentProjectModelProviders: any = null;
  private static providerModules = new Map<string, Promise<any>>();

  private static async getProviderModule(provider: string): Promise<any> {
    if (!this.providerModules.has(provider)) {
      let loader: (() => Promise<any>) | null = null;
      switch (provider) {
        case 'deepseek':
          loader = loadDeepseekModule;
          break;
        case 'doubao':
          loader = loadDoubaoModule;
          break;
        case 'openai':
          loader = loadOpenaiModule;
          break;
        case 'gemini':
          loader = loadGeminiModule;
          break;
        case 'yunwu':
          loader = loadYunwuModule;
          break;
        case 'minimax':
          loader = loadMinimaxModule;
          break;
        case 'kling':
          loader = loadKlingModule;
          break;
        case 'sora':
          loader = loadSoraModule;
          break;
        case 'wan':
          loader = loadWanModule;
          break;
        case 'bigmore':
          loader = loadBigmoreModule;
          break;
        case 'skyreels':
          loader = loadSkyreelsModule;
          break;
        case 'baidu':
          loader = loadBaiduTtsModule;
          break;
        default:
          throw new Error(`未知的模型提供商: ${provider}`);
      }
      this.providerModules.set(provider, loader());
    }
    return this.providerModules.get(provider)!;
  }

  /**
   * 设置当前项目的模型供应商
   * @param modelProviders - 项目级别的模型供应商配置
   */
  static setCurrentProjectProviders(modelProviders: any) {
    this.currentProjectModelProviders = modelProviders;
    //console.log('已设置项目模型供应商:', modelProviders);
  }

  /**
   * 初始化模型配置
   * 在应用启动时调用，加载启用的模型配置
   */
  static async initialize() {
    if (this.initialized) return;

    try {
      // 获取所有启用的配置并更新对应的服务
      const allConfigs = await getAllModelConfigs();
      const enabledConfigs = allConfigs.filter(c => c.enabled);

      for (const config of enabledConfigs) {
        await this.updateServiceConfig(config);
      }

      this.initialized = true;
      //console.log('模型服务初始化完成，已加载配置:', enabledConfigs.map(c => c.provider + ':' + c.modelType));
    } catch (error) {
      console.error('模型服务初始化失败:', error);
    }
  }

  /**
   * 根据配置更新对应服务的参数
   * @param config - 模型配置
   */
  private static async updateServiceConfig(config: any): Promise<void> {
    try {
      switch (config.provider) {
        case 'deepseek':
          (await this.getProviderModule('deepseek')).setApiKey(config.apiKey);
          if (config.apiUrl) {
            (await this.getProviderModule('deepseek')).setApiUrl(config.apiUrl);
          }
          if (config.model) {
            (await this.getProviderModule('deepseek')).setModel(config.model);
          }
          //console.log(`已更新 DeepSeek ${config.modelType} 配置`);
          break;

        case 'doubao':
          (await this.getProviderModule('doubao')).setApiKey(config.apiKey);
          if (config.apiUrl) {
            (await this.getProviderModule('doubao')).setApiUrl(config.apiUrl);
          }
          if (config.model) {
            switch (config.modelType) {
              case 'llm':
                (await this.getProviderModule('doubao')).setModel('text', config.model);
                break;
              case 'text2image':
                (await this.getProviderModule('doubao')).setModel('image', config.model);
                break;
              case 'image2video':
                (await this.getProviderModule('doubao')).setModel('video', config.model);
                break;
            }
          }
          //console.log(`已更新 Doubao ${config.modelType} 配置`);
          break;

        case 'openai':
          (await this.getProviderModule('openai')).setApiKey(config.apiKey);
          if (config.apiUrl) {
            (await this.getProviderModule('openai')).setApiUrl(config.apiUrl);
          }
          if (config.model) {
            switch (config.modelType) {
              case 'llm':
                (await this.getProviderModule('openai')).setModel('text', config.model);
                break;
              case 'text2image':
                (await this.getProviderModule('openai')).setModel('image', config.model);
                break;
              case 'image2video':
                (await this.getProviderModule('openai')).setModel('video', config.model);
                break;
            }
          }
          //console.log(`已更新 OpenAI ${config.modelType} 配置`);
          break;

        case 'gemini':
          (await this.getProviderModule('gemini')).setApiKey(config.apiKey);
          //console.log(`已更新 Gemini ${config.modelType} 配置`);
          break;

        case 'yunwu':
          (await this.getProviderModule('yunwu')).setApiKey(config.apiKey);
          if (config.apiUrl) {
            (await this.getProviderModule('yunwu')).setApiUrl(config.apiUrl);
          }
          if (config.model) {
            switch (config.modelType) {
              case 'llm':
                (await this.getProviderModule('yunwu')).setModel('text', config.model);
                break;
              case 'text2image':
                (await this.getProviderModule('yunwu')).setModel('image', config.model);
                break;
              case 'image2video':
                (await this.getProviderModule('yunwu')).setModel('video', config.model);
                break;
            }
          }
          //console.log(`已更新 Yunwu ${config.modelType} 配置`);
          break;

        case 'minimax':
          (await this.getProviderModule('minimax')).setApiKey(config.apiKey);
          if (config.apiUrl) {
            (await this.getProviderModule('minimax')).setApiUrl(config.apiUrl);
          }
          if (config.model) {
            (await this.getProviderModule('minimax')).setModel(config.model);
          }
          //console.log(`已更新 MiniMax ${config.modelType} 配置`);
          break;

        case 'kling':
          (await this.getProviderModule('kling')).setApiKey(config.apiKey);
          if (config.apiUrl) {
            (await this.getProviderModule('kling')).setApiUrl(config.apiUrl);
          }
          if (config.model) {
            (await this.getProviderModule('kling')).setModel(config.model);
          }
          //console.log(`已更新 Kling ${config.modelType} 配置`);
          break;

      case 'sora':
        (await this.getProviderModule('sora')).setApiKey(config.apiKey);
        if (config.apiUrl) {
          (await this.getProviderModule('sora')).setApiUrl(config.apiUrl);
        }
        if (config.model) {
          (await this.getProviderModule('sora')).setModel(config.model);
        }
        //console.log(`已更新 Sora ${config.modelType} 配置`);
        break;

      case 'wan':
        (await this.getProviderModule('wan')).setApiKey(config.apiKey);
        if (config.apiUrl) {
          (await this.getProviderModule('wan')).setApiUrl(config.apiUrl);
        }
        if (config.model) {
          (await this.getProviderModule('wan')).setModel(config.model);
        }
        //console.log(`已更新 Wan ${config.modelType} 配置`);
        break;

      case 'bigmore':
        (await this.getProviderModule('bigmore')).setApiKey(config.apiKey);
        if (config.apiUrl) {
          (await this.getProviderModule('bigmore')).setApiUrl(config.apiUrl);
        }
        if (config.model) {
          (await this.getProviderModule('bigmore')).setModel(config.model);
        }
        //console.log(`已更新 BigMore ${config.modelType} 配置`);
        break;

      case 'skyreels':
        (await this.getProviderModule('skyreels')).setApiKey(config.apiKey);
        if (config.apiUrl) {
          (await this.getProviderModule('skyreels')).setApiUrl(config.apiUrl);
        }
        if (config.model) {
          (await this.getProviderModule('skyreels')).setModel(config.model);
        }
        //console.log(`已更新 SkyReels ${config.modelType} 配置`);
        break;

      case 'baidu':
          if (config.modelType === 'tts') {
            // 对于百度 TTS，apiKey 是 API Key，apiUrl 是 Secret Key
            (await this.getProviderModule('baidu')).setApiKey(config.apiKey);
          }
          if (config.apiUrl) {
            (await this.getProviderModule('baidu')).setApiUrl(config.apiUrl);
          }
          //console.log(`已更新 Baidu ${config.modelType} 配置`);
          break;
      }
    } catch (error) {
      console.error(`更新 ${config.provider} 配置失败:`, error);
    }
  }

  /**
   * 获取当前启用的 LLM 提供商
   * @param projectModelProviders - 项目级别的模型供应商配置
   */
  private static async getEnabledLLMProvider(projectModelProviders?: { llm?: string }): Promise<AIModelConfig> {
    let config;

    // 优先使用项目级别的供应商配置
    if (projectModelProviders?.llm) {
      const allConfigs = await getAllModelConfigs();
      config = allConfigs.find(c => c.id === projectModelProviders.llm);
      //console.log(`使用项目配置的 LLM 供应商: ${config?.provider}`);
    }

    // 如果项目没有配置，使用系统默认的启用配置
    if (!config) {
      config = await getEnabledConfigByType('llm');
    }

    if (!config) {
      console.warn('未找到 LLM 配置，使用默认的 doubao');
      return {
        id: 'doubao-llm',
        provider: 'doubao',
        modelType: 'llm',
        model: '',
        apiKey: '',
        apiUrl: '',
        enabled: false,
        description: 'Doubao LLM'
      }
    }

    // 立即更新对应服务的配置参数
    await this.updateServiceConfig(config);

    return config;
  }

  /**
   * 获取当前启用的文生图提供商
   * @param projectModelProviders - 项目级别的模型供应商配置
   */
  private static async getEnabledImageProvider(projectModelProviders?: { text2image?: string }): Promise<AIModelConfig> {
    let config;

    // 优先使用项目级别的供应商配置
    if (projectModelProviders?.text2image) {
      const allConfigs = await getAllModelConfigs();
      config = allConfigs.find(c => c.id === projectModelProviders.text2image);
      //console.log(`使用项目配置的文生图供应商: ${config?.provider}`);
    }

    // 如果项目没有配置，使用系统默认的启用配置
    if (!config) {
      config = await getEnabledConfigByType('text2image');
    }

    if (!config) {
      console.warn('未找到文生图配置，使用默认的 doubao');
      return {
        id: 'doubao-text2image',
        provider: 'doubao',
        modelType: 'text2image',
        model: '',
        apiKey: '',
        apiUrl: '',
        enabled: false,
        description: 'Doubao text2image'
      };
    }

    // 立即更新对应服务的配置参数
    await this.updateServiceConfig(config);

    return config;
  }

  /**
   * 获取当前启用的语音合成提供商
   * @param projectModelProviders - 项目级别的模型供应商配置
   */
  private static async getEnabledAudioProvider(projectModelProviders?: { tts?: string }): Promise<'baidu'> {
    let config;

    // 优先使用项目级别的供应商配置
    if (projectModelProviders?.tts) {
      const allConfigs = await getAllModelConfigs();
      config = allConfigs.find(c => c.id === projectModelProviders.tts);
      //console.log(`使用项目配置的语音合成供应商: ${config?.provider}`);
    }

    // 如果项目没有配置，使用系统默认的启用配置
    if (!config) {
      config = await getEnabledConfigByType('tts');
    }

    if (!config) {
      console.warn('未找到语音合成配置，使用默认的 baidu');
      return 'baidu';
    }

    // 立即更新对应服务的配置参数
    await this.updateServiceConfig(config);

    return config.provider as 'baidu';
  }

  /**
   * 获取当前启用的图生视频提供商
   * @param projectModelProviders - 项目级别的模型供应商配置
   */
  private static async getEnabledVideoProvider(projectModelProviders?: { image2video?: string }): Promise<AIModelConfig> {
    let config;

    // 优先使用项目级别的供应商配置
    if (projectModelProviders?.image2video) {
      const allConfigs = await getAllModelConfigs();
      config = allConfigs.find(c => c.id === projectModelProviders.image2video);
      //console.log(`使用项目配置的图生视频供应商: ${config?.provider}`);
    }

    // 如果项目没有配置，使用系统默认的启用配置
    if (!config) {
      config = await getEnabledConfigByType('image2video');
    }

    if (!config) {
      console.warn('未找到图生视频配置，使用默认的 doubao');
      const storedApiKey = localStorage.getItem('cinegen_api_key') || '';
      (await this.getProviderModule('doubao')).setApiKey(storedApiKey);
      return {
        id: 'doubao-image2video',
        provider: 'doubao',
        modelType: 'image2video',
        model: '',
        apiKey: '',
        apiUrl: '',
        enabled: false,
        description: 'Doubao image2video'
      };
    }

    // 立即更新对应服务的配置参数
    await this.updateServiceConfig(config);

    return config;
  }

  /**
   * 分析剧本并结构化数据
   * @param rawText - 剧本文本
   * @param language - 输出语言
   */
  static async parseScriptToData(rawText: string, language: string = "中文"): Promise<ScriptData> {
    const provider = await this.getEnabledLLMProvider(this.currentProjectModelProviders);
    const prompt = renderTemplate('PARSE_SCRIPT', rawText, language);
    switch (provider.provider) {
      case 'deepseek':
        return await (await this.getProviderModule('deepseek')).parseScriptToData(prompt, language);
      case 'doubao':
        return await (await this.getProviderModule('doubao')).parseScriptToData(prompt, language);
      case 'gemini':
        return await (await this.getProviderModule('gemini')).parseScriptToData(prompt, language);
      case 'yunwu':
        return await (await this.getProviderModule('yunwu')).parseScriptToData(prompt, language);
      case 'openai':
        return await (await this.getProviderModule('openai')).parseScriptToData(prompt, language);
      default:
        throw new Error(`暂不支持 ${provider} 提供商的剧本分析`);
    }
  }

  /**
   * 为剧本生成镜头清单
   * @param scriptData - 剧本数据
   */
  static async generateShotList(scriptData: ScriptData): Promise<Shot[]> {
    const provider = await this.getEnabledLLMProvider(this.currentProjectModelProviders);

    if (!scriptData.scenes || scriptData.scenes.length === 0) {
      return [];
    }

    // Process scenes sequentially
    const BATCH_SIZE = 1;
    const allShots: Shot[] = [];

    for (let i = 0; i < scriptData.scenes.length; i += BATCH_SIZE) {
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, 1500));

      const batch = scriptData.scenes.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((scene, idx) => (async () => {
          const lang = scriptData.language || "中文";
          const paragraphs = scriptData.storyParagraphs
            .filter((p) => String(p.sceneRefId) === String(scene.id))
            .map((p) => p.text)
            .join("\n");
          if (!paragraphs.trim()) return [];

          let characters = "";
          characters = scriptData.characters ? scriptData.characters.map(d =>`${d.name}: ${d.visualPrompt}`).join('\n') : "";
          const prompt = renderTemplate('GENERATE_SHOTS',
            i + idx + 1,
            scene.location,
            scene.time,
            scene.atmosphere,
            paragraphs,
            scriptData.genre,
            scriptData.targetDuration || "30s",
            characters,
            lang
          );
          switch (provider.provider) {
            case 'deepseek':
              (await this.getProviderModule('deepseek')).generateShotListForScene(scene, prompt);
              break;
            case 'doubao':
              (await this.getProviderModule('doubao')).generateShotListForScene(scene, prompt);
              break;
            case 'gemini':
              (await this.getProviderModule('gemini')).generateShotListForScene(scene, prompt);
              break;
            case 'yunwu':
              (await this.getProviderModule('yunwu')).generateShotListForScene(scene, prompt);
              break;
            case 'openai':
              (await this.getProviderModule('openai')).generateShotListForScene(scene, prompt);
              break;
            default:
              throw new Error(`暂不支持 ${provider} 提供商的镜头生成`);
          }
          })()
        )
      );
      batchResults.forEach((shots) => allShots.push(...shots));
    }

    // Re-index shots to be sequential globally
    return allShots.map((s, idx) => ({
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
  }

  /**
   * 为单个场景生成镜头清单
   * @param scriptData - 剧本数据
   * @param scene - 场景数据
   * @param sceneIndex - 场景索引
   */
  static async generateShotListForScene(
    scriptData: ScriptData,
    scene: any,
    sceneIndex: number
  ): Promise<Shot[]> {
    const provider = await this.getEnabledLLMProvider(this.currentProjectModelProviders);
    //console.log(`使用 ${provider} 生成场景 ${sceneIndex + 1} 的镜头清单`);

    if(scene.referenceImage){
      scene.referenceImage=null;
    }
    const lang = scriptData.language || "中文";

    const paragraphs = scriptData.storyParagraphs
      .filter((p) => String(p.sceneRefId) === String(scene.id))
      .map((p) => p.text)
      .join("\n");

    if (!paragraphs.trim()) return [];
    let characters = "";
    characters = scriptData.characters ? scriptData.characters.map(d =>`${d.name}: ${d.visualPrompt}`).join('\n') : "";
    const prompt = renderTemplate('GENERATE_SHOTS',
      sceneIndex+1,
      scene.location,
      scene.time,
      scene.atmosphere,
      paragraphs,
      scriptData.genre,
      scriptData.targetDuration || "30s",
      characters,
      lang
    );
    switch (provider.provider) {
      case 'deepseek':
        return await (await this.getProviderModule('deepseek')).generateShotListForScene(scene, prompt);
      case 'doubao':
        return await (await this.getProviderModule('doubao')).generateShotListForScene(scene, prompt);
      case 'gemini':
        return await (await this.getProviderModule('gemini')).generateShotListForScene(scene, prompt);
      case 'yunwu':
        return await (await this.getProviderModule('yunwu')).generateShotListForScene(scene, prompt);
      case 'openai':
        return await (await this.getProviderModule('openai')).generateShotListForScene(scene, prompt);
      default:
        throw new Error(`暂不支持 ${provider} 提供商的镜头生成`);
    }
  }

  /**
   * 根据简单提示词生成完整剧本
   * @param prompt - 用户提示词
   * @param genre - 题材类型
   * @param targetDuration - 目标时长
   * @param language - 输出语言
   */
  static async generateScript(
    prompt: string,
    genre: string = "剧情片",
    targetDuration: string = "60s",
    language: string = "中文"
  ): Promise<string> {
    const provider = await this.getEnabledLLMProvider(this.currentProjectModelProviders);
    //console.log(`使用 ${provider} 生成剧本`);
    const generationPrompt = renderTemplate('GENERATE_SCRIPT', prompt, targetDuration, genre, language);

    let script = '';
    switch (provider.provider) {
      case 'deepseek':
        script = await (await this.getProviderModule('deepseek')).generateScript(generationPrompt, genre, targetDuration, language);
        break;
      case 'doubao':
        script = await (await this.getProviderModule('doubao')).generateScript(generationPrompt, genre, targetDuration, language);
        break;
      case 'gemini':
        script = await (await this.getProviderModule('gemini')).generateScript(generationPrompt, genre, targetDuration, language);
        break;
      case 'yunwu':
        script = await (await this.getProviderModule('yunwu')).generateScript(generationPrompt, genre, targetDuration, language);
        break;
      case 'openai':
        script = await (await this.getProviderModule('openai')).generateScript(generationPrompt, genre, targetDuration, language);
        break;
      default:
        throw new Error(`暂不支持 ${provider} 提供商的剧本生成`);
    }
    return cleanJsonString(script);
  }

  /**
   * 生成视觉提示词
   * @param type - 角色 or 场景
   * @param data - 角色或场景数据
   * @param genre - 题材类型
   */
  static async generateVisualPrompts(
    type: "character" | "scene",
    data: any,
    genre: string,
    visualStyle: string
  ): Promise<string> {
    const provider = await this.getEnabledLLMProvider(this.currentProjectModelProviders);
    //console.log(`使用 ${provider} 生成视觉提示词`);

    if(data.referenceImage){
      data.referenceImage=null;
    }
    if(data.variations){
      data.variations=[];
    }
    if(data.ttsParams){
      data.ttsParams=null;
    }
    if(data.voiceUrl){
      data.voiceUrl=null;
    }
    const desc = JSON.stringify(data);
    const prompt = renderTemplate('GENERATE_VISUAL_PROMPT', type=='character'?'角色':'场景', desc, genre, visualStyle);
    let visualPrompt = '';
    switch (provider.provider) {
      case 'deepseek':
        visualPrompt = await (await this.getProviderModule('deepseek')).generateVisualPrompts(prompt);
        break;
      case 'doubao':
        visualPrompt = await (await this.getProviderModule('doubao')).generateVisualPrompts(prompt);
        break;
      case 'gemini':
        visualPrompt = await (await this.getProviderModule('gemini')).generateVisualPrompts(prompt);
        break;
      case 'yunwu':
        visualPrompt = await (await this.getProviderModule('yunwu')).generateVisualPrompts(prompt);
        break;
      case 'openai':
        visualPrompt = await (await this.getProviderModule('openai')).generateVisualPrompts(prompt);
        break;
      default:
        throw new Error(`暂不支持 ${provider} 提供商的视觉提示词生成`);
    }
    return cleanJsonString(visualPrompt);
  }

  /**
   * 生成视频拍摄提示词
   * @param shot - 镜头信息
   * @param scriptData - 剧本数据
   * @param visualStyle - 视觉风格
   */
  static async generateVideoPrompt(
    shot: Shot,
    scriptData: ScriptData,
    visualStyle: string = "真人写实"
  ): Promise<string> {
    const provider = await this.getEnabledLLMProvider(this.currentProjectModelProviders);
    //console.log(`使用 ${provider} 生成视频拍摄提示词`);

    // 获取起始帧和结束帧的视觉描述
    const startKeyframe = shot.keyframes?.find((kf: any) => kf.type === 'start');
    const endKeyframe = shot.keyframes?.find((kf: any) => kf.type === 'end');

    // 获取角色名称列表
    const characterNames = shot.characters?.map((charId: string) => {
      const char = scriptData.characters?.find((c: any) => c.id === charId);
      return char?.name || charId;
    }).join(',') || '';

    // 获取对白
    const dialogues: string[] = [];
    if(shot.dialogue){
      if(shot.dialogue instanceof Array){
        shot.dialogue.forEach((d) => {
          dialogues.push(d.character + "：" + d.value);
        });
      }else{
        dialogues.push(shot.dialogue);
      }
    }

    const prompt = renderTemplate('GENERATE_VIDEO_PROMPT',
      shot.actionSummary,
      shot.cameraMovement,
      shot.shotSize || '',
      shot.interval?.duration || 5,
      visualStyle,
      characterNames,
      startKeyframe?.visualPrompt || '',
      endKeyframe?.visualPrompt || '',
      dialogues.join('\n')
    );

    let videoPrompt = '';
    switch (provider.provider) {
      case 'deepseek':
        videoPrompt = await (await this.getProviderModule('deepseek')).generateVisualPrompts(prompt);
        break;
      case 'doubao':
        videoPrompt = await (await this.getProviderModule('doubao')).generateVisualPrompts(prompt);
        break;
      case 'gemini':
        videoPrompt = await (await this.getProviderModule('gemini')).generateVisualPrompts(prompt);
        break;
      case 'yunwu':
        videoPrompt = await (await this.getProviderModule('yunwu')).generateVisualPrompts(prompt);
        break;
      case 'openai':
        videoPrompt = await (await this.getProviderModule('openai')).generateVisualPrompts(prompt);
        break;
      default:
        throw new Error(`暂不支持 ${provider} 提供商的视频提示词生成`);
    }
    return cleanJsonString(videoPrompt);
  }

  /**
   * 设置模型配置（用于动态配置更新）
   * @param provider - 提供商
   * @param apiKey - API 密钥
   */
  static setApiKey(provider: 'doubao' | 'deepseek' | 'openai' | 'gemini' | 'yunwu' | 'minimax' | 'kling' | 'sora' | 'wan' | 'bigmore' | 'baidu' | 'skyreels', apiKey: string): void {
    switch (provider) {
      case 'deepseek':
        void this.getProviderModule('deepseek').then(mod => mod.setApiKey(apiKey));
        break;
      case 'doubao':
        void this.getProviderModule('doubao').then(mod => mod.setApiKey(apiKey));
        break;
      case 'openai':
        void this.getProviderModule('openai').then(mod => mod.setApiKey(apiKey));
        break;
      case 'gemini':
        void this.getProviderModule('gemini').then(mod => mod.setApiKey(apiKey));
        break;
      case 'yunwu':
        void this.getProviderModule('yunwu').then(mod => mod.setApiKey(apiKey));
        break;
      case 'minimax':
        void this.getProviderModule('minimax').then(mod => mod.setApiKey(apiKey));
        break;
      case 'kling':
        void this.getProviderModule('kling').then(mod => mod.setApiKey(apiKey));
        break;
      case 'sora':
        void this.getProviderModule('sora').then(mod => mod.setApiKey(apiKey));
        break;
      case 'wan':
        void this.getProviderModule('wan').then(mod => mod.setApiKey(apiKey));
        break;
      case 'bigmore':
        void this.getProviderModule('bigmore').then(mod => mod.setApiKey(apiKey));
        break;
      case 'skyreels':
        void this.getProviderModule('skyreels').then(mod => mod.setApiKey(apiKey));
        break;
      case 'baidu':
        void this.getProviderModule('baidu').then(mod => mod.setApiKey(apiKey));
        break;
      default:
        throw new Error(`暂不支持 ${provider} 提供商的 API 密钥设置`);
    }
  }

  /**
   * 设置 API URL（用于动态配置更新）
   * @param provider - 提供商
   * @param apiUrl - API 端点
   */
  static setApiUrl(provider: 'doubao' | 'deepseek' | 'openai' | 'gemini' | 'yunwu' | 'minimax' | 'kling' | 'sora' | 'wan' | 'bigmore' | 'baidu' | 'skyreels', apiUrl: string): void {
    switch (provider) {
      case 'deepseek':
        void this.getProviderModule('deepseek').then(mod => mod.setApiUrl(apiUrl));
        break;
      case 'doubao':
        // Doubao 使用固定配置
        break;
      case 'openai':
        // TODO: 实现 OpenAI
        void this.getProviderModule('openai').then(mod => mod.setApiUrl(apiUrl));
        break;
      case 'gemini':
        // Gemini 使用 GoogleGenAI 的默认端点，不支持自定义 apiUrl
        //console.log('Gemini 使用默认 API 端点');
        break;
      case 'yunwu':
        void this.getProviderModule('yunwu').then(mod => mod.setApiUrl(apiUrl));
        break;
      case 'minimax':
        void this.getProviderModule('minimax').then(mod => mod.setApiUrl(apiUrl));
        break;
      case 'kling':
        void this.getProviderModule('kling').then(mod => mod.setApiUrl(apiUrl));
        break;
      case 'sora':
        void this.getProviderModule('sora').then(mod => mod.setApiUrl(apiUrl));
        break;
      case 'wan':
        void this.getProviderModule('wan').then(mod => mod.setApiUrl(apiUrl));
        break;
      case 'bigmore':
        void this.getProviderModule('bigmore').then(mod => mod.setApiUrl(apiUrl));
        break;
      case 'skyreels':
        void this.getProviderModule('skyreels').then(mod => mod.setApiUrl(apiUrl));
        break;
      case 'baidu':
        // baidu 使用固定配置
        break;
    }
  }

  /**
   * 文本转语音并返回音频 URL
   * @param text - 要合成的文本
   * @param options - 可选参数
   * @param projectId - 项目 ID，用于文件上传
   * @returns - 音频的 URL
   */
  static async generateSpeechUrl(
    text: string,
    shotprovider: any = null,
    options: {
      spd?: number; // 语速 0-15，默认5
      pit?: number; // 音调 0-15，默认5
      vol?: number; // 音量，基础音库0-9，精品音库0-15，默认5
      per?: number; // 发音人，默认0（度小美）
      aue?: number; // 音频格式，3=mp3(默认)，4=pcm-16k，5=pcm-8k，6=wav
    } = {},
    projectId: string = "",
    preview: boolean = false
  ): Promise<string> {
    try {
      const provider = await this.getEnabledAudioProvider(shotprovider || this.currentProjectModelProviders);
      //console.log(`使用 ${provider} 合成语音`);

      let audioBlob: Blob;

      switch (provider) {
        case 'baidu':
          let speek = text;
          audioBlob = await (await this.getProviderModule('baidu')).textToSpeech(speek, options);
          break;
        default:
          throw new Error(`暂不支持 ${provider} 提供商的文生图`);
    }

      // 将 Blob 转换为 Base64 格式以便上传
      const audioBase64 = await (await this.getProviderModule('baidu')).blobToBase64(audioBlob);
      const audioDataUrl = `data:audio/mp3;base64,${audioBase64}`;
      //console.log('audioDataUrl:', audioDataUrl);
      // 上传到文件服务器
      if(preview){
        return audioDataUrl;
      }

      const uploadResponse = await uploadFileToService({
        fileType: projectId + '/audio/tts',
        base64Data: audioBase64,
        fileName: 's.mp3'
      });

      if (uploadResponse.success && uploadResponse.data?.fileUrl) {
        //console.log(`音频已上传到本地服务器: ${uploadResponse.data.fileUrl}`);
        return uploadResponse.data.fileUrl;
      } else {
        console.error(`音频上传失败: ${uploadResponse.error}`);
        // 上传失败时，返回 Base64 data URL
        return audioDataUrl;
      }
    } catch (error) {
      console.error('语音合成失败:', error);
      throw error;
    }
  }
  /**
   * 获取当前使用的提供商信息
   */
  static async getProviderInfo(): Promise<{
    provider: 'doubao' | 'deepseek' | 'openai' | 'gemini' | 'yunwu' | 'minimax' | 'kling' | 'sora' | 'wan' | 'bigmore' | 'baidu' | 'skyreels';
    enabled: boolean;
  }> {
    const config = await getEnabledConfigByType('llm');
    return {
      provider: config?.provider || 'doubao',
      enabled: !!config
    };
  }

  /**
   * 文生图
   * @param prompt - 提示词
   * @param referenceImages - 参考图片数组（可选）
   * @param isCharacter - 是否是角色图片（仅 doubao 支持）
   * @param localStyle - 本地风格（仅 doubao 支持）
   * @param imageSize - 图片尺寸（仅 doubao 支持）
   */
  static async generateImage(
    prompt: string,
    referenceImages: string[] = [],
    imageType: string = "character",
    localStyle: string = "真人写实",
    imageSize: string = "2560x1440",
    imageCount: number = 1,
    shotprovider: any = null,
    projectid: string = "",
    shotid: string = "0",
  ): Promise<string> {
    const provider = await this.getEnabledImageProvider(shotprovider || this.currentProjectModelProviders);
    //console.log(`使用 ${provider} 生成图片`);

    // 处理参考图片：将HTTP/HTTPS URL转换为Base64
    let processedReferenceImages = [];
    if (referenceImages && referenceImages.length > 0) {
      for(let i=0;i<referenceImages.length;i++){
        try{
          const baseurl = await imageUrlToBase64(referenceImages[i]);
          processedReferenceImages.push(baseurl);
        }catch(error){
          console.error('转换参考图片为Base64失败:', error);
          processedReferenceImages.push(referenceImages[i]);
        }
      }
    }else{
      processedReferenceImages = referenceImages;
    }

    let imageUrlOrBase64: string;

    // 调用各个模型服务生成图片
    switch (provider.provider) {
      case 'doubao':
        imageUrlOrBase64 = await (await this.getProviderModule('doubao')).generateImage(prompt, processedReferenceImages, imageType, localStyle, imageSize,imageCount);
        break;
      case 'gemini':
        imageUrlOrBase64 = await (await this.getProviderModule('gemini')).generateImage(prompt, processedReferenceImages,imageType, localStyle, imageSize,imageCount);
        break;
      case 'yunwu':
        imageUrlOrBase64 = await (await this.getProviderModule('yunwu')).generateImage(prompt, processedReferenceImages, imageType, localStyle, imageSize,imageCount);
        break;
      case 'openai':
        imageUrlOrBase64 = await (await this.getProviderModule('openai')).generateImage(prompt, processedReferenceImages, imageType, localStyle, imageSize, imageCount);
        break;
      default:
        throw new Error(`暂不支持 ${provider} 提供商的文生图`);
    }

    // 将模型返回的 URL 或 Base64 转换成本地服务器文件
    try {
      // 判断是否是 Base64 格式
      const isBase64 = imageUrlOrBase64.startsWith('data:');

      const uploadResponse = await uploadFileToService({
        fileType: projectid+'/image/'+imageType+'/'+shotid,
        fileUrl: isBase64 ? undefined : imageUrlOrBase64,
        base64Data: isBase64 ? imageUrlOrBase64 : undefined
      });

      if (uploadResponse.success && uploadResponse.data?.fileUrl) {
        //console.log(`图片已上传到本地服务器: ${uploadResponse.data.fileUrl}`);
        return uploadResponse.data.fileUrl;
      } else {
        console.error(`图片上传失败: ${uploadResponse.error}`);
        // 上传失败时返回原始图片
        return imageUrlOrBase64;
      }
    } catch (error) {
      console.error(`处理生成图片时出错:`, error);
      // 出错时返回原始图片
      return imageUrlOrBase64;
    }
  }

  /**
   * 图生视频
   * @param prompt - 提示词
   * @param startImageBase64 - 起始图片（可选）
   * @param endImageBase64 - 结束图片（可选，仅 gemini 支持）
   * @param duration - 视频时长，单位秒（仅 doubao 支持）
   */
  static async generateVideo(
    prompt: string,
    startImageBase64?: string,
    endImageBase64?: string,
    duration: number = 5,
    full_frame: boolean = false,
    shotprovider: any = null,
    projectid: string = "",
    imageSize: string = "2560x1440",
    visualStyle: string = "真人写实",
    shotid: string = "0",
    referenceImages: string[] = [],
  ): Promise<string> {
    const provider = await this.getEnabledVideoProvider(shotprovider || this.currentProjectModelProviders);
    //console.log(`使用 ${provider} 生成视频`);

    // 处理起始图片：如果是HTTP/HTTPS URL则转换为Base64
    let processedStartImageBase64 = startImageBase64;

    // 处理结束图片：如果是HTTP/HTTPS URL则转换为Base64
    let processedEndImageBase64 = endImageBase64;
    if(provider.provider!='bigmore' && provider.provider!='skyreels'){
      try {
        processedStartImageBase64 = await imageUrlToBase64(startImageBase64);
        //console.log('已将起始图片转换为Base64格式');
      } catch (error) {
        console.error('转换起始图片为Base64失败:', error);
        // 转换失败时继续使用原始图片
        processedStartImageBase64 = startImageBase64;
      }

      try {
        processedEndImageBase64 = await imageUrlToBase64(endImageBase64);
        //console.log('已将结束图片转换为Base64格式');
      } catch (error) {
        console.error('转换结束图片为Base64失败:', error);
        // 转换失败时继续使用原始图片
        processedEndImageBase64 = endImageBase64;
      }
    }

    let videoUrl: string;

    // 调用各个模型服务生成视频
    switch (provider.provider) {
      case 'doubao':
        const generate_audio = provider.description.indexOf("sound")>-1;
        videoUrl = await (await this.getProviderModule('doubao')).generateVideo(prompt, processedStartImageBase64, processedEndImageBase64, duration,full_frame,generate_audio);
        break;
      case 'gemini':
        videoUrl = await (await this.getProviderModule('gemini')).generateVideo(prompt, processedStartImageBase64, processedEndImageBase64,full_frame);
        break;
      case 'yunwu':
        videoUrl = await (await this.getProviderModule('yunwu')).generateVideo(prompt, processedStartImageBase64, processedEndImageBase64, duration,full_frame,imageSize);
        break;
      case 'minimax':
        videoUrl = await (await this.getProviderModule('minimax')).generateVideo(prompt, processedStartImageBase64, processedEndImageBase64, duration, full_frame);
        break;
      case 'kling':
        videoUrl = await (await this.getProviderModule('kling')).generateVideo(prompt, processedStartImageBase64, processedEndImageBase64, duration, full_frame);
        break;
      case 'sora':
        videoUrl = await (await this.getProviderModule('sora')).generateVideo(prompt, processedStartImageBase64, processedEndImageBase64, duration, full_frame,imageSize,visualStyle);
        break;
      case 'wan':
        videoUrl = await (await this.getProviderModule('wan')).generateVideo(prompt, processedStartImageBase64, processedEndImageBase64, duration, full_frame);
        break;
      case 'bigmore':
        videoUrl = await (await this.getProviderModule('bigmore')).generateVideo(prompt, processedStartImageBase64, processedEndImageBase64, duration, full_frame,imageSize);
        break;
      case 'skyreels':
        videoUrl = await (await this.getProviderModule('skyreels')).generateVideo(prompt, processedStartImageBase64, processedEndImageBase64, duration, full_frame, imageSize);
        break;
      case 'openai':
        videoUrl = await (await this.getProviderModule('openai')).generateVideo(prompt, processedStartImageBase64, processedEndImageBase64, duration, full_frame);
        break;
      default:
        throw new Error(`暂不支持 ${provider} 提供商的图生视频`);
    }

    // 将模型返回的视频 URL 转换成本地服务器文件
    try {
      const uploadResponse = await uploadFileToService({
        fileType: projectid+'/video/'+shotid,
        fileUrl: videoUrl
      });

      if (uploadResponse.success && uploadResponse.data?.fileUrl) {
        //console.log(`视频已上传到本地服务器: ${uploadResponse.data.fileUrl}`);
        return uploadResponse.data.fileUrl;
      } else {
        console.error(`视频上传失败: ${uploadResponse.error}`);
        // 上传失败时返回原始 URL
        return videoUrl;
      }
    } catch (error) {
      console.error(`处理生成视频时出错:`, error);
      // 出错时返回原始 URL
      return videoUrl;
    }
  }
}
