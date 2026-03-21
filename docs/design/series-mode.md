# ManDirector-AI 剧集模式（Series）设计 - 最小侵入方案

作者: 2号虾（方案与任务拆解）  
分支: feature/series-mode

## 1. 目标与约束
- 在最小侵入现有单集 ProjectState 的前提下，新增“多剧集/连续剧”能力。
- 老数据零破坏；原有单集工程打开后无感可用。
- 保持现有模型、渲染与导出逻辑尽量不动（通过适配层承接差异）。

## 2. 总体方案（Series 扩展 + 适配层）
- 不直接重构现有 ProjectState；在根状态增加可选 `series` 扩展块。
- 每一集的数据继续沿用“单集 ProjectState”结构（记作 `episodes[epId].data`）。
- 新增适配层 selectors/services：统一用 `getActiveProjectState`/`setActiveProjectState` 访问/写入当前剧集数据，避免组件大面积改动。
- 首次迁移：老项目生成 E01（第 1 集），把原顶层 ProjectState 作为 E01.data；设置 `series.enabled=true`，`currentEpisodeId=E01`。

## 3. 数据结构（关键片段）
```ts
// 仅新增/扩展，原 ProjectState 不改
export interface EpisodeMeta {
  id: string;           // "E01"
  title: string;        // "第1集"
  order: number;        // 排序
  status?: draft|ready|locked;
  configOverride?: Partial<ProjectConfig>; // 可选：剧集对项目级配置的覆写（先留接口）
  createdAt: number;
  updatedAt: number;
}

export interface SeriesLibrary {
  roles: Record<string, Role>;
  roleOrder: string[];
  scenes: Record<string, Scene>;
  sceneOrder: string[];
}

export interface SeriesExt {
  enabled: boolean;
  currentEpisodeId?: string;
  episodeOrder: string[];
  episodes: Record<string, { meta: EpisodeMeta; data: ProjectState }>; // data 复用单集结构
  library: SeriesLibrary; // 全剧共享：角色与场景
  version: 1;
}

// 根：保留原 ProjectState，仅新增可选 series 扩展
export type RootState = ProjectState & { series?: SeriesExt };
```

备注：短期内不做 IndexedDB 拆表；若工程体量增长，再将 `episodes.*.data` 拆为独立 store（向下兼容迁移）。

## 4. 共享库（角色/场景）与 Episode 引用
- 在 `series.library` 维护全剧共享的 `roles` 与 `scenes`，并记录顺序数组。
- Episode 侧保留本地 roles/scenes（兼容）；条目可选择用 `refId` 指向共享库，或保留“仅本地”。
- 写入策略：
  - 从共享库选择 → Episode 仅存 `{ refId }`（或在现有条目上增加 `refId` 字段）。
  - 从 Episode 新建 → 默认写入共享库并回填 `refId`（也支持仅本地/后续提升为共享）。
  - 编辑共享库条目 → 所有引用剧集即时生效。

## 5. 适配层（selectors/services）
- `getActiveProjectState(root)`: `series.enabled ? series.episodes[currentId].data : root`
- `setActiveProjectState(root, updater)`: 写入当前集 `data` 或单集 `root`
- `getEffectiveRoles(root, episodeId)`: 优先解析 `refId` 指向共享库；否则回退到本地条目
- `getEffectiveScenes(root, episodeId)`: 同上
- `getEffectiveConfig(root, episodeId)`: `projectConfig` 与 `meta.configOverride` 浅合并（第二阶段启用）

## 6. IndexedDB 存储与迁移
- 存储：继续使用现有 store/key；新增字段均落在同一记录内。
- 迁移（打开旧工程时执行一次）：
  1) 若 `series` 不存在：创建 `series.enabled=true`，生成 E01 元数据。
  2) 迁移旧顶层 ProjectState → `episodes.E01.data`。
  3) 扫描 E01 的 `roles/scenes`，按“名称+关键字段哈希”提升到共享库，Episode 内条目尽量建立 `refId`，匹配不到的保留为本地。

## 7. UI/交互改动（小步落地）
- “剧集管理器”（侧栏）：列表/新建空白集/重命名/切换当前集（M1），复制/删除/拖拽排序（M2）。
- “共享库”面板：角色与场景的增删改查与引用选择（M2）。
- 顶栏（可选）：当前剧集信息、启用/停用剧集模式开关。

## 8. 里程碑拆解
- M1 基础剧集（1 人日）：类型与适配层；迁移（单集→E01）；剧集列表+切换+新建+重命名；持久化改造。
- M2 管理与共享库（0.5-1 人日）：复制/删除/排序；library CRUD 与 Episode 引用；冲突提示。
- M3 可选（0.5-1 人日）：配置覆写；批量提升/替换共享引用；覆盖率统计。

## 9. 验收标准
- 老工程导入后不丢数据，E01 呈现与原单集等价；
- 切换剧集数据不串；共享库编辑能全局生效；
- 刷新后剧集/共享库/引用状态持久；
- 单元测试覆盖迁移与选择器核心逻辑（≥80%）。

## 10. 风险与对策
- 体量过大：后续拆表迁移（保留向下兼容）。
- 历史数据不一致：迁移时宽容解析 + 冲突提示；允许人工合并。
- UI 侵入：通过适配层收口，避免组件大改。
