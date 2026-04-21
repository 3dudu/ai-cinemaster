import express from 'express';
import { getDouyinDownloadService } from '../services/douyinDownload.service.js';

const router = express.Router();
const douyinService = getDouyinDownloadService();

/**
 * POST /api/douyin/parse
 * 解析抖音视频链接，返回视频信息（不下载）
 */
router.post('/parse', async (req, res, next) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        code: 400,
        message: '缺少 url 参数',
        data: null
      });
    }

    const result = await douyinService.parseVideoInfo(url);

    res.json({
      code: 200,
      message: '解析成功',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/douyin/download
 * 解析并下载抖音视频
 */
router.post('/download', async (req, res, next) => {
  try {
    const { url, fileName } = req.body;

    if (!url) {
      return res.status(400).json({
        code: 400,
        message: '缺少 url 参数',
        data: null
      });
    }

    // 使用 SSE 流式推送进度
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');

    // 进度回调
    const progressCallback = (percent) => {
      res.write(JSON.stringify({
        type: 'progress',
        data: { percent }
      }) + '\n');
    };

    try {
      const result = await douyinService.downloadDouyinVideo(url, fileName, progressCallback);

      res.write(JSON.stringify({
        type: 'complete',
        data: result
      }) + '\n');
      res.end();
    } catch (error) {
      res.write(JSON.stringify({
        type: 'error',
        message: error.message
      }) + '\n');
      res.end();
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/douyin/upload-volcengine
 * 上传本地文件到火山引擎 ARK
 * body: { fileUrl: string, apiKey: string, purpose?: string }
 */
router.post('/upload-volcengine', async (req, res, next) => {
  try {
    const { fileUrl, apiKey, purpose } = req.body;

    if (!fileUrl) {
      return res.status(400).json({
        code: 400,
        message: '缺少 fileUrl 参数',
        data: null
      });
    }

    if (!apiKey) {
      return res.status(400).json({
        code: 400,
        message: '缺少 apiKey 参数',
        data: null
      });
    }

    // 设置 SSE 用于大文件上传进度
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');

    res.write(JSON.stringify({
      type: 'progress',
      data: { percent: 0, message: '开始上传...' }
    }) + '\n');

    try {
      const result = await douyinService.uploadFileToVolcEngine(
        fileUrl,
        apiKey,
        purpose || 'user_data'
      );

      res.write(JSON.stringify({
        type: 'complete',
        data: result
      }) + '\n');
      res.end();
    } catch (error) {
      res.write(JSON.stringify({
        type: 'error',
        message: error.message
      }) + '\n');
      res.end();
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/douyin/process
 * 一站式处理抖音视频：解析 → 下载 → 上传到火山引擎
 * 使用标准 SSE (text/event-stream) 格式
 * body: { url: string, apiKey: string }
 */
router.post('/process', async (req, res, next) => {
  try {
    const { url, apiKey } = req.body;
    if (!url) {
      return res.status(400).json({
        code: 400,
        message: '缺少 url 参数'
      });
    }

    if (!apiKey) {
      return res.status(400).json({
        code: 400,
        message: '缺少 apiKey 参数'
      });
    }

    // 设置标准 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // 发送进度事件的辅助函数
    const sendEvent = (type, data) => {
      res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
    };

    try {
      const result = await douyinService.processDouyinVideo(url, apiKey, (progress) => {
        sendEvent('progress', progress);
      });

      // 发送完成事件
      sendEvent('ready', {
        fileId: result.fileId,
        fileName: result.fileName,
        fileSize: result.fileSize
      });

      res.end();
    } catch (error) {
      sendEvent('error', { message: error.message });
      res.end();
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/douyin/check
 * 检查服务是否正常
 */
router.get('/check', (req, res) => {
  res.json({
    code: 200,
    message: 'Douyin service is running',
    data: {
      status: 'ok',
      timestamp: Date.now()
    }
  });
});

export default router;
