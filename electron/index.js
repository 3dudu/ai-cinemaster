import cors from 'cors';
import express from 'express';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import cutosRoutes from './routes/cutos.routes.js';
import douyinRoutes from './routes/douyin.routes.js';
import fileRoutes from './routes/file.routes.js';
import syncRoutes from './routes/sync.routes.js';
import ttsRoutes from './routes/tts.routes.js';
const config = JSON.parse(readFileSync(path.join(__dirname, './config/default.json'), 'utf-8'));

const app = express();

const PORT = config.server.port || 8080;
const API_PREFIX = config.server.apiPrefix || '/api';

app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

app.use(`${API_PREFIX}/file`, fileRoutes);
app.use(`${API_PREFIX}/sync`, syncRoutes);
app.use(`${API_PREFIX}/text2audio`, ttsRoutes);
app.use(`${API_PREFIX}/cutos`, cutosRoutes);
app.use(`${API_PREFIX}/douyin`, douyinRoutes);

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

function startServer(port, staticFilesDir) {
  const serverPort = port || PORT;
  console.log('[Express] 静态文件目录:', staticFilesDir);
  app.use(`${API_PREFIX}/files`, express.static(staticFilesDir));
  const server = app.listen(serverPort, () => {
    console.log(`Server running on port ${serverPort}`);
    console.log(`API prefix: ${API_PREFIX}`);
  });
  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const uploadDir = path.resolve(__dirname, '../upload');
  startServer(PORT,uploadDir);
}

export { app, startServer };
