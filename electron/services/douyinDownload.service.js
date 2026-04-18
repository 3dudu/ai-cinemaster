import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/default.json'), 'utf-8'));

/**
 * 抖音视频下载服务
 * 基于 Python 参考代码移植，支持解析和下载抖音视频
 */
class DouyinDownloadService {
  constructor() {
    // 抖音 URL 正则模式
    this.DOUYIN_PATTERNS = [
      /https?:\/\/v\.douyin\.com\/[a-zA-Z0-9]+/,
      /https?:\/\/www\.douyin\.com\/video\/(\d+)/,
      /https?:\/\/www\.douyin\.com\/share\/video\/(\d+)/,
      /https?:\/\/m\.douyin\.com\/video\/(\d+)/,
      /https?:\/\/www\.iesdouyin\.com\/share\/video\/(\d+)/
    ];

    // RENDER_DATA 提取正则（多种模式）
    this.RENDER_DATA_PATTERNS = [
      /<script id="RENDER_DATA" type="application\/json">([^<]+)<\/script>/,
      /window\._ROUTER_DATA\s*=\s*(\{.*?\});/,
      /"render_data":\s*(\[.*?\])/,
      /RENDER_DATA["\']?\s*[:=]\s*["\']?([^"'\s]+)/
    ];

    // 存储路径
    this.storagePath = path.resolve(__dirname, '../../', config.storage.local.path);

    // 火山引擎 ARK API 配置
    this.volcEngineEndpoint = 'https://ark.cn-beijing.volces.com/api/v3/files';
  }

  /**
   * 检查是否是抖音 URL
   */
  isDouyinUrl(url) {
    return this.DOUYIN_PATTERNS.some(pattern => pattern.test(url));
  }

  /**
   * 提取视频 ID
   */
  extractVideoId(url) {
    const patterns = [
      /video\/(\d+)/,
      /share\/video\/(\d+)/,
      /(\d{19,})/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return null;
  }

  /**
   * 获取重定向后的完整 URL 和页面 HTML
   */
  async getRedirectUrl(shortUrl) {
    try {
      const response = await axios.get(shortUrl, {
        maxRedirects: 5,
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        }
      });

      // 获取最终 URL
      const finalUrl = response.request.res?.responseUrl || response.request.res?.socket?.handshake?.response?.url || shortUrl;

      return {
        finalUrl,
        html: response.data,
        status: response.status
      };
    } catch (error) {
      console.error('[DouyinDownload] 获取重定向 URL 失败:', error.message);
      throw new Error(`获取抖音页面失败: ${error.message}`);
    }
  }

  /**
   * 从 HTML 中提取 RENDER_DATA
   */
  extractRenderData(html) {
    for (const pattern of this.RENDER_DATA_PATTERNS) {
      const match = html.match(new RegExp(pattern, 's'));
      if (match && match[1]) {
        try {
          // URL 解码
          const decoded = decodeURIComponent(match[1]);
          return JSON.parse(decoded);
        } catch (e) {
          // 尝试直接解析
          try {
            return JSON.parse(match[1]);
          } catch (e2) {
            continue;
          }
        }
      }
    }
    return null;
  }

  /**
   * 安全获取嵌套对象值
   */
  getNested(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  }

  /**
   * 从 RENDER_DATA 中提取视频 URL（无水印）
   */
  extractVideoUrl(data) {
    if (!data) return null;

    // 多种可能的嵌套路径
    const paths = [
      // 新版页面结构
      'videoInfo.renderData.video.awemeDetail.video.playAddr',
      'videoInfo.renderData.video.awemeDetail.download_addr',
      // 旧版结构
      'aweme.detail.video.playAddr',
      'aweme.detail.video',
      'aweme_list.0.video.playAddr',
      'aweme.video.playAddr',
      // 直接在根节点
      'video.playAddr',
      'playAddr',
      // m站结构
      'item_list.0.video.playAddr',
      // 更多可能
      'detail.video.playAddr',
      'aweme_detail.video.play_addr'
    ];

    for (const p of paths) {
      let videoInfo = this.getNested(data, p);
      if (videoInfo) {
        // 提取 url_list
        let urls = videoInfo.url_list || videoInfo.urls || [];
        if (urls.length > 0) {
          let url = urls[0];
          // 去除水印：将 playwm 替换为 play
          url = url.replace('/playwm/', '/play/');
          return url;
        }
      }
    }

    // 递归搜索
    const searchVideoUrl = (obj) => {
      if (!obj || typeof obj !== 'object') return null;

      // 检查当前对象
      if (obj.url_list && obj.url_list.length > 0) {
        let url = obj.url_list[0];
        return url.replace('/playwm/', '/play/');
      }
      if (obj.urls && obj.urls.length > 0) {
        return obj.urls[0].replace('/playwm/', '/play/');
      }

      // 递归搜索
      for (const key of Object.keys(obj)) {
        if (key === 'video' || key === 'playAddr' || key === 'download_addr') {
          const result = searchVideoUrl(obj[key]);
          if (result) return result;
        }
      }
      return null;
    };

    return searchVideoUrl(data);
  }

  /**
   * 通过 videoId 请求 iesdouyin API 获取视频信息
   */
  async fetchVideoInfoFromApi(videoId) {
    const apiUrl = `https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids=${videoId}`;

    const response = await axios.get(apiUrl, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://www.douyin.com/'
      }
    });

    if (response.data && response.data.item_list && response.data.item_list.length > 0) {
      return response.data.item_list[0];
    }

    return null;
  }

  /**
   * 从 API 返回的视频数据中提取视频 URL
   */
  extractVideoUrlFromApi(itemData) {
    if (!itemData || !itemData.video) return null;

    const video = itemData.video;
    // 优先尝试 play_addr
    const playAddr = video.play_addr || video.playAddr;
    if (playAddr && playAddr.url_list && playAddr.url_list.length > 0) {
      return playAddr.url_list[0];
    }

    // 尝试 download_addr
    const downloadAddr = video.download_addr || video.downloadAddr;
    if (downloadAddr && downloadAddr.url_list && downloadAddr.url_list.length > 0) {
      return downloadAddr.url_list[0];
    }

    // 尝试 bit_rate（多码率）
    if (video.bit_rate && video.bit_rate.length > 0) {
      const highest = video.bit_rate.sort((a, b) => (b.bit_rate || 0) - (a.bit_rate || 0))[0];
      if (highest.play_addr && highest.play_addr.url_list && highest.play_addr.url_list.length > 0) {
        return highest.play_addr.url_list[0];
      }
    }

    return null;
  }

  /**
   * 流式下载视频
   * @param {string} videoUrl - 视频 URL
   * @param {string} outputPath - 输出路径
   * @param {Function} onProgress - 进度回调 (percent) => void
   */
  async downloadVideo(videoUrl, outputPath, onProgress) {
    return new Promise(async (resolve, reject) => {
      try {
        const response = await axios.get(videoUrl, {
          responseType: 'stream',
          timeout: 120000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://www.douyin.com/'
          }
        });

        const totalSize = parseInt(response.headers['content-length'], 10) || 0;
        let downloaded = 0;

        // 确保目录存在
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        const writer = fs.createWriteStream(outputPath);

        response.data.on('data', (chunk) => {
          downloaded += chunk.length;
          if (totalSize > 0 && onProgress) {
            const percent = Math.round((downloaded / totalSize) * 100);
            onProgress(percent);
          }
        });

        response.data.pipe(writer);

        writer.on('finish', () => {
          resolve({
            filePath: outputPath,
            fileSize: downloaded,
            mimeType: response.headers['content-type']
          });
        });

        writer.on('error', (err) => {
          reject(err);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 解析视频信息（不下载）
   */
  async parseVideoInfo(url) {
    if (!this.isDouyinUrl(url)) {
      throw new Error('不是有效的抖音 URL');
    }
    
    const { finalUrl } = await this.getRedirectUrl(url);
    const videoId = this.extractVideoId(finalUrl);
    
    if (!videoId) {
      throw new Error('无法从 URL 中提取视频 ID');
    }

    // 通过 iesdouyin API 获取视频信息
    const itemData = await this.fetchVideoInfoFromApi(videoId);
    const videoUrl = itemData ? this.extractVideoUrlFromApi(itemData) : null;

    console.log('itemData', itemData);
    console.log('videoUrl', videoUrl);
    if (!videoUrl) {
      throw new Error('无法通过 API 获取视频地址，接口可能已更新或视频不可用');
    }
    return {
      videoId,
      videoUrl,
      pageUrl: finalUrl,
      hasVideo: !!videoUrl
    };
  }

  /**
   * 完整下载流程
   * @param {string} url - 抖音视频 URL
   * @param {string} fileName - 自定义文件名（可选）
   * @param {Function} onProgress - 进度回调
   */
  async downloadDouyinVideo(url, fileName = null, onProgress = null) {
    // 1. 解析视频信息
    const videoInfo = await this.parseVideoInfo(url);

    if (!videoInfo.videoUrl) {
      throw new Error('无法提取视频地址，页面结构可能已更新');
    }

    // 2. 生成文件名
    const name = fileName || `douyin_${videoInfo.videoId}_${Date.now()}.mp4`;
    const outputPath = path.join(this.storagePath, 'douyin', name);

    // 3. 下载视频
    const result = await this.downloadVideo(videoInfo.videoUrl, outputPath, onProgress);

    // 4. 返回结果
    return {
      filePath: result.filePath,
      fileUrl: `/api/files/douyin/${name}`,
      fileSize: result.fileSize,
      videoId: videoInfo.videoId,
      pageUrl: videoInfo.pageUrl
    };
  }

  /**
   * 上传文件到火山引擎 ARK
   * @param {string} filePath - 本地文件路径
   * @param {string} apiKey - 火山引擎 API Key
   * @param {string} purpose - 文件用途，默认 user_data
   * @returns {Promise<Object>} 上传结果，包含 file_id 等信息
   */
  async uploadToVolcEngine(filePath, apiKey, purpose = 'user_data') {
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    const FormData = (await import('form-data')).default;
    const form = new FormData();

    // 添加文件
    form.append('file', fs.createReadStream(filePath));
    form.append('purpose', purpose);

    try {
      const response = await axios.post(this.volcEngineEndpoint, form, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          ...form.getHeaders()
        },
        timeout: 300000 // 5分钟超时，大文件上传可能较慢
      });

      return response.data;
    } catch (error) {
      const message = error.response?.data?.error?.message || error.message;
      throw new Error(`上传到火山引擎失败: ${message}`);
    }
  }

  /**
   * 根据文件 URL 或路径上传到火山引擎
   * @param {string} fileIdentifier - 文件 URL 或相对路径
   * @param {string} apiKey - 火山引擎 API Key
   * @param {string} purpose - 文件用途
   */
  async uploadFileToVolcEngine(fileIdentifier, apiKey, purpose = 'user_data') {
    // 解析文件路径
    let filePath = fileIdentifier;

    // 如果是 URL，转换为本地路径
    if (fileIdentifier.startsWith('/api/files/')) {
      const relativePath = fileIdentifier.replace('/api/files/', '');
      filePath = path.join(this.storagePath, relativePath);
    } else if (fileIdentifier.startsWith('/')) {
      // 绝对路径
      filePath = fileIdentifier;
    }

    return this.uploadToVolcEngine(filePath, apiKey, purpose);
  }

  /**
   * 一站式处理抖音视频：解析 → 下载 → 上传到火山引擎
   * @param {string} url - 抖音视频 URL
   * @param {string} apiKey - 火山引擎 API Key
   * @param {Function} onProgress - 进度回调 { stage: string, percent?: number, message?: string }
   * @returns {Promise<Object>} { fileId, fileName, fileSize }
   */
  async processDouyinVideo(url, apiKey, onProgress) {
    try {
      // 1. 解析视频信息
      onProgress({ stage: 'parsing', percent: 10, message: '正在解析视频链接...' });
      const videoInfo = await this.parseVideoInfo(url);
      console.log('开始处理抖音视频:', videoInfo);

      if (!videoInfo.videoUrl) {
        throw new Error('无法提取视频地址，页面结构可能已更新');
      }

      // 2. 生成文件名
      const name = `douyin_${videoInfo.videoId}_${Date.now()}.mp4`;
      const outputPath = path.join(this.storagePath, 'douyin', name);

      // 3. 下载视频（带进度）
      onProgress({ stage: 'downloading', percent: 20, message: '正在下载视频...' });
      await this.downloadVideo(videoInfo.videoUrl, outputPath, (percent) => {
        // 映射到 20-70% 范围
        const mappedPercent = Math.round(20 + (percent / 100) * 50);
        onProgress({ stage: 'downloading', percent: mappedPercent, message: `下载中 ${percent}%` });
      });

      // 4. 获取文件信息
      const stats = fs.statSync(outputPath);
      const fileSize = stats.size;

      // 5. 上传到火山引擎
      onProgress({ stage: 'uploading', percent: 75, message: '正在上传到火山引擎...' });
      const uploadResult = await this.uploadToVolcEngine(outputPath, apiKey, 'user_data');

      if (!uploadResult.id) {
        throw new Error('火山引擎返回结果缺少 file_id');
      }

      // 6. 清理本地文件（可选，节省空间）
      try {
        fs.unlinkSync(outputPath);
      } catch (e) {
        console.warn('[DouyinDownload] 清理本地文件失败:', e.message);
      }

      onProgress({ stage: 'complete', percent: 100, message: '处理完成' });

      return {
        fileId: uploadResult.id,
        fileName: name,
        fileSize: fileSize
      };
    } catch (error) {
      throw error;
    }
  }
}

// 单例模式
let instance = null;

function getDouyinDownloadService() {
  if (!instance) {
    instance = new DouyinDownloadService();
  }
  return instance;
}

export { DouyinDownloadService, getDouyinDownloadService };
