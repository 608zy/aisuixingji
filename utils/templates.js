// 游记模板配置

// 模板定义
export const TEMPLATES = {
  literary: {
    id: 'literary',
    name: '文艺风',
    description: '优雅细腻，富有诗意和情感',
    prompt: '请用优雅细腻的文艺笔触，写一段富有诗意和情感的旅行随笔。注重细节描写和情感表达，语言优美但不过分矫情。',
    example: '阳光透过梧桐叶的缝隙，在青石板路上投下斑驳的光影...'
  },
  humorous: {
    id: 'humorous',
    name: '幽默风',
    description: '轻松诙谐，充满趣味和调侃',
    prompt: '请用轻松诙谐的幽默笔触，写一段充满趣味的旅行随笔。可以适当调侃和自嘲，让读者会心一笑。',
    example: '说好的"人间仙境"，结果我只看到了人间和人...'
  },
  concise: {
    id: 'concise',
    name: '简洁风',
    description: '简明扼要，直击重点',
    prompt: '请用简明扼要的笔触，写一段直击重点的旅行随笔。语言精练，不拖泥带水，突出核心体验。',
    example: '到了。看了。值了。'
  },
  poetic: {
    id: 'poetic',
    name: '诗意风',
    description: '意境深远，充满想象力',
    prompt: '请用充满诗意的笔触，写一段意境深远的旅行随笔。注重意象和氛围营造，语言富有韵律感。',
    example: '风吹过山谷，带来远方的呼唤。我在这里，听见了时间的声音...'
  }
}

// 模板引擎类
export class TemplateEngine {
  /**
   * 构建 AI prompt
   * @param {string} templateId - 模板 ID
   * @param {string} address - 地点信息
   * @param {string} feedbackText - 用户反馈（可选）
   * @returns {string} 构建好的 prompt
   */
  static buildPrompt(templateId, address, feedbackText = '') {
    const template = TEMPLATES[templateId] || TEMPLATES.literary
    
    if (feedbackText) {
      // 如果有反馈，构建改进 prompt
      return [
        '你是一名中文旅行随笔作者。请在上一版基础上根据以下建议改写，不少于 500 字，口语化，有画面感，不要列表和标题。',
        `地点：${address}`,
        `建议：${feedbackText}`,
        `风格要求：${template.prompt}`
      ].join('\n')
    }
    
    // 构建初始生成 prompt
    return [
      '你是一名中文旅行随笔作者。',
      template.prompt,
      '要求：画面感强、像朋友圈随手记；不要官方口吻；不要列点；不要标题；不要出现"作为AI/模型"等字眼。',
      '字数要求：不少于 400 字（最好 400-600 字）。',
      `地点：${address}`
    ].join('\n')
  }
  
  /**
   * 获取所有模板
   * @returns {Array<Object>} 模板列表
   */
  static getAllTemplates() {
    return Object.values(TEMPLATES)
  }
  
  /**
   * 获取默认模板 ID
   * @returns {string} 默认模板 ID
   */
  static getDefaultTemplateId() {
    return 'literary'
  }
  
  /**
   * 根据 ID 获取模板
   * @param {string} templateId - 模板 ID
   * @returns {Object} 模板对象
   */
  static getTemplate(templateId) {
    return TEMPLATES[templateId] || TEMPLATES.literary
  }
}
