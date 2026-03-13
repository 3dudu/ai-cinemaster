# Electron 集成指南

CineGen AI 现已支持 Electron，可以打包为桌面应用程序。

## 快速开始

### 开发模式

在开发模式下运行 Electron 应用（会自动启动 Vite 开发服务器）：

```bash
npm run dev:electron
```

这将：
1. 启动 Vite 开发服务器（http://localhost:3000）
2. 等待服务器准备就绪
3. 启动 Electron 应用窗口

### 构建桌面应用

打包应用为可执行文件：

```bash
npm run build:electron
```

这将：
1. 构建生产版本（Vite build）
2. 使用 electron-builder 创建桌面应用
3. 输出到 `electron-dist` 目录

## 平台支持

### Windows

- 目标格式：NSIS 安装程序
- 输出位置：`electron-dist/CineGen AI Setup X.X.X.exe`
- 图标：`assets/icon.ico`（需要提供）

### macOS

- 目标格式：DMG 镜像
- 输出位置：`electron-dist/CineGen AI-X.X.X.dmg`
- 图标：`assets/icon.icns`（需要提供）

### Linux

- 目标格式：AppImage
- 输出位置：`electron-dist/CineGen AI-X.X.X.AppImage`
- 图标：`assets/icon.png`（需要提供）

## 准备图标

在 `assets` 目录中放置以下图标文件：

### Windows
- 文件名：`icon.ico`
- 格式：ICO
- 推荐尺寸：256x256

### macOS
- 文件名：`icon.icns`
- 格式：ICNS
- 推荐尺寸：1024x1024
- 可以使用 `iconutil` 命令从 PNG 转换

### Linux
- 文件名：`icon.png`
- 格式：PNG
- 推荐尺寸：512x512

### 图标生成工具

推荐使用在线工具生成图标：
- [favicon.io](https://favicon.io/) - 支持多种格式
- [CloudConvert](https://cloudconvert.com/) - 格式转换
- [ImageMagick](https://imagemagick.org/) - 命令行工具

## 目录结构

```
CineGen-AI/
├── electron/
│   ├── main.js       # Electron 主进程
│   └── preload.js    # 预加载脚本
├── dist/            # Vite 构建输出
├── assets/          # 应用图标
│   ├── icon.ico     # Windows 图标
│   ├── icon.icns    # macOS 图标
│   └── icon.png     # Linux 图标
└── electron-dist/    # Electron 打包输出
```

## 主要功能

### 菜单栏

应用包含完整的菜单栏：

**文件菜单**
- 新建项目 (Ctrl/Cmd+N)
- 导入项目 (Ctrl/Cmd+O)
- 保存 (Ctrl/Cmd+S)
- 退出

**编辑菜单**
- 撤销/重做
- 剪切/复制/粘贴

**视图菜单**
- 重载/强制重载
- 开发者工具
- 缩放控制
- 全屏

**帮助菜单**
- 关于 CineGen AI

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| Ctrl/Cmd+N | 新建项目 |
| Ctrl/Cmd+O | 导入项目 |
| Ctrl/Cmd+S | 保存项目 |
| F12 | 开发者工具（仅开发模式） |
| Ctrl/Cmd+Q | 退出（仅 macOS） |

### 安全特性

- Context Isolation：启用，保护渲染进程
- Node Integration：禁用，防止直接访问 Node.js API
- Preload Script：通过 contextBridge 安全暴露必要的 API
- External Links：自动在系统浏览器中打开

## 与 Web 版本的差异

1. **本地数据存储**：Electron 应用使用 IndexedDB/LocalStorage，数据存储在本地
2. **文件访问**：Electron 可以访问本地文件系统（可通过 API 扩展）
3. **系统集成**：更好的系统集成（通知、托盘等）
4. **离线模式**：可以完全离线使用（除 AI 生成功能外）

## 开发提示

### 热重载

开发模式下，Vite 的热重载功能正常工作，Electron 窗口会自动更新。

### 调试

1. 按 `F12` 打开开发者工具
2. 在开发模式下，开发者工具默认打开
3. 可以使用 Chrome DevTools 进行调试

### 主进程调试

要调试主进程（Electron 进程），在终端中：

```bash
# Linux/macOS
DEBUG=* npm run dev:electron

# Windows
set DEBUG=* && npm run dev:electron
```

## 故障排除

### "Application is already running"

确保没有其他 Electron 实例在运行。在 Linux/macOS 上，检查进程：

```bash
ps aux | grep electron
```

### 端口冲突

如果 3000 端口被占用，修改 `vite.config.ts` 中的端口设置。

### 打包失败

1. 检查 Node.js 版本（推荐 16+）
2. 清理 node_modules 并重新安装：`rm -rf node_modules && npm install`
3. 确保 electron-dist 目录不在使用中

## 发布

打包完成后，`electron-dist` 目录包含可分发的安装文件：

- **Windows**: `CineGen AI Setup X.X.X.exe`
- **macOS**: `CineGen AI-X.X.X.dmg`
- **Linux**: `CineGen AI-X.X.X.AppImage`

用户可以直接运行这些文件来安装应用。

## 自动更新（可选）

如需添加自动更新功能，可以使用 `electron-updater`：

```bash
npm install electron-updater
```

在 `main.js` 中配置更新检查逻辑。

## 更多资源

- [Electron 官方文档](https://www.electronjs.org/docs)
- [electron-builder 文档](https://www.electron.build/)
- [Electron + Vite 指南](https://electron-vite.github.io/)

## 许可证

Electron 集成遵循项目的 MIT 许可证。
