# Application Icons

此目录用于存放 Electron 桌面应用的图标文件。

## 所需图标文件

### Windows (icon.ico)
- 格式: ICO
- 推荐尺寸: 256x256 或更大
- 文件名: `icon.ico`

### macOS (icon.icns)
- 格式: ICNS
- 推荐尺寸: 1024x1024
- 文件名: `icon.icns`
- 可以使用 macOS 的 `iconutil` 命令从 PNG 转换

### Linux (icon.png)
- 格式: PNG
- 推荐尺寸: 512x512
- 文件名: `icon.png`

## 图标生成工具

推荐使用以下工具生成图标：

1. **在线工具**
   - [favicon.io](https://favicon.io/) - 支持多种格式
   - [CloudConvert](https://cloudconvert.com/) - 格式转换

2. **命令行工具**
   - ImageMagick: `convert icon.png -define icon:auto-resize=256,48,32,16 icon.ico`

3. **设计工具**
   - Adobe Illustrator/Photoshop
   - Sketch (macOS)
   - Figma (可以导出 PNG，然后使用在线工具转换)

## 暂时没有图标？

如果暂时没有准备图标，可以：
1. 注释掉 `package.json` 中 `build` 配置的 `icon` 字段
2. Electron 将使用默认图标
3. 发布前准备好自定义图标以提升应用外观
