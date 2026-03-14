import express from 'express';
import { getBaiduTtsService } from '../services/baiduTts.service.js';

const router = express.Router();

/**
 * 文本转语音接口
 * POST /text2audio
 */
router.post('/', async (req, res) => {
  console.log('接收到 text2audio 请求，参数：', req.query, req.body);

  try {
    const formData = { ...req.query, ...req.body };
    const authorization = req.headers['authorization'];

    const baiduTtsService = getBaiduTtsService();
    const audioData = await baiduTtsService.convertToAudio(formData, authorization);

    console.log(`TTS 转换成功，音频大小：${audioData.length} bytes`);

    res.set({
      'Content-Type': 'audio/mp3',
      'Content-Length': audioData.length
    });
    res.send(audioData);
  } catch (error) {
    console.error('TTS 转换失败：', error.message);

    const errorResponse = {
      success: false,
      error: error.message || 'text2audio 失败',
      details: error.cause ? String(error.cause) : null
    };

    res.status(500).json(errorResponse);
  }
});

export default router;