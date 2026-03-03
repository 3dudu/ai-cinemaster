/**
 * 提示词模板使用示例
 *
 * 本文件展示如何在代码中使用提示词模板系统
 */

import { renderTemplate, PROMPT_TEMPLATES } from './promptTemplates';

// ========================================
// 方式一：直接使用 PROMPT_TEMPLATES（使用默认模板）
// ========================================

// 示例 1: 剧本解析
const parseScriptPrompt = PROMPT_TEMPLATES.PARSE_SCRIPT(
  '这是一个关于爱情的故事...',
  '中文'
);

// 示例 2: 镜头清单生成
const shotsPrompt = PROMPT_TEMPLATES.GENERATE_SHOTS(
  0,
  { location: '咖啡店', time: '下午', atmosphere: '温馨' },
  '男主角走进咖啡店，点了一杯拿铁',
  '爱情片',
  '30秒',
  [{ id: '1', name: '张三', visualPrompt: '年轻帅气男子' }],
  '中文'
);

// 示例 3: 剧本生成
const scriptPrompt = PROMPT_TEMPLATES.GENERATE_SCRIPT(
  '一个关于时间旅行的科幻故事',
  '5分钟',
  '科幻',
  '中文'
);

// ========================================
// 方式二：使用 renderTemplate（支持自定义模板）
// ========================================

// 如果用户在 PromptTemplateModal 中自定义了模板，
// renderTemplate 会优先使用自定义模板，否则使用默认模板

// 使用方式与直接调用 PROMPT_TEMPLATES 完全相同
const parseScriptCustom = renderTemplate('PARSE_SCRIPT',
  '这是一个关于爱情的故事...',
  '中文'
);

const shotsCustom = renderTemplate('GENERATE_SHOTS',
  0,
  { location: '咖啡店', time: '下午', atmosphere: '温馨' },
  '男主角走进咖啡店，点了一杯拿铁',
  '爱情片',
  '30秒',
  [{ id: '1', name: '张三', visualPrompt: '年轻帅气男子' }],
  '中文'
);

// ========================================
// 自定义模板变量格式说明
// ========================================

// 用户在 PromptTemplateModal 中编辑模板时，可以使用以下变量格式：

// 1. 简单变量: {variableName}
//    例如: {language}, {genre}, {prompt}

// 2. 嵌套属性: {object.property}
//    例如: {scene.location}, {scene.time}

// 3. JavaScript 表达式（在函数模板中保留）
//    例如: {sceneIndex + 1}, {paragraphs.slice(0, 5000)}
//    注意：这些会在 renderTemplate 时被替换为实际值

// ========================================
// 自定义模板示例
// ========================================

// 示例: 自定义 PARSE_SCRIPT 模板
// 在 PromptTemplateModal 中编辑 PARSE_SCRIPT，输入：

/*
分析文本并以 {language} 语言输出 JSON。

请提取以下信息：
- 标题
- 角色（姓名、性别、年龄）
- 场景（地点、时间、氛围）
- 故事段落

文本内容：
"{rawText.slice(0, 30000)}"
*/

// 使用时调用：
// renderTemplate('PARSE_SCRIPT', rawText, '中文')
// 会自动替换 {language} 和 {rawText} 变量

// ========================================
// 注意事项
// ========================================

// 1. 对于函数类型的模板（如 GENERATE_SHOTS），
//    用户编辑的是模板字符串，系统会在运行时替换变量

// 2. 自定义模板必须使用正确的变量名，变量名区分大小写

// 3. 支持的变量名请参考 PromptTemplateModal 中的提示

// 4. 导出的模板 JSON 格式：
//    {
//      "customContent": {
//        "PARSE_SCRIPT": "自定义内容...",
//        "GENERATE_SHOTS": "自定义内容..."
//      },
//      "exportDate": "2024-xx-xx",
//      "version": "1.0"
//    }

// ========================================
// 推荐使用方式
// ========================================

// ✅ 推荐：使用 renderTemplate
const recommendedWay = renderTemplate('GENERATE_SCRIPT',
  '提示词内容',
  '时长',
  '类型',
  '语言'
);
// 这样既支持默认模板，也支持用户自定义模板

// ⚠️ 不推荐：直接使用 PROMPT_TEMPLATES
const notRecommended = PROMPT_TEMPLATES.GENERATE_SCRIPT(
  '提示词内容',
  '时长',
  '类型',
  '语言'
);
// 这样会忽略用户的自定义模板

export {};
