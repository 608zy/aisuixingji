<template>
  <view class="wrap" :style="themeVars">
    <view class="card">
      <view class="title-row">
        <text class="title">模型设置</text>
      </view>
      <view style="margin-top: 16rpx;">
        <text class="label">AI 模型选择</text>
        <picker class="input" mode="selector" :range="modelList" :value="modelIndex" @change="onModelChange">
          <view class="picker-text">{{ modelList[modelIndex] }}</view>
        </picker>
        <view class="model-desc">
          <text class="desc-text">{{ modelDescriptions[modelIndex] }}</text>
        </view>
        <text class="label" style="margin-top: 20rpx;">AI API 地址</text>
        <input class="input" v-model.trim="baseUrl" placeholder="https://example.com/v1" />
        <text class="label" style="margin-top: 20rpx;">AI API Key</text>
        <input class="input" v-model.trim="apiKey" password placeholder="仅保存在本机，不会提交到项目" />
        <text class="label" style="margin-top: 20rpx;">百度地图 AK（定位地址与足迹补全）</text>
        <input class="input" v-model.trim="baiduMapAK" password placeholder="可选，仅保存在本机" />
        <view class="row" style="margin-top: 16rpx;">
          <button class="btn primary" @click="saveModel">保存 AI 设置</button>
        </view>
      </view>
      <view class="tips">
        <text>不同模型的生成效果和速度略有差异。API Key 只保存在当前设备，请勿使用已公开或共享的密钥。</text>
      </view>
    </view>

    <!-- 历史记录展示 -->
    <view class="card" style="margin-top: 24rpx;">
      <view class="title-row">
        <text class="title">本地历史记录</text>
        <text class="clear-btn" @click="clearHistory">清空</text>
      </view>
      
      <scroll-view scroll-y="true" class="history-list" v-if="history.length > 0">
        <view class="history-item" v-for="item in history" :key="item.id" @click="viewHistoryDetail(item)">
          <image v-if="item.cover" :src="item.cover" mode="aspectFill" class="history-cover"></image>
          <view class="history-info">
            <text class="history-addr">{{ item.address }}</text>
            <text class="history-time">{{ item.time }}</text>
            <text class="history-content">{{ item.content }}</text>
          </view>
        </view>
      </scroll-view>
      
      <view class="empty-tip" v-else>
        <text>暂无生成记录</text>
      </view>
    </view>
    
    <!-- 主题皮肤设置 -->
    <view class="card" style="margin-top: 24rpx;">
      <view class="title-row">
        <text class="title">主题皮肤</text>
      </view>
      <view class="theme-grid">
        <view 
          v-for="theme in themeList" 
          :key="theme.key" 
          class="theme-item"
          :class="{ active: currentTheme === theme.key }"
          @click="selectTheme(theme.key)"
        >
          <view class="theme-preview" :style="{ background: theme.primary }"></view>
          <text class="theme-name">{{ theme.name }}</text>
        </view>
      </view>
    </view>
    
    <!-- 离线缓存与定位记忆（与微信「清缓存」不是同一套存储） -->
    <view class="card" style="margin-top: 24rpx;">
      <view class="title-row">
        <text class="title">缓存与定位记忆</text>
      </view>
      <text class="tips" style="display:block;margin-bottom:16rpx;">
        游记广场、榜单等使用的「离线缓存」保存在以 __cache__ 开头的本地键中；首页「当前位置」若曾在「我的」里选过点，会记住坐标（user_location）。仅清微信开发者工具缓存不一定会删掉它们。
      </text>
      <view class="row">
        <button class="btn outline" @click="clearAppCachesAndLocationHints">清除离线缓存与定位记忆</button>
      </view>
    </view>

    <!-- 数据统计入口 -->
    <view class="card" style="margin-top: 24rpx;">
      <view class="title-row">
        <text class="title">数据统计</text>
      </view>
      <view class="menu-item" @click="goToStats">
        <text class="menu-text">查看统计数据</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>
  </view>
</template>

<script>
import ThemeManager from '@/utils/theme-manager.js'
import { CacheManager } from '@/utils/cache-manager.js'
import { getAIConfig, saveAIConfig } from '@/utils/ai-config.js'
import { getBaiduMapAK, saveBaiduMapAK } from '@/utils/map-config.js'

export default {
  data() {
    return {
      modelList: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
      modelDescriptions: [
        '推荐 - 速度快，效果好，性价比高',
        '高级 - 效果最好，速度较慢',
        '经济 - 速度快，效果一般'
      ],
      modelIndex: 0,
      baseUrl: '',
      apiKey: '',
      baiduMapAK: '',
      history: [],
      themeList: [],
      currentTheme: 'blue'
    }
  },
  onShow() {
    this.loadHistory()
    this.loadThemes()
  },
  onLoad() {
    const config = getAIConfig()
    this.modelIndex = this.modelList.indexOf(config.model) >= 0 ? this.modelList.indexOf(config.model) : 0
    this.baseUrl = config.baseUrl
    this.apiKey = config.apiKey
    this.baiduMapAK = getBaiduMapAK()
  },
  methods: {
    loadThemes() {
      this.themeList = ThemeManager.getThemeList()
      const current = ThemeManager.getCurrentTheme()
      this.currentTheme = uni.getStorageSync('app_theme') || 'blue'
    },
    selectTheme(themeKey) {
      const success = ThemeManager.setTheme(themeKey)
      if (success) {
        this.currentTheme = themeKey
        const theme = ThemeManager.THEMES[themeKey]
        uni.showToast({
          title: `已切换到${theme.name}`,
          icon: 'success',
          duration: 1500
        })
        // themeChanged 事件已在 main.js 全局混入中监听，无需 reLaunch
      } else {
        uni.showToast({
          title: '切换失败',
          icon: 'none'
        })
      }
    },
    loadHistory() {
      this.history = uni.getStorageSync('travel_history') || []
    },
    clearHistory() {
      uni.showModal({
        title: '提示',
        content: '确定要清空所有历史记录吗？',
        success: (res) => {
          if (res.confirm) {
            uni.removeStorageSync('travel_history')
            this.history = []
            uni.showToast({ title: '已清空', icon: 'success' })
          }
        }
      })
    },
    viewHistoryDetail(item) {
      const payload = {
        title: '历史游记',
        address: item.address,
        content: item.content,
        coverSrc: item.cover
      }
      try {
        uni.setStorageSync('temp_note_payload', payload)
        uni.navigateTo({
          url: '/pages/note/note'
        })
      } catch (e) {
        console.error('保存临时数据失败', e)
        uni.showToast({ title: '跳转失败，请重试', icon: 'none' })
      }
    },
    onModelChange(e) {
      this.modelIndex = e.detail.value
    },
    saveModel() {
      const result = saveAIConfig({
        apiKey: this.apiKey,
        baseUrl: this.baseUrl,
        model: this.modelList[this.modelIndex]
      })
      if (result.ok) {
        if (!saveBaiduMapAK(this.baiduMapAK)) {
          uni.showToast({ title: '地图设置保存失败', icon: 'none' })
          return
        }
        this.baseUrl = result.value.baseUrl
        uni.showToast({ title: '保存成功', icon: 'success' })
      } else {
        uni.showToast({ title: result.message, icon: 'none', duration: 2500 })
      }
    },
    goToStats() {
      uni.navigateTo({
        url: '/pages/stats/stats'
      })
    },
    clearAppCachesAndLocationHints() {
      uni.showModal({
        title: '确认清除',
        content: '将删除离线缓存（广场/榜单等）并清除「记住的选点」与上次天气坐标。不会删除登录态与游记历史。',
        success: (res) => {
          if (!res.confirm) return
          try {
            CacheManager.removeAllCached()
          } catch (e) {}
          try {
            uni.removeStorageSync('user_location')
            uni.removeStorageSync('last_weather_location')
          } catch (e) {}
          uni.showToast({ title: '已清除', icon: 'success' })
        }
      })
    }
  }
}
</script>

<style scoped>
.wrap{padding:24rpx;background:var(--theme-background, #f6f7fb);min-height:100vh}
.card{background:var(--theme-card-bg, #fff);border-radius:24rpx;border:1rpx solid rgba(17,24,39,.06);box-shadow:0 16rpx 40rpx rgba(17,24,39,.08);padding:24rpx}
.title-row{display:flex;justify-content:space-between;align-items:center}
.title{display:block;font-size:36rpx;font-weight:800;color:var(--theme-text-primary, #111827)}
.label{display:block;font-size:26rpx;color:var(--theme-text-secondary, #6b7280);margin-bottom:8rpx}
.input{width:100%;height:88rpx;line-height:88rpx;border-radius:18rpx;background:#f3f4f6;padding:0 18rpx;border:2rpx solid #e5e7eb;font-size:28rpx;color:var(--theme-text-primary, #111827)}
.row{display:flex;gap:16rpx;margin-top:18rpx}
.btn{flex:1;height:88rpx;line-height:88rpx;border-radius:24rpx;font-size:30rpx;border:none;font-weight:800}
.primary{background:var(--theme-primary, linear-gradient(135deg,#007aff,#4f46e5));color:#fff;box-shadow:0 14rpx 30rpx rgba(79,70,229,.18)}
.outline{background:#fff;color:#111827;border:2rpx solid rgba(17,24,39,.12)}
.tips{margin-top:14rpx;color:#6b7280;font-size:26rpx}

.clear-btn {
  font-size: 24rpx;
  color: #ef4444;
  padding: 8rpx 20rpx;
  border: 1rpx solid #fee2e2;
  border-radius: 999rpx;
  background: #fef2f2;
}

.menu-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 0;
  border-top: 1rpx solid #f3f4f6;
}

.menu-text {
  font-size: 28rpx;
  color: #111827;
}

.menu-arrow {
  font-size: 48rpx;
  color: #9ca3af;
  font-weight: 300;
}

.history-list {
  margin-top: 20rpx;
  max-height: 800rpx;
}

.history-item {
  display: flex;
  gap: 20rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f3f4f6;
}

.history-item:last-child {
  border-bottom: none;
}

.history-cover {
  width: 120rpx;
  height: 120rpx;
  border-radius: 12rpx;
  flex-shrink: 0;
  background: #f3f4f6;
}

.history-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  overflow: hidden;
}

.history-addr {
  font-size: 28rpx;
  font-weight: bold;
  color: #111827;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-time {
  font-size: 22rpx;
  color: #9ca3af;
}

.history-content {
  font-size: 24rpx;
  color: #4b5563;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  line-height: 1.4;
}

.empty-tip {
  padding: 60rpx 0;
  text-align: center;
  color: #9ca3af;
  font-size: 28rpx;
}

.picker-text {
  height: 88rpx;
  line-height: 88rpx;
  font-size: 28rpx;
  color: #111827;
}

.model-desc {
  margin-top: 12rpx;
  padding: 16rpx;
  background: #f0f9ff;
  border-radius: 12rpx;
  border: 1rpx solid #bfdbfe;
}

.desc-text {
  font-size: 24rpx;
  color: #1e40af;
  line-height: 1.5;
}

/* 主题皮肤样式 */
.theme-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
  margin-top: 16rpx;
}

.theme-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  padding: 16rpx;
  border-radius: 16rpx;
  background: #f9fafb;
  border: 2rpx solid #e5e7eb;
  transition: all 0.3s ease;
}

.theme-item.active {
  border-color: #3b82f6;
  background: #eff6ff;
  box-shadow: 0 4rpx 12rpx rgba(59, 130, 246, 0.2);
}

.theme-preview {
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.15);
}

.theme-name {
  font-size: 22rpx;
  color: #6b7280;
  font-weight: 500;
}

.theme-item.active .theme-name {
  color: #1e40af;
  font-weight: 700;
}
</style>
