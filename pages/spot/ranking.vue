<template>
  <view class="container" :style="themeVars">
    <view v-if="staleData" class="stale-banner">
      <text>⚠️ 数据可能不是最新</text>
    </view>

    <view class="search-bar">
      <input
        v-model="keyword"
        class="search-input"
        placeholder="搜索景点名称..."
        confirm-type="search"
        @confirm="doSearch"
      />
      <button class="search-btn" @click="doSearch">搜索</button>
    </view>

    <scroll-view
      scroll-y
      class="list"
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
    >
      <view v-if="searchLoading" class="loading-wrap">
        <text class="loading-text">搜索中...</text>
      </view>

      <view v-else-if="searchResults.length > 0" class="search-block">
        <text class="section-label">搜索结果</text>
        <view
          v-for="spot in searchResults"
          :key="spot._id"
          class="spot-card"
          @click="goSpotDetail(spot._id)"
        >
          <image v-if="spot.cover" :src="spot.cover" mode="aspectFill" class="spot-cover" />
          <view v-else class="spot-cover placeholder">
            <text>🏔️</text>
          </view>
          <view class="spot-info">
            <text class="spot-name">{{ spot.name }}</text>
            <text class="spot-desc">{{ (spot.description || '').slice(0, 50) }}{{ spot.description && spot.description.length > 50 ? '...' : '' }}</text>
            <text class="spot-checkin">📍 打卡 {{ spot.checkin_count || 0 }} 次</text>
          </view>
        </view>
      </view>

      <view v-else-if="searched && keyword.trim()" class="empty-search">
        <text class="empty-icon">🔍</text>
        <text class="empty-text">没有找到相关景点</text>
      </view>

      <text class="section-label rank-section-title">热门目的地榜单</text>

      <view v-if="loading && rankings.length === 0" class="loading-wrap">
        <text class="loading-text">加载榜单中...</text>
      </view>
      <view v-else-if="rankings.length === 0" class="empty-state">
        <text class="empty-rank-text">暂无榜单数据</text>
      </view>
      <view v-else>
        <view
          v-for="(item, index) in rankings"
          :key="item.spot_id || index"
          class="rank-item"
          @click="goSpotDetail(item.spot_id)"
        >
          <view class="rank-num-wrap">
            <text class="rank-num" :class="getRankClass(index)">{{ index + 1 }}</text>
          </view>
          <view class="rank-info">
            <text class="rank-name">{{ item.spot_name }}</text>
            <text class="rank-checkin">打卡 {{ item.checkin_count || 0 }} 次</text>
          </view>
          <text class="rank-change" :class="getRankChangeClass(item)">{{ getRankChange(item) }}</text>
        </view>
      </view>
      <view class="scroll-bottom-pad" />
    </scroll-view>
  </view>
</template>

<script>
import { CacheManager, TTL } from '@/utils/cache-manager.js'
import { getLocalRankingData, searchLocalSpots } from '@/utils/local-spot-data.js'

const RANKING_CACHE_KEY = 'ranking_cache'

export default {
  data() {
    return {
      rankings: [],
      loading: false,
      refreshing: false,
      staleData: false,
      keyword: '',
      searchResults: [],
      searchLoading: false,
      searched: false
    }
  },
  onLoad() {
    this.loadRankings(false)
  },
  methods: {
    async loadRankings(forceRefresh = false) {
      if (!forceRefresh) {
        const cached = CacheManager.get(RANKING_CACHE_KEY)
        if (cached) {
          this.rankings = cached
          return
        }
      }
      this.loading = true
      this.staleData = false
      try {
        const res = await uniCloud.callFunction({
          name: 'ranking',
          data: { action: 'get' }
        })
        const snapshot = (res.result && res.result.data) || {}
        const data = snapshot.rankings || []
        if (data.length > 0) {
          this.rankings = data
          CacheManager.set(RANKING_CACHE_KEY, data, TTL.ONE_DAY)
        } else {
          this.useLocalRankingFallback()
        }
      } catch (e) {
        const cached = CacheManager.get(RANKING_CACHE_KEY)
        if (cached) {
          this.rankings = cached
          this.staleData = true
        } else {
          this.useLocalRankingFallback()
        }
      } finally {
        this.loading = false
        this.refreshing = false
      }
    },
    onRefresh() {
      this.refreshing = true
      this.loadRankings(true)
    },
    async doSearch() {
      const kw = this.keyword.trim()
      if (!kw) {
        this.searchResults = searchLocalSpots('')
        this.searched = true
        uni.showToast({ title: '已展示本地热门推荐', icon: 'none' })
        return
      }
      this.searchLoading = true
      this.searched = false
      try {
        const res = await uniCloud.callFunction({
          name: 'spot-search',
          data: { action: 'search', keyword: kw }
        })
        const cloudResults = (res.result && res.result.data) || []
        this.searchResults = cloudResults.length > 0 ? cloudResults : searchLocalSpots(kw)
        this.searched = true
        if (cloudResults.length === 0 && this.searchResults.length > 0) {
          uni.showToast({ title: '未命中云端，已展示本地推荐', icon: 'none' })
        }
      } catch (e) {
        this.searchResults = searchLocalSpots(kw)
        this.searched = true
        uni.showToast({ title: '云端异常，已使用本地数据', icon: 'none' })
      } finally {
        this.searchLoading = false
      }
    },
    getRankChange(item) {
      if (item.prev_rank == null) return '—'
      if (item.rank < item.prev_rank) return '↑'
      if (item.rank > item.prev_rank) return '↓'
      return '—'
    },
    getRankChangeClass(item) {
      const change = this.getRankChange(item)
      if (change === '↑') return 'up'
      if (change === '↓') return 'down'
      return 'flat'
    },
    getRankClass(index) {
      if (index === 0) return 'gold'
      if (index === 1) return 'silver'
      if (index === 2) return 'bronze'
      return ''
    },
    useLocalRankingFallback() {
      const localRankings = getLocalRankingData()
      this.rankings = localRankings
      this.staleData = true
      CacheManager.set(RANKING_CACHE_KEY, localRankings, TTL.ONE_DAY)
      uni.showToast({ title: '已展示本地榜单数据', icon: 'none' })
    },
    goSpotDetail(spotId) {
      if (!spotId) return
      uni.navigateTo({ url: `/pages/spot/spot-detail?id=${spotId}` })
    }
  }
}
</script>

<style scoped>
.container {
  height: 100vh;
  background: var(--theme-background, #f6f7fb);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.stale-banner {
  background: #fef3c7;
  padding: 16rpx 30rpx;
  text-align: center;
  font-size: 26rpx;
  color: #92400e;
  flex-shrink: 0;
}
.search-bar {
  display: flex;
  gap: 16rpx;
  padding: 24rpx 30rpx;
  background: var(--theme-card-bg, #fff);
  border-bottom: 1rpx solid #f3f4f6;
  flex-shrink: 0;
}
.search-input {
  flex: 1;
  height: 80rpx;
  background: #f3f4f6;
  border-radius: 40rpx;
  padding: 0 28rpx;
  font-size: 28rpx;
}
.search-btn {
  height: 80rpx;
  line-height: 80rpx;
  padding: 0 32rpx;
  background: var(--theme-primary-color, #007aff);
  color: #fff;
  border-radius: 40rpx;
  font-size: 28rpx;
  border: none;
}
.list {
  flex: 1;
  min-height: 0;
  padding: 16rpx 0 0;
}
.section-label {
  display: block;
  padding: 12rpx 30rpx 8rpx;
  font-size: 24rpx;
  font-weight: 700;
  color: var(--theme-text-secondary, #6b7280);
}
.rank-section-title {
  margin-top: 8rpx;
}
.search-block {
  padding-bottom: 8rpx;
}
.spot-card {
  display: flex;
  gap: 20rpx;
  background: var(--theme-card-bg, #fff);
  margin: 0 24rpx 20rpx;
  border-radius: 16rpx;
  overflow: hidden;
  padding: 20rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}
.spot-cover {
  width: 160rpx;
  height: 120rpx;
  border-radius: 12rpx;
  flex-shrink: 0;
}
.spot-cover.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f3f4f6;
  font-size: 48rpx;
}
.spot-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
}
.spot-name {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--theme-text-primary, #111827);
}
.spot-desc {
  font-size: 24rpx;
  color: var(--theme-text-secondary, #6b7280);
  line-height: 1.5;
}
.spot-checkin {
  font-size: 22rpx;
  color: #9ca3af;
}
.empty-search {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48rpx 0 24rpx;
}
.empty-icon {
  font-size: 64rpx;
  margin-bottom: 12rpx;
}
.empty-text {
  font-size: 28rpx;
  color: #9ca3af;
}
.loading-wrap {
  display: flex;
  justify-content: center;
  padding: 48rpx;
}
.loading-text {
  font-size: 28rpx;
  color: #9ca3af;
}
.empty-state {
  display: flex;
  justify-content: center;
  padding: 80rpx;
}
.empty-rank-text {
  font-size: 28rpx;
  color: #9ca3af;
}
.rank-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 24rpx 30rpx;
  background: var(--theme-card-bg, #fff);
  margin-bottom: 2rpx;
}
.rank-num-wrap {
  width: 64rpx;
  display: flex;
  justify-content: center;
}
.rank-num {
  font-size: 32rpx;
  font-weight: 800;
  color: var(--theme-text-secondary, #6b7280);
}
.rank-num.gold {
  color: #d97706;
}
.rank-num.silver {
  color: #9ca3af;
}
.rank-num.bronze {
  color: #b45309;
}
.rank-info {
  flex: 1;
  min-width: 0;
}
.rank-name {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--theme-text-primary, #111827);
  display: block;
  margin-bottom: 6rpx;
}
.rank-checkin {
  font-size: 24rpx;
  color: var(--theme-text-secondary, #6b7280);
}
.rank-change {
  font-size: 32rpx;
  font-weight: 700;
  width: 40rpx;
  text-align: center;
}
.rank-change.up {
  color: #16a34a;
}
.rank-change.down {
  color: #dc2626;
}
.rank-change.flat {
  color: #9ca3af;
}
.scroll-bottom-pad {
  height: 48rpx;
}
</style>
