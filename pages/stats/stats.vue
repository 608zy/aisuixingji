<template>
  <view class="container" :style="themeVars">
    <view class="header">
      <text class="title">数据统计</text>
    </view>
    
    <!-- 统计卡片 -->
    <view class="stats-cards">
      <view class="stat-card">
        <text class="stat-value">{{ stats.generationCount }}</text>
        <text class="stat-label">生成次数</text>
      </view>
      <view class="stat-card">
        <text class="stat-value">{{ formatUsageTime(stats.totalUsageTime) }}</text>
        <text class="stat-label">使用时长</text>
      </view>
    </view>
    
    <!-- 常访地点 -->
    <view class="section">
      <view class="section-header">
        <text class="section-title">常访地点</text>
      </view>
      <view v-if="topLocations.length > 0" class="locations-list">
        <view v-for="(location, index) in topLocations" :key="index" class="location-item">
          <view class="location-info">
            <text class="location-rank">{{ index + 1 }}</text>
            <text class="location-name">{{ location.name }}</text>
          </view>
          <text class="location-count">{{ location.count }} 次</text>
        </view>
      </view>
      <view v-else class="empty-state">
        <text class="empty-text">暂无数据</text>
      </view>
    </view>
    
    <!-- 月度统计 -->
    <view class="section">
      <view class="section-header">
        <text class="section-title">月度统计</text>
      </view>
      <view v-if="monthlyData.length > 0" class="chart-container">
        <view class="chart">
          <view v-for="(item, index) in monthlyData" :key="index" class="chart-bar">
            <view class="bar-wrapper">
              <view class="bar" :style="{ height: getBarHeight(item.count) + 'rpx' }"></view>
            </view>
            <text class="bar-label">{{ formatMonth(item.month) }}</text>
            <text class="bar-value">{{ item.count }}</text>
          </view>
        </view>
      </view>
      <view v-else class="empty-state">
        <text class="empty-text">暂无数据</text>
      </view>
    </view>
    
    <!-- 同步按钮 -->
    <view class="actions">
      <button class="btn primary" @click="goAnnualReport">📊 生成年度报告</button>
      <button class="btn outline" @click="syncStats">保存统计数据</button>
    </view>
  </view>
</template>

<script>
import { StatsService } from '@/utils/stats-service.js'

export default {
  data() {
    return {
      stats: {
        generationCount: 0,
        totalUsageTime: 0,
        locations: {},
        monthlyStats: {}
      },
      topLocations: [],
      monthlyData: []
    }
  },
  async onLoad() {
    await this.loadStats()
  },
  async onShow() {
    await this.loadStats()
  },
  methods: {
    async loadStats() {
      try {
        // 加载统计数据
        this.stats = await StatsService.getStats()
        
        // 加载常访地点
        this.topLocations = await StatsService.getMostVisitedLocations(10)
        
        // 加载月度统计
        this.monthlyData = await StatsService.getMonthlyStats(6)
        
      } catch (error) {
        console.error('加载统计数据失败:', error)
        uni.showToast({
          title: '加载失败',
          icon: 'none'
        })
      }
    },
    formatUsageTime(milliseconds) {
      if (!milliseconds) return '0分钟'
      
      const minutes = Math.floor(milliseconds / 60000)
      const hours = Math.floor(minutes / 60)
      
      if (hours > 0) {
        return `${hours}小时${minutes % 60}分钟`
      }
      
      return `${minutes}分钟`
    },
    formatMonth(monthStr) {
      // 将 "2024-01" 格式转换为 "1月"
      const parts = monthStr.split('-')
      return `${parseInt(parts[1])}月`
    },
    getBarHeight(count) {
      if (!count) return 0
      
      // 找出最大值
      const maxCount = Math.max(...this.monthlyData.map(item => item.count))
      
      if (maxCount === 0) return 0
      
      // 计算高度（最大 200rpx）
      return Math.max(20, (count / maxCount) * 200)
    },
    async syncStats() {
      try {
        uni.showLoading({ title: '保存中...' })
        await StatsService.syncToCloud()
        uni.hideLoading()
      } catch (error) {
        uni.hideLoading()
        console.error('操作失败:', error)
        uni.showToast({ title: '操作失败', icon: 'none' })
      }
    },
    goAnnualReport() {
      uni.navigateTo({ url: '/pages/annual-report/annual-report' })
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: #f6f7fb;
  padding: 24rpx;
  padding-bottom: 120rpx;
}
.header {
  padding: 20rpx 0;
}
.title {
  font-size: 48rpx;
  font-weight: 800;
  color: #1f2937;
}
.stats-cards {
  display: flex;
  gap: 24rpx;
  margin-top: 24rpx;
}
.stat-card {
  flex: 1;
  background: #fff;
  border-radius: 16rpx;
  padding: 32rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}
.stat-value {
  font-size: 56rpx;
  font-weight: 800;
  color: #4f46e5;
  margin-bottom: 8rpx;
}
.stat-label {
  font-size: 26rpx;
  color: #6b7280;
}
.section {
  margin-top: 32rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 32rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}
.section-header {
  margin-bottom: 24rpx;
}
.section-title {
  font-size: 32rpx;
  font-weight: 800;
  color: #1f2937;
}
.locations-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.location-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx;
  background: #f9fafb;
  border-radius: 12rpx;
}
.location-info {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.location-rank {
  width: 48rpx;
  height: 48rpx;
  line-height: 48rpx;
  text-align: center;
  background: #4f46e5;
  color: #fff;
  border-radius: 50%;
  font-size: 24rpx;
  font-weight: 800;
}
.location-name {
  font-size: 28rpx;
  color: #1f2937;
}
.location-count {
  font-size: 26rpx;
  color: #6b7280;
}
.chart-container {
  padding: 20rpx 0;
}
.chart {
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  height: 280rpx;
  padding-bottom: 60rpx;
}
.chart-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}
.bar-wrapper {
  height: 200rpx;
  display: flex;
  align-items: flex-end;
  margin-bottom: 8rpx;
}
.bar {
  width: 40rpx;
  background: linear-gradient(180deg, #4f46e5, #7c3aed);
  border-radius: 8rpx 8rpx 0 0;
  transition: height 0.3s ease;
}
.bar-label {
  font-size: 22rpx;
  color: #6b7280;
  margin-top: 8rpx;
}
.bar-value {
  font-size: 24rpx;
  color: #1f2937;
  font-weight: 600;
  margin-top: 4rpx;
}
.empty-state {
  padding: 60rpx 0;
  display: flex;
  justify-content: center;
  align-items: center;
}
.empty-text {
  font-size: 28rpx;
  color: #9ca3af;
}
.actions {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom));
  background: rgba(246, 247, 251, 0.92);
  backdrop-filter: blur(8px);
  border-top: 1rpx solid rgba(17, 24, 39, 0.06);
}
.btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 24rpx;
  font-size: 30rpx;
  border: none;
  font-weight: 800;
}
.primary {
  background: linear-gradient(135deg, #007aff, #4f46e5);
  color: #fff;
  box-shadow: 0 14rpx 30rpx rgba(79, 70, 229, 0.18);
}
</style>
