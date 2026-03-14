import { app, BrowserWindow, Menu, shell, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { startServer } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// 设置 Electron userData 路径到环境变量，供文件存储服务使用
// 这解决了 macOS 上的存储权限问题
process.env.ELECTRON_USER_DATA_PATH = app.getPath('userData');

// 获取用户配置文件路径
function getConfigPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

// 获取用户自定义存储目录
function getCustomStoragePath() {
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return config.customStoragePath || null;
    } catch (e) {
      return null;
    }
  }
  return null;
}

// 保存用户自定义存储目录
function saveCustomStoragePath(customPath) {
  const configPath = getConfigPath();
  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (e) {
      config = {};
    }
  }
  config.customStoragePath = customPath;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  process.env.CUSTOM_STORAGE_PATH = customPath;
}

let mainWindow;

function createWindow() {
  const server = startServer(8080);
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false,
      allowRunningInsecureContent: true
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    webSecurity: false,
    show: false
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    if (__dirname.includes('app.asar')) {
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    } else {
      mainWindow.loadFile(path.join(process.cwd(), 'dist/index.html'));
    }
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '新建项目',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow?.webContents.send('new-project');
          }
        },
        {
          label: '导入项目',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow?.webContents.send('import-project');
          }
        },
        { type: 'separator' },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow?.webContents.send('save-project');
          }
        },
        { type: 'separator' },
        {
          label: '设置存储目录...',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openDirectory'],
              title: '选择文件存储目录'
            });
            if (!result.canceled && result.filePaths.length > 0) {
              saveCustomStoragePath(result.filePaths[0]);
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: '设置成功',
                message: `存储目录已设置为：\n${result.filePaths[0]}\n\n应用重启后将生效。`
              });
            }
          }
        },
        { type: 'separator' },
        { label: '退出', role: 'quit' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', role: 'cut' },
        { label: '复制', role: 'copy' },
        { label: '粘贴', role: 'paste' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { label: '重载', role: 'reload' },
        { label: '强制重载', role: 'forceReload' },
        { label: '开发者工具', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: '实际大小', role: 'resetZoom' },
        { label: '放大', role: 'zoomIn' },
        { label: '缩小', role: 'zoomOut' },
        { type: 'separator' },
        { label: '全屏', role: 'togglefullscreen' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于 CineGen AI',
          click: () => {
            shell.openExternal('https://github.com/your-repo/cinegen-ai');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  // 加载用户自定义存储目录
  const customPath = getCustomStoragePath();
  if (customPath) {
    process.env.CUSTOM_STORAGE_PATH = customPath;
  }
  
  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});