import axios from 'axios';
import FormData from 'form-data';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = JSON.parse(readFileSync(path.join(__dirname, '../config/default.json'), 'utf-8'));

class BaiduTtsService {
  constructor() {
    this.apiUrl = config.baidu.tts.apiUrl;
    this.connectTimeout = config.baidu.tts.connectTimeout;
    this.readTimeout = config.baidu.tts.readTimeout;
  }

  /**
   * 将文本转换为音频
   * @param {Object} formData - 表单数据
   * @param {string} authorization - Authorization header
   */
  async convertToAudio(formData, authorization) {
    try {
      const form = new FormData();
      
      // 添加所有表单字段
      for (const [key, value] of Object.entries(formData)) {
        if (Array.isArray(value)) {
          value.forEach(v => form.append(key, v));
        } else {
          form.append(key, value);
        }
      }

      const headers = {
        ...form.getHeaders(),
        'Accept': '*/*'
      };

      if (authorization) {
        headers['Authorization'] = authorization;
      }

      const response = await axios.post(this.apiUrl, form, {
        headers,
        timeout: this.readTimeout,
        responseType: 'arraybuffer' // 重要：接收二进制数据
      });

      return response.data;
    } catch (error) {
      console.error('百度 TTS 调用失败:', error.message);
      throw error;
    }
  }
}

// 单例
let instance = null;

function getBaiduTtsService() {
  if (!instance) {
    instance = new BaiduTtsService();
  }
  return instance;
}

export { BaiduTtsService, getBaiduTtsService };
