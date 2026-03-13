import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getFileStorageService } from './fileStorage.service.js';

const SYNC_DIR = 'sync';
const SYNC_KEY_LENGTH = 8;
const SYNC_KEY_PATTERN = /^[a-zA-Z0-9]{8}$/;
const FILE_EXTENSION = '.json';

class SyncService {
  constructor() {
    this.storageService = getFileStorageService();
  }

  /**
   * 初始化用户
   * @param {string} syncKey - 同步密钥（可选）
   */
  initUser(syncKey) {
    try {
      // 确保 sync 目录存在
      this.storageService.createDirectory(SYNC_DIR);

      // 如果提供了 syncKey，验证其格式和存在性
      if (syncKey && syncKey.trim()) {
        if (!SYNC_KEY_PATTERN.test(syncKey)) {
          throw new Error('同步密钥格式不正确，必须为8位字母数字');
        }

        // 检查用户目录是否存在
        const userPath = this.getUserPath(syncKey);
        const files = this.storageService.listFiles(userPath);

        if (files.length === 0) {
          throw new Error('同步密钥对应的目录不存在');
        }

        console.log(`用户初始化成功，使用现有同步密钥: ${syncKey}`);
        return syncKey;
      }

      // 自动生成 syncKey
      let generatedKey;
      let userPath;
      let files;
      let attempts = 0;
      const maxAttempts = 100;

      do {
        generatedKey = this.generateSyncKey();
        userPath = this.getUserPath(generatedKey);
        attempts++;

        if (attempts > maxAttempts) {
          throw new Error('生成同步密钥失败，请重试');
        }

        this.storageService.createDirectory(userPath);
        files = this.storageService.listFiles(userPath);
      } while (files.length > 0);

      console.log(`用户初始化成功，生成新同步密钥: ${generatedKey}`);
      return generatedKey;

    } catch (error) {
      console.error('用户初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取文件列表
   * @param {string} syncKey - 同步密钥
   */
  getFileList(syncKey) {
    const userPath = this.getUserPath(syncKey);
    const fileUrls = this.storageService.listFiles(userPath, FILE_EXTENSION);

    if (fileUrls.length === 0) {
      console.log('获取文件列表成功，数量: 0');
      return [];
    }

    const fileList = [];

    for (const fileUrl of fileUrls) {
      try {
        const fileName = this.extractFileNameFromUrl(fileUrl);
        const baseName = fileName.substring(0, fileName.length - FILE_EXTENSION.length);

        const jsonContent = this.storageService.readFile(fileUrl);
        const fileInfo = JSON.parse(jsonContent);

        fileList.push({
          fileName: baseName,
          id: fileInfo.id,
          title: fileInfo.title,
          createdAt: fileInfo.createdAt,
          lastModified: fileInfo.lastModified
        });
      } catch (error) {
        console.warn('解析文件失败:', fileUrl, error);
      }
    }

    console.log(`获取文件列表成功，数量: ${fileList.length}`);
    return fileList;
  }

  /**
   * 上传文件（Buffer方式）
   * @param {string} syncKey - 同步密钥
   * @param {string} fileName - 文件名（不含扩展名）
   * @param {Buffer} fileBuffer - 文件内容
   */
  uploadFile(syncKey, fileName, fileBuffer) {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('上传文件不能为空');
    }

    const userPath = this.getUserPath(syncKey);
    const targetFileName = fileName + FILE_EXTENSION;

    try {
      // 验证 JSON 格式
      const jsonContent = fileBuffer.toString('utf-8');
      const fileInfo = JSON.parse(jsonContent);
      
      // 验证必要字段
      if (!fileInfo.id || !fileInfo.title) {
        throw new Error('JSON 缺少必要字段');
      }

      // 上传文件
      this.storageService.uploadString(jsonContent, userPath, targetFileName);

      console.log(`文件上传成功: ${syncKey}/${targetFileName}`);
      return true;
    } catch (error) {
      console.error('文件上传失败:', error);
      throw new Error('文件上传失败：' + error.message);
    }
  }

  /**
   * 上传文件（JSON字符串方式）
   * @param {string} syncKey - 同步密钥
   * @param {string} fileName - 文件名
   * @param {string} jsonContent - JSON 内容
   */
  uploadFileJson(syncKey, fileName, jsonContent) {
    if (!jsonContent || jsonContent.trim() === '') {
      throw new Error('JSON 内容不能为空');
    }

    const userPath = this.getUserPath(syncKey);
    const targetFileName = fileName + FILE_EXTENSION;

    try {
      // 验证 JSON 格式
      const fileInfo = JSON.parse(jsonContent);
      
      // 验证必要字段
      if (!fileInfo.id || !fileInfo.title) {
        throw new Error('JSON 缺少必要字段');
      }

      this.storageService.uploadString(jsonContent, userPath, targetFileName);

      console.log(`JSON 文件上传成功: ${syncKey}/${targetFileName}`);
      return true;
    } catch (error) {
      console.error('JSON 文件上传失败:', error);
      throw new Error('JSON 文件上传失败：' + error.message);
    }
  }

  /**
   * 下载文件
   * @param {string} syncKey - 同步密钥
   * @param {string} fileName - 文件名
   */
  downloadFile(syncKey, fileName) {
    const userPath = this.getUserPath(syncKey);
    const targetFileName = fileName + FILE_EXTENSION;

    const fileUrls = this.storageService.listFiles(userPath, FILE_EXTENSION);

    for (const fileUrl of fileUrls) {
      const urlFileName = this.extractFileNameFromUrl(fileUrl);
      if (urlFileName === targetFileName) {
        const jsonContent = this.storageService.readFile(fileUrl);
        console.log(`文件下载成功: ${syncKey}/${targetFileName}`);
        return jsonContent;
      }
    }

    throw new Error('文件不存在');
  }

  /**
   * 删除文件
   * @param {string} syncKey - 同步密钥
   * @param {string} fileName - 文件名
   */
  deleteFile(syncKey, fileName) {
    const userPath = this.getUserPath(syncKey);
    const targetFileName = fileName + FILE_EXTENSION;

    const fileUrls = this.storageService.listFiles(userPath, FILE_EXTENSION);

    for (const fileUrl of fileUrls) {
      const urlFileName = this.extractFileNameFromUrl(fileUrl);
      if (urlFileName === targetFileName) {
        this.storageService.delete(fileUrl);
        console.log(`文件删除成功: ${syncKey}/${targetFileName}`);
        return true;
      }
    }

    throw new Error('文件不存在');
  }

  /**
   * 获取用户路径
   */
  getUserPath(syncKey) {
    return `${SYNC_DIR}/${syncKey}`;
  }

  /**
   * 从 URL 中提取文件名
   */
  extractFileNameFromUrl(url) {
    const parts = url.split('/');
    return parts[parts.length - 1];
  }

  /**
   * 生成同步密钥
   */
  generateSyncKey() {
    return uuidv4().replace(/-/g, '').substring(0, SYNC_KEY_LENGTH);
  }
}

// 单例
let instance = null;

function getSyncService() {
  if (!instance) {
    instance = new SyncService();
  }
  return instance;
}

export { SyncService, getSyncService };