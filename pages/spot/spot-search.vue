<template>
  <view class="redirect-wrap">
    <text class="redirect-text">正在打开热门榜单…</text>
  </view>
</template>

<script>
export default {
  onLoad() {
    uni.redirectTo({
      url: '/pages/spot/ranking',
      fail() {
        uni.reLaunch({ url: '/pages/spot/ranking' })
      }
    })
  }
}
</script>

<style scoped>
.redirect-wrap {
  min-height: 40vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
}
.redirect-text {
  font-size: 28rpx;
  color: #6b7280;
}
</style>
