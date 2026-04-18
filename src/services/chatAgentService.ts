/**
 * Chat Agent Service - AI 对话 Agent 配置管理
 * 支持多个预设 Agent，每个 Agent 有独立的系统提示词
 */

/** Agent 配置 */
export interface ChatAgent {
  id: string;
  name: string;
  description: string;
  emoji: string;
  systemPrompt: string;
  isBuiltIn: boolean;  // 内置 Agent 不可删除
}

/** localStorage key */
const STORAGE_KEY = 'chatAgents';

/** 默认内置 Agent */
const DEFAULT_AGENTS: ChatAgent[] = [
  {
    id: 'general',
    name: '通用助手',
    description: '通用 AI 助手，简洁准确回答问题',
    emoji: '💬',
    systemPrompt: '你是一个 AI 助手，请用中文回答用户的问题。回答要简洁、准确、有帮助。',
    isBuiltIn: true,
  },
  {
    id: 'screenwriter',
    name: '剧本创作',
    description: '专注影视剧本创作，熟悉编剧技巧和故事结构',
    emoji: '📝',
    systemPrompt: `你是一位专业的影视编剧助手，精通剧本创作技巧和故事结构理论。

你的职责包括：
1. 帮助用户构思和优化剧本故事线
2. 提供角色塑造和人物弧线的专业建议
3. 分析剧本结构，给出节奏调整建议
4. 协助撰写场景描述和对白
5. 解答编剧相关的专业问题

回答时请：
- 使用专业术语但解释清楚概念
- 给出具体可行的建议而非空泛的理论
- 结合经典案例或模板来说明观点
- 保持创作灵感和艺术性`,
    isBuiltIn: true,
  },
  {
    id: 'prompt-optimizer',
    name: '提示词优化',
    description: '专注图片/视频提示词优化，熟悉主流 AI 绘图风格',
    emoji: '🎨',
    systemPrompt: `
# Role：
首席 AI 指令架构师（PrincipalPrompt Engineer)
你是一位拥有10年顶尖科技公司背景的 AI交互专家。你不仅精通语义建模，更深刻理解不同参数(Temperature，Top p)下模型的逻辑表现。你擅长将混沌的原始意图升维为“生产力级”的指令矩阵。

# Profile:
  - **核心能力**：
    1.**意图纠偏（Intent Refinement)**：自动补全用卢末察觉的逻辑真空，纠正低维表达。
    2.**多维建模(Multi-Dimensional Modeling)**：综合任务背景、受众画像、专业深度进行全景重构。
    3.**熵值控制(Entropy Control)**：通过极简且高强度的负向约束，锁定模型输出，杜绝幻觉。
  - **哲学理念**：一条优秀的Prompt是对AI注意力的精准导流。

# Goals:
  1.**建立高压背景**：补全业务压力、资源限制或受众苛求等高标准场景。
  2.**逻辑工程化**：将任务转化为逻辑链条.(Chain of Thought)，而非简单的要求描述。
  3.**交付即插即用的 os**：确保输出的文档包含Role、 Context、Goals、 Specific Instructions 和 Output Format。

# Workflow（核心指令协议）:
1.**[意图深度扫描]**：评估用户输入的原始信息熵。若关键信息缺失（<40%清晰度），你必须先询问1-2个关键问题以对齐意图。
2.**[架构重组]**:
  - **Persona**：赋予具备特定领域“偏见”和“直觉”的权威专家身份。
  - **Chain of Logic**：设计该专家处理此任务的每一步思维流程。
  - **Boundary Definition**:明确列出输出中“绝对不能出现“和“必须包含”的元素。
3.**[思维模型嵌入]**：根据领域自动匹配对应的认知模型（如：金字塔原理、迪斯尼策略、费曼技巧等）。

# Constraints & Rules:
  - **输出契约**：必须在代码块中交付[优化后的指令]，并在此乏后提供 100 字以内的[设计思路说明]。
  - **变量化处理**：优化后的指令中必须使用~[变量名了标记需要用户后续填充的部分。
  - **拒绝平庸**：禁正使用“请根据...”、”尽可能...“等弱指令词,”使甫“必须”、”严禁”、“强制执行”等强动词。

# Initialization:
"你好。指令架构师V2.0已就位。请发送你的原始需求或核心意图，我将为你构建一套具备顶级执行力的指令 os。"

`,
    isBuiltIn: true,
  },
  {
    id: 'director-assistant',
    name: '导演助理',
    description: '影视制作专业助理，熟悉分镜、镜头语言、转场等',
    emoji: '🎬',
    systemPrompt: `你是一位专业的导演助理，精通影视制作的各个环节，特别是分镜设计、镜头语言和转场技巧。

你的职责包括：
1. 帮助设计场景的分镜和镜头调度
2. 提供镜头语言的专业建议（景别、角度、运动等）
3. 规划场景之间的转场方式
4. 分析视觉叙事和节奏控制
5. 解答导演工作相关的专业问题

回答时请：
- 使用专业影视术语
- 给出具体的镜头设计示例
- 考虑实际拍摄的可行性
- 关注视觉叙事的效果和观众体验`,
    isBuiltIn: true,
  },
];

/**
 * 获取所有 Agent
 */
export function getChatAgents(): ChatAgent[] {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // 确保内置 Agent 始终存在
      const builtInIds = DEFAULT_AGENTS.map(a => a.id);
      const customAgents = parsed.filter((a: ChatAgent) => !builtInIds.includes(a.id));
      // 合并内置 Agent（使用最新版本）和自定义 Agent
      return [...DEFAULT_AGENTS, ...customAgents];
    } catch (e) {
      console.error('Failed to parse chat agents:', e);
      return [...DEFAULT_AGENTS];
    }
  }
  return [...DEFAULT_AGENTS];
}

/**
 * 保存所有 Agent
 */
export function saveChatAgents(agents: ChatAgent[]): void {
  // 只保存非内置的 Agent
  const customAgents = agents.filter(a => !a.isBuiltIn);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customAgents));
}

/**
 * 添加自定义 Agent
 */
export function addChatAgent(agent: Omit<ChatAgent, 'id' | 'isBuiltIn'>): ChatAgent {
  const agents = getChatAgents();
  const newAgent: ChatAgent = {
    ...agent,
    id: `custom-${Date.now()}`,
    isBuiltIn: false,
  };
  agents.push(newAgent);
  saveChatAgents(agents);
  return newAgent;
}

/**
 * 更新 Agent
 */
export function updateChatAgent(id: string, updates: Partial<Omit<ChatAgent, 'id' | 'isBuiltIn'>>): ChatAgent | null {
  const agents = getChatAgents();
  const index = agents.findIndex(a => a.id === id);
  
  if (index === -1) return null;
  
  const updated = { ...agents[index], ...updates };
  agents[index] = updated;
  
  // 内置 Agent 的更新也保存到 localStorage（以便恢复用户自定义的系统提示词）
  if (updated.isBuiltIn) {
    const customAgents = agents.filter(a => !a.isBuiltIn);
    // 内置 Agent 的自定义版本也保存
    customAgents.push(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customAgents));
  } else {
    saveChatAgents(agents);
  }
  
  return updated;
}

/**
 * 删除 Agent
 */
export function deleteChatAgent(id: string): boolean {
  const agents = getChatAgents();
  const agent = agents.find(a => a.id === id);
  
  if (!agent || agent.isBuiltIn) return false;
  
  const filtered = agents.filter(a => a.id !== id);
  saveChatAgents(filtered);
  return true;
}

/**
 * 获取默认 Agent
 */
export function getDefaultAgent(): ChatAgent {
  return DEFAULT_AGENTS[0];
}

/**
 * 根据 ID 获取 Agent
 */
export function getChatAgentById(id: string): ChatAgent | undefined {
  const agents = getChatAgents();
  return agents.find(a => a.id === id);
}

/**
 * 重置 Agent 到默认状态
 */
export function resetAgentToDefault(id: string): ChatAgent | null {
  const defaultAgent = DEFAULT_AGENTS.find(a => a.id === id);
  if (!defaultAgent) return null;
  
  const agents = getChatAgents();
  const index = agents.findIndex(a => a.id === id);
  
  if (index !== -1) {
    agents[index] = { ...defaultAgent };
    // 移除该内置 Agent 的自定义保存
    const customAgents = agents.filter(a => !a.isBuiltIn);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customAgents));
  }
  
  return defaultAgent;
}

/**
 * 重置所有 Agent 到默认状态
 */
export function resetAllAgents(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * 导出 Agent 配置
 */
export function exportAgents(): string {
  const agents = getChatAgents();
  return JSON.stringify({
    agents,
    exportDate: new Date().toISOString(),
    version: '1.0',
  }, null, 2);
}

/**
 * 导入 Agent 配置
 */
export function importAgents(json: string): { success: boolean; message: string; count: number } {
  try {
    const data = JSON.parse(json);
    
    if (!data.agents || !Array.isArray(data.agents)) {
      return { success: false, message: '无效的配置文件格式', count: 0 };
    }
    
    const imported: ChatAgent[] = [];
    for (const agent of data.agents) {
      if (agent.id && agent.name && agent.systemPrompt) {
        imported.push({
          id: agent.id,
          name: agent.name,
          description: agent.description || '',
          emoji: agent.emoji || '🤖',
          systemPrompt: agent.systemPrompt,
          isBuiltIn: false, // 导入的都视为自定义
        });
      }
    }
    
    if (imported.length === 0) {
      return { success: false, message: '没有找到有效的 Agent 配置', count: 0 };
    }
    
    // 合并现有自定义 Agent（避免重复 ID）
    const existing = getChatAgents();
    const existingCustomIds = existing.filter(a => !a.isBuiltIn).map(a => a.id);
    const newAgents = imported.filter(a => !existingCustomIds.includes(a.id));
    
    // 重新分配 ID 避免冲突
    const renamedAgents = newAgents.map(a => ({
      ...a,
      id: `imported-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    }));
    
    const allCustom = [...existing.filter(a => !a.isBuiltIn), ...renamedAgents];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allCustom));
    
    return { 
      success: true, 
      message: `成功导入 ${renamedAgents.length} 个 Agent`, 
      count: renamedAgents.length 
    };
  } catch (e) {
    console.error('Failed to import agents:', e);
    return { success: false, message: '解析配置文件失败', count: 0 };
  }
}
