'use strict';

/**
 * 获取天气信息云函数
 * 使用百度地图天气 API 获取真实天气数据
 */
exports.main = async (event, context) => {
  console.log('[CloudFunction] 收到天气请求:', JSON.stringify(event));

  let { latitude, longitude, city } = event || {};
  latitude = Number(latitude);
  longitude = Number(longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return weatherError('invalid_location', '经纬度无效');
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return weatherError('invalid_location', '经纬度超出范围');
  }

  const baiduAk = String(process.env.BAIDU_MAP_AK || '').trim();
  if (!baiduAk) return weatherError('not_configured', '请在 get-weather 云函数环境变量中配置 BAIDU_MAP_AK');
  const locationParam = `${longitude},${latitude}`;
  const weatherUrl = `https://api.map.baidu.com/weather/v1/?location=${encodeURIComponent(locationParam)}&data_type=now&coord_type=gcj02ll&output=json&ak=${baiduAk}`;

  try {
    const weatherRes = await requestWithRetry(weatherUrl, 2);
    const payload = safeJson(weatherRes && weatherRes.data);
    const statusCode = weatherRes && (weatherRes.status || weatherRes.statusCode);

    if (statusCode !== 200 || !payload) {
      return weatherError('upstream_error', '天气服务响应异常');
    }

    // 百度接口成功状态兼容：0 / "0"
    const apiStatus = payload.status;
    const statusOk = apiStatus === 0 || apiStatus === '0';
    const now = payload.result && payload.result.now ? payload.result.now : null;

    if (!statusOk || !now) {
      const msg = payload.message || payload.msg || `status=${String(apiStatus)}`;
      return weatherError('upstream_error', `天气查询失败：${msg}`);
    }

    const cityName =
      city ||
      (payload.result && payload.result.location && (payload.result.location.city || payload.result.location.name)) ||
      '未知城市';

    const text = now.text || now.weather || '';
    const weatherData = {
      temp: toStr(now.temp, ''),
      text,
      code: toWeatherCode(now.code, text),
      feelsLike: toStr(now.feels_like != null ? now.feels_like : now.feelsLike, toStr(now.temp, '')),
      humidity: toStr(now.rh != null ? now.rh : now.humidity, ''),
      windDir: now.wind_dir || now.windDir || '',
      windScale: toStr(now.wind_class != null ? now.wind_class : now.windScale, ''),
      pressure: toStr(now.pressure, ''),
      city: cityName
    };

    return {
      ok: true,
      data: {
        now: weatherData,
        city: cityName
      }
    };
  } catch (error) {
    console.error('[CloudFunction] get-weather 失败:', error && error.message);
    return weatherError('request_failed', '天气服务暂时不可用，请稍后重试');
  }
};

function weatherError(error, message) {
  return { ok: false, error, message };
}

function safeJson(data) {
  if (!data) return null;
  if (typeof data === 'object') return data;
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  }
  return null;
}

function toStr(v, dft) {
  return v === undefined || v === null || v === '' ? String(dft) : String(v);
}

function toWeatherCode(rawCode, text) {
  if (rawCode !== undefined && rawCode !== null && rawCode !== '') return String(rawCode);
  const t = String(text || '');
  if (t.includes('雨')) return '3';
  if (t.includes('雪')) return '12';
  if (t.includes('雾')) return '16';
  if (t.includes('霾')) return '17';
  if (t.includes('阴')) return '2';
  if (t.includes('云')) return '1';
  return '0';
}

async function requestWithRetry(url, retryCount) {
  let lastError = null;
  let remain = Number(retryCount) || 0;
  while (remain >= 0) {
    try {
      return await uniCloud.httpclient.request(url, {
        method: 'GET',
        dataType: 'json',
        timeout: 8000
      });
    } catch (e) {
      lastError = e;
      remain -= 1;
      if (remain >= 0) {
        await sleep(400);
      }
    }
  }
  throw lastError || new Error('request_failed');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
