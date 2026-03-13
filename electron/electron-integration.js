/**
 * Electron 主进程集成示例
 * 
 * 在 Electron 主进程中使用此服务：
 * 
 * 1. 安装依赖：
 *    cd electron-server && npm install
 * 
 * 2. 在 main.js 中引入：
 */

// main.js 示例代码
/*
const { app, BrowserWindow } = require('electron');
const path = require('path');

// 引入服务
const { startServer } = require('./electron-server/src/index');

let mainWindow;

async function createWindow() {
  // 启动内置服务
  const server = startServer(8080);
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // 加载前端页面（可以是本地文件或远程URL）
  mainWindow.loadFile('index.html');
  // 或 mainWindow.loadURL('http://localhost:3000');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // 可以在这里优雅关闭服务器
});
*/

/**
 * API 接口列表
 * 
 * 文件上传 API (/api/file):
 * - POST   /upload           - 单文件上传
 * - POST   /upload/:path     - 单文件上传（指定路径）
 * - DELETE /delete?url=xxx   - 删除文件
 * - GET    /storage-type     - 获取存储类型
 * - POST   /extupload        - 第三方文件上传（URL或Base64）
 * 
 * 文件同步 API (/api/sync):
 * - POST   /init             - 初始化用户
 * - GET    /files            - 获取文件列表
 * - POST   /upload           - 上传文件（表单方式）
 * - POST   /upload/json      - 上传文件（JSON字符串方式）
 * - GET    /download         - 下载文件
 * - DELETE /delete           - 删除文件
 * 
 * TTS API (/api/text2audio):
 * - POST   /                 - 文本转语音
 * 
 * 其他:
 * - GET    /api/health       - 健康检查
 */

module.exports = { startServer };
