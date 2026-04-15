/**
 * 模版组注册表
 * 管理元数据注册和模版延迟加载
 */

import type { TemplateGroupMeta, TemplateLoader, RegisteredGroup, TemplateGroupFull } from './types';

/** 所有已注册的模版组 */
const registeredGroups = new Map<string, RegisteredGroup>();

/**
 * 注册一个模版组
 */
export function registerGroup(meta: TemplateGroupMeta, loader: TemplateLoader): void {
  if (registeredGroups.has(meta.id)) {
    console.warn(`[TemplateRegistry] Group "${meta.id}" already registered, overwriting`);
  }
  registeredGroups.set(meta.id, { meta, loader });
}

/**
 * 获取所有已注册的元数据（轻量，同步加载）
 */
export function getAllGroupMeta(): TemplateGroupMeta[] {
  return Array.from(registeredGroups.values()).map(g => g.meta);
}

/**
 * 获取指定 ID 的元数据
 */
export function getGroupMetaById(id: string): TemplateGroupMeta | undefined {
  return registeredGroups.get(id)?.meta;
}

/**
 * 获取完整的模版组（延迟加载模版内容）
 */
export function getGroupFull(id: string): TemplateGroupFull | undefined {
  const registered = registeredGroups.get(id);
  if (!registered) return undefined;

  // 延迟加载模版内容
  if (!registered._templates) {
    registered._templates = registered.loader();
  }

  return {
    ...registered.meta,
    templates: registered._templates,
  };
}

/**
 * 获取所有完整的模版组（触发所有延迟加载）
 */
export function getAllGroupsFull(): TemplateGroupFull[] {
  return Array.from(registeredGroups.keys()).map(id => getGroupFull(id)!);
}

/**
 * 获取默认组 ID
 */
export function getDefaultGroupId(): string {
  return 'default';
}

/**
 * 获取默认组元数据
 */
export function getDefaultGroupMeta(): TemplateGroupMeta {
  const meta = getGroupMetaById(getDefaultGroupId());
  if (!meta) {
    throw new Error('[TemplateRegistry] Default group not registered');
  }
  return meta;
}

/**
 * 获取默认组完整数据
 */
export function getDefaultGroupFull(): TemplateGroupFull {
  const group = getGroupFull(getDefaultGroupId());
  if (!group) {
    throw new Error('[TemplateRegistry] Default group not registered');
  }
  return group;
}

/**
 * 获取所有内置组 ID 列表
 */
export function getBuiltInGroupIds(): string[] {
  return Array.from(registeredGroups.values())
    .filter(g => g.meta.isBuiltIn)
    .map(g => g.meta.id);
}

/** 内置组元数据列表（便于导入使用） */
export const BUILT_IN_GROUP_META: TemplateGroupMeta[] = [];
