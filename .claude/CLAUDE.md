# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

请始终使用简体中文回答，技术术语保留英文但提供中文解释。

## 项目概述

**AI漫剧工场 (AI Motion Comic Studio)** — 工业级 AI 漫剧与视频生成工作台。采用 "Script-to-Asset-to-Keyframe" 工作流，通过深度集成多个大模型实现角色一致性、场景连续性和镜头运动控制。

## 常用命令

```bash
npm run dev            # 启动 Vite 开发服务器 (localhost:3000)
npm run build          # 构建生产版本
npm run preview        # 预览构建结果
npx tsc --noEmit       # TypeScript 类型检查

npm run dev:electron   # Electron + Vite 热重载开发
npm run build:electron # 打包 Electron 桌面应用

npm run build:pages    # 构建 Cloudflare Pages 版本
npm run build:gitlab   # 构建 GitLab Pages 版本
```

注意: 项目没有配置测试框架。

## 技术栈

- **框架**: React 19 + TypeScript
- **样式**: Tailwind CSS 4 (通过 @tailwindcss/vite 插件)
- **构建**: Vite 6 (vite.config.ts)，按模型提供商和 UI 库分包
- **存储**: IndexedDB (浏览器本地存储，无后端依赖)
- **桌面**: Electron
- **PWA**: vite-plugin-pwa (Service Worker)
- **UI 组件**: Radix UI (Accordion, Dialog, Select, Slider), Framer Motion, Lucide React
- **AI SDK**: @ai-sdk/openai, @ai-sdk/react, @google/genai

## 架构概览

### 四阶段工作流

| 阶段 | 组件 | 功能 |
|------|------|------|
| Phase 01 | StageScript | 剧本生成/导入、角色/场景管理、分镜清单自动生成 |
| Phase 02 | StageAssets | 角色定妆照生成、场景概念图、衣橱系统、道具管理 |
| Phase 03 | StageDirector | 导演工作台：关键帧制作、一键视频生成、批量制作 |
| Phase 04 | StageExport | 视频合并、批量导出、资源打包 |

另有 StageImage（图片管理）和 StageChat（AI 对话）两个辅助阶段。

### 服务层

`ModelService` (`src/services/modelService.ts`) 是核心外观类，所有 AI 操作通过它路由到动态加载的模型提供商模块：

```
ModelService (外观)
├── deepseekService.ts   (LLM)
├── doubaoService.ts     (LLM / 文生图 / 图生视频)
├── geminiService.ts     (LLM / 文生图 / 图生视频)
├── yunwuService.ts      (LLM / 文生图 / 图生视频)
├── openaiService.ts     (LLM / 文生图 / 图生视频)
├── minimaxService.ts    (图生视频)
├── klingService.ts      (图生视频)
├── soraService.ts       (图生视频)
├── wanService.ts        (图生视频)
├── bigmoreService.ts    (文生图 / 图生视频)
├── skyreelsService.ts   (图生视频)
├── nanobananaService.ts (文生图)
├── baiduTtsService.ts   (语音合成)
└── cozeService.ts       (Coze 工作流集成)

辅助服务
├── modelConfigService.ts  # AI 模型配置管理
├── storageService.ts      # IndexedDB 读写封装
├── llmLogService.ts       # LLM 调用日志
└── llmChatService.ts      # AI 对话
```

关键设计: 所有模型模块使用**动态 import 懒加载** (`await import("./modelproviders/...")`)，支持的提供商以插件形式存在，通过 `modelConfigService` 启用/切换。

### Prompt 模板系统

`src/prompt/` 目录包含结构化的提示词系统：
- `promptTemplates.ts` — 基础模板（剧本解析、镜头生成、视频提示词等）
- `groups/` — 按视觉风格分组的模板包（真人写实、2D日漫、国风、3D动画等）
- `templateGroupService.ts` — 根据当前选中的视觉风格渲染对应模板组

### 状态管理

**无外部状态库**，全部使用 React hooks (useState, useEffect, useRef)。项目状态 (`ProjectState`) 在 App.tsx 中管理，通过 props 下传到各 Stage 组件。自动保存通过 debounce 机制写入 IndexedDB。

### 数据模型

核心类型定义在 `src/types.ts`:
- `ProjectState` — 项目完整状态（剧本、镜头、片段、设置等）
- `ScriptData` — 结构化剧本数据（角色、场景、段落）
- `Shot` — 镜头（关键帧、对话、摄像运镜）
- `Segment` — 片段（视频分段，用于生成/合并）
- `SeriesRecord` — 连续剧模式（跨剧集共享角色库）
- `AIModelConfig` — AI 模型供应商配置（支持多个提供商并存）

### 关键目录结构

```
src/
├── App.tsx                  # 主应用，状态管理中心
├── types.ts                 # 全局类型定义
├── components/              # UI 组件
│   ├── Stage*.tsx           # 各阶段页面
│   ├── modals/              # 弹窗组件
│   ├── dialog/              # 通用对话框系统
│   ├── common/              # 公共组件
│   └── CutOSEditor/         # 视频编辑器组件
├── services/                # 服务层
├── prompt/                  # 提示词模板
│   ├── groups/              # 视觉风格分组模板
│   └── promptTemplates.ts   # 基础模板定义
├── utils/                   # 工具函数
├── lib/                     # 库代码
└── config/                  # 配置
electron/                    # Electron 桌面应用集成
```

## 构建输出

支持多个构建目标:
- `vite.config.ts` — 默认 PWA 构建
- `vite.config.pages.ts` — Cloudflare Pages
- `vite.config.cloudflare.ts` — Cloudflare Workers
- `vite.gitlab.ts` — GitLab Pages (CI 中使用)

## 环境变量

配置在 `.env` 文件中，通过 Vite 的 `loadEnv` 加载:
- `VOLCENGINE_API_KEY` — 火山引擎 API 密钥
- `OSS_UP_ENDPOINT` / `OSS_ACCESS_ENDPOINT` — 对象存储端点
- `HIDE_GITHUB` — 隐藏 GitHub 链接

## 注意事项

- 所有图片/视频资源通过 `fileUploadUtils.ts` 上传到本地文件服务器
- 项目中`@/` 路径别名指向 `src/` 目录
- 连续剧模式 (`SeriesRecord`) 允许多个项目共享角色场景库
- LLM 调用日志存储在 IndexedDB 的 `llmLogs` 表中
