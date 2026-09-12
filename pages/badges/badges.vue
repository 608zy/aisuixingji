<template>
  <view class="container" :style="themeVars">
    <view class="header">
      <text class="title">旅行成就</text>
      <text class="subtitle">已解锁 {{unlockedCount}} / {{badges.length}}</text>
    </view>
    <view class="badge-grid">
      <view
        v-for="badge in badges"
        :key="badge.id"
        class="badge-card"
        :class="{unlocked: badge.unlocked, locked: !badge.unlocked}"
      >
        <text class="badge-icon">{{badge.unlocked ? badge.icon : '🔒'}}</text>
        <text class="badge-name">{{badge.name}}</text>
        <text class="badge-desc">{{badge.desc}}</text>
        <text v-if="badge.unlocked && badge.unlocked_at" class="badge-time">
          {{formatDate(badge.unlocked_at)}}
        </text>
      </view>
    </view>

    <!-- 解锁动画弹层 -->
    <uni-popup ref="unlockPopup" type="center">
      <view class="unlock-popup" :style="themeVars">
        <text class="unlock-icon">{{newBadge ? newBadge.icon : '🏆'}}</text>
        <text class="unlock-title">解锁成就！</text>
        <text class="unlock-name">{{newBadge ? newBadge.name : ''}}</text>
        <text class="unlock-desc">{{newBadge ? newBadge.desc : ''}}</text>
        <button class="unlock-close" @click="closeUnlockPopup">太棒了！</button>
      </view>
    </uni-popup>
  </view>
</template>

<script>
import { BadgeService } from '@/utils/badge-service.js'

export default {
  data() {
    return {
      badges: [],
      newBadge: null
    }
  },
  computed: {
    unlockedCount() {
      return this.badges.filter(b => b.unlocked).length
    }
  },
  onShow() {
    this.loadBadges()
  },
  methods: {
    async loadBadges() {
      this.badges = BadgeService.getAll()
      // 检查是否有新解锁
      try {
        const newBadges = await BadgeService.checkAndUnlock('view_badges')
        if (newBadges && newBadges.length > 0) {
          this.badges = BadgeService.getAll()
          this.newBadge = newBadges[0]
          this.$nextTick(() => {
            this.$refs.unlockPopup && this.$refs.unlockPopup.open()
          })
        }
      } catch (e) {
        // 静默忽略
      }
    },
    closeUnlockPopup() {
      this.$refs.unlockPopup && this.$refs.unlockPopup.close()
      this.newBadge = null
    },
    formatDate(ts) {
      if (!ts) return ''
      const d = new Date(ts)
      return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} 解锁`
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
.header {
  padding: 40rpx 30rpx 20rpx;
}
.title {
  font-size: 40rpx;
  font-weight: 800;
  color: var(--theme-text-primary, #111827);
  display: block;
}
.subtitle {
  font-size: 26rpx;
  color: var(--theme-text-secondary, #6b7280);
  display: block;
  margin-top: 8rpx;
}
.badge-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
  padding: 20rpx 30rpx;
}
.badge-card {
  width: calc(33.33% - 14rpx);
  background: var(--theme-card-bg, #fff);
  border-radius: 20rpx;
  padding: 24rpx 16rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.05);
  box-sizing: border-box;
}
.badge-card.locked {
  opacity: 0.5;
  filter: grayscale(1);
}
.badge-card.unlocked {
  border: 2rpx solid #fbbf24;
}
.badge-icon {
  font-size: 56rpx;
}
.badge-name {
  font-size: 24rpx;
  font-weight: 700;
  color: var(--theme-text-primary, #111827);
  text-align: center;
}
.badge-desc {
  font-size: 20rpx;
  color: var(--theme-text-secondary, #6b7280);
  text-align: center;
  line-height: 1.4;
}
.badge-time {
  font-size: 18rpx;
  color: #d97706;
  text-align: center;
}
.unlock-popup {
  background: var(--theme-card-bg, #fff);
  border-radius: 32rpx;
  padding: 60rpx 40rpx;
  width: 560rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}
.unlock-icon {
  font-size: 100rpx;
}
.unlock-title {
  font-size: 36rpx;
  font-weight: 800;
  color: var(--theme-text-primary, #111827);
}
.unlock-name {
  font-size: 32rpx;
  font-weight: 700;
  color: #d97706;
}
.unlock-desc {
  font-size: 26rpx;
  color: var(--theme-text-secondary, #6b7280);
  text-align: center;
}
.unlock-close {
  margin-top: 20rpx;
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: #fff;
  border-radius: 40rpx;
  border: none;
  padding: 0 60rpx;
  height: 80rpx;
  line-height: 80rpx;
  font-size: 28rpx;
  font-weight: 700;
}
</style>
