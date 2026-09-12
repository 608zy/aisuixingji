// 测试定位和天气获取的脚本
const fs = require('fs');
const path = require('path');

// 检查本地存储中的 user_location
function checkUserLocation() {
  console.log('=== 检查本地存储中的 user_location ===');
  
  // 小程序本地存储路径（不同平台可能不同）
  const possiblePaths = [
    path.join(process.env.APPDATA, 'uni-app', 'uni-storage', 'ai随心记，小程序版'),
    path.join(process.env.HOME || process.env.USERPROFILE, 'uni-app', 'uni-storage', 'ai随心记，小程序版')
  ];
  
  let found = false;
  possiblePaths.forEach(storagePath => {
    if (fs.existsSync(storagePath)) {
      console.log(`找到存储路径: ${storagePath}`);
      
      const files = fs.readdirSync(storagePath);
      files.forEach(file => {
        if (file.endsWith('.json')) {
          const filePath = path.join(storagePath, file);
          try {
            const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (content.user_location) {
              console.log(`发现 user_location:`, content.user_location);
              found = true;
            }
          } catch (e) {
            console.error(`读取文件 ${file} 失败:`, e.message);
          }
        }
      });
    }
  });
  
  if (!found) {
    console.log('未发现 user_location');
  }
}

// 测试百度地图天气 API
function testWeatherAPI() {
  console.log('\n=== 测试百度地图天气 API ===');
  
  const baiduAk = process.env.BAIDU_MAP_AK || '';
  if (!baiduAk) {
    console.log('未设置 BAIDU_MAP_AK，跳过天气 API 地址生成');
    return;
  }
  const latitude = 39.9042; // 北京
  const longitude = 116.4074;
  const locationParam = `${longitude},${latitude}`;
  const weatherUrl = `https://api.map.baidu.com/weather/v1/?location=${encodeURIComponent(locationParam)}&data_type=now&coord_type=gcj02&output=json&ak=${baiduAk}`;
  
  console.log('天气 API 测试地址已生成（AK 已隐藏）');
}

// 执行测试
checkUserLocation();
testWeatherAPI();
