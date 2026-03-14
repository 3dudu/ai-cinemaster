import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import fileRoutes from './routes/file.routes.js';
import syncRoutes from './routes/sync.routes.js';
import ttsRoutes from './routes/tts.routes.js';
const config = JSON.parse(readFileSync(path.join(__dirname, './config/default.json'), 'utf-8'));

/**
 * 获取静态文件目录
 * 优先使用 Electron userData 目录，解决 macOS 权限问题
 */
function getStaticFilesDir() {
  if (process.env.ELECTRON_USER_DATA_PATH) {
    return path.join(process.env.ELECTRON_USER_DATA_PATH, 'upload');
  }
  return path.join(__dirname, '../upload');
}

const app = express();

const PORT = config.server.port || 8080;
const API_PREFIX = config.server.apiPrefix || '/api';

app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

const staticFilesDir = getStaticFilesDir();
console.log('[Express] 静态文件目录:', staticFilesDir);
app.use(`${API_PREFIX}/files`, express.static(staticFilesDir));

app.use(`${API_PREFIX}/file`, fileRoutes);
app.use(`${API_PREFIX}/sync`, syncRoutes);
app.use(`${API_PREFIX}/text2audio`, ttsRoutes);

app.get(`${API_PREFIX}/health`, (req, res) => {
  res.json({
    status: 'UP',
    timestamp: Date.now()
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    code: 500,
    message: err.message || '服务器内部错误',
    data: null,
    timestamp: Date.now()
  });
});

function startServer(port) {
  const serverPort = port || PORT;
  const server = app.listen(serverPort, () => {
    console.log(`Server running on port ${serverPort}`);
    console.log(`API prefix: ${API_PREFIX}`);
  });
  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}

export { app, startServer };