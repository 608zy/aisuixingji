<template>
  <view class="container" :style="themeVars">
    <!-- 自定义导航 -->
    <view class="nav-bar">
      <text class="nav-back" @click="goBack">‹</text>
      <text class="nav-title">{{year}} 年度旅行报告</text>
    </view>

    <view v-if="loading" class="loading-wrap">
      <text class="loading-text">正在生成报告...</text>
    </view>
    <view v-else-if="!report" class="empty-state">
      <text class="empty-icon">✈️</text>
      <text class="empty-text">今年还没有旅行记录，快去探索吧！</text>
      <button class="guide-btn" @click="goHome">去首页生成游记</button>
    </view>
    <view v-else class="report-content">
      <!-- 统计卡片 -->
      <view class="stats-row">
        <view class="stat-card">
          <text class="stat-num">{{report.totalNotes}}</text>
          <text class="stat-label">游记总数</text>
        </view>
        <view class="stat-card">
          <text class="stat-num">{{report.cityCount}}</text>
          <text class="stat-label">打卡城市</text>
        </view>
        <view class="stat-card">
          <text class="stat-num">{{report.provinceCount}}</text>
          <text class="stat-label">足迹省份</text>
        </view>
      </view>

      <!-- Top 3 地点 -->
      <view class="section-card">
        <text class="section-title">🏆 最常去的地方</text>
        <view v-if="report.topLocations && report.topLocations.length > 0" class="top-list">
          <view v-for="(loc, i) in report.topLocations" :key="i" class="top-item">
            <text class="top-rank">{{i + 1}}</text>
            <text class="top-name">{{loc.name}}</text>
            <text class="top-count">{{loc.count}} 次</text>
          </view>
        </view>
        <text v-else class="no-data">暂无数据</text>
      </view>

      <!-- 月度趋势图 -->
      <view class="section-card">
        <text class="section-title">📊 月度趋势</text>
        <view class="chart">
          <view v-for="(item, i) in report.monthlyTrend" :key="i" class="chart-bar">
            <view class="bar-wrap">
              <view class="bar" :style="{height: getBarHeight(item) + 'rpx'}"></view>
            </view>
            <text class="bar-label">{{i + 1}}月</text>
            <text class="bar-val">{{item}}</text>
          </view>
        </view>
      </view>

      <!-- 保存按钮 -->
      <button class="save-btn" @click="saveReport">📷 保存报告图片</button>
    </view>

    <!-- 与 ShareGenerator 一致 canvas-id -->
    <canvas
      canvas-id="shareCanvas"
      class="report-canvas"
      :style="{ width: shareCanvasW + 'px', height: shareCanvasH + 'px' }"
      :width="shareCanvasW"
      :height="shareCanvasH"
    ></canvas>
  </view>
</template>

<script>
import { ShareGenerator } from '@/utils/share-generator.js'

export default {
  data() {
    return {
      year: new Date().getFullYear(),
      report: null,
      loading: true,
      shareCanvasW: 375,
      shareCanvasH: 667
    }
  },
  onLoad() {
    const d = ShareGenerator.getPosterDimensions()
    this.shareCanvasW = d.width
    this.shareCanvasH = d.height
    this.generateReport()
  },
  methods: {
    generateReport() {
      this.loading = true
      try {
        const history = uni.getStorageSync('travel_history') || []
        const yearStr = String(this.year)
        const yearNotes = history.filter(n => {
          const ts = n.created_at || n.timestamp || 0
          return new Date(ts).getFullYear() === this.year
        })

        if (yearNotes.length === 0) {
          this.report = null
          this.loading = false
          return
        }

        // 统计城市和省份
        const cities = new Set()
        const provinces = new Set()
        const locationCount = {}
        const provinceKeywords = ['北京', '上海', '天津', '重庆', '河北', '山西', '辽宁', '吉林', '黑龙江', '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南', '广东', '海南', '四川', '贵州', '云南', '陕西', '甘肃', '青海', '台湾', '内蒙古', '广西', '西藏', '宁夏', '新疆', '香港', '澳门']

        yearNotes.forEach(n => {
          if (n.city) cities.add(n.city)
          if (n.address) {
            provinceKeywords.forEach(p => {
              if (n.address.includes(p)) provinces.add(p)
            })
            const addr = n.address.slice(0, 10)
            locationCount[addr] = (locationCount[addr] || 0) + 1
          }
        })

        // Top 3 地点
        const topLocations = Object.entries(locationCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name, count]) => ({ name, count }))

        // 月度趋势（12个月）
        const monthlyTrend = Array(12).fill(0)
        yearNotes.forEach(n => {
          const ts = n.created_at || n.timestamp || 0
          const month = new Date(ts).getMonth()
          monthlyTrend[month]++
        })

        this.report = {
          totalNotes: yearNotes.length,
          cityCount: cities.size,
          provinceCount: provinces.size,
          topLocations,
          monthlyTrend
        }
      } catch (e) {
        console.error('生成报告失败', e)
        this.report = null
      } finally {
        this.loading = false
      }
    },
    getBarHeight(count) {
      if (!this.report) return 0
      const max = Math.max(...this.report.monthlyTrend)
      if (max === 0) return 0
      return Math.max(8, (count / max) * 160)
    },
    async saveReport() {
      try {
        uni.showLoading({ title: '生成中...' })
        const imagePath = await ShareGenerator.generateShareImage({
          title: `${this.year} 年度旅行报告`,
          content: `游记 ${this.report.totalNotes} 篇 · 打卡 ${this.report.cityCount} 城市 · 足迹 ${this.report.provinceCount} 省份`,
          address: `Top 地点：${this.report.topLocations.map(l => l.name).join('、')}`
        })
        uni.hideLoading()
        await ShareGenerator.saveToAlbum(imagePath)
      } catch (e) {
        uni.hideLoading()
        uni.showToast({ title: '保存失败', icon: 'none' })
      }
    },
    goBack() {
      uni.navigateBack()
    },
    goHome() {
      uni.reLaunch({ url: '/pages/index/index' })
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: var(--theme-background, #f6f7fb);
  padding-bottom: 40rpx;
}
.nav-bar {
  display: flex;
  align-items: center;
  padding: 80rpx 30rpx 20rpx;
  background: var(--theme-card-bg, #fff);
  border-bottom: 1rpx solid #f3f4f6;
}
.nav-back {
  font-size: 48rpx;
  color: var(--theme-text-primary, #111827);
  margin-right: 16rpx;
  line-height: 1;
}
.nav-title {
  font-size: 34rpx;
  font-weight: 800;
  color: var(--theme-text-primary, #111827);
}
.loading-wrap {
  display: flex;
  justify-content: center;
  padding: 120rpx;
}
.loading-text { font-size: 28rpx; color: #9ca3af; }
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 40rpx;
}
.empty-icon { font-size: 100rpx; margin-bottom: 24rpx; }
.empty-text {
  font-size: 30rpx;
  color: #9ca3af;
  text-align: center;
  margin-bottom: 40rpx;
}
.guide-btn {
  background: var(--theme-primary-color, #007aff);
  color: #fff;
  border-radius: 40rpx;
  border: none;
  padding: 0 40rpx;
  height: 80rpx;
  line-height: 80rpx;
  font-size: 28rpx;
}
.report-content {
  padding: 24rpx 30rpx;
}
.stats-row {
  display: flex;
  gap: 16rpx;
  margin-bottom: 24rpx;
}
.stat-card {
  flex: 1;
  background: var(--theme-card-bg, #fff);
  border-radius: 20rpx;
  padding: 30rpx 16rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.05);
}
.stat-num {
  font-size: 52rpx;
  font-weight: 900;
  color: var(--theme-primary-color, #007aff);
}
.stat-label {
  font-size: 22rpx;
  color: var(--theme-text-secondary, #6b7280);
  margin-top: 8rpx;
}
.section-card {
  background: var(--theme-card-bg, #fff);
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.05);
}
.section-title {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--theme-text-primary, #111827);
  display: block;
  margin-bottom: 20rpx;
}
.top-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.top-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.top-rank {
  width: 48rpx;
  height: 48rpx;
  line-height: 48rpx;
  text-align: center;
  background: var(--theme-primary-color, #007aff);
  color: #fff;
  border-radius: 50%;
  font-size: 24rpx;
  font-weight: 800;
}
.top-name {
  flex: 1;
  font-size: 28rpx;
  color: var(--theme-text-primary, #111827);
}
.top-count {
  font-size: 24rpx;
  color: var(--theme-text-secondary, #6b7280);
}
.no-data {
  font-size: 26rpx;
  color: #9ca3af;
}
.chart {
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  height: 220rpx;
  padding-bottom: 50rpx;
}
.chart-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}
.bar-wrap {
  height: 160rpx;
  display: flex;
  align-items: flex-end;
  margin-bottom: 8rpx;
}
.bar {
  width: 28rpx;
  background: linear-gradient(180deg, var(--theme-primary-color, #007aff), #4f46e5);
  border-radius: 6rpx 6rpx 0 0;
  min-height: 4rpx;
}
.bar-label {
  font-size: 18rpx;
  color: #9ca3af;
}
.bar-val {
  font-size: 18rpx;
  color: var(--theme-text-primary, #111827);
  font-weight: 600;
}
.save-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: linear-gradient(135deg, #007aff, #4f46e5);
  color: #fff;
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 700;
  border: none;
}
.report-canvas {
  position: fixed;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  pointer-events: none;
}
</style>
