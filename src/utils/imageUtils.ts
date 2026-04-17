/**
 * 文件工具函数
 * 提供文件URL（图片/音频等）到Base64的转换功能
 */

/**
 * 将任意文件URL转换为Base64格式（通用函数）
 * @param fileUrl - 文件URL或data URL
 * @returns Promise<string> - 返回 data:<mime>;base64, 格式的字符串
 */
export async function urlToBase64(fileUrl: string): Promise<string> {
  if (!fileUrl || fileUrl.startsWith('data:')) {
    return fileUrl;
  }

  try {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }

    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting URL to base64:', error);
    throw new Error(`Failed to convert URL to base64: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * 将图片URL转换为Base64格式
 * @param imageUrl - 图片URL或data URL
 * @returns Promise<string> - 返回 data:image/xxx;base64, 格式的字符串
 */
export async function imageUrlToBase64(imageUrl: string): Promise<string> {
  return urlToBase64(imageUrl);
}

/**
 * 将音频URL转换为Base64格式
 * @param audioUrl - 音频URL或data URL
 * @returns Promise<string> - 返回 data:audio/xxx;base64, 格式的字符串
 */
export async function audioUrlToBase64(audioUrl: string): Promise<string> {
  return urlToBase64(audioUrl);
}

/**
 * 批量转换图片URL数组为Base64格式
 * @param imageUrls - 图片URL数组
 * @returns Promise<string[]> - 返回Base64格式的字符串数组
 */
export async function imageUrlsToBase64(imageUrls: string[]): Promise<string[]> {
  const promises = imageUrls.map(url => imageUrlToBase64(url));
  return Promise.all(promises);
}

/**
 * 从Base64字符串中提取MIME类型
 * @param base64String - Base64格式的文件字符串
 * @returns MIME类型 (例如: image/png, audio/mpeg)
 */
export function getMimeTypeFromBase64(base64String: string): string {
  const match = base64String.match(/^data:([a-zA-Z]+\/[a-zA-Z0-9.+-]+);base64,/);
  return match ? match[1] : '';
}

/**
 * 从Base64字符串中提取纯数据部分（不包含前缀）
 * @param base64String - Base64格式的文件字符串
 * @returns 纯Base64数据
 */
export function getPureBase64Data(base64String: string): string {
  const match = base64String.match(/^data:[a-zA-Z]+\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
  return match ? match[1] : base64String;
}

/**
 * 从视频 URL 生成缩略图（base64 格式）
 * @param url - 视频 URL
 * @param seekTime - 跳转到的时间点（秒），默认 1 秒（取早期帧）
 * @returns Promise<string | null> - base64 图片数据或 null
 */
export async function generateVideoThumbnail(url: string, seekTime: number = 1): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";

    const timeout = setTimeout(() => {
      console.warn("Thumbnail generation timeout for URL:", url);
      resolve(null);
    }, 10000);

    // 先加载元数据获取时长
    video.onloadedmetadata = () => {
      const targetTime = Math.max(0, Math.min(seekTime, video.duration - 0.1));
      video.currentTime = targetTime;
    };

    video.onseeked = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.7));
        } else {
          resolve(null);
        }
      } catch {
        // 跨域限制可能导致 canvas 无法读取像素
        resolve(null);
      }
    };

    video.onerror = () => {
      clearTimeout(timeout);
      console.error("Error loading video for thumbnail from URL:", url);
      resolve(null);
    };

    video.src = url;
  });
}

/**
 * 获取视频尾帧缩略图
 * @param url - 视频 URL
 * @returns Promise<string | null> - base64 图片数据或 null
 */
export async function getVideoLastFrame(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";

    const timeout = setTimeout(() => {
      console.warn("Last frame extraction timeout for URL:", url);
      resolve(null);
    }, 10000);

    video.onloadedmetadata = () => {
      // 跳转到最后一帧（duration - 0.1秒）
      video.currentTime = Math.max(0, video.duration - 0.1);
    };

    video.onseeked = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.7));
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    };

    video.onerror = () => {
      clearTimeout(timeout);
      console.error("Error loading video for last frame from URL:", url);
      resolve(null);
    };

    video.src = url;
  });
}

/**
 * 获取视频指定时间的帧
 * @param url - 视频 URL
 * @param timeSeconds - 指定时间点（秒）
 * @returns Promise<string | null> - base64 图片数据或 null
 */
export async function getVideoFrameAtTime(url: string, timeSeconds: number): Promise<string | null> {
  return generateVideoThumbnail(url, timeSeconds);
}

/**
 * 获取视频时长
 * @param url - 视频 URL
 * @returns Promise<number> - 视频时长（秒）
 */
export async function getVideoDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const timeout = setTimeout(() => {
      console.warn("Video duration fetch timeout for URL:", url);
      resolve(0);
    }, 10000);

    video.onloadedmetadata = () => {
      clearTimeout(timeout);
      resolve(video.duration || 0);
    };

    video.onerror = () => {
      clearTimeout(timeout);
      console.error("Error loading video for duration:", url);
      resolve(0);
    };

    video.src = url;
  });
}
