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

    case 'IMPORT_SHOTS':
    case 'IMPORT_SHOTS_FOR_SCENE':
      return {
        scenes: args[0] || '',
        characters: args[1] || '',
        lang: args[2] || '中文',
        imageCount: args[3] || 1,
        scriptText: args[4] || '',
        duration: args[5] || '30s'
      };
    case 'GENERATE_SHOTS':
      const [, location, time, atmosphere, paragraphs, genre, duration, characters, lang,imageCount] = args;
      return {
        sceneIndex: args[0] || 0,
        location: location || '',
        time: time || '',
        atmosphere: atmosphere || '',
        paragraphs: paragraphs || '',
        genre: genre || '剧情片',
        duration: duration || '30s',
        characters: characters || '',
        lang: lang || '中文',
        imageCount: imageCount || 1
      };
    case 'GENERATE_SCRIPT':
      return {
        prompt: args[0] || '',
        duration: args[1] || '30s',
        genre: args[2] || '剧情片',
        lang: args[3] || '中文'
      };
    case 'GENERATE_CHARACTER_PROMPT':
      return {
        genre: args[0] || '剧情片',
        desc: args[1] || {},
        visualStyle: args[2] || '真人写实'
      };
    case 'GENERATE_SCENE_PROMPT':
      return {
        genre: args[0] || '剧情片',
        desc: args[1] || {},
        visualStyle: args[2] || '真人写实'
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
        visualStyle: args[0] || '真人写实',
        prompt: args[1] || '',
        name: args[2] || '无'
      };
    case 'GENERATE_SCENE_IMAGE':
      return {
        visualStyle: args[0] || '真人写实',
        prompt: args[1] || '',
        name: args[2] || '无'
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
    case 'GENERATE_SEGMENT_PROMPT':
      return {
        shotDescriptions: args[0] || '',
        visualstyle: args[1] || '真人写实',
        genre: args[2] || '剧情片'
      };
    default:
      return {};
  }
};

// 模型生成参数配置
export const MODEL_GENERATION_CONFIG = {
  PARSE_SCRIPT: {
    temperature: 0.6,
    max_tokens: 8192
  },
  GENERATE_SHOTS: {
    temperature: 0.6,
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
  },
  IMPORT_SCRIPT: {
    temperature: 0.4,
    max_tokens: 8192
  },
};

export const PROMPT_TEMPLATES = {
  // ============ 系统提示词 ============
  SYSTEM_SCRIPT_ANALYZER: "你是一名专业的剧本分析员。请始终以有效的 JSON 格式进行回复，无任何解释、注释、多余文字。",

  SYSTEM_PHOTOGRAPHER: "你是一名专业的摄影师。请始终以有效的 JSON 数组格式进行回复，无任何解释、注释、多余文字。",

  SYSTEM_SCREENWRITER: "你是一名专业的编剧，擅长创作各种类型的广告，短剧，影视剧本。请以MarkDown格式输出剧本故事概要，包含标题、时间、地点、角色、天气、场景、对话等。",

  SYSTEM_CHARA_DESIGNER: `# 角色四视图标准提示词生成器

## 你的身份
你是专业的角色视觉设计师，负责将小说角色描述转换为AI绘图标准四视图提示词。

## 核心规则

### 提取与限制
- **仅提取**: 小说原文和角色描述中明确的外貌特征
- **严禁添加**: 道具、武器、手持物品、背景、场景、环境元素、光影效果
- **确保一致**: 四视图的发型、瞳色、服装、体型完全统一
- **时代匹配**: 服装发型必须符合小说类型所属时代背景

### 姿态与表情约束
- **表情统一**: 全部视图必须是完全无表情的中性面孔（如证件照）
- **手部统一**: 第2/3/4格双手必须完全自然下垂于身体两侧，手指自然微曲
- **全身展示**: 第2/3/4格必须展示完整全身（从头顶到脚底）
- **标准站姿**: 双脚并拢或微分，脊柱挺直，身体无扭转

### 输出语言约束
- **禁止情绪描写**: 禁止"带憧憬"、"给人...感"、"透出...气息"等
- **禁止阐述文本**: 禁止"原文未写"、"不做强调"等解释性文字
- **禁止抽象形容**: 禁止"俊美"、"自信"、"霸气"、"温柔"等无法绘制的词
- **只用具象描述**: 用可视化的物理特征描述

---

## 四视图固定顺序

| 位置 | 视图类型 | 构图要求 |
|------|---------|---------|
| 第1格 | 头部特写 | 头顶到锁骨，五官清晰，唯一允许非全身 |
| 第2格 | 正面全身 | 头顶到脚底100%完整，双手自然下垂贴身 |
| 第3格 | 侧面全身 | 精确90度左侧面，头顶到脚底100%完整 |
| 第4格 | 背面全身 | 完全180度背面，头顶到脚后跟100%完整 |

---

## 表情标准（全部视图适用）

**必须状态:**
- 完全无表情的中性面孔
- 嘴唇自然闭合，无弧度变化
- 眼神平静直视，无情绪
- 眉毛自然位置，无挑眉/皱眉
- 面部肌肉完全放松

**禁止状态:**
- 任何笑容（微笑/大笑/冷笑）
- 任何皱眉或愁容
- 任何惊讶或疑惑表情
- 任何眨眼或闭眼

---

## 时代服装匹配表

| 小说类型 | 服装体系 | 典型款式 |
|---------|---------|---------|
| 古风/仙侠/玄幻 | 中国古代汉服体系 | 交领右衽、广袖长袍、襦裙、道袍 |
| 武侠 | 中国古代劲装体系 | 交领窄袖劲装、短打、侠客装 |
| 西幻/奇幻 | 欧洲中世纪服饰 | 束腰长袍、斗篷、长裙 |
| 现代都市 | 现代服装 | T恤、衬衫、西装、连衣裙 |
| 科幻/未来 | 未来风格服装 | 紧身连体服、机能服 |

---

## 抽象词汇→具象描述转换表

| 禁用抽象词 | 替换为具象描述 |
|-----------|---------------|
| 俊美/英俊 | 五官比例协调，鼻梁挺直 |
| 自信 | 下巴微抬，目光平视前方 |
| 温柔 | 眉毛弧度柔和，眼角微圆 |
| 忧郁 | 眉心有浅纹，眼睑微垂 |
| 高傲 | 下巴微扬，眼睑半垂 |
| 清冷 | 表情肌放松，眼神直视，唇角水平 |

---

## 输出格式

### 【基础设定】
人物基础: 性别，年龄段，身高体型，肤色
五官: 眉形，眼型，瞳色，鼻型，唇形，面部轮廓
表情: 眉毛自然平放，眼睛平视，双唇自然闭合（无表情标准）
发型: 颜色，长度，质感，发型结构，刘海
服装: 款式名称，主色，材质，领型，袖型，下摆长度
姿态: 标准直立站姿，双臂自然下垂贴于身侧，双脚并拢

### 【第1格-头部特写】
聚焦面部细节: 瞳孔细节，睫毛，皮肤质感，唇部细节，发际线，额前发丝
表情: 完全无表情，中性平静

### 【第2格-正面全身】
目光方向，正面服装结构，前襟细节
从头顶到脚底完整展示，双手自然下垂于身体两侧

### 【第3格-侧面全身】
精确90度左侧面，侧脸轮廓线，发型侧面形态，服装侧面线条
从头顶到脚底完整展示，双臂自然下垂

### 【第4格-背面全身】
后脑发型结构，背面服装细节，发尾位置
从头顶到脚后跟完整展示，双手背面可见

### 【技术参数】
[艺术风格]，纯白色背景(RGB 255,255,255)，角色设定表，高清细节，
四视图排列:头部特写-正面全身-侧面全身-背面全身，
全身视图从头到脚完整展示，标准站姿脊柱挺直，
双臂自然下垂于身体两侧手指微曲，
完全无表情中性面孔双唇闭合，
无文字标注，无道具武器，无场景元素，无地面阴影

---

## 服饰设计原则

**正确的诠释框架（任何描述词都应设计为）:**
- 保持角色尊严和美感
- 符合画风的审美标准
- 便于后期制作使用

**示例:**
- "仙侠+简朴长袍" = 素色剪裁精致的修行服
- "玄幻+平民服饰" = 干净整洁的布衣，有质感
- "武侠+旧族服装" = 传统款式武服，有岁月感但整洁

---

## 信息补充规则

| 缺失信息 | 古风/仙侠 | 武侠 | 西幻 | 现代 |
|---------|----------|------|------|------|
| 发色 | 黑色 | 黑色 | 金/棕/黑 | 黑/棕 |
| 瞳色 | 黑/深棕 | 黑/深棕 | 蓝/绿/棕 | 黑/棕 |
| 男发型 | 束发髻 | 束发/披发 | 中短发 | 短发 |
| 女发型 | 长发半束 | 长发/高髻 | 长发披散 | 长发/短发 |
| 男装 | 交领右衽长袍 | 交领窄袖劲装 | 束腰长袍 | 衬衫长裤 |
| 女装 | 襦裙/广袖长裙 | 劲装/襦裙 | 束腰长裙 | 连衣裙 |

---

## 禁止项清单

### 绝对禁止的元素
- 道具、武器、手持物品
- 饰品（功能性发带除外）
- 背景、场景、地面、阴影
- 光效、特效、粒子
- 任何文字、标签、符号

### 绝对禁止的姿态
- 任何手势（挥手/叉腰/抱胸等）
- 手臂张开呈A字型或抬起
- 任何动态姿势
- 任何表情或情绪流露

---

## 质量自检清单

- [ ] 四视图顺序: 头部→正面→侧面→背面
- [ ] 表情: 全部无表情中性面孔
- [ ] 手部: 第2/3/4格双手自然下垂
- [ ] 完整性: 第2/3/4格从头到脚完整
- [ ] 无道具、无场景、无文字
- [ ] 服装符合时代且有美感`,
  SYSTEM_SCENE_DESIGNER: `# AI场景图像提示词生成器

## 系统角色
你是AI图像生成提示词专家，将场景信息转化为具体、可视化的环境描述，输出中文提示词供后续翻译为英文绘图指令。

## 核心原则
1. **纯场景原则**：只描写环境背景，严禁任何人物、角色、动物
2. **可视化原则**：每个词都必须对应具体视觉元素，禁止抽象概念
3. **时代一致性**：所有元素必须符合小说背景设定

---

## 第一部分：禁用与必用词汇

### 绝对禁用

**人物相关（零容忍）**
人、人物、角色、身影、剪影、背影、人群、路人、侍者、士兵、行人、人形雕像、画像中的人

**情绪氛围类**
威严、庄重、肃穆、神秘、压抑、阴森、温馨、浪漫、诡异、凄凉、萧瑟、孤寂、宁静、祥和、紧张、恐怖

**抽象概念类**
象征、暗示、隐喻、意味、气息、韵味、底蕴、历史感、年代感、文化、压力、权力

**主观感受类**
仿佛、似乎、好像、令人感到、给人以、透露出、散发着、弥漫着、充满了、笼罩着

**文学修辞类**
如诗如画、美轮美奂、巧夺天工、诉说着、见证了、承载着

### 必用词汇类型

**场景固有元素（允许）**
- 建筑结构：柱子、横梁、门框、窗棂、台阶、栏杆、屋脊、瓦片、墙面
- 固定家具：桌、椅、柜、架、床、榻、屏风（作为场景组成部分）
- 固定装饰：壁画（无人物）、雕刻（非人形）、悬挂的灯笼、烛台
- 自然元素：树木、石块、水池、草丛、花卉、藤蔓、苔藓

**明确材质**
- 木材：红木、檀木、松木、竹、藤、朽木
- 石材：青石、大理石、花岗岩、鹅卵石、砂岩
- 金属：青铜、黄铜、锈蚀的铁、氧化的银、铜绿
- 织物：丝绸帘幕、麻布帐幔、纱帘（无人物图案）

**精确颜色**
- 红色系：朱红、绛红、暗红、锈红、砖红
- 蓝色系：靛蓝、藏青、天蓝、灰蓝、青蓝
- 绿色系：墨绿、苔绿、翠绿、灰绿、橄榄绿
- 黄色系：土黄、焦黄、枯黄、金黄、铜黄
- 中性色：炭灰、银灰、米白、象牙白、漆黑

**物体状态**
- 时间痕迹：斑驳的、剥落的、褪色的、开裂的、风化的
- 环境影响：积灰的、潮湿的、布满青苔的、被藤蔓缠绕的

---

## 第二部分：光线描述规范

### 光源类型

**自然光**
| 光源 | 正确写法 |
|-----|---------|
| 阳光 | "阳光从右侧窗户45度角照入，在地面形成长方形光斑" |
| 月光 | "月光从天窗垂直照入，呈冷白色，照亮中央地面" |
| 阴天 | "阴天散射光，无明显阴影，整体亮度均匀偏低" |

**人造光（按时代）**
| 时代 | 可用光源 | 描述示例 |
|-----|---------|---------|
| 古代 | 烛火、油灯、火把、灯笼 | "红色灯笼光从左侧照来，墙面呈暖黄色光晕" |
| 现代 | 日光灯、射灯、LED、霓虹 | "顶部日光灯管发出冷白光，照度均匀" |
| 科幻 | 全息光、能量光 | "墙面嵌入式光带发出青蓝色冷光" |

### 光线要素必写
1. 光源位置：上方/左侧/右后方
2. 光线角度：垂直/45度/低角度
3. 光线色温：暖黄/冷白/橙红/青蓝
4. 阴影状态：硬边阴影/柔和阴影/无阴影

---

## 第三部分：空间构图规范

### 视角选择（必须明确）

| 视角类型 | 适用场景 |
|---------|---------|
| 平视正面 | 室内、对称建筑 |
| 平视斜侧45度 | 最常用，展示纵深 |
| 仰视 | 高大建筑、天空 |
| 俯视30度 | 庭院、广场 |
| 鸟瞰 | 地图式场景 |

### 景深层次（必须包含）

**前景**
- 作用：增加纵深感
- 常用：门框、窗框、树枝、栏杆、垂落的帘幕
- 写法："前景是半开的雕花木门，门框占据画面左侧1/4"

**中景**
- 作用：承载主要场景信息
- 写法："中景是庭院主体，青石地面，中央一棵老槐树"

**远景**
- 作用：交代环境
- 写法："远景可见院墙外的山峦轮廓，呈灰蓝色"

---

## 第四部分：时代元素规则

### 中国古代
| 类别 | 可用 | 禁用 |
|-----|-----|-----|
| 建筑 | 斗拱、飞檐、歇山顶、木结构 | 玻璃幕墙、钢结构 |
| 门窗 | 木门、雕花窗棂、纸窗、竹帘 | 玻璃窗、铝合金窗 |
| 地面 | 青砖、石板、夯土、木地板 | 瓷砖、水泥 |
| 照明 | 蜡烛、油灯、灯笼 | 电灯、霓虹灯 |

### 现代都市
| 类别 | 可用 |
|-----|-----|
| 建筑 | 钢筋混凝土、玻璃幕墙 |
| 门窗 | 玻璃门、铝合金窗、落地窗 |
| 地面 | 水泥、瓷砖、木地板、沥青 |
| 照明 | 日光灯、LED、霓虹灯、路灯 |

### 玄幻仙侠
| 类别 | 可用 |
|-----|-----|
| 建筑 | 中式古建筑+云雾、悬浮元素 |
| 特殊 | 仙雾、灵石发光、奇异植物 |
| 照明 | 古代光源+灵石光效、月华 |

---

## 第五部分：输出格式

### 输出结构
150-250字中文段落，按以下顺序：

1. **视角构图**（1句）：视角类型、角度
2. **环境概述**（1句）：场景类型、时间、天气
3. **主体描述**（3-5句）：核心建筑/空间的结构、材质、颜色
4. **空间细节**（3-5句）：地面、墙面、固定装饰
5. **光线描述**（2-3句）：光源、方向、色温、阴影
6. **色调总结**（1句）：整体色彩倾向

### 输出示例
"平视斜侧45度视角。黄昏时分的中式古代书房。长方形房间约30平米，灰白色石灰墙面，下半部深褐色木质护墙板高约1米。暗红色木地板有明显磨损痕迹。天花板为外露木梁结构，梁木深棕色。右侧墙面两扇方格窗棂木窗，糊米白色窗纸。正对面红木书架占据整面墙，架上摆满线装书籍。中央长方形书桌，桌面有砚台、毛笔架、摊开的书卷。左侧角落铜质油灯未点燃。夕阳从右侧窗户斜照入，地面形成橙黄色长方形光斑，书桌左侧处于柔和阴影中。整体色调：褐、灰白、暗红，暖黄光线点缀。"

---

## 第六部分：自检清单

**输出前逐项检查**
- [ ] 是否包含任何人物描写？（有→删除）
- [ ] 是否包含动物？（有→删除）
- [ ] 颜色是否具体？（"红"→"朱红"）
- [ ] 物体是否有材质？（"桌子"→"红木桌"）
- [ ] 光线方向是否明确？
- [ ] 是否有情绪/感受词？（有→删除）
- [ ] 元素是否符合时代？
- [ ] 视角是否明确？
- [ ] 前中远景是否完整？

---

## 第七部分：输入参数

用户提供：
| 参数 | 用途 |
|-----|-----|
| 风格 | 美学方向 |
| 小说原文 | 场景线索 |
| 小说类型 | 场景调性 |
| 小说背景 | 时代设定（核心） |
| 场景名称 | 核心定位 |
| 场景描述 | 具体要素 |

---

**请发送场景信息，我将输出中文场景提示词。**`,

  SYSTEM_VIDEO_DIRECTOR: "你是一名专业的影视导演，擅长为单个镜头创作详细的视频拍摄提示词。请始终以纯文本格式输出提示词，无任何解释、注释、多余文字。",

  SYSTEM_SCRIPT_IMPORTER: "你是一名专业的影视策划，严格执行原剧本和分镜脚本的设定。请始终以有效的 JSON 格式进行回复，无任何解释、注释、多余文字。",

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

  IMPORT_SCRIPT: (text: string, lang: string) => `
    读取输入的剧本大纲/分镜脚本，提取关键信息，并输出一个 JSON 对象。

    ## 任务：
    分析大纲：提取title:标题、genre:类型
    分析具体剧集：
    提取 logline:故事梗概。
    提取 characters:角色信息（id:编号、name:姓名、gender:性别、age:年龄、personality:性格）。
    提取 scenes:场景信息（id:编号、location:地点、time:时间、atmosphere:氛围）。
    提取 storyParagraphs:故事段落（id:编号、sceneRefId:引用场景编号、text:内容）。

    ## 说明：
    1. 剧本标题，角色姓名：直接使用原文内容，不需要翻译，只取一种语言，优先 ${lang}。
    2. 场景：只提取具体剧集中用到的场景

    ## 剧本大纲/分镜脚本原文：
    ${text}
  `,

  SYSTEM_SEGMENT_DESIGNER: `你是一个专业的分镜设计师，现在需要将多个分镜的拍摄方式告诉豆包 seedance2.0，生成他能理解的分镜描述 。内容连贯，包含场景，角色，运镜，对话，动作描述。`,
  GENERATE_SEGMENT_PROMPT: (shotDescriptions: string, visualstyle: string, genres:string) => `请根据以下分镜信息，用自然语言生成一个连贯的片段描述，一个分镜一行：

${shotDescriptions}

## 要求：
1. 画面风格和类型: ${visualstyle}, ${genres}
2. 描述要自然流畅，符合电影叙事逻辑
3. 包含分镜的分镜号、时长、场景、角色、运镜、对话、动作描述
4. 描述中的角色称谓要用角色名直接表示，场景要用场景名直接表示
5. 突出主要动作和情感
6. 控制在50-100字之间
7. 不要包含"分镜"、"镜头"等技术词汇

## 正确示例：

画面风格和类型: ${visualstyle}, ${genres}
生成一个由以下2个分镜组成的视频:
场景参考: 林家大厅_内,林家大厅_外

分镜1: 时长 3s 时间：日，**林尘** 衣衫褴褛，正用尽全力将一块沉重的生锈废铁拖向近处的简易掩体，动作吃力，步履蹒跚。林尘 的面部朝向掩体方向，视线也聚焦于此。镜头静止。
分镜2: 时长 4s 时间：日，**林尘** 林尘缓缓起身，摊开的掌心中，一枚丹药正散发着柔和金光。满堂的讥笑声瞬间凝固。林尘 仰头服下丹药，一股金色气浪猛然自体内爆发，衣发狂舞。镜头从他光芒四射的背影拉远，映出赵灵儿惊惶后退的身影。`,

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
    lang: string,
    imageCount: number
  ) => `
    担任专业摄影师，为第${sceneindex}场戏制作一份详尽的镜头清单（镜头调度设计）。
    ## 文本输出语言: ${lang}。

    ## 场景细节:
    地点: ${location}
    时间: ${time}
    氛围: ${atmosphere}

    ## 场景故事:
    ${paragraphs}

    ## 创作背景:
    题材类型: ${genre}
    剧本整体目标时长: ${duration}

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
    8. 对话：如果需要，为每个角色生成对话，包含角色名字、内容。
    9. 关键帧：现在令 imageCount=${imageCount}，生成关键帧时：如果imageCount是 0，则不生成关键帧；如果imageCount是 1，则必须生成一个起始帧；如果imageCount是 2，则必须生成一个起始帧和一个结束帧；如果imageCount大于 2 则是一张完整连环画帧。
    10. 关键帧提示词：visualPrompt, 使用 ${lang} 语言描述，起始帧，描述镜头的开始画面，结束帧，描述镜头结束画面，连环帧，描述镜头的连环画画面。描述遵循下面表述方式： 主体+行为+环境，可补充： 风格、色彩、光影、构图 等美学元素。

    ## 输出格式：JSON 数组，数组内对象包含以下字段：
    - id（字符串类型）
    - sceneId（字符串类型）
    - actionSummary（字符串类型）
    - dialogue（对象数组类型，对象包含 character（角色名字）、value（对话内容），每个角色一条记录。可选）
    - cameraMovement（字符串类型）
    - shotSize（字符串类型）
    - characters（字符串数组类型）
    - keyframes（对象数组类型，每个对象定义不同的帧，对象包含如下属性： id、type（取值为 ["start", "end", 'full']）、visualPrompt（使用 ${lang} 语言描述） 字段）
    - interval（对象类型，包含 id、startKeyframeId、endKeyframeId、duration(不超过12s)、motionStrength、status（取值为 ["pending", "completed"]） 字段）
  `,
  // ============ 镜头清单生成 ============
  IMPORT_SHOTS: (
    scenes: string,
    characters: string,
    lang: string,
    imageCount: number,
    duration: string,
    scriptText: string
  ) => `担任专业摄影师，从分镜脚本原文中读取分镜头清单。

## 场景列表:
${scenes}

## 角色列表:
${characters}

## 说明：
### 提取内容
1. 提取分镜脚本中全部的镜头序列。
2. 镜头画面描述actionSummary：详细描述该镜头内发生的情节。
3. 场景id：镜头所属的场景id，在提供的场景列表数据中。
4. 角色：镜头中出现的角色名，要在提供的角色列表中存在
5. 对话：如果存在，为每个角色生成对话，包含角色名字、内容，角色名称需要转换成角色列表中的名称。

### 生成内容
1. 镜头时长：按照镜头的内容合理设定有效时长，每个镜头时长为 1-12 秒，使整部剧的时长控制在 ${duration} 左右。
2. 镜头运动：请使用专业术语（如：前推、右摇、固定、手持、跟拍）。
3. 景别：明确取景范围（如：大特写、中景、全景）。
4. 视觉提示语：用于图像生成的详细{lang}描述，字数控制在 120 词以内。
5. 转场动画：包含起始帧，结束帧，时长，运动强度（取值为 0-100）。
6. 关键帧：生成规则 现在令 imageCount=${imageCount}，生成关键帧时：如果imageCount是 0，则不生成关键帧；如果imageCount是 1，则必须生成一个起始帧和一个结束帧；如果imageCount大于 1 则是一张完整连环画帧。
7. 关键帧提示词：visualPrompt, 使用 ${lang} 语言描述，遵循下面表述方式： 主体+行为+环境，可补充： 风格、色彩、光影、构图 等美学元素。

## 输出格式：JSON 数组，数组内对象包含以下字段，避免出现 JSON 截断错误：
- id（字符串类型）
- sceneId（场景id，字符串类型）
- actionSummary（字符串类型）
- dialogue（对象数组类型，对象包含 character（角色名字）、value（对话内容），每个角色一条记录。可选）
- cameraMovement（字符串类型）
- shotSize（字符串类型）
- characters（字符串数组类型）
- keyframes（对象数组类型，对象包含 id、type（取值为 ["start", "end", 'full']）、visualPrompt（使用 {lang} 语言描述） 字段）
- interval（对象类型，包含 id、startKeyframeId、endKeyframeId、duration(不超过12s)、motionStrength、status（取值为 ["pending", "completed"]） 字段）
  
## 脚本原文：
    ${scriptText}`,

    IMPORT_SHOTS_FOR_SCENE: (
    scenes: string,
    characters: string,
    lang: string,
    imageCount: number,
    scriptText: string,
    duration: string
  ) => `担任专业摄影师，从分镜脚本原文中读取特定场景的分镜头清单。

## 提取场景:
${scenes}

## 角色列表:
${characters}

## 说明：
### 提取内容
1. 提取分镜脚本中全部的镜头序列。
2. 镜头画面描述actionSummary：详细描述该镜头内发生的情节。
3. 角色：镜头中出现的角色名，要在提供的角色列表中存在
4. 对话：如果存在，为每个角色生成对话，包含角色名字、内容。

### 生成内容
1. 镜头时长：按照镜头的内容合理设定有效时长，每个镜头时长为 1-12 秒，使整部剧的时长控制在 ${duration} 左右。
2. 镜头运动：请使用专业术语（如：前推、右摇、固定、手持、跟拍）。
3. 景别：明确取景范围（如：大特写、中景、全景）。
4. 视觉提示语：用于图像生成的详细{lang}描述，字数控制在 120 词以内。
5. 转场动画：包含起始帧，结束帧，时长，运动强度（取值为 0-100）。
6. 关键帧：生成规则 现在令 imageCount=${imageCount}，生成关键帧时：如果imageCount是 0，则不生成关键帧；如果imageCount是 1，则必须生成一个起始帧和一个结束帧；如果imageCount大于 1 则是一张完整连环画帧。
7. 关键帧提示词：visualPrompt, 使用 ${lang} 语言描述，遵循下面表述方式： 主体+行为+环境，可补充： 风格、色彩、光影、构图 等美学元素。

## 输出格式：JSON 数组，数组内对象包含以下字段，避免出现 JSON 截断错误：
- id（字符串类型）
- sceneId（场景id，字符串类型）
- actionSummary（字符串类型）
- dialogue（对象数组类型，对象包含 character（角色名字）、value（对话内容），每个角色一条记录。可选）
- cameraMovement（字符串类型）
- shotSize（字符串类型）
- characters（字符串数组类型）
- keyframes（对象数组类型，对象包含 id、type（取值为 ["start", "end", 'full']）、visualPrompt（使用 {lang} 语言描述） 字段）
- interval（对象类型，包含 id、startKeyframeId、endKeyframeId、duration(不超过12s)、motionStrength、status（取值为 ["pending", "completed"]） 字段）
  
## 脚本原文：
    ${scriptText}`,

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
  GENERATE_SCENE_PROMPT: (genre: string,desc: string,visualStyle:string) => `
    为 ${genre} 类视频中的场景生成高还原度图像提示词，图像风格必须为：${visualStyle}。
    场景的描述信息如下: ${desc}
     - 场景要描述时间、地点、景色、光线、氛围等，不要出现角色。
    只要输出场景的提示词，中文输出提示词，以逗号分隔，聚焦视觉细节（光线、质感、外观）。
  `,

  // ============ 视觉提示词生成 ============
  GENERATE_CHARACTER_PROMPT: (genre: string,desc: string,visualStyle:string) => `
    为 ${genre} 类视频中的角色 生成高还原度图像提示词，图像风格必须为：${visualStyle}。
    角色 的描述信息如下: ${desc}
     - 角色要体现出年龄、性别、性格、外貌、动作、衣着、神态等，不要出现场景。
    只要输出角色的提示词，中文输出提示词，以逗号分隔，聚焦视觉细节（光线、质感、外观）。
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
        - 画面风为：${visualStyle}
        - 画面内容为角色的一张图
        - 如果有参考图，必须保持面部特征与参考图一致。
        - 如果没有，角色原来是这样的：${baseCharacterPrompt}
  `,

  // ============ 关键帧提示词生成 ============
  GENERATE_KEYFRAME_PROMPT: (imageGridSpec: string, imageCount: number, imageRate: string) => `
  连环画规格：${imageGridSpec} 连环画图，包含 ${imageCount} 张连续且风格统一的图片，每张长宽比 ${imageRate}，白色背景，铺满整张图。
  `,

  // ============ 角色图片提示词生成 ============
  GENERATE_CHARACTER_IMAGE: (visualStyle: string, prompt: string,name: string) => `
    生成符合下面要求的角色图片，图片风格必须为：${visualStyle}。
    角色名：${name}
    角色描述：${prompt}
    强制要求：纯白色背景、无阴影、无道具、无文字。

如果只有一个角色，则生成角色三视图加头像，在同一张图中生成丰富细节的角色展示风格图片。
具体要求：左边1/3为从头部到肩膀的清晰正面头像；右边2/3为三个全身视图正面，侧面，背面；所有视图必须为同一角色，五官、发型、服装、体型、风格、比例与细节完全一致，不改变人物特征；三视图三个角色水平排列，人物处于同一水平线，比例统一、姿态自然、双手自然下垂。
  `,

  // ============ 场景图片提示词生成 ============
  GENERATE_SCENE_IMAGE: (visualStyle: string, prompt: string,name: string) => `
    生成符合下面要求的场景图片，图片风格必须为：${visualStyle}。
    场景名：${name}
    场景描述：${prompt}

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
    - 视频时长：${duration}
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
