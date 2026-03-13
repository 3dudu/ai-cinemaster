import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import fileRoutes from './routes/file.routes.js';
import syncRoutes from './routes/sync.routes.js';
import ttsRoutes from './routes/tts.routes.js';
import config from './config/default.json' assert { type: 'json' };

const app = express();

const PORT = config.server.port || 8080;
const API_PREFIX = config.server.apiPrefix || '/api';

app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

app.use(`${API_PREFIX}/files`, express.static(path.join(__dirname, '../upload')));

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