/**
 * 提示词模版组统一入口
 * 支持元数据同步加载，模版内容延迟加载
 */

// 导入所有组文件（触发注册）
import './groups/default';
import './groups/realistic';
import './groups/ancient-chinese';
import './groups/3d-animation';

// 导出类型
export type { TemplateGroupMeta, TemplateGroupFull, TemplateLoader, RegisteredGroup } from './types';

// 导出注册表函数
export {
  registerGroup,
  getAllGroupMeta,
  getGroupMetaById,
  getGroupFull,
  getAllGroupsFull,
  getDefaultGroupId,
  getDefaultGroupMeta,
  getDefaultGroupFull,
  getBuiltInGroupIds,
  BUILT_IN_GROUP_META,
} from './registry';

// 兼容旧 API：导出 BUILT_IN_TEMPLATE_GROUPS（延迟加载所有组）
import { getAllGroupsFull } from './registry';
import type { PromptTemplateGroup } from '../types/promptTemplate';

export const BUILT_IN_TEMPLATE_GROUPS: PromptTemplateGroup[] = new Proxy([] as PromptTemplateGroup[], {
  get(target, prop) {
    // 首次访问时触发延迟加载
    if (target.length === 0) {
      const groups = getAllGroupsFull();
      target.push(...groups);
    }
    return Reflect.get(target, prop);
  },
});
