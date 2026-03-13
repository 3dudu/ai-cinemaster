# Electron 快速开始指南

## 1. 安装 Electron 依赖

首先需要安装 Electron 相关的开发依赖：

```bash
npm install electron electron-builder concurrently wait-on electron-is-dev --save-dev
```

## 2. 准备应用图标（可选但推荐）

在项目根目录创建 `assets` 文件夹，并添加以下图标文件：

### Windows 图标
```bash
assets/icon.ico  # 256x256 或更大
```

### macOS 图标
```bash
assets/icon.icns  # 1024x1024
```

### Linux 图标
```bash
assets/icon.png  # 512x512
```

**提示**：如果没有图标，打包时会使用默认图标，但建议准备自定义图标以提升应用外观。

## 3. 开发模式运行

启动 Electron 开发环境（支持热重载）：

```bash
npm run dev:electron
```

这会：
- 启动 Vite 开发服务器（http://localhost:3000）
- 自动打开 Electron 应用窗口
- 支持代码热更新

## 4. 构建桌面应用

打包为可分发的桌面应用：

```bash
npm run build:electron
```

构建产物会输出到 `electron-dist` 目录：
- Windows: `CineGen AI Setup 0.0.0.exe`
- macOS: `CineGen AI-0.0.0.dmg`
- Linux: `CineGen AI-0.0.0.AppImage`

## 5. 分发应用

将 `electron-dist` 目录中的安装文件分发给用户即可。

## 常见问题

### Q: 如何在没有图标的情况下快速测试？

A: 创建一个临时图标文件，或者注释掉 `package.json` 中 electron-builder 配置的 icon 字段。

### Q: 开发模式下页面显示不正常？

A: 确保端口 3000 没有被占用。如有必要，修改 `vite.config.ts` 中的端口配置。

### Q: 打包失败怎么办？

A: 尝试以下步骤：
```bash
# 清理并重新安装依赖
rm -rf node_modules package-lock.json
npm install

# 清理构建输出
rm -rf dist electron-dist
```

### Q: 如何修改应用名称和版本？

A: 在 `package.json` 中修改：
- `name`: 应用内部名称（com.cinegen.ai）
- `productName`: 显示名称（CineGen AI）
- `version`: 版本号（0.0.0）

## 下一步

详细文档请参考 [ELECTRON.md](./ELECTRON.md)
