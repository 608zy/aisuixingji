/**
 * 生成小程序码云函数
 * 用于生成包含游记 ID 的小程序码，扫码后跳转到游记详情页
 */
'use strict';

exports.main = async (event, context) => {
  console.log('[generate-qrcode] 云函数调用开始');
  console.log('[generate-qrcode] 参数:', event);
  
  const { noteId, page = 'pages/note/note' } = event;
  
  // 参数验证
  if (!noteId) {
    console.error('[generate-qrcode] 缺少必需参数: noteId');
    return {
      success: false,
      error: 'MISSING_PARAMS',
      message: '缺少游记 ID'
    };
  }
  
  try {
    // 调用微信小程序 API 生成小程序码
    // 注意：这需要在 uniCloud 控制台配置小程序 AppID 和 AppSecret
    const result = await uniCloud.getWXACode({
      path: `${page}?id=${noteId}`,
      width: 280,
      auto_color: false,
      line_color: { r: 0, g: 0, b: 0 },
      is_hyaline: true
    });
    
    if (result.errCode) {
      console.error('[generate-qrcode] 生成小程序码失败:', result.errMsg);
      return {
        success: false,
        error: 'GENERATE_FAILED',
        message: result.errMsg || '生成小程序码失败'
      };
    }
    
    console.log('[generate-qrcode] 小程序码生成成功');
    
    return {
      success: true,
      qrCodeUrl: result.fileID || result.url
    };
    
  } catch (error) {
    console.error('[generate-qrcode] 云函数执行异常:', error);
    
    return {
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message || '生成小程序码时发生错误'
    };
  }
};
