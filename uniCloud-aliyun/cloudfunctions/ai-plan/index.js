'use strict';

/**
 * AI 智能行程规划云函数
 * 接收目的地和天数，调用 OpenAI 兼容 API 生成行程
 */

const TIMEOUT = 60000;

exports.main = async (event, context) => {
  const { destination, days, fallbackLocations } = event;
  const dayCount = Number(days);

  if (!destination || !Number.isFinite(dayCount) || dayCount < 1) {
    return { ok: false, error: 'missing_params', message: '缺少目的地或天数' };
  }

  const d = Math.max(1, Math.min(14, Math.round(dayCount)));
  const apiKey = String(process.env.AI_API_KEY || '').trim();
  const baseUrl = String(process.env.AI_API_BASE_URL || 'https://vg.v1api.cc/v1').trim().replace(/\/+$/, '');
  const model = String(process.env.AI_MODEL || 'gpt-4o-mini').trim();

  if (!apiKey) {
    if (Array.isArray(fallbackLocations) && fallbackLocations.length > 0) {
      return {
        ok: true,
        data: generateFallbackPlan(destination, d, fallbackLocations),
        isFallback: true,
        message: '云函数未配置 AI_API_KEY，已使用历史足迹生成'
      };
    }
    return { ok: false, error: 'ai_not_configured', message: '请在 ai-plan 云函数环境变量中配置 AI_API_KEY' };
  }

  if (!/^https:\/\//i.test(baseUrl)) {
    return { ok: false, error: 'invalid_api_url', message: 'AI_API_BASE_URL 必须使用 HTTPS' };
  }

  const prompt = `你是一名专业旅行规划师。请为用户规划一份${destination}${d}天行程。
要求：
1. 每天安排 2-4 个景点
2. 每个景点包含：名称、建议游玩时长（小时）、简短描述（30字以内）
3. 按 JSON 格式返回，结构如下：
{
  "daily_spots": [
    {
      "day": 1,
      "spots": [
        { "name": "景点名", "duration_hours": 2, "description": "简短描述" }
      ]
    }
  ]
}
只返回 JSON，不要其他文字。`;

  try {
    const res = await uniCloud.httpclient.request(`${baseUrl}/chat/completions`, {
      method: 'POST',
      data: {
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.7
      },
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      dataType: 'json',
      timeout: TIMEOUT
    });

    if (res.status !== 200 || !res.data) {
      throw new Error('AI API 响应异常');
    }

    const content = res.data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('AI 返回内容为空');

    // 解析 JSON
    let plan;
    try {
      // 提取 JSON 块（防止 AI 返回多余文字）
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      plan = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (e) {
      throw new Error('AI 返回格式解析失败');
    }

    // 验证结构
    if (!plan.daily_spots || !Array.isArray(plan.daily_spots)) {
      throw new Error('行程结构无效');
    }

    // 确保每天至少 2 个景点
    plan.daily_spots = plan.daily_spots.slice(0, d).map((day, index) => {
      const spots = Array.isArray(day && day.spots) ? day.spots.slice(0, 4) : [];
      while (spots.length < 2) {
        spots.push({ name: '自由活动', duration_hours: 2, description: '自由探索当地特色' });
      }
      return { ...day, day: index + 1, spots };
    });
    if (plan.daily_spots.length === 0) throw new Error('行程内容为空');

    return { ok: true, data: plan };

  } catch (error) {
    console.error('[ai-plan] AI 生成失败:', error.message);

    // 兜底：基于历史打卡地点生成行程
    if (Array.isArray(fallbackLocations) && fallbackLocations.length > 0) {
      const fallbackPlan = generateFallbackPlan(destination, d, fallbackLocations);
      return { ok: true, data: fallbackPlan, isFallback: true };
    }

    return { ok: false, error: 'ai_failed', message: error.message };
  }
};

/**
 * 基于历史打卡地点生成兜底行程
 */
function generateFallbackPlan(destination, days, locations) {
  const daily_spots = [];
  for (let i = 0; i < days; i++) {
    const daySpots = [];
    for (let j = 0; j < 2; j++) {
      const loc = locations[(i * 2 + j) % locations.length];
      daySpots.push({
        name: loc.address || loc.name || destination,
        duration_hours: 2,
        description: '根据您的历史足迹推荐',
        latitude: loc.latitude != null ? loc.latitude : null,
        longitude: loc.longitude != null ? loc.longitude : null
      });
    }
    daily_spots.push({ day: i + 1, spots: daySpots });
  }
  return { daily_spots };
}
