// utils/styleMapping.ts
// 中文风格到英文标签的映射

export const STYLE_MAPPING: Record<string, string> = {
  '仙侠古装': 'nostalgic',
  '可爱卡通': 'comic',
  '古典水墨': 'nostalgic',
  '赛博朋克': 'anime',
  '未来机甲': 'anime',
  '二次元': 'anime',
  '真人写实': 'selfie',
  '蜡笔画风格': 'comic',
  '现代城市风': 'news',
  '沙雕漫': 'comic',
};

/**
 * 将中文风格映射为英文标签
 * @param chineseStyle 中文风格名称
 * @returns 英文标签，如果没有映射则返回原值
 */
export function mapStyleToEnglish(chineseStyle: string): string {
  return STYLE_MAPPING[chineseStyle] || 'comic';
}

/**
 * 获取所有支持的中文风格列表
 */
export function getSupportedChineseStyles(): string[] {
  return Object.keys(STYLE_MAPPING);
}

/**
 * 获取所有英文标签列表
 */
export function getSupportedEnglishStyles(): string[] {
  return [...new Set(Object.values(STYLE_MAPPING))];
}
