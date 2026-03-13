const express = require('express');
const cors = require('cors');
const path = require('path');

// 路由
const fileRoutes = require('./routes/file.routes');
const syncRoutes = require('./routes/sync.routes');
const ttsRoutes = require('./routes/tts.routes');

const app = express();

// 配置
const config = require('../config/default.json');
const PORT = config.server.port || 8080;
const API_PREFIX = config.server.apiPrefix || '/api';

// 中间件
app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// 静态文件服务（本地存储时使用）
app.use(`${API_PREFIX}/files`, express.static(path.join(__dirname, '../upload')));

// 注册路由
app.use(`${API_PREFIX}/file`, fileRoutes);
app.use(`${API_PREFIX}/sync`, syncRoutes);
app.use(`${API_PREFIX}/text2audio`, ttsRoutes);

// 健康检查
app.get(`${API_PREFIX}/health`, (req, res) => {
  res.json({
    status: 'UP',
    timestamp: Date.now()
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    code: 500,
    message: err.message || '服务器内部错误',
    data: null,
    timestamp: Date.now()
  });
});

/**
 * 启动服务器
 * @param {number} port - 端口号
 * @returns {http.Server} - HTTP 服务器实例
 */
function startServer(port) {
  const serverPort = port || PORT;
  const server = app.listen(serverPort, () => {
    console.log(`Server running on port ${serverPort}`);
    console.log(`API prefix: ${API_PREFIX}`);
  });
  return server;
}

// 如果直接运行此文件，启动服务器
if (require.main === module) {
  startServer();
}

// 导出 app 和 startServer 供 Electron 集成使用
module.exports = { app, startServer };
