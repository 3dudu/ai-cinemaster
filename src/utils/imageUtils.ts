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
