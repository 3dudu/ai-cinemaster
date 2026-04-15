/**
 * 提示词模版组类型定义
 * 元数据与模版内容分离，支持延迟加载
 */

import { TemplateGroupMatchRules, GroupTemplates } from '../types/promptTemplate';

/** 模版组元数据（轻量，用于匹配） */
export interface TemplateGroupMeta {
  id: string;
  name: string;
  description: string;
  isBuiltIn: boolean;
  matchRules: TemplateGroupMatchRules;
}

/** 完整的模版组（元数据 + 模版内容） */
export interface TemplateGroupFull extends TemplateGroupMeta {
  templates: GroupTemplates;
}

/** 模版加载器函数类型 */
export type TemplateLoader = () => GroupTemplates;

/** 已注册的模版组信息 */
export interface RegisteredGroup {
  meta: TemplateGroupMeta;
  loader: TemplateLoader;
  /** 已加载的模版缓存 */
  _templates?: GroupTemplates;
}
