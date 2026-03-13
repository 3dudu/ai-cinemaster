const express = require('express');
const multer = require('multer');
const axios = require('axios');
const { resultMiddleware } = require('../middleware/result');
const { getFileStorageService } = require('../services/fileStorage.service');

const router = express.Router();
router.use(resultMiddleware);

// 配置 multer 用于内存存储
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB
});

/**
 * 单文件上传
 * POST /file/upload
 */
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.error('上传文件不能为空');
  }

  try {
    const service = getFileStorageService();
    const url = service.upload(req.file);

    const data = {
      url: url,
      filename: req.file.originalname,
      size: String(req.file.size),
      contentType: req.file.mimetype
    };

    console.log(`文件上传成功：${url}`);
    res.success(data, '上传成功');
  } catch (error) {
    console.error('文件上传失败:', error);
    res.error('上传失败：' + error.message);
  }
});

/**
 * 单文件上传（指定路径）
 * POST /file/upload/:path
 */
router.post('/upload/:path', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.error('上传文件不能为空');
  }

  try {
    const service = getFileStorageService();
    const customPath = req.params.path;
    const url = service.upload(req.file, customPath);

    const data = {
      url: url,
      filename: req.file.originalname,
      size: String(req.file.size),
      contentType: req.file.mimetype
    };

    console.log(`文件上传成功：${url}`);
    res.success(data, '上传成功');
  } catch (error) {
    console.error('文件上传失败:', error);
    res.error('上传失败：' + error.message);
  }
});

/**
 * 删除文件
 * DELETE /file/delete
 */
router.delete('/delete', (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.error('URL 参数不能为空');
    }

    const service = getFileStorageService();
    service.delete(url);

    console.log(`文件删除成功：${url}`);
    res.success(null, '删除成功');
  } catch (error) {
    console.error('文件删除失败:', error);
    res.error('删除失败：' + error.message);
  }
});

/**
 * 获取当前存储类型
 * GET /file/storage-type
 */
router.get('/storage-type', (req, res) => {
  const service = getFileStorageService();
  res.success({ type: service.getStorageType() });
});

/**
 * 第三方文件上传接口
 * POST /file/extupload
 */
router.post('/extupload', async (req, res) => {
  const { fileType, fileUrl, fileBase64, fileName } = req.body;

  // 验证至少提供了URL或Base64中的一种
  if ((!fileUrl || fileUrl.trim() === '') && (!fileBase64 || fileBase64.trim() === '')) {
    return res.error('必须提供文件URL或Base64编码中的至少一种', 400);
  }

  // 验证通过Base64上传时必须提供文件名
  if (fileBase64 && fileBase64.trim() && (!fileName || fileName.trim() === '')) {
    return res.error('通过Base64上传时必须提供文件名', 400);
  }

  try {
    let fileBytes;
    let originalFileName;

    if (fileUrl && fileUrl.trim()) {
      // 从URL下载文件
      fileBytes = await downloadFileFromUrl(fileUrl);
      originalFileName = getFileNameFromUrl(fileUrl);
    } else {
      // 从Base64解码文件
      fileBytes = Buffer.from(fileBase64, 'base64');
      originalFileName = fileName;
    }

    // 构造文件对象
    const file = {
      buffer: fileBytes,
      originalname: originalFileName,
      mimetype: getContentType(originalFileName),
      size: fileBytes.length
    };

    const filePath = generateFilePath(fileType);
    const service = getFileStorageService();
    const fileUrlResult = service.upload(file, filePath);

    const result = {
      fileUrl: fileUrlResult,
      fileName: originalFileName,
      fileSize: fileBytes.length,
      fileType: fileType
    };

    res.success(result);
  } catch (error) {
    console.error('第三方文件上传失败:', error);
    res.error('文件上传失败: ' + error.message, 500);
  }
});

/**
 * 从URL下载文件
 */
async function downloadFileFromUrl(url) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  return Buffer.from(response.data);
}

/**
 * 从URL中提取文件名
 */
function getFileNameFromUrl(url) {
  const parts = url.split('/');
  let fileName = parts[parts.length - 1];
  
  // 如果URL包含查询参数，去除它们
  const queryIndex = fileName.indexOf('?');
  if (queryIndex !== -1) {
    fileName = fileName.substring(0, queryIndex);
  }
  
  return fileName;
}

/**
 * 生成文件路径
 */
function generateFilePath(fileType) {
  return `upload/${fileType}`;
}

/**
 * 根据文件扩展名获取内容类型
 */
function getContentType(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  const contentTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'pdf': 'application/pdf',
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    'json': 'application/json'
  };
  return contentTypes[ext] || 'application/octet-stream';
}

module.exports = router;
