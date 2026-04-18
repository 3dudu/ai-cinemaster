import fs, { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = JSON.parse(readFileSync(path.join(__dirname, '../config/default.json'), 'utf-8'));

/**
 * 获取存储根目录
 * 优先级：用户自定义目录 > Electron userData > 配置文件
 */
function getStorageRoot() {
  // 1. 优先使用用户自定义目录（通过菜单设置）
  if (process.env.CUSTOM_STORAGE_PATH) {
    return process.env.CUSTOM_STORAGE_PATH;
  }
  // 2. 其次使用 Electron userData 目录，解决 macOS 权限问题
  if (process.env.ELECTRON_USER_DATA_PATH) {
    return path.join(process.env.ELECTRON_USER_DATA_PATH, 'upload');
  }
  // 3. 最后使用配置文件中的路径（兼容独立服务器模式）
  return path.resolve(__dirname, '../', config.storage.local.path);
}

class FileStorageService {
  constructor() {
    this.storageType = config.storage.type;
    this.uploadPath = getStorageRoot();
    this.urlPrefix = config.storage.local.urlPrefix;
    
    console.log('[FileStorage] 存储路径:', this.uploadPath);
    
    // 确保上传目录存在
    this.ensureDirectoryExists(this.uploadPath);
  }

  /**
   * 确保目录存在
   */
  ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * 获取存储类型
   */
  getStorageType() {
    return this.storageType;
  }

  /**
   * 上传文件
   * @param {Object} file - multer 文件对象
   * @param {string} customPath - 自定义路径（可选）
   */
  upload(file, customPath = '') {
    const targetDir = customPath 
      ? path.join(this.uploadPath, customPath)
      : this.uploadPath;
    
    this.ensureDirectoryExists(targetDir);

    // 生成唯一文件名
    const uniqueName = this.generateUniqueFileName(file.originalname);
    const filePath = path.join(targetDir, uniqueName);
    fs.writeFileSync(filePath, file.buffer);

    // 生成 URL
    const relativePath = customPath ? `${customPath}/${uniqueName}` : uniqueName;
    const url = `${this.urlPrefix}/${relativePath}`;

    return url;
  }

  /**
   * 上传字符串内容
   * @param {string} content - 文件内容
   * @param {string} customPath - 路径
   * @param {string} filename - 文件名
   */
  uploadString(content, customPath, filename) {
    const targetDir = path.join(this.uploadPath, customPath);
    this.ensureDirectoryExists(targetDir);

    const filePath = path.join(targetDir, filename);
    fs.writeFileSync(filePath, content, 'utf-8');

    const url = `${this.urlPrefix}/${customPath}/${filename}`;
    return url;
  }

  /**
   * 读取文件
   * @param {string} fileUrl - 文件 URL 或路径
   */
  readFile(fileUrl) {
    // 从 URL 中提取相对路径
    const relativePath = this.extractRelativePath(fileUrl);
    const filePath = path.join(this.uploadPath, relativePath);

    if (!fs.existsSync(filePath)) {
      throw new Error('文件不存在');
    }

    return fs.readFileSync(filePath, 'utf-8');
  }

  /**
   * 删除文件
   * @param {string} fileUrl - 文件 URL 或路径
   */
  delete(fileUrl) {
    const relativePath = this.extractRelativePath(fileUrl);
    const filePath = path.join(this.uploadPath, relativePath);

    if (!fs.existsSync(filePath)) {
      throw new Error('文件不存在');
    }

    fs.unlinkSync(filePath);
    return true;
  }

  /**
   * 列出目录下的文件
   * @param {string} dirPath - 目录路径
   * @param {string} extension - 文件扩展名过滤（可选）
   */
  listFiles(dirPath, extension = null) {
    const targetDir = path.join(this.uploadPath, dirPath);

    if (!fs.existsSync(targetDir)) {
      return [];
    }

    let files = fs.readdirSync(targetDir);

    if (extension) {
      files = files.filter(f => f.endsWith(extension));
    }

    // 返回完整的 URL 路径
    return files.map(f => `${this.urlPrefix}/${dirPath}/${f}`);
  }

  /**
   * 创建目录
   * @param {string} dirPath - 目录路径
   */
  createDirectory(dirPath) {
    const targetDir = path.join(this.uploadPath, dirPath);
    this.ensureDirectoryExists(targetDir);
    return true;
  }

  /**
   * 生成唯一文件名
   */
  generateUniqueFileName(originalName) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    return `${baseName}_${timestamp}_${random}${ext}`;
  }

  /**
   * 从 URL 中提取相对路径
   */
  extractRelativePath(url) {
    // 如果是完整 URL，提取路径部分
    if (url.startsWith('http')) {
      const urlObj = new URL(url);
      // 移除 /api/files/ 前缀
      const prefix = '/api/files/';
      if (urlObj.pathname.startsWith(prefix)) {
        return urlObj.pathname.substring(prefix.length);
      }
      return urlObj.pathname.substring(1); // 移除开头的 /
    }
    // 如果是相对路径，直接返回
    return url;
  }

  /**
   * 获取文件的完整本地路径
   */
  getLocalPath(relativePath) {
    return path.join(this.uploadPath, relativePath);
  }
}

// 单例模式
let instance = null;

function getFileStorageService() {
  if (!instance) {
    instance = new FileStorageService();
  }
  return instance;
}

export { FileStorageService, getFileStorageService };
