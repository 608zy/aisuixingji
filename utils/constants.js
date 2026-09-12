// 常量定义

// 进度阶段
export const PROGRESS_STAGES = {
  ANALYZING: { text: '正在分析图片...', progress: 20 },
  CREATING: { text: '正在创作...', progress: 60 },
  FINISHING: { text: '即将完成...', progress: 90 },
  COMPLETED: { text: '生成完成', progress: 100 }
}

// 错误类型
export const ERROR_TYPES = {
  NETWORK_TIMEOUT: {
    code: 'NETWORK_TIMEOUT',
    message: '网络连接超时，请检查网络设置',
    retry: true
  },
  CLOUD_FUNCTION_ERROR: {
    code: 'CLOUD_FUNCTION_ERROR',
    message: '云函数调用失败',
    retry: true
  },
  AI_API_ERROR: {
    code: 'AI_API_ERROR',
    message: 'AI 服务暂时不可用',
    retry: true
  },
  MISSING_PARAMS: {
    code: 'MISSING_PARAMS',
    message: '缺少必要参数',
    retry: false
  },
  PERMISSION_DENIED: {
    code: 'PERMISSION_DENIED',
    message: '权限不足',
    retry: false
  },
  UNKNOWN_ERROR: {
    code: 'UNKNOWN_ERROR',
    message: '未知错误，请稍后重试',
    retry: true
  }
}

// 本地存储 key
export const STORAGE_KEYS = {
  TRAVEL_HISTORY: 'travel_history',
  WEAPIS_MODEL: 'weapis_model',
  LAST_TEMPLATE: 'last_template',
  UNI_ID_TOKEN: 'uni_id_token'
}
