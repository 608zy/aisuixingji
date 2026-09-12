// 测试百度地图天气 API
const https = require('https');

// 测试参数
const latitude = 39.9042; // 北京
const longitude = 116.4074;
const ak = process.env.BAIDU_MAP_AK || '';

// 测试天气 API - 纬度,经度 格式
const weatherUrl1 = `https://api.map.baidu.com/weather/v1/?location=${latitude},${longitude}&data_type=now&coord_type=gcj02&output=json&ak=${ak}`;

// 测试天气 API - 经度,纬度 格式
const weatherUrl2 = `https://api.map.baidu.com/weather/v1/?location=${longitude},${latitude}&data_type=now&coord_type=gcj02&output=json&ak=${ak}`;

// 测试逆地理编码 API
const geoUrl = `https://api.map.baidu.com/reverse_geocoding/v3/?ak=${ak}&output=json&coordtype=gcj02ll&location=${latitude},${longitude}`;

function testAPI(url, name) {
  console.log(`\n=== 测试 ${name} ===`);
  console.log(`URL: ${url.replace(/([?&]ak=)[^&]+/i, '$1***')}`);
  
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('响应:', result);
          resolve(result);
        } catch (e) {
          console.error('解析响应失败:', e);
          reject(e);
        }
      });
    }).on('error', (err) => {
      console.error('请求失败:', err);
      reject(err);
    });
  });
}

// 执行测试
async function runTests() {
  if (!ak) {
    console.error('请先设置 BAIDU_MAP_AK 环境变量');
    process.exitCode = 1;
    return;
  }
  try {
    await testAPI(geoUrl, '逆地理编码 API');
    await testAPI(weatherUrl1, '天气 API (纬度,经度)');
    await testAPI(weatherUrl2, '天气 API (经度,纬度)');
  } catch (e) {
    console.error('测试失败:', e);
  }
}

runTests();
