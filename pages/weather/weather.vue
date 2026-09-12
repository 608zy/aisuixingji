<template>
  <view class="container" :style="themeVars">
    <!-- 顶部导航 -->
    <view class="header">
      <view class="back-btn" @click="goBack">
        <text class="back-icon">←</text>
      </view>
      <text class="header-title">天气详情</text>
      <view class="placeholder"></view>
    </view>

    <!-- 当前天气卡片 -->
    <view class="current-weather">
      <view v-if="errorMessage" class="weather-error">{{ errorMessage }}</view>
      <view class="location-info">
        <text class="location-icon">📍</text>
        <text class="location-text">{{ locationName }}</text>
      </view>
      
      <view class="weather-main">
        <view class="weather-icon-large" :class="weatherInfo.iconClass"></view>
        <view class="temp-info">
          <text class="current-temp">{{ weatherInfo.temp || '--' }}°</text>
          <text class="weather-desc">{{ weatherInfo.desc || '获取中...' }}</text>
        </view>
      </view>

      <view class="weather-details">
        <view class="detail-item">
          <text class="detail-label">体感温度</text>
          <text class="detail-value">{{ weatherInfo.feelsLike || '--' }}°</text>
        </view>
        <view class="detail-item">
          <text class="detail-label">湿度</text>
          <text class="detail-value">{{ weatherInfo.humidity || '--' }}%</text>
        </view>
        <view class="detail-item">
          <text class="detail-label">风速</text>
          <text class="detail-value">{{ weatherInfo.windSpeed || '--' }} m/s</text>
        </view>
        <view class="detail-item">
          <text class="detail-label">气压</text>
          <text class="detail-value">{{ weatherInfo.pressure || '--' }} hPa</text>
        </view>
      </view>
    </view>

    <!-- 未来天气预报 -->
    <view class="forecast-section" v-if="forecast.length > 0">
      <view class="section-title">
        <text class="title-icon">📅</text>
        <text class="title-text">未来天气</text>
      </view>
      
      <scroll-view scroll-x class="forecast-scroll">
        <view class="forecast-list">
          <view 
            v-for="(item, index) in forecast" 
            :key="index" 
            class="forecast-item"
          >
            <text class="forecast-date">{{ item.date }}</text>
            <view class="forecast-icon" :class="item.iconClass"></view>
            <text class="forecast-temp">{{ item.temp }}°</text>
            <text class="forecast-desc">{{ item.desc }}</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 生活指数 -->
    <view class="life-index-section" v-if="lifeIndex.length > 0">
      <view class="section-title">
        <text class="title-icon">💡</text>
        <text class="title-text">生活指数</text>
      </view>
      
      <view class="life-index-grid">
        <view 
          v-for="(item, index) in lifeIndex" 
          :key="index" 
          class="life-index-item"
        >
          <view class="life-icon">{{ item.icon }}</view>
          <view class="life-info">
            <text class="life-title">{{ item.title }}</text>
            <text class="life-level">{{ item.level }}</text>
            <text class="life-desc">{{ item.desc }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 空气质量 -->
    <view class="air-quality-section" v-if="airQuality">
      <view class="section-title">
        <text class="title-icon">🌬️</text>
        <text class="title-text">空气质量</text>
      </view>
      
      <view class="air-quality-card">
        <view class="aqi-circle" :class="airQuality.level">
          <text class="aqi-value">{{ airQuality.aqi }}</text>
          <text class="aqi-label">{{ airQuality.label }}</text>
        </view>
        <view class="air-details">
          <view class="air-detail-item">
            <text class="air-detail-label">PM2.5</text>
            <text class="air-detail-value">{{ airQuality.pm25 }} μg/m³</text>
          </view>
          <view class="air-detail-item">
            <text class="air-detail-label">PM10</text>
            <text class="air-detail-value">{{ airQuality.pm10 }} μg/m³</text>
          </view>
          <view class="air-detail-item">
            <text class="air-detail-label">O₃</text>
            <text class="air-detail-value">{{ airQuality.o3 }} μg/m³</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 更新时间 -->
    <view class="update-time">
      <text class="update-text">更新时间：{{ updateTime }}</text>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      locationName: '当前位置',
      weatherInfo: {
        temp: '',
        desc: '',
        iconClass: '',
        feelsLike: '',
        humidity: '',
        windSpeed: '',
        pressure: ''
      },
      forecast: [],
      lifeIndex: [],
      airQuality: null,
      updateTime: '',
      errorMessage: ''
    }
  },
  onShow() {
    this.loadWeatherData()
  },
  methods: {
    goBack() {
      uni.navigateBack()
    },
    
    async loadWeatherData() {
      try {
        // 获取位置
        const location = await this.getLocation()
        
        // 调用云函数获取天气数据
        const res = await uniCloud.callFunction({
          name: 'get-weather',
          data: {
            latitude: location.latitude,
            longitude: location.longitude
          }
        })
        
        if (res.result && res.result.ok && res.result.data) {
          this.parseWeatherData(res.result.data)
        } else {
          this.setWeatherUnavailable(res.result && res.result.message)
        }
      } catch (error) {
        console.error('获取天气数据失败:', error)
        this.setWeatherUnavailable('天气服务暂时不可用，请稍后重试')
      }
    },
    
    getLocation() {
      return new Promise((resolve, reject) => {
        // 1) 优先使用用户手动选择的位置（与首页一致）
        const userLocation = uni.getStorageSync('user_location')
        if (userLocation && userLocation.latitude && userLocation.longitude) {
          this.locationName = userLocation.name || userLocation.address || '当前位置'
          resolve({
            latitude: Number(userLocation.latitude),
            longitude: Number(userLocation.longitude)
          })
          return
        }

        // 2) 使用首页最近一次天气坐标缓存（确保首页卡片与详情一致）
        const lastWeatherLocation = uni.getStorageSync('last_weather_location')
        if (lastWeatherLocation && lastWeatherLocation.latitude && lastWeatherLocation.longitude) {
          this.locationName = lastWeatherLocation.name || lastWeatherLocation.address || '当前位置'
          resolve({
            latitude: Number(lastWeatherLocation.latitude),
            longitude: Number(lastWeatherLocation.longitude)
          })
          return
        }

        // 3) 最后才走系统定位
        uni.getLocation({
          type: 'gcj02',
          success: (res) => {
            resolve({
              latitude: res.latitude,
              longitude: res.longitude
            })
          },
          fail: (err) => {
            // 使用默认位置（北京）
            this.locationName = '北京市'
            resolve({
              latitude: 39.9042,
              longitude: 116.4074
            })
          }
        })
      })
    },
    
    parseWeatherData(data) {
      this.errorMessage = ''
      if (data.now) {
        const now = data.now
        this.weatherInfo = {
          temp: now.temp || '',
          desc: now.text || '',
          iconClass: this.getWeatherIconClass(now.code),
          feelsLike: now.feelsLike || now.temp || '',
          humidity: now.humidity || '',
          windSpeed: now.windScale || now.windSpeed || '',
          pressure: now.pressure || ''
        }
      }
      
      // 更新城市名
      if (data.city) {
        this.locationName = data.city
      }
      
      // 解析预报数据
      if (data.forecast) {
        this.forecast = data.forecast.map((item, index) => ({
          date: this.formatDate(item.date || Date.now() + index * 86400000),
          iconClass: this.getWeatherIconClass(item.code),
          temp: item.temp || '',
          desc: item.text || ''
        }))
      } else {
        this.forecast = []
      }
      this.lifeIndex = Array.isArray(data.lifeIndex) ? data.lifeIndex : []
      this.airQuality = data.airQuality || null
      
      // 更新时间
      this.updateTime = this.formatDateTime(Date.now())
    },
    
    setWeatherUnavailable(message) {
      this.weatherInfo = {
        temp: '', desc: '', iconClass: '', feelsLike: '', humidity: '', windSpeed: '', pressure: ''
      }
      this.forecast = []
      this.lifeIndex = []
      this.airQuality = null
      this.updateTime = ''
      this.errorMessage = message || '天气数据暂不可用'
      uni.showToast({ title: this.errorMessage, icon: 'none', duration: 2500 })
    },
    
    getWeatherIconClass(code) {
      const codeStr = (code !== undefined && code !== null) ? String(code) : '0'
      const iconMap = {
        '0': 'weather-sunny',
        '1': 'weather-cloudy',
        '2': 'weather-overcast',
        '3': 'weather-rain',
        '4': 'weather-rain',
        '5': 'weather-rain',
        '6': 'weather-rain',
        '7': 'weather-rain',
        '8': 'weather-rain',
        '9': 'weather-rain',
        '10': 'weather-rain',
        '11': 'weather-rain',
        '12': 'weather-snow',
        '13': 'weather-snow',
        '14': 'weather-snow',
        '15': 'weather-snow',
        '16': 'weather-fog',
        '17': 'weather-haze',
        '18': 'weather-wind',
        '19': 'weather-dust'
      }
      return iconMap[codeStr] || 'weather-sunny'
    },
    
    formatDate(timestamp) {
      const date = new Date(timestamp)
      const month = date.getMonth() + 1
      const day = date.getDate()
      const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
      const weekday = weekdays[date.getDay()]
      
      if (timestamp === Date.now() || Math.abs(timestamp - Date.now()) < 86400000) {
        return '今天'
      }
      
      return `${month}/${day}`
    },
    
    formatDateTime(timestamp) {
      const date = new Date(timestamp)
      const hours = date.getHours().toString().padStart(2, '0')
      const minutes = date.getMinutes().toString().padStart(2, '0')
      return `${hours}:${minutes}`
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: linear-gradient(180deg, #4f46e5 0%, #7c3aed 100%);
  padding-bottom: 40rpx;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 40rpx 30rpx 20rpx;
}

.back-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
}

.back-icon {
  color: #fff;
  font-size: 36rpx;
}

.header-title {
  color: #fff;
  font-size: 34rpx;
  font-weight: 700;
}

.placeholder {
  width: 60rpx;
}

.current-weather {
  margin: 20rpx 30rpx;
  padding: 40rpx;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border-radius: 30rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.2);
}

.weather-error {
  margin-bottom: 24rpx;
  padding: 18rpx 22rpx;
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
  font-size: 24rpx;
  line-height: 1.5;
}

.location-info {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 30rpx;
}

.location-icon {
  font-size: 32rpx;
}

.location-text {
  color: #fff;
  font-size: 28rpx;
}

.weather-main {
  display: flex;
  align-items: center;
  gap: 40rpx;
  margin-bottom: 40rpx;
}

.weather-icon-large {
  font-size: 120rpx;
  line-height: 1;
}

.weather-icon-large::before {
  content: attr(data-icon);
}

.temp-info {
  display: flex;
  flex-direction: column;
}

.current-temp {
  font-size: 96rpx;
  font-weight: 200;
  color: #fff;
  line-height: 1;
}

.weather-desc {
  font-size: 32rpx;
  color: rgba(255, 255, 255, 0.9);
  margin-top: 10rpx;
}

.weather-details {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.detail-label {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.7);
}

.detail-value {
  font-size: 28rpx;
  color: #fff;
  font-weight: 600;
}

.forecast-section,
.life-index-section,
.air-quality-section {
  margin: 30rpx;
  padding: 30rpx;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border-radius: 30rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.2);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 24rpx;
}

.title-icon {
  font-size: 32rpx;
}

.title-text {
  font-size: 30rpx;
  color: #fff;
  font-weight: 700;
}

.forecast-scroll {
  white-space: nowrap;
}

.forecast-list {
  display: inline-flex;
  gap: 20rpx;
}

.forecast-item {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  padding: 20rpx;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 20rpx;
  min-width: 120rpx;
}

.forecast-date {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
}

.forecast-icon {
  font-size: 48rpx;
}

.forecast-temp {
  font-size: 28rpx;
  color: #fff;
  font-weight: 600;
}

.forecast-desc {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.7);
}

.life-index-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}

.life-index-item {
  display: flex;
  gap: 16rpx;
  padding: 20rpx;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 20rpx;
}

.life-icon {
  font-size: 48rpx;
  line-height: 1;
}

.life-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.life-title {
  font-size: 26rpx;
  color: #fff;
  font-weight: 600;
}

.life-level {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.9);
}

.life-desc {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.7);
}

.air-quality-card {
  display: flex;
  gap: 30rpx;
  align-items: center;
}

.aqi-circle {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.2);
  border: 4rpx solid rgba(255, 255, 255, 0.3);
}

.aqi-circle.excellent {
  background: rgba(34, 197, 94, 0.3);
  border-color: rgba(34, 197, 94, 0.5);
}

.aqi-circle.good {
  background: rgba(59, 130, 246, 0.3);
  border-color: rgba(59, 130, 246, 0.5);
}

.aqi-circle.light {
  background: rgba(251, 191, 36, 0.3);
  border-color: rgba(251, 191, 36, 0.5);
}

.aqi-circle.moderate {
  background: rgba(239, 68, 68, 0.3);
  border-color: rgba(239, 68, 68, 0.5);
}

.aqi-value {
  font-size: 48rpx;
  color: #fff;
  font-weight: 700;
  line-height: 1;
}

.aqi-label {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.9);
  margin-top: 8rpx;
}

.air-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.air-detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.air-detail-label {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.7);
}

.air-detail-value {
  font-size: 26rpx;
  color: #fff;
  font-weight: 600;
}

.update-time {
  text-align: center;
  padding: 20rpx;
}

.update-text {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.6);
}

/* 天气图标样式 */
.weather-sunny::before { content: '☀️'; }
.weather-cloudy::before { content: '⛅'; }
.weather-overcast::before { content: '☁️'; }
.weather-rain::before { content: '🌧️'; }
.weather-snow::before { content: '❄️'; }
.weather-fog::before { content: '🌫️'; }
.weather-haze::before { content: '🌁'; }
.weather-wind::before { content: '💨'; }
.weather-dust::before { content: '🌪️'; }
</style>
