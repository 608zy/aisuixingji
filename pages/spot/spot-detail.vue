<template>
  <view class="container" :style="themeVars">
    <view v-if="loading" class="loading-wrap">
      <text class="loading-text">加载中...</text>
    </view>
    <view v-else-if="!spot" class="empty-state">
      <text class="empty-icon">🏔️</text>
      <text class="empty-text">暂无数据</text>
      <button class="guide-btn" @click="goHome">去首页生成游记</button>
    </view>
    <view v-else>
      <image v-if="spot.cover" :src="spot.cover" mode="aspectFill" class="cover" />
      <view class="info-card">
        <view class="name-row">
          <text class="spot-name">{{spot.name}}</text>
          <text v-if="isLoggedIn" class="fav-btn" :class="{favorited: isFavorited}" @click="toggleFavorite">
            {{isFavorited ? '⭐ 已收藏' : '☆ 收藏'}}
          </text>
        </view>
        <text class="description">{{spot.description}}</text>
        <view class="detail-rows">
          <view class="detail-row" v-if="spot.open_hours">
            <text class="detail-label">⏰ 开放时间</text>
            <text class="detail-value">{{spot.open_hours}}</text>
          </view>
          <view class="detail-row">
            <text class="detail-label">🎫 门票价格</text>
            <text class="detail-value">{{spot.ticket_price != null ? '¥' + spot.ticket_price : '免费'}}</text>
          </view>
          <view class="detail-row">
            <text class="detail-label">📍 打卡次数</text>
            <text class="detail-value">{{spot.checkin_count || 0}} 次</text>
          </view>
        </view>
        <button class="map-btn" @click="openMap">🗺️ 查看地图</button>
      </view>

      <!-- 关联游记 -->
      <view class="related-section">
        <text class="section-title">相关游记</text>
        <view v-if="relatedNotes.length > 0" class="note-list">
          <view v-for="note in relatedNotes" :key="note._id" class="note-card">
            <image v-if="note.cover" :src="note.cover" mode="aspectFill" class="note-cover" />
            <view class="note-info">
              <text class="note-title">{{note.title || note.address}}</text>
              <text class="note-like">❤️ {{note.like_count || 0}}</text>
            </view>
          </view>
        </view>
        <view v-else class="no-notes">
          <text>暂无相关游记</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { getLocalSpotById } from '@/utils/local-spot-data.js'

export default {
  data() {
    return {
      spotId: '',
      spot: null,
      relatedNotes: [],
      loading: true,
      isFavorited: false
    }
  },
  computed: {
    isLoggedIn() {
      return !!uni.getStorageSync('uni_id_token')
    }
  },
  onLoad(query) {
    this.spotId = query.id || ''
    this.loadSpot()
  },
  methods: {
    async loadSpot() {
      this.loading = true
      try {
        const res = await uniCloud.callFunction({
          name: 'spot-search',
          data: { action: 'detail', spotId: this.spotId }
        })
        if (res.result && res.result.data) {
          this.spot = res.result.data
          this.loadRelatedNotes()
          if (this.isLoggedIn) this.checkFavorite()
        } else {
          this.useLocalSpotFallback()
        }
      } catch (e) {
        this.useLocalSpotFallback()
      } finally {
        this.loading = false
      }
    },
    async loadRelatedNotes() {
      try {
        const res = await uniCloud.callFunction({
          name: 'community-post',
          data: { action: 'listBySpot', spotId: this.spotId, limit: 10 }
        })
        this.relatedNotes = (res.result && res.result.data) || []
      } catch (e) {
        this.relatedNotes = []
      }
    },
    useLocalSpotFallback() {
      const localSpot = getLocalSpotById(this.spotId)
      if (localSpot) {
        this.spot = localSpot
        this.relatedNotes = this.mockRelatedNotes(localSpot)
        uni.showToast({ title: '已展示本地景点数据', icon: 'none' })
      } else {
        this.spot = null
        uni.showToast({ title: '加载失败', icon: 'none' })
      }
    },
    mockRelatedNotes(spot) {
      const title = (spot && spot.name) || '该景点'
      return [
        {
          _id: `local-note-1-${this.spotId}`,
          cover: '',
          title: `${title} 半日漫游攻略`,
          address: title,
          like_count: 36
        },
        {
          _id: `local-note-2-${this.spotId}`,
          cover: '',
          title: `${title} 拍照打卡路线`,
          address: title,
          like_count: 29
        }
      ]
    },
    async checkFavorite() {
      try {
        const res = await uniCloud.callFunction({
          name: 'community-post',
          data: { action: 'checkFavorite', targetType: 'spot', targetId: this.spotId }
        })
        this.isFavorited = !!(res.result && res.result.isFavorited)
      } catch (e) {}
    },
    async toggleFavorite() {
      if (!this.isLoggedIn) {
        uni.showToast({ title: '请先登录', icon: 'none' })
        return
      }
      const wasFav = this.isFavorited
      this.isFavorited = !wasFav
      try {
        await uniCloud.callFunction({
          name: 'community-post',
          data: { action: wasFav ? 'unfavorite' : 'favorite', targetType: 'spot', targetId: this.spotId }
        })
        uni.showToast({ title: wasFav ? '已取消收藏' : '已收藏', icon: 'success' })
      } catch (e) {
        this.isFavorited = wasFav
        uni.showToast({ title: '操作失败', icon: 'none' })
      }
    },
    openMap() {
      if (!this.spot || !this.spot.latitude || !this.spot.longitude) {
        uni.showToast({ title: '暂无坐标信息', icon: 'none' })
        return
      }
      uni.openLocation({
        latitude: this.spot.latitude,
        longitude: this.spot.longitude,
        name: this.spot.name,
        address: this.spot.description || this.spot.name,
        fail: () => uni.showToast({ title: '打开地图失败', icon: 'none' })
      })
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
.empty-text { font-size: 30rpx; color: #9ca3af; margin-bottom: 40rpx; }
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
.cover {
  width: 100%;
  height: 480rpx;
}
.info-card {
  background: var(--theme-card-bg, #fff);
  padding: 30rpx;
  margin-bottom: 16rpx;
}
.name-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}
.spot-name {
  font-size: 36rpx;
  font-weight: 800;
  color: var(--theme-text-primary, #111827);
}
.fav-btn {
  font-size: 26rpx;
  color: var(--theme-primary-color, #007aff);
  padding: 8rpx 20rpx;
  border: 1rpx solid var(--theme-primary-color, #007aff);
  border-radius: 20rpx;
}
.fav-btn.favorited {
  background: #fef3c7;
  color: #d97706;
  border-color: #d97706;
}
.description {
  font-size: 28rpx;
  color: var(--theme-text-secondary, #6b7280);
  line-height: 1.7;
  display: block;
  margin-bottom: 24rpx;
}
.detail-rows {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-bottom: 24rpx;
}
.detail-row {
  display: flex;
  gap: 16rpx;
}
.detail-label {
  font-size: 26rpx;
  color: var(--theme-text-secondary, #6b7280);
  width: 200rpx;
}
.detail-value {
  font-size: 26rpx;
  color: var(--theme-text-primary, #111827);
  flex: 1;
}
.map-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: var(--theme-primary-color, #007aff);
  color: #fff;
  border-radius: 44rpx;
  font-size: 30rpx;
  border: none;
  font-weight: 700;
}
.related-section {
  background: var(--theme-card-bg, #fff);
  padding: 30rpx;
}
.section-title {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--theme-text-primary, #111827);
  display: block;
  margin-bottom: 24rpx;
}
.note-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.note-card {
  display: flex;
  gap: 16rpx;
  align-items: center;
}
.note-cover {
  width: 120rpx;
  height: 90rpx;
  border-radius: 10rpx;
  flex-shrink: 0;
}
.note-info {
  flex: 1;
}
.note-title {
  font-size: 28rpx;
  color: var(--theme-text-primary, #111827);
  display: block;
  margin-bottom: 8rpx;
}
.note-like {
  font-size: 24rpx;
  color: #9ca3af;
}
.no-notes {
  text-align: center;
  padding: 40rpx;
  font-size: 26rpx;
  color: #9ca3af;
}
</style>
