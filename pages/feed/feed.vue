<template>
  <view class="container" :style="themeVars">
    <!-- 自定义导航 -->
    <view class="nav-bar">
      <view class="nav-top">
        <view class="back-btn" @click="goBack">‹ 返回</view>
        <text class="nav-title">游记广场</text>
        <view class="nav-right" />
      </view>
      <view class="sort-tabs">
        <text v-for="tab in sortTabs" :key="tab.key" class="tab" :class="{active: sort===tab.key}" @click="changeSort(tab.key)">{{tab.label}}</text>
      </view>
    </view>
    <!-- 离线提示 -->
    <view v-if="isOffline" class="offline-banner"><text>📶 离线模式，显示缓存数据</text></view>
    <!-- 骨架屏 -->
    <view v-if="loading && posts.length===0" class="skeleton-list">
      <view v-for="i in 3" :key="i" class="skeleton-card"></view>
    </view>
    <!-- 帖子列表 -->
    <scroll-view
      v-else
      scroll-y
      class="post-list"
      refresher-enabled
      :refresher-triggered="feedRefreshing"
      @refresherrefresh="onFeedRefresh"
      @scrolltolower="loadMore"
    >
      <view v-for="post in posts" :key="post._id" class="post-card" @click="goDetail(post._id)">
        <image v-if="post.cover" :src="post.cover" mode="aspectFill" class="post-cover" />
        <view class="post-info">
          <text class="post-title">{{post.title || post.address}}</text>
          <text class="post-meta">📍 {{post.address}}</text>
          <view class="post-footer">
            <text class="like-count" :class="{liked: post.isLiked}">❤️ {{post.like_count || 0}}</text>
            <text class="comment-count">💬 {{post.comment_count || 0}}</text>
          </view>
        </view>
      </view>
      <view v-if="loadingMore" class="loading-more"><text>加载中...</text></view>
      <view v-if="noMore && posts.length>0" class="no-more"><text>没有更多了</text></view>
      <view v-if="!loading && posts.length===0" class="empty-state">
        <text class="empty-icon">🌍</text>
        <text class="empty-text">还没有游记，快去生成第一篇吧</text>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { CacheManager, TTL } from '@/utils/cache-manager.js'
import { SensitiveFilter } from '@/utils/sensitive-filter.js'

const FEED_CACHE_KEY = 'feed_cache'
const PAGE_SIZE = 10

export default {
  data() {
    return {
      sortTabs: [
        { key: 'latest', label: '最新' },
        { key: 'hot', label: '最热' },
        { key: 'nearby', label: '附近' }
      ],
      sort: 'latest',
      posts: [],
      page: 1,
      loading: false,
      loadingMore: false,
      noMore: false,
      isOffline: false,
      feedRefreshing: false
    }
  },
  onLoad() {
    this.loadFeed(true)
  },
  methods: {
    onFeedRefresh() {
      this.feedRefreshing = true
      ;['latest', 'hot', 'nearby'].forEach(s => {
        CacheManager.remove(FEED_CACHE_KEY + '_' + s)
      })
      this.posts = []
      this.page = 1
      this.noMore = false
      this.loadFeed(true).finally(() => {
        this.feedRefreshing = false
      })
    },
    goBack() {
      uni.navigateBack({
        delta: 1,
        fail: () => {
          uni.reLaunch({ url: '/pages/index/index' })
        }
      })
    },
    changeSort(key) {
      if (this.sort === key) return
      this.sort = key
      this.posts = []
      this.page = 1
      this.noMore = false
      this.loadFeed(true)
    },
    async loadFeed(refresh = false) {
      if (this.loading) return Promise.resolve()
      if (refresh) {
        CacheManager.remove(FEED_CACHE_KEY + '_' + this.sort)
      }
      this.loading = true
      try {
        const res = await uniCloud.callFunction({
          name: 'community-post',
          data: {
            action: 'list', sort: this.sort, page: 1, pageSize: PAGE_SIZE,
            uniIdToken: uni.getStorageSync('uni_id_token') || ''
          }
        })
        if (!res.result || !res.result.ok) throw new Error(res.result?.message || '加载失败')
        const rawPosts = (res.result && res.result.data) || []
        const filtered = SensitiveFilter.filterPosts(rawPosts)
        const marked = this._markLiked(filtered)
        this.posts = marked
        this.page = 1
        this.noMore = rawPosts.length < PAGE_SIZE
        this.isOffline = false
        CacheManager.set(FEED_CACHE_KEY + '_' + this.sort, marked, TTL.FIVE_MINUTES)
      } catch (e) {
        const offline = await new Promise(resolve => {
          uni.getNetworkType({
            success: r => resolve(r.networkType === 'none'),
            fail: () => resolve(false)
          })
        })
        if (offline) {
          const cached = CacheManager.get(FEED_CACHE_KEY + '_' + this.sort)
          if (cached) {
            this.posts = cached
            this.isOffline = true
          } else {
            this.posts = []
            this.isOffline = true
          }
        } else {
          // 有网络但请求失败：不用旧缓存，避免「清缓存后仍看到旧的一条」
          this.posts = []
          this.isOffline = false
          uni.showToast({ title: '加载失败，请下拉重试', icon: 'none' })
        }
      } finally {
        this.loading = false
      }
    },
    async loadMore() {
      if (this.loadingMore || this.noMore || this.isOffline) return
      this.loadingMore = true
      try {
        const nextPage = this.page + 1
        const res = await uniCloud.callFunction({
          name: 'community-post',
          data: {
            action: 'list', sort: this.sort, page: nextPage, pageSize: PAGE_SIZE,
            uniIdToken: uni.getStorageSync('uni_id_token') || ''
          }
        })
        if (!res.result || !res.result.ok) throw new Error(res.result?.message || '加载失败')
        const rawPosts = (res.result && res.result.data) || []
        const filtered = SensitiveFilter.filterPosts(rawPosts)
        const marked = this._markLiked(filtered)
        this.posts = this.posts.concat(marked)
        this.page = nextPage
        this.noMore = rawPosts.length < PAGE_SIZE
      } catch (e) {
        uni.showToast({ title: '加载失败', icon: 'none' })
      } finally {
        this.loadingMore = false
      }
    },
    _markLiked(posts) {
      try {
        const token = uni.getStorageSync('uni_id_token')
        if (!token) return posts.map(p => ({ ...p, isLiked: false }))
        const likedIds = uni.getStorageSync('liked_post_ids') || []
        const likedSet = new Set(likedIds)
        return posts.map(p => ({ ...p, isLiked: typeof p.isLiked === 'boolean' ? p.isLiked : likedSet.has(p._id) }))
      } catch (e) {
        return posts.map(p => ({ ...p, isLiked: false }))
      }
    },
    goDetail(id) {
      uni.navigateTo({ url: `/pages/feed/post-detail?id=${id}` })
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
.nav-bar {
  padding: 80rpx 30rpx 20rpx;
  background: var(--theme-card-bg, #fff);
  border-bottom: 1rpx solid #f3f4f6;
}
.nav-top{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 16rpx;
  margin-bottom: 20rpx;
}
.nav-title {
  font-size: 40rpx;
  font-weight: 800;
  color: var(--theme-text-primary, #111827);
  display: block;
  text-align: center;
  flex: 1;
}
.nav-right{width: 120rpx; flex-shrink: 0;}
.back-btn{
  width: 120rpx;
  flex-shrink: 0;
  font-size: 26rpx;
  color: var(--theme-text-primary, #111827);
  padding: 10rpx 12rpx;
  border-radius: 999rpx;
  background: #f3f4f6;
  border: 1rpx solid #e5e7eb;
  text-align: center;
}
.sort-tabs {
  display: flex;
  gap: 32rpx;
}
.tab {
  font-size: 28rpx;
  color: var(--theme-text-secondary, #6b7280);
  padding-bottom: 12rpx;
  border-bottom: 4rpx solid transparent;
}
.tab.active {
  color: var(--theme-primary-color, #007aff);
  font-weight: 700;
  border-bottom-color: var(--theme-primary-color, #007aff);
}
.offline-banner {
  background: #fef3c7;
  padding: 16rpx 30rpx;
  text-align: center;
  font-size: 26rpx;
  color: #92400e;
}
.skeleton-list {
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}
.skeleton-card {
  height: 240rpx;
  background: #e5e7eb;
  border-radius: 20rpx;
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.post-list {
  flex: 1;
  padding: 24rpx;
  box-sizing: border-box;
}
.post-card {
  background: var(--theme-card-bg, #fff);
  border-radius: 20rpx;
  overflow: hidden;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.06);
}
.post-cover {
  width: 100%;
  height: 320rpx;
}
.post-info {
  padding: 20rpx 24rpx;
}
.post-title {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--theme-text-primary, #111827);
  display: block;
  margin-bottom: 8rpx;
}
.post-meta {
  font-size: 24rpx;
  color: var(--theme-text-secondary, #6b7280);
  display: block;
  margin-bottom: 16rpx;
}
.post-footer {
  display: flex;
  gap: 24rpx;
}
.like-count, .comment-count {
  font-size: 24rpx;
  color: var(--theme-text-secondary, #6b7280);
}
.like-count.liked {
  color: #ef4444;
}
.loading-more, .no-more {
  text-align: center;
  padding: 24rpx;
  font-size: 26rpx;
  color: #9ca3af;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}
.empty-icon {
  font-size: 100rpx;
  margin-bottom: 24rpx;
}
.empty-text {
  font-size: 28rpx;
  color: #9ca3af;
}
</style>
