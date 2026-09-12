<template>
  <view class="wrap" :style="themeVars">
    <view class="card profile">
      <image class="avatar" :src="avatarUrl || defaultAvatar" mode="aspectFill" />
      <view class="profile-info">
        <text class="name">{{ displayName }}</text>
        <text class="sub">{{ isLoggedIn ? '已登录（可解锁同步等功能）' : '未登录（登录后可同步/跨设备恢复）' }}</text>
      </view>
      <view class="profile-actions">
        <button v-if="!isLoggedIn" class="btn primary" @click="goLogin">微信一键登录</button>
        <button v-else class="btn outline" @click="logout">退出登录</button>
      </view>
    </view>

    <view class="card">
      <view class="row">
        <text class="row-title">历史记录同步</text>
        <text class="badge" :class="cloudStatusClass">{{ isLoggedIn ? cloudStatusText : '需登录' }}</text>
      </view>
      <text class="desc">
        历史记录保存在本地（travel_history）{{ isLoggedIn ? '，可随时同步到云端或从云端恢复。' : '。登录后将支持同步到云端与跨设备恢复。' }}
      </text>
      <text v-if="cloudStatus === 'error' && isLoggedIn" class="error-hint">
        错误信息: {{ cloudError }}
      </text>
      <view class="row-actions">
        <button class="btn primary" :disabled="!isLoggedIn || cloudStatus !== 'ready'" @click="syncNow">立即同步</button>
        <button class="btn outline" :disabled="!isLoggedIn || cloudStatus !== 'ready'" @click="restoreFromCloud">从云端恢复</button>
      </view>
      <text v-if="!isLoggedIn" class="hint">提示：先登录即可解锁同步功能。</text>
      <text v-if="isLoggedIn && cloudStatus === 'error'" class="hint">提示：云函数接入失败，请检查云函数是否已上传并配置正确。</text>
    </view>

    <view class="card">
      <view class="row">
        <text class="row-title">快捷入口</text>
      </view>
      <view class="row-actions">
        <button class="btn outline" @click="goSettings">设置</button>
        <button class="btn outline" @click="handleChooseLocation">位置</button>
        <button class="btn outline danger" @click="clearUserLocation">清除位置</button>
        <button class="btn outline" @click="goHome">回首页</button>
      </view>
    </view>
    
    <!-- 新功能入口 -->
    <view class="card" style="margin-top: 24rpx;">
      <view class="row">
        <text class="row-title">探索更多</text>
      </view>
      <view class="feature-list">
        <view class="feature-item" @click="goToMap">
          <view class="feature-icon">🗺️</view>
          <view class="feature-info">
            <text class="feature-title">地图足迹</text>
            <text class="feature-desc">查看去过的地方</text>
          </view>
          <text class="feature-arrow">›</text>
        </view>
        
        <view class="feature-item" @click="goToPlan">
          <view class="feature-icon">📋</view>
          <view class="feature-info">
            <text class="feature-title">行程规划</text>
            <text class="feature-desc">智能整理行程单</text>
          </view>
          <text class="feature-arrow">›</text>
        </view>

        <view class="feature-item" @click="goToFeed">
          <view class="feature-icon">📰</view>
          <view class="feature-info">
            <text class="feature-title">游记广场</text>
            <text class="feature-desc">发现精彩旅行故事</text>
          </view>
          <text class="feature-arrow">›</text>
        </view>

        <view class="feature-item" @click="goToRanking">
          <view class="feature-icon">🏆</view>
          <view class="feature-info">
            <text class="feature-title">热门榜单</text>
            <text class="feature-desc">搜索景点 · 热门目的地排行</text>
          </view>
          <text class="feature-arrow">›</text>
        </view>

        <view class="feature-item" @click="goToBadges">
          <view class="feature-icon">🎖️</view>
          <view class="feature-info">
            <text class="feature-title">我的成就</text>
            <text class="feature-desc">解锁旅行徽章</text>
          </view>
          <text class="feature-arrow">›</text>
        </view>

        <view class="feature-item" @click="goToAnnualReport">
          <view class="feature-icon">📊</view>
          <view class="feature-info">
            <text class="feature-title">年度报告</text>
            <text class="feature-desc">回顾一年旅行足迹</text>
          </view>
          <text class="feature-arrow">›</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { HistoryManager } from '@/utils/history-manager.js'

export default {
  data() {
    return {
      defaultAvatar:
        'data:image/svg+xml;utf8,' +
        encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
            <defs>
              <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stop-color="#4f46e5"/><stop offset="1" stop-color="#007aff"/>
              </linearGradient>
            </defs>
            <rect width="120" height="120" rx="60" fill="url(#g)"/>
            <circle cx="60" cy="48" r="18" fill="rgba(255,255,255,.92)"/>
            <path d="M24 102c8-18 24-28 36-28s28 10 36 28" fill="rgba(255,255,255,.92)"/>
          </svg>`
        ),
      cloudStatus: 'checking', // checking, ready, error
      cloudError: ''
    }
  },
  computed: {
    token() {
      return uni.getStorageSync('uni_id_token') || ''
    },
    isLoggedIn() {
      return !!this.token
    },
    userInfo() {
      // uni-id-pages/uni-id-clientdb 常见会写入该 key；若没有也不影响登录判定
      return uni.getStorageSync('uni_id_user_info') || null
    },
    displayName() {
      const u = this.userInfo || {}
      return u.nickName || u.nickname || u.username || '游客'
    },
    avatarUrl() {
      const u = this.userInfo || {}
      return u.avatarUrl || u.avatar || ''
    },
    cloudStatusText() {
      if (this.cloudStatus === 'checking') return '检测中...'
      if (this.cloudStatus === 'ready') return '云端就绪'
      return '接入失败'
    },
    cloudStatusClass() {
      if (this.cloudStatus === 'ready') return 'ok'
      if (this.cloudStatus === 'error') return 'error'
      return ''
    }
  },
  onShow() {
    // 进入页面即刷新一次显示
    this.refresh()
    // 检测云函数状态
    if (this.isLoggedIn) {
      this.checkCloudStatus()
    }
  },
  methods: {
    refresh() {
      // 目前基于本地 token/userInfo 显示即可
      // 后续接入 uni-id-pages 后，你也可以在这里调用 getCurrentUserInfo 做一次兜底刷新
      this.$forceUpdate()
    },
    async checkCloudStatus() {
      try {
        console.log('[CloudCheck] 开始检测云函数状态...')
        this.cloudStatus = 'checking'

        // 用 get-weather 测连通（无需登录；sync-notes 的 ping 未登录会返回 ok:false，且易误导）
        const res = await uniCloud.callFunction({
          name: 'get-weather',
          data: {
            latitude: 39.9042,
            longitude: 116.4074
          },
          timeout: 12000
        })

        console.log('[CloudCheck] 云函数响应:', res)

        if (res.result && res.result.ok) {
          this.cloudStatus = 'ready'
          this.cloudError = ''
          console.log('[CloudCheck] 云端就绪')
        } else {
          throw new Error((res.result && res.result.message) || '云函数返回异常')
        }
      } catch (error) {
        console.error('[CloudCheck] 云函数检测失败:', error)
        this.cloudStatus = 'error'
        const msg = error && (error.message || error.errMsg)
        this.cloudError = msg || '连接失败'
      }
    },
    async goLogin() {
      // 这里直接跳 uni-id-pages 的登录页（你安装 uni-id-pages 后即可用）
      const candidates = [
        '/uni_modules/uni-id-pages/pages/login/login-withoutpwd',
        '/uni_modules/uni-id-pages/pages/login/login-withpwd',
        '/uni_modules/uni-id-pages/pages/login/login'
      ]

      for (const url of candidates) {
        try {
          await new Promise((resolve, reject) => {
            uni.navigateTo({
              url,
              success: resolve,
              fail: reject
            })
          })
          return
        } catch (e) {}
      }

      uni.showModal({
        title: '缺少登录模块',
        content:
          '当前项目未安装 uni-id-pages（或路由未加入 pages.json）。请在 HBuilderX 插件市场安装 uni-id-pages，然后重新运行。需要的话我也可以继续把云端 uni-id 配置与同步云函数补齐。',
        showCancel: false
      })
    },
    logout() {
      // 最小化退出：清 token + 用户信息
      const keysToRemove = [
        'uni_id_token',
        'uni_id_token_expired',
        'uni_id_refresh_token',
        'uni_id_user_info'
      ]
      keysToRemove.forEach((k) => {
        try {
          uni.removeStorageSync(k)
        } catch (e) {}
      })
      uni.showToast({ title: '已退出', icon: 'success' })
      this.refresh()
    },
    async syncNow() {
      try {
        uni.showLoading({ title: '正在同步...' })
        
        // 获取本地历史记录
        const localNotes = uni.getStorageSync('travel_history') || []
        
        if (localNotes.length === 0) {
          uni.hideLoading()
          uni.showToast({ title: '暂无数据需要同步', icon: 'none' })
          return
        }
        
        // 获取 token
        const token = uni.getStorageSync('uni_id_token') || ''
        if (!token) {
          uni.hideLoading()
          uni.showToast({ title: '请先登录', icon: 'none' })
          return
        }
        
        // 调用云函数同步
        const res = await uniCloud.callFunction({
          name: 'sync-notes',
          data: {
            action: 'upload',
            uniIdToken: token,
            notes: localNotes
          }
        })
        
        uni.hideLoading()
        
        if (res.result && res.result.ok) {
          const syncedIds = new Set((res.result.data || []).map(note => String(note.id)))
          if (syncedIds.size > 0) {
            const updatedLocalNotes = localNotes.map(note =>
              syncedIds.has(String(note.id)) ? { ...note, synced: true } : note
            )
            uni.setStorageSync('travel_history', updatedLocalNotes)
          }
          uni.showToast({
            title: res.result.failed > 0
              ? `成功 ${res.result.count || 0} 条，失败 ${res.result.failed} 条`
              : `同步成功 ${res.result.count || 0} 条`,
            icon: res.result.failed > 0 ? 'none' : 'success',
            duration: res.result.failed > 0 ? 3000 : 1500
          })
        } else {
          const errCode = res.result?.error
          const errorMessage = res.result?.message || '同步失败'
          if (errCode === 'token_expired' || errCode === 'token_invalid' || errCode === 'not_logged_in' || errorMessage.includes('登录')) {
            try {
              uni.removeStorageSync('uni_id_token')
              uni.removeStorageSync('uni_id_token_expired')
              uni.removeStorageSync('uni_id_user_info')
              uni.removeStorageSync('uni-id-pages-userInfo')
              this.refresh()
            } catch (e) {}
            uni.showModal({
              title: '登录已失效',
              content: '登录状态已过期或无效，请重新登录后再试。',
              showCancel: false
            })
            return
          }
          throw new Error(errorMessage)
        }
      } catch (error) {
        uni.hideLoading()
        console.error('同步失败:', error)
        uni.showToast({
          title: '同步失败: ' + (error.message || '未知错误'),
          icon: 'none',
          duration: 3000
        })
      }
    },
    async restoreFromCloud() {
      try {
        uni.showLoading({ title: '正在恢复...' })
        
        // 获取 token
        const token = uni.getStorageSync('uni_id_token') || ''
        if (!token) {
          uni.hideLoading()
          uni.showToast({ title: '请先登录', icon: 'none' })
          return
        }
        
        // 调用云函数下载
        const res = await uniCloud.callFunction({
          name: 'sync-notes',
          data: {
            action: 'download',
            uniIdToken: token
          }
        })
        
        if (res.result && res.result.ok) {
          const cloudNotes = res.result.data || []
          
          if (cloudNotes.length === 0) {
            uni.hideLoading()
            uni.showToast({ title: '云端暂无数据', icon: 'none' })
            return
          }
          
          const mergedNotes = await HistoryManager.mergeNotes(cloudNotes)
          
          uni.hideLoading()
          uni.showToast({
            title: `恢复成功，共 ${mergedNotes.length} 条`,
            icon: 'success'
          })
        } else {
          const errCode = res.result?.error
          const errorMessage = res.result?.message || '恢复失败'
          if (errCode === 'token_expired' || errCode === 'token_invalid' || errCode === 'not_logged_in' || errorMessage.includes('登录')) {
            try {
              uni.removeStorageSync('uni_id_token')
              uni.removeStorageSync('uni_id_token_expired')
              uni.removeStorageSync('uni_id_user_info')
              uni.removeStorageSync('uni-id-pages-userInfo')
              this.refresh()
            } catch (e) {}
            uni.showModal({
              title: '登录已失效',
              content: '登录状态已过期或无效，请重新登录后再试。',
              showCancel: false
            })
            return
          }
          throw new Error(errorMessage)
        }
      } catch (error) {
        uni.hideLoading()
        console.error('恢复失败:', error)
        uni.showToast({
          title: '恢复失败: ' + (error.message || '未知错误'),
          icon: 'none',
          duration: 3000
        })
      }
    },
    goSettings() {
      uni.navigateTo({ url: '/pages/settings/settings' })
    },
    handleChooseLocation() {
      console.log('[HandleChooseLocation] 按钮被点击')
      // 添加点击反馈
      try {
        uni.vibrateShort({ type: 'light' })
      } catch (e) {}
      this.chooseLocation()
    },
    chooseLocation() {
      console.log('[ChooseLocation] 点击位置按钮')

      // #ifdef MP-WEIXIN
      // 说明：不要先强依赖 getLocation 再打开地图——部分基础库下高精度参数会导致长时间无回调，chooseLocation 永远不执行。
      // 策略：先用本地缓存作地图中心（不申请定位）；没有再短时定位；仍失败则用北京作初始中心（避免微信无参时默认落在广州一带）。
      const FALLBACK_CENTER = { latitude: 39.9042, longitude: 116.4074 }
      let opened = false

      const openMap = (lat, lng) => {
        if (opened) return
        opened = true
        try {
          uni.hideLoading()
        } catch (e) {}

        const opts = {
          success: (res) => {
            console.log('选择位置成功:', res)
            try {
              uni.setStorageSync('user_location', {
                latitude: Number(res.latitude),
                longitude: Number(res.longitude),
                address: res.address || '',
                name: res.name || '',
                source: 'manual',
                updatedAt: Date.now()
              })
            } catch (e) {
              console.error('保存位置失败', e)
            }
            uni.showToast({
              title: '位置已更新',
              icon: 'success'
            })
            setTimeout(() => {
              uni.reLaunch({ url: '/pages/index/index' })
            }, 800)
          },
          fail: (err) => {
            console.error('选择位置失败:', err)
            opened = false
            if (err.errMsg && err.errMsg.includes('cancel')) {
              console.log('[ChooseLocation] 用户取消选择')
            } else {
              uni.showToast({
                title: '选择位置失败：' + (err.errMsg || '未知错误'),
                icon: 'none',
                duration: 3000
              })
            }
          }
        }
        const la = lat != null ? Number(lat) : NaN
        const ln = lng != null ? Number(lng) : NaN
        if (Number.isFinite(la) && Number.isFinite(ln)) {
          opts.latitude = la
          opts.longitude = ln
        }
        uni.chooseLocation(opts)
      }

      const readCachedCenter = () => {
        try {
          const u = uni.getStorageSync('user_location')
          if (u && u.latitude != null && u.longitude != null) {
            const la = Number(u.latitude)
            const ln = Number(u.longitude)
            if (Number.isFinite(la) && Number.isFinite(ln)) return { la, ln }
          }
          const w = uni.getStorageSync('last_weather_location')
          if (w && w.latitude != null && w.longitude != null) {
            const la = Number(w.latitude)
            const ln = Number(w.longitude)
            if (Number.isFinite(la) && Number.isFinite(ln)) return { la, ln }
          }
        } catch (e) {}
        return null
      }

      const cached = readCachedCenter()
      if (cached) {
        openMap(cached.la, cached.ln)
        return
      }

      uni.showLoading({ title: '准备地图…', mask: true })
      let settled = false
      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        console.warn('[ChooseLocation] 定位超时，使用默认中心打开选点')
        openMap(FALLBACK_CENTER.latitude, FALLBACK_CENTER.longitude)
      }, 6500)

      uni.getLocation({
        type: 'gcj02',
        success: (res) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          openMap(res.latitude, res.longitude)
        },
        fail: (err) => {
          console.warn('[ChooseLocation] getLocation 失败，使用默认中心', err)
          if (settled) return
          settled = true
          clearTimeout(timer)
          openMap(FALLBACK_CENTER.latitude, FALLBACK_CENTER.longitude)
        }
      })
      // #endif
      
      // #ifndef MP-WEIXIN
      // 非微信小程序环境（如 H5、App）的兜底方案
      uni.showToast({
        title: '该功能仅支持微信小程序',
        icon: 'none'
      })
      // #endif
    },
    clearUserLocation() {
      try {
        uni.removeStorageSync('user_location')
        try {
          uni.removeStorageSync('last_weather_location')
        } catch (e2) {}
        uni.showToast({ title: '已恢复自动定位', icon: 'success' })
        setTimeout(() => {
          uni.reLaunch({ url: '/pages/index/index' })
        }, 600)
      } catch (e) {
        uni.showToast({ title: '清除失败', icon: 'none' })
      }
    },
    goHome() {
      // 项目未配置 tabBar，不能用 switchTab
      uni.reLaunch({ url: '/pages/index/index' })
    },
    goToMap() {
      uni.navigateTo({
        url: '/pages/map/map'
      })
    },
    goToPlan() {
      uni.navigateTo({
        url: '/pages/plan/plan'
      })
    },
    goToFeed() {
      uni.navigateTo({ url: '/pages/feed/feed' })
    },
    goToRanking() {
      uni.navigateTo({ url: '/pages/spot/ranking' })
    },
    goToBadges() {
      uni.navigateTo({ url: '/pages/badges/badges' })
    },
    goToAnnualReport() {
      uni.navigateTo({ url: '/pages/annual-report/annual-report' })
    }
  }
}
</script>

<style scoped>
.wrap{padding:24rpx;background:var(--theme-background, #f6f7fb);min-height:100vh}
.card{background:var(--theme-card-bg, #fff);border-radius:24rpx;border:1rpx solid rgba(17,24,39,.06);box-shadow:0 16rpx 40rpx rgba(17,24,39,.08);padding:24rpx;margin-bottom: 24rpx;}
.profile{display:flex;gap:18rpx;align-items:center}
.avatar{width:112rpx;height:112rpx;border-radius:999rpx;background:#f3f4f6;flex-shrink:0}
.profile-info{flex:1;min-width:0}
.name{display:block;font-size:34rpx;font-weight:900;color:var(--theme-text-primary, #111827);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sub{display:block;margin-top:6rpx;font-size:24rpx;color:var(--theme-text-secondary, #6b7280)}
.profile-actions{display:flex;flex-direction:column;gap:12rpx;flex-shrink:0}

.row{display:flex;justify-content:space-between;align-items:center}
.row-title{font-size:30rpx;font-weight:900;color:var(--theme-text-primary, #111827)}
.badge{font-size:22rpx;padding:6rpx 14rpx;border-radius:999rpx;border:1rpx solid #e5e7eb;background:#f3f4f6;color:#6b7280}
.badge.ok{border-color:#bbf7d0;background:#ecfdf5;color:#047857}
.badge.error{border-color:#fecaca;background:#fef2f2;color:#dc2626}
.desc{display:block;margin-top:12rpx;font-size:26rpx;color:var(--theme-text-secondary, #4b5563);line-height:1.5}
.error-hint{display:block;margin-top:8rpx;font-size:24rpx;color:#dc2626;background:#fef2f2;padding:12rpx;border-radius:8rpx;border:1rpx solid #fecaca}
.hint{display:block;margin-top:10rpx;font-size:24rpx;color:#9ca3af}

.row-actions{display:flex;gap:16rpx;margin-top:16rpx}
.btn{height:80rpx;line-height:80rpx;border-radius:20rpx;font-size:28rpx;border:none;font-weight:900;padding:0 18rpx}
.primary{background:var(--theme-primary, linear-gradient(135deg,#007aff,#4f46e5));color:#fff;box-shadow:0 14rpx 30rpx rgba(79,70,229,.18)}
.outline{background:var(--theme-card-bg, #fff);color:var(--theme-text-primary, #111827);border:2rpx solid rgba(17,24,39,.12)}
.danger{color:#dc2626;border-color:rgba(220,38,38,.25);background:#fff}
.btn[disabled]{opacity:.45}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 16rpx;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f3f4f6;
}

.feature-item:last-child {
  border-bottom: none;
}

.feature-icon {
  font-size: 48rpx;
  line-height: 1;
}

.feature-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.feature-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #111827;
}

.feature-desc {
  font-size: 24rpx;
  color: #9ca3af;
}

.feature-arrow {
  font-size: 48rpx;
  color: #d1d5db;
  font-weight: 300;
}
</style>
