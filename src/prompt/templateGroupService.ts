/**
 * 提示词模版组服务
 * 提供模版组匹配、获取、管理等功能
 */

import {
  BUILT_IN_TEMPLATE_GROUPS,
  getDefaultGroupFull
} from '.';
import {
  GROUP_MANAGED_TEMPLATE_KEYS,
  GroupTemplates,
  ProjectTemplateContext,
  PromptTemplateGroup,
  TEMPLATE_GROUPS_STORAGE_KEY,
  TEMPLATE_KEY_TO_GROUP_PROP,
} from './promptTemplate';
import { PROMPT_TEMPLATES, renderTemplate } from './promptTemplates';

/**
 * 模版组服务
 */
const groupTemplateKeys: (keyof GroupTemplates)[] = [
      'systemCharacterDesignerRule', 'systemSceneDesignerRule', 'systemPropDesignerRule',
      'systemSegmentDesignerRule',
      'systemSegmentOptimize',
      'characterImage', 'sceneImage', 'propImage'
];
export class TemplateGroupService {
  private static customGroups: PromptTemplateGroup[] | null = null;
  /**
   * 从 localStorage 加载自定义模版组
   */
  private static loadCustomGroups(): PromptTemplateGroup[] {
    if (this.customGroups !== null) {
      return this.customGroups;
    }

    try {
      const saved = localStorage.getItem(TEMPLATE_GROUPS_STORAGE_KEY);
      if (saved) {
        this.customGroups = JSON.parse(saved);
        return this.customGroups;
      }
    } catch (e) {
      console.error('Failed to load custom template groups:', e);
    }

    this.customGroups = [];
    return this.customGroups;
  }

  /**
   * 保存自定义模版组到 localStorage
   */
  private static saveCustomGroups(groups: PromptTemplateGroup[]): void {
    this.customGroups = groups;
    localStorage.setItem(TEMPLATE_GROUPS_STORAGE_KEY, JSON.stringify(groups));
  }

  /**
   * 获取所有模版组（内置 + 自定义，自定义覆盖同 id 内置组）
   */
  static getAllGroups(): PromptTemplateGroup[] {
    const customGroups = this.loadCustomGroups();
    // 用 Map 实现自定义组覆盖内置组
    const groupMap = new Map<string, PromptTemplateGroup>();

    // 先添加内置组
    for (const group of BUILT_IN_TEMPLATE_GROUPS) {
      groupMap.set(group.id, group);
    }

    // 再用自定义组覆盖（同 id 会被替换）
    for (const group of customGroups) {
      groupMap.set(group.id, group);
    }

    return Array.from(groupMap.values());
  }

  /**
   * 根据 ID 获取模版组
   */
  static getGroupById(id: string): PromptTemplateGroup | undefined {
    return this.getAllGroups().find(g => g.id === id);
  }

  /**
   * 获取默认模版组
   */
  static getDefaultGroup(): PromptTemplateGroup {
    return getDefaultGroupFull();
  }

  /**
   * 根据项目上下文匹配最佳模版组
   * @param context 项目上下文（visualStyle, genre, globalSettings）
   * @returns 匹配的模版组，无匹配时返回 default 组
   */
  static matchGroup(context: ProjectTemplateContext): PromptTemplateGroup {
    const allGroups = this.getAllGroups();
    
    // 按 priority 降序排序
    const sortedGroups = [...allGroups].sort((a, b) => b.matchRules.priority - a.matchRules.priority);

    for (const group of sortedGroups) {
      if (this.isGroupMatch(group, context)) {
        return group;
      }
    }
    // 无匹配，返回 default 组
    return getDefaultGroupFull();
  }

  /**
   * 检查模版组是否匹配项目上下文
   */
  private static isGroupMatch(group: PromptTemplateGroup, context: ProjectTemplateContext): boolean {
    const rules = group.matchRules;
    // 如果没有任何匹配规则，则不匹配（除了 default 组）
    if (!rules.visualStyle && !rules.genre && !rules.globalSettings) {
      return group.id === 'default';
    }

    // 检查 visualStyle
    if (rules.visualStyle && rules.visualStyle.length > 0) {
      const matched = rules.visualStyle.some(keyword =>
        context.visualStyle?.toLowerCase().includes(keyword.toLowerCase())
      );
      if (!matched) return false;
    }

    // 检查 genre
    if (rules.genre && rules.genre.length > 0) {
      const matched = rules.genre.some(keyword =>
        context.genre?.toLowerCase().includes(keyword.toLowerCase())
      );
      if (!matched) return false;
    }

    // 检查 globalSettings（模糊匹配关键词）
    if (rules.globalSettings && rules.globalSettings.length > 0) {
      const matched = rules.globalSettings.some(keyword =>
        context.globalSettings?.toLowerCase().includes(keyword.toLowerCase())
      );
      if (!matched) return false;
    }

    return true;
  }

  /**
   * 解析某个模板 key 的最终内容
   * 解析顺序：当前组 → default 组 → PROMPT_TEMPLATES
   *
   * @param group 当前匹配的模版组
   * @param templateKey 模版 key（如 'GENERATE_CHARACTER_IMAGE'）
   * @returns 最终的模版内容
   */
  static resolveTemplate(group: PromptTemplateGroup, templateKey: string): string {
    const groupProp = TEMPLATE_KEY_TO_GROUP_PROP[templateKey];

    // 1. 尝试从当前组获取
    if (groupProp && group.templates[groupProp]) {
      return group.templates[groupProp]!;
    }

    // 2. 尝试从 default 组获取
    const defaultGroup = getDefaultGroupFull();
    if (group.id !== 'default' && defaultGroup.templates[groupProp!]) {
      return defaultGroup.templates[groupProp!]!;
    }

    // 3. 降级到 PROMPT_TEMPLATES
    const defaultTemplate = PROMPT_TEMPLATES[templateKey as keyof typeof PROMPT_TEMPLATES];
    if (typeof defaultTemplate === 'string') {
      return defaultTemplate;
    }

    return '';
  }

  /**
   * 检查模版 key 是否纳入模版组管理
   */
  static isGroupManagedTemplate(templateKey: string): boolean {
    return GROUP_MANAGED_TEMPLATE_KEYS.includes(templateKey as any);
  }

  /**
   * 组感知的 renderTemplate
   * 如果模版 key 纳入模版组管理，则使用模版组系统解析
   * 否则使用原有的 renderTemplate
   *
   * @param templateKey 模版 key
   * @param context 项目上下文（用于匹配模版组）
   * @param args 变量参数
   * @returns 渲染后的提示词
   */
  static renderGroupTemplate(
    templateKey: string,
    context: ProjectTemplateContext | null,
    ...args: any[]
  ): string {
    console.log('renderGroupTemplate', templateKey, context, args);
    // 如果不是模版组管理的模版，使用原有逻辑
    if (!this.isGroupManagedTemplate(templateKey)) {
      return renderTemplate(templateKey, ...args);
    }

    // 先检查是否有单模版级别的自定义（优先级最高）
    /*
    const customContent = getCustomTemplate(templateKey);
    if (customContent) {
      // 使用原有的变量提取和替换逻辑
      const variables = this.extractVariablesForGroupTemplate(templateKey, args);
      return this.replaceVariables(customContent, variables);
    }
    */
    // 匹配模版组
    const group = context ? this.matchGroup(context) : getDefaultGroupFull();
    console.log('use group', group);
    // 解析模版内容
    const templateContent = this.resolveTemplate(group, templateKey);

    if (!templateContent) {
      return '';
    }

    // 提取变量并替换
    const variables = this.extractVariablesForGroupTemplate(templateKey, args);
    return this.replaceVariables(templateContent, variables);
  }

  /**
   * 变量替换函数
   */
  private static replaceVariables(template: string, variables: Record<string, any>): string {
    let result = template;
    Object.entries(variables).forEach(([key, value]) => {
      // 处理简单变量替换 {key}
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value ?? ''));

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
  }

  /**
   * 为组模版提取变量
   * 复用 extractVariablesForTemplate 的逻辑
   */
  private static extractVariablesForGroupTemplate(key: string, args: any[]): Record<string, any> {
    // 复用原有的变量提取逻辑
    switch (key) {
      case 'GENERATE_CHARACTER_IMAGE':
        return {
          visualStyle: args[0] || '真人写实',
          prompt: args[1] || '',
          name: args[2] || '无',
          story: args[3] || '',
        };
      case 'GENERATE_SCENE_IMAGE':
        return {
          visualStyle: args[0] || '真人写实',
          prompt: args[1] || '',
          location: args[2] || '未知',
          time: args[3] || '无',
          atmosphere: args[4] || '无',
          story: args[5] || '',
        };
      case 'GENERATE_PROP_IMAGE':
        return {
          visualStyle: args[0] || '真人写实',
          prompt: args[1] || '',
          name: args[2] || '无',
          story: args[3] || '',
        };
      case 'GENERATE_CHARACTER_PROMPT':
        return {
          genre: args[0] || '剧情片',
          desc: args[1] || {},
          visualStyle: args[2] || '真人写实',
          story: args[3] || '',
        };
      case 'GENERATE_SCENE_PROMPT':
        return {
          genre: args[0] || '剧情片',
          desc: args[1] || {},
          visualStyle: args[2] || '真人写实',
          story: args[3] || '',
        };
      case 'GENERATE_PROP_PROMPT':
        return {
          genre: args[0] || '剧情片',
          desc: args[1] || {},
          visualStyle: args[2] || '真人写实',
        };
      case 'SYSTEM_CHARA_DESIGNER':
      case 'SYSTEM_SCENE_DESIGNER':
      case 'SYSTEM_PROP_DESIGNER':
      case 'SYSTEM_SEGMENT_DESIGNER':
        return {};
      case 'SYSTEM_SEGMENT_SPLIT':
        return {
          segmentDuration: args[0] || 15,
        };
      case 'GENERATE_SEGMENT_PROMPT':
        return {
          scriptText: args[0] || '',
          storyParagraphs: args[1] || '',
          shotDescriptions: args[2] || '',
          visualstyle: args[3] || '真人写实',
          genre: args[4] || '剧情片',
          segmentName: args[5] || '',
          segmentIndex: args[6] || 1,
          segmentDuration: args[7] || 15,
          videoRatio: args[8] || '16:9',
          story: args[9] || '',
          chars: args[10] || '',
          scenes: args[11] || '',
          props: args[12] || ''
        };
      case 'OPTIMIZE_SEGMENT_PROMPT':
        return {
          existingVideoPrompt: args[0] || '',
          segmentName: args[1] || '',
          segmentIndex: args[2] || 1,
          segmentDuration: args[3] || 15,
          videoRatio: args[4] || '16:9',
          visualstyle: args[5] || '真人写实',
          genre: args[6] || '剧情片',
          story: args[7] || '',
          scriptText: args[8] || '',
        };
      case 'GENERATE_SEGMENT_VIDEO_PROMPT':
        return {
          scenes: args[0] || '',
          segment: args[1] || '',
          transitionFrom: args[2] || '',
          transitionTo: args[3] || '',
          story: args[4] || '',
          visualStyle: args[5] || '真人写实',
        };
      default:
        return {};
    }
  }

  /**
   * 获取组内原始模版内容（用于编辑器）
   *
   * @param templateKey 模版 key（可以是 PROMPT_TEMPLATES 的 key 如 'GENERATE_CHARACTER_IMAGE'，
   *                    也可以是 GroupTemplates 的属性名如 'characterImage'）
   * @param group 模版组（可选，不传则使用 default）
   * @returns 原始模版内容
   */
  static getGroupTemplateRaw(templateKey: string, group?: PromptTemplateGroup): string {
    const targetGroup = group || getDefaultGroupFull();

    // 先尝试从 TEMPLATE_KEY_TO_GROUP_PROP 映射获取
    let groupProp = TEMPLATE_KEY_TO_GROUP_PROP[templateKey] as keyof GroupTemplates | undefined;

    // 如果映射不存在，检查是否传入的直接是 GroupTemplates 的属性名
    if (!groupProp) {
      if (groupTemplateKeys.includes(templateKey as keyof GroupTemplates)) {
        groupProp = templateKey as keyof GroupTemplates;
      }
    }

    if (groupProp && targetGroup.templates[groupProp]) {
      return targetGroup.templates[groupProp]!;
    }

    // 尝试从 default 组获取
    const defaultGroup = getDefaultGroupFull();
    if (targetGroup.id !== 'default' && defaultGroup.templates[groupProp!]) {
      return defaultGroup.templates[groupProp!]!;
    }

    // 降级到 PROMPT_TEMPLATES
    const defaultTemplate = PROMPT_TEMPLATES[templateKey as keyof typeof PROMPT_TEMPLATES];
    if (typeof defaultTemplate === 'string') {
      return defaultTemplate;
    }

    return '';
  }

  // ==================== CRUD 操作 ====================

  /**
   * 添加自定义模版组
   */
  static addCustomGroup(group: PromptTemplateGroup): void {
    const customGroups = this.loadCustomGroups();

    // 检查 ID 是否已存在
    if (this.getAllGroups().some(g => g.id === group.id)) {
      throw new Error(`模版组 ID "${group.id}" 已存在`);
    }

    customGroups.push({ ...group, isBuiltIn: false });
    this.saveCustomGroups(customGroups);
  }

  /**
   * 更新自定义模版组
   */
  static updateCustomGroup(group: PromptTemplateGroup): void {
    const customGroups = this.loadCustomGroups();
    const index = customGroups.findIndex(g => g.id === group.id);

    if (index >= 0) {
      customGroups[index] = { ...group, isBuiltIn: false };
      this.saveCustomGroups(customGroups);
    } else {
      // 如果是内置组，创建一个覆盖的自定义组
      if (BUILT_IN_TEMPLATE_GROUPS.some(g => g.id === group.id)) {
        customGroups.push({ ...group, isBuiltIn: false });
        this.saveCustomGroups(customGroups);
      }
    }
  }

  /**
   * 删除自定义模版组
   */
  static deleteCustomGroup(groupId: string): boolean {
    const customGroups = this.loadCustomGroups();
    const index = customGroups.findIndex(g => g.id === groupId);

    if (index >= 0) {
      customGroups.splice(index, 1);
      this.saveCustomGroups(customGroups);
      return true;
    }

    return false;
  }

  /**
   * 重置模版组到内置默认
   * 删除自定义覆盖
   */
  static resetGroup(groupId: string): void {
    const customGroups = this.loadCustomGroups();
    const filtered = customGroups.filter(g => g.id !== groupId);
    this.saveCustomGroups(filtered);
  }

  /**
   * 更新组内单个模版
   */
  static updateGroupTemplate(groupId: string, templateKey: string, content: string): void {
    const group = this.getGroupById(groupId);
    if (!group) return;

    // 尝试从映射获取 groupProp
    let groupProp = TEMPLATE_KEY_TO_GROUP_PROP[templateKey] as keyof GroupTemplates | undefined;

    // 如果映射不存在，检查是否传入的直接是 GroupTemplates 的属性名
    if (!groupProp) {
      if (groupTemplateKeys.includes(templateKey as keyof GroupTemplates)) {
        groupProp = templateKey as keyof GroupTemplates;
      }
    }

    if (!groupProp) return;

    // 如果是内置组，创建自定义覆盖
    if (group.isBuiltIn) {
      // 查找是否已有自定义覆盖
      const customGroups = this.loadCustomGroups();
      const existingIndex = customGroups.findIndex(g => g.id === groupId);

      if (existingIndex >= 0) {
        // 更新现有自定义组
        customGroups[existingIndex].templates[groupProp] = content;
      } else {
        // 创建新的自定义组覆盖
        const newCustomGroup: PromptTemplateGroup = {
          id: groupId,
          name: group.name,
          description: group.description,
          isBuiltIn: false,
          matchRules: { ...group.matchRules },
          templates: { [groupProp]: content },
        };
        customGroups.push(newCustomGroup);
      }

      this.saveCustomGroups(customGroups);
    } else {
      // 直接更新自定义组
      this.updateCustomGroup({
        ...group,
        templates: { ...group.templates, [groupProp]: content },
      });
    }
  }

  // ==================== 导入导出 ====================

  /**
   * 导出模版组
   */
  static exportGroups(): string {
    const customGroups = this.loadCustomGroups();
    const exportData = {
      version: 1,
      exportDate: new Date().toISOString(),
      groups: customGroups,
    };
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * 导入模版组
   */
  static importGroups(json: string): { success: boolean; imported: number; message: string } {
    try {
      const data = JSON.parse(json);

      if (!data.groups || !Array.isArray(data.groups)) {
        return { success: false, imported: 0, message: '无效的导入文件格式' };
      }

      const customGroups = this.loadCustomGroups();
      let imported = 0;

      for (const group of data.groups) {
        // 跳过内置组的 ID
        if (BUILT_IN_TEMPLATE_GROUPS.some(g => g.id === group.id)) {
          // 作为覆盖添加
          const existingIndex = customGroups.findIndex(g => g.id === group.id);
          if (existingIndex >= 0) {
            customGroups[existingIndex] = { ...group, isBuiltIn: false };
          } else {
            customGroups.push({ ...group, isBuiltIn: false });
          }
        } else {
          // 检查 ID 冲突
          const existingIndex = customGroups.findIndex(g => g.id === group.id);
          if (existingIndex >= 0) {
            customGroups[existingIndex] = { ...group, isBuiltIn: false };
          } else {
            customGroups.push({ ...group, isBuiltIn: false });
          }
        }
        imported++;
      }

      this.saveCustomGroups(customGroups);
      return { success: true, imported, message: `成功导入 ${imported} 个模版组` };
    } catch (e) {
      console.error('Import failed:', e);
      return { success: false, imported: 0, message: '导入失败：文件格式错误' };
    }
  }

  /**
   * 清除缓存（用于测试或强制刷新）
   */
  static clearCache(): void {
    this.customGroups = null;
  }
}

/**
 * 便捷函数：组感知的 renderTemplate
 * 可直接替换原有的 renderTemplate 调用
 */
export const renderGroupTemplate = TemplateGroupService.renderGroupTemplate.bind(TemplateGroupService);
