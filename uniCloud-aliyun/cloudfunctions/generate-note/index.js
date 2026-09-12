'use strict';

/**
 * 游记生成云函数
 * 
 * 功能：调用 AI API 生成旅行游记内容
 * 
 * @param {Object} event - 云函数事件参数
 * @param {string} event.address - 地点信息（必需）
 * @param {Array<string>} event.imageUrls - 图片 URL 数组（可选，最多使用前3张）
 * @param {string} event.feedbackText - 用户反馈建议（可选，用于改进生成）
 * @param {string} event.apiKey - AI API 密钥（可选，优先使用环境变量 AI_API_KEY）
 * @param {string} event.model - AI 模型名称（可选，默认 gpt-4o-mini）
 * @param {string} event.baseUrl - AI API 基础 URL（可选，优先使用环境变量 AI_API_BASE_URL）
 * 
 * @returns {Object} 返回结果
 * @returns {boolean} returns.ok - 是否成功
 * @returns {string} returns.content - 生成的游记内容（成功时）
 * @returns {string} returns.error - 错误代码（失败时）
 * @returns {string} returns.message - 错误消息（失败时）
 */
exports.main = async (event, context) => {
  console.log('[CloudFunction] 收到请求');
  console.log('[CloudFunction] 地点:', event.address);
  console.log('[CloudFunction] 图片数量:', event.imageUrls ? event.imageUrls.length : 0);
  console.log('[CloudFunction] 是否有反馈:', !!event.feedbackText);
  
  // 解构参数
  const { address, imageUrls, feedbackText, model } = event;
  const apiKey = String(process.env.AI_API_KEY || event.apiKey || '').trim();
  const baseUrl = String(process.env.AI_API_BASE_URL || event.baseUrl || '').trim().replace(/\/+$/, '');
  
  // ========== 参数验证 ==========
  
  // 验证地点信息
  if (!address || typeof address !== 'string' || address.trim() === '') {
    console.error('[CloudFunction] 参数错误: 缺少或无效的 address');
    return { 
      ok: false, 
      error: 'missing_address', 
      message: '缺少地点信息' 
    };
  }
  
  // 验证 API Key
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
    console.error('[CloudFunction] 参数错误: 缺少或无效的 apiKey');
    return { 
      ok: false, 
      error: 'missing_apiKey', 
      message: '缺少 API Key' 
    };
  }
  
  // 验证 API 基础 URL
  if (!baseUrl || typeof baseUrl !== 'string' || baseUrl.trim() === '') {
    console.error('[CloudFunction] 参数错误: 缺少或无效的 baseUrl');
    return { 
      ok: false, 
      error: 'missing_baseUrl', 
      message: '缺少 API 地址' 
    };
  }
  if (!/^https:\/\//i.test(baseUrl)) {
    return { ok: false, error: 'invalid_baseUrl', message: 'API 地址必须使用 HTTPS' };
  }

  if (address.length > 300 || String(feedbackText || '').length > 1000) {
    return { ok: false, error: 'input_too_long', message: '输入内容过长' };
  }

  // ========== 构建 AI Prompt ==========
  
  // 根据是否有反馈构建不同的 prompt
  let basePrompt;
  if (feedbackText && feedbackText.trim()) {
    // 有反馈：改进模式
    basePrompt = [
      '你是一名中文旅行随笔作者。请在上一版基础上根据以下建议改写，不少于 500 字，口语化，有画面感，不要列表和标题。',
      `地点：${address}`,
      `建议：${feedbackText}`
    ].join('\n');
  } else {
    // 无反馈：初次生成模式
    basePrompt = [
      '你是一名中文旅行随笔作者。请用轻松、文艺但不过分矫情的语气，写一段不少于 400 字（最好 400-600 字）的旅行随笔。',
      '要求：画面感强、像朋友圈随手记；不要官方口吻；不要列点；不要标题；不要出现"作为AI/模型"等字眼。',
      `地点：${address}`
    ].join('\n');
  }

  // 构建内容块数组（文本 + 图片）
  const contentBlocks = [{ type: 'text', text: basePrompt }];
  
  // 添加图片（最多3张，防止请求过大）
  if (Array.isArray(imageUrls) && imageUrls.length > 0) {
    const validImages = imageUrls
      .slice(0, 3) // 只取前3张
      .filter(url => url && typeof url === 'string' && url.trim() !== ''); // 过滤无效 URL
    
    validImages.forEach(url => {
      contentBlocks.push({ 
        type: 'image_url', 
        image_url: { url } 
      });
    });
    
    console.log('[CloudFunction] 添加图片数量:', validImages.length);
  }

  // ========== 调用 AI API ==========
  
  try {
    const requestUrl = `${baseUrl}/chat/completions`;
    const requestModel = model || 'gpt-4o-mini';
    
    console.log('[CloudFunction] 开始请求 AI API');
    console.log('[CloudFunction] URL:', requestUrl);
    console.log('[CloudFunction] 模型:', requestModel);
    
    // 构建请求数据
    const requestData = {
      model: requestModel,
      messages: [{ 
        role: 'user', 
        content: contentBlocks 
      }],
      max_tokens: 1200,
      temperature: 0.6
    };
    
    // 发送 HTTP 请求
    const res = await uniCloud.httpclient.request(requestUrl, {
      method: 'POST',
      data: requestData,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      dataType: 'json',
      timeout: 120000 // 120秒超时
    });
    
    console.log('[CloudFunction] AI API 响应状态:', res.status);

    // ========== 处理响应 ==========
    
    // 检查 HTTP 状态码
    if (res.status !== 200 && res.status !== 201) {
      console.error('[CloudFunction] AI API 返回错误状态:', res.status);
      
      // 根据状态码返回不同的错误信息
      let errorMessage = 'AI API 请求失败';
      if (res.status === 401) {
        errorMessage = 'API Key 无效或已过期';
      } else if (res.status === 429) {
        errorMessage = 'API 请求频率超限，请稍后重试';
      } else if (res.status === 503) {
        errorMessage = 'AI 服务暂时不可用，请稍后重试';
      }
      
      return { 
        ok: false, 
        error: 'ai_api_error', 
        status: res.status, 
        message: errorMessage,
        detail: res.data 
      };
    }
    
    // 验证响应数据结构
    if (!res.data) {
      console.error('[CloudFunction] API 返回数据为空');
      return { 
        ok: false, 
        error: 'api_response_empty', 
        message: 'API 返回数据为空' 
      };
    }
    
    if (!res.data.choices || !Array.isArray(res.data.choices) || res.data.choices.length === 0) {
      console.error('[CloudFunction] API 响应格式错误: 缺少 choices 字段');
      return { 
        ok: false, 
        error: 'api_format_error', 
        message: 'API 响应格式错误',
        detail: res.data 
      };
    }
    
    const choice = res.data.choices[0];
    if (!choice.message || !choice.message.content) {
      console.error('[CloudFunction] API 响应格式错误: 缺少 message.content 字段');
      return { 
        ok: false, 
        error: 'api_format_error', 
        message: 'API 响应格式错误',
        detail: choice 
      };
    }
    
    // 提取生成的内容
    const content = choice.message.content.trim();
    
    console.log('[CloudFunction] 生成成功');
    console.log('[CloudFunction] 内容长度:', content.length, '字符');
    
    // 返回成功结果
    return { 
      ok: true, 
      content: content, 
      provider: 'uniCloud',
      model: requestModel
    };
    
  } catch (error) {
    // ========== 错误处理 ==========
    
    console.error('[CloudFunction] 请求异常:', error.message);
    console.error('[CloudFunction] 异常类型:', error.name);
    
    // 区分不同类型的错误
    let errorCode = 'system_error';
    let errorMessage = '系统错误，请稍后重试';
    
    if (error.message && error.message.includes('timeout')) {
      errorCode = 'network_timeout';
      errorMessage = '网络请求超时，请检查网络连接';
    } else if (error.message && error.message.includes('ECONNREFUSED')) {
      errorCode = 'connection_refused';
      errorMessage = '无法连接到 AI 服务';
    } else if (error.message && error.message.includes('ENOTFOUND')) {
      errorCode = 'dns_error';
      errorMessage = 'API 地址无效';
    }
    
    return { 
      ok: false, 
      error: errorCode, 
      message: errorMessage,
      detail: error.message
    };
  }
};
