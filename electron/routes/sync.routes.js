import express from 'express';
import multer from 'multer';
import { resultMiddleware } from '../middleware/result.js';
import { getSyncService } from '../services/sync.service.js';

const router = express.Router();
router.use(resultMiddleware);

// 配置 multer
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }
});

/**
 * 初始化用户
 * POST /sync/init
 */
router.post('/init', (req, res) => {
  try {
    const { syncKey } = req.query;
    const syncService = getSyncService();
    const resultKey = syncService.initUser(syncKey);
    res.success(resultKey, '用户初始化成功');
  } catch (error) {
    console.error('用户初始化失败:', error);
    res.error(error.message);
  }
});

/**
 * 获取服务器文件列表
 * GET /sync/files
 */
router.get('/files', (req, res) => {
  try {
    const { syncKey } = req.query;
    const syncService = getSyncService();
    const fileList = syncService.getFileList(syncKey);
    res.success(fileList, '获取文件列表成功');
  } catch (error) {
    console.error('获取文件列表失败:', error);
    res.error(error.message);
  }
});

/**
 * 上传文件（表单方式）
 * POST /sync/upload
 */
router.post('/upload', upload.single('file'), (req, res) => {
  try {
    const { syncKey, fileName } = req.query;
    
    if (!req.file) {
      return res.error('上传文件不能为空');
    }

    const syncService = getSyncService();
    const success = syncService.uploadFile(syncKey, fileName, req.file.buffer);
    res.success(success, '文件上传成功');
  } catch (error) {
    console.error('文件上传失败:', error);
    res.error(error.message);
  }
});

/**
 * 上传文件（JSON字符串方式）
 * POST /sync/upload/json
 */
router.post('/upload/json', express.text({ type: '*/*' }), (req, res) => {
  try {
    const { syncKey, fileName } = req.query;
    let jsonContent = req.body;

    // 如果jsonContent是对象，转换为字符串
    if (typeof jsonContent === 'object') {
      jsonContent = JSON.stringify(jsonContent);
    }

    const syncService = getSyncService();
    const success = syncService.uploadFileJson(syncKey, fileName, jsonContent);
    res.success(success, '文件上传成功');
  } catch (error) {
    console.error('文件上传失败:', error);
    res.error(error.message);
  }
});

/**
 * 下载文件
 * GET /sync/download
 */
router.get('/download', (req, res) => {
  try {
    const { syncKey, fileName } = req.query;
    const syncService = getSyncService();
    const content = syncService.downloadFile(syncKey, fileName);
    res.success(content, '文件下载成功');
  } catch (error) {
    console.error('文件下载失败:', error);
    res.error(error.message);
  }
});

/**
 * 删除文件
 * DELETE /sync/delete
 */
router.delete('/delete', (req, res) => {
  try {
    const { syncKey, fileName } = req.query;
    const syncService = getSyncService();
    const success = syncService.deleteFile(syncKey, fileName);
    res.success(success, '文件删除成功');
  } catch (error) {
    console.error('文件删除失败:', error);
    res.error(error.message);
  }
});

export default router;