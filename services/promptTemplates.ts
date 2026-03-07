/**
 * 公共提示词模板
 * 集中管理所有 AI 服务使用的提示词,便于维护和更新
 */

// 获取自定义模板（从 localStorage）
export const getCustomTemplate = (key: string): string | null => {
  try {
    const saved = localStorage.getItem('promptTemplates');
    if (saved) {
      const customContent = JSON.parse(saved);
      return customContent[key] || null;
    }
  } catch (e) {
    console.error('Failed to load custom template:', e);
  }
  return null;
};

// 模板变量替换函数
const replaceVariables = (template: string, variables: Record<string, any>): string => {
  let result = template;
  Object.entries(variables).forEach(([key, value]) => {
    // 处理简单变量替换 {key}
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));

    // 处理嵌套属性 {key.prop}
    result = result.replace(
      new RegExp(`\\{${key}\\.(\\w+)(\\.(\\w+))*\\}`, 'g'),
      (match) => {
        const parts = match.slice(1, -1).split('.');
        let current: any = variables;
        for (const part of parts) {
          if (current && current[part] !== undefined) {
            current = current[part];
          } else {
            return match;
          }
        }
        return String(current);
      }
    );
  });
  return result;
};

// 渲染模板（支持自定义和默认模板）
export const renderTemplate = (key: string, ...args: any[]): string => {
  const customTemplate = getCustomTemplate(key);

  if (customTemplate) {
    // 如果有自定义模板，尝试替换变量
    // 需要根据不同的模板类型提取变量
    const variables = extractVariablesForTemplate(key, args);
    return replaceVariables(customTemplate, variables);
  }

  // 使用默认模板函数
  const defaultFn = PROMPT_TEMPLATES[key as keyof typeof PROMPT_TEMPLATES] as Function;
  if (defaultFn) {
    if(typeof defaultFn === 'function'){
      return defaultFn(...args);
    }else{
      return defaultFn;
    }
  }
  return customTemplate || '';
};

// 根据模板 key 提取变量
const extractVariablesForTemplate = (key: string, args: any[]): Record<string, any> => {
  switch (key) {
    case 'PARSE_SCRIPT':
      return { text: args[0] || '', lang: args[1] || '中文', genre: args[2] || '剧情片' };
    case 'GENERATE_SHOTS':
      const [, location, time, atmosphere, paragraphs, genre, duration, characters, lang] = args;
      return {
        sceneIndex: args[0] || 0,
        location: location || '',
        time: time || '',
        atmosphere: atmosphere || '',
        paragraphs: paragraphs || '',
        genre: genre || '',
        duration: duration || '30s',
        characters: characters || '',
        lang: lang || '中文'
      };
    case 'GENERATE_SCRIPT':
      return {
        prompt: args[0] || '',
        duration: args[1] || '30s',
        genre: args[2] || '',
        lang: args[3] || '中文'
      };
    case 'GENERATE_VISUAL_PROMPT':
      return {
        type: args[0] || 'character',
        data: args[1] || {},
        genre: args[2] || '',
        visualStyle: args[3] || '真人写实'
      };
    case 'JOIN_IMAGES':
      return {
        imageCount: args[0] || 4,
        imageSize: args[1] || '2560x1440'
      };
    case 'IMAGE_GENERATION_WITH_REFERENCE':
      return {
        prompt: args[0] || '',
        visualStyle: args[1] || '真人写实'
      };
    case 'GENERATE_CHARACTER_VARIATION':
      return {
        character: args[0] || '',
        visualStyle: args[1] || '真人写实',
        variationPrompt: args[2] || '',
        baseCharacterPrompt: args[3] || ''
      };
    case 'GENERATE_KEYFRAME_PROMPT':
      return {
        imageGridSpec: args[0] || '3x3',
        imageCount: args[1] || 9,
        imageRate: args[2] || '16:9'
      };
    case 'GENERATE_CHARACTER_IMAGE':
      return {
        prompt: args[0] || '',
        visualStyle: args[1] || '真人写实'
      };
    case 'GENERATE_SCENE_IMAGE':
      return {
        prompt: args[0] || '',
        visualStyle: args[1] || '真人写实'
      };
    case 'GENERATE_VIDEO_PROMPT':
      return {
        shotSummary: args[0] || '',
        cameraMovement: args[1] || '',
        shotSize: args[2] || '',
        duration: args[3] || 5,
        visualStyle: args[4] || '真人写实',
        characters: args[5] || '无',
        startFrameVisualPrompt: args[6] || '',
        endFrameVisualPrompt: args[7] || '',
        dialogues: args[8] || '无',
      };
    case 'GENERATE_TRANSITION_VIDEO':
      return {
        currentShotSummary: args[0] || '',
        nextShotSummary: args[1] || '',
        currentShotSize: args[2] || '',
        nextShotSize: args[3] || '',
        visualStyle: args[4] || '真人写实',
        endFrameVisualPrompt: args[5] || '',
        startFrameVisualPrompt: args[6] || ''
      };
    default:
      return {};
  }
};

// 模型生成参数配置
export const MODEL_GENERATION_CONFIG = {
  PARSE_SCRIPT: {
    temperature: 0.5,
    max_tokens: 8192
  },
  GENERATE_SHOTS: {
    temperature: 0.5,
    max_tokens: 8192
  },
  GENERATE_SCRIPT: {
    temperature: 0.8,
    max_tokens: 8192
  },
  GENERATE_VISUAL_PROMPT: {
    temperature: 0.8,
    max_tokens: 500
  },
  GENERATE_VIDEO_PROMPT: {
    temperature: 0.7,
    max_tokens: 1000
  }
};

export const PROMPT_TEMPLATES = {
  // ============ 系统提示词 ============
  SYSTEM_SCRIPT_ANALYZER: "你是一名专业的剧本分析员。请始终以有效的 JSON 格式进行回复，无任何解释、注释、多余文字。",

  SYSTEM_PHOTOGRAPHER: "你是一名专业的摄影师。请始终以有效的 JSON 数组格式进行回复，无任何解释、注释、多余文字。",

  SYSTEM_SCREENWRITER: "你是一名专业的编剧，擅长创作各种类型的广告，短剧，影视剧本。请以MarkDown格式输出剧本故事概要，包含标题、时间、地点、角色、天气、场景、对话等。",

  SYSTEM_VISUAL_DESIGNER: "你是一名专业的影视美术设计师，擅长为影视角色和场景设计服装、造型、道具等，以专业词汇描述你设计的角色或场景。",

  SYSTEM_VIDEO_DIRECTOR: "你是一名专业的影视导演，擅长为单个镜头创作详细的视频拍摄提示词。请始终以纯文本格式输出提示词，无任何解释、注释、多余文字。",

  // ============ 剧本解析 ============
  PARSE_SCRIPT: (text: string, lang: string,genre: string) => `
    分析输入的故事或剧本，构思制作一部 ${genre} 类型的视频，并输出一个 JSON 对象，字段值以 ${lang} 语言呈现。

    ## 任务：
    提取title:标题、genre:类型、logline:故事梗概（以 ${lang} 语言呈现）。
    提取characters:角色信息（id:编号、name:姓名、gender:性别、age:年龄、personality:性格）。
    提取scenes:场景信息（id:编号、location:地点、time:时间、atmosphere:氛围）。
    storyParagraphs:故事段落（id:编号、sceneRefId:引用场景编号、text:内容）。

    ## 输入：
    ${text}
  `,

  // ============ 镜头清单生成 ============
  GENERATE_SHOTS: (
    sceneindex: number,
    location: string,
    time: string,
    atmosphere: string,
    paragraphs: string,
    genre: string,
    duration: string,
    characters: string,
    lang: string
  ) => `
    担任专业摄影师，为第${sceneindex}场戏制作一份详尽的镜头清单（镜头调度设计）。
    ## 文本输出语言: ${lang}。

    ## 场景细节:
    地点: ${location}
    时间: ${time}
    氛围: ${atmosphere}

    ## 场景动作:
    ${paragraphs}

    ## 创作背景:
    题材类型: ${genre}
    剧本整体目标时长: ${duration || "30s"}

    ## 角色:
    ${characters}

    ## 说明：
    1. 设计一组覆盖全部情节动作的镜头序列。
    2. 重要提示：每场戏镜头数量上限为 2-8 个，每个镜头时长为 4-12 秒，避免出现 JSON 截断错误。
    3. 镜头运动：请使用专业术语（如：前推、右摇、固定、手持、跟拍）。
    4. 景别：明确取景范围（如：大特写、中景、全景）。
    5. 镜头情节概述：详细描述该镜头内发生的情节（使用 ${lang} 语言描述），遵循下面表述方式：主体+运动+环境（非必须）+运镜/切镜（非必须）+美学描述（非必须）+声音（非必须）。
    6. 视觉提示语：用于图像生成的详细${lang}描述，字数控制在 120 词以内。
    7. 转场动画：包含起始帧，结束帧，时长，运动强度（取值为 0-100）。
    8. 关键帧提示词：visualPrompt, 使用 ${lang} 语言描述，遵循下面表述方式： 主体+行为+环境，可补充： 风格、色彩、光影、构图 等美学元素。

    ## 输出格式：JSON 数组，数组内对象包含以下字段：
    - id（字符串类型）
    - sceneId（字符串类型）
    - actionSummary（字符串类型）
    - dialogue（对象数组类型，对象包含 character（角色名字）、value（对话内容），每个角色一条记录。可选）
    - cameraMovement（字符串类型）
    - shotSize（字符串类型）
    - characters（字符串数组类型）
    - keyframes（对象数组类型，对象包含 id、type（取值为 ["start", "end"]）、visualPrompt（使用 ${lang} 语言描述） 字段）
    - interval（对象类型，包含 id、startKeyframeId、endKeyframeId、duration(不超过12s)、motionStrength、status（取值为 ["pending", "completed"]） 字段）
  `,

  // ============ 剧本生成 ============
  GENERATE_SCRIPT: (
    prompt: string,
    duration: string,
    genre: string,
    lang: string
  ) => `
    你是一名专业的编剧。请根据以下提示词创作一个完整的影视剧本。

    ## 创作要求：
    1. 剧本时长：${duration}
    2. 题材类型：${genre}
    3. 输出语言：${lang}
    4. 剧本结构清晰，包含剧本标题、场景标题、时间（大的时间，如：上午、下午、清晨、夜晚，或者某年某月，某个年代等）、地点、天气、角色、动作描述、对白
    5. 情节紧凑，画面感强
    6. 角色性格鲜明，对话自然

    ## 用户提示词：
    "${prompt}"

    请以Markdown格式输出剧本结构，不要使用 JSON 格式，直接输出可阅读的剧本文本。
  `,

  // ============ 视觉提示词生成 ============
  GENERATE_VISUAL_PROMPT: (type: string, desc: string, genre: string,visualStyle:string) => `
    为 ${genre} 类视频中的 ${type} 生成高还原度图像提示词，图像风格必须为：${visualStyle}。
    ${type} 的描述信息如下: ${desc}
     - 角色要体现出年龄、性别、性格、外貌、动作、衣着、神态等，不要出现场景。
     - 场景要描述时间、地点、景色、光线、氛围等，不要出现角色。
    中文输出提示词，以逗号分隔，聚焦视觉细节（光线、质感、外观）。
  `,

  // ============ 图片拼接 ============
  JOIN_IMAGES: (imageCount: number, imageSize: string) => `
    请将这些图片拼成一张${imageCount}宫格图片，图片之间留有1个像素的间隔，最终图片大小为${imageSize}。
  `,

  // ============ 带参考图的图片生成 ============
  IMAGE_GENERATION_WITH_REFERENCE: (prompt: string,visualStyle: string="真人写实") => `
    生成符合下面描述的图画，画面风格必须为：${visualStyle}。
    图像描述：
      ${prompt}

    如果有参考图像：
    - 所提供的第一张图片为场景 / 环境参考图。
    - 后续所有图片均为角色参考图（例如：基础形象，或特定变体造型）。

    要求：
    - 画面风格必须为：${visualStyle}。
    - 严格保持与场景参考图一致的视觉风格、光影效果和环境氛围。
    - 若画面中出现角色，必须与所提供的角色参考图高度相似。
  `,

  // ============ 角色造型变体生成 ============
  GENERATE_CHARACTER_VARIATION: (
    character: string,
    visualStyle: string,
    variationPrompt: string,
    baseCharacterPrompt: string
  ) => `
    生成角色：${character} 的新造型图，画面风格必须为：${visualStyle}，符合下面描述。
    造型描述：
        ${variationPrompt}
    要求：
        - 画面尺寸为：1728x2304
        - 画面风为：${visualStyle}
        - 画面内容为角色的一张图
        - 如果有参考图，参考图为角色的三视图加大头照，必须保持面部特征与参考图一致。
        - 如果没有，角色原来是这样的：${baseCharacterPrompt}
  `,

  // ============ 关键帧提示词生成 ============
  GENERATE_KEYFRAME_PROMPT: (imageGridSpec: string, imageCount: number, imageRate: string) => `
  连环画规格：${imageGridSpec} 连环画图，包含 ${imageCount} 张连续且风格统一的图片，每张长宽比 ${imageRate}，白色背景，铺满整张图。
  `,

  // ============ 角色图片提示词生成 ============
  GENERATE_CHARACTER_IMAGE: (prompt: string, visualStyle: string) => `
    生成符合下面要求的角色图片，图片风格必须为：${visualStyle}。
    图片内容：${prompt}

    如果只有一个角色，则生成角色三视图加大头照，在同一张图中生成丰富细节的角色展示风格图片，图片比例3:4，具体要求：排版布局左上1/4为从头部到肩膀的清晰正面大头照，右上1/4为人物站立的全身正视图， 下部左边人物的站立全身侧视图，右边人物的站立全身背视图；所有视图必须为同一角色，五官、发型、服装、体型、风格、比例与细节完全一致，不改变人物特征；三视图比例统一、姿态自然；纯白色背景、无阴影、无道具、无文字。
  `,

  // ============ 场景图片提示词生成 ============
  GENERATE_SCENE_IMAGE: (prompt: string, visualStyle: string) => `
    生成符合下面要求的场景图片，图片风格必须为：${visualStyle}。
    图片内容：${prompt}

    图片比例16:9，具体要求：图中无角色、无文字。
  `,

  // ============ 视频拍摄提示词生成 ============
  GENERATE_VIDEO_PROMPT: (
    shotSummary: string,
    cameraMovement: string,
    shotSize: string,
    duration: number,
    visualStyle: string,
    characters: string,
    startFrameVisualPrompt: string,
    endFrameVisualPrompt: string,
    dialogues: string
  ) => `
    为单个镜头创作详细的视频拍摄提示词。

    镜头信息：
    - 镜头情节概述：${shotSummary}
    - 镜头运动：${cameraMovement}
    - 景别：${shotSize}
    - 视频时长：${duration}秒
    - 画面风格：${visualStyle}
    - 出场角色：${characters}
    - 对白：
         ${dialogues}
    - 起始帧视觉描述：${startFrameVisualPrompt}
    - 结束帧视觉描述：${endFrameVisualPrompt}

    要求：
    1. 提示词应详细描述视频中需要呈现的视觉效果
    2. 包含主体运动方式、运镜方式、光影变化、氛围营造等元素
    3. 描述要符合镜头运动和景别要求
    4. 可以按秒级时长分别描述画面的变化
    5. 提示词长度控制在200-300字以内
    6. 输出纯文本提示词，无任何解释或注释

    请输出视频拍摄提示词：
  `,

  // ============ 转场视频提示词生成 ============
  GENERATE_TRANSITION_VIDEO: (
    currentShotSummary: string,
    nextShotSummary: string,
    currentShotSize: string,
    nextShotSize: string,
    visualStyle: string,
    endFrameVisualPrompt: string,
    startFrameVisualPrompt: string
  ) => `
    视频风格：${visualStyle}；故事从 ${currentShotSummary} 过渡到 ${nextShotSummary}。景别变化：从 ${currentShotSize} 到 ${nextShotSize}；制作转场视频：保持画面风格一致。转场时长 5 秒，运动强度适中。
    镜头开始：${endFrameVisualPrompt}；
    镜头结束：${startFrameVisualPrompt}；
    按照上面描述生成 ${visualStyle} 风格的转场视频！
  `,
};
