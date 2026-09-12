<script>
import ThemeManager from '@/utils/theme-manager.js'
import { HistoryManager } from '@/utils/history-manager.js'
import { CacheManager } from '@/utils/cache-manager.js'

export default {
  onLaunch: function() {
    console.log('App Launch')
    try {
      CacheManager.purgeExpired()
    } catch (e) {}
    // 清理旧版自动定位记忆；手动选择的位置继续保留
    try {
      const u = uni.getStorageSync('user_location')
      if (u && u.source !== 'manual') {
        uni.removeStorageSync('user_location')
        try {
          uni.removeStorageSync('last_weather_location')
        } catch (e2) {}
      }
    } catch (e) {}
    // 仅清理过期缓存，保留仍在有效期内的离线数据
    this.applyThemeToPage()
    uni.$on('themeChanged', () => {
      this.applyThemeToPage()
    })
    // 监听网络恢复，触发增量同步
    uni.onNetworkStatusChange((res) => {
      if (res.isConnected) {
        console.log('[App] 网络恢复，触发增量同步')
        this.doIncrementalSync()
      }
    })
  },
  onShow: function() {
    console.log('App Show')
    this.applyThemeToPage()
  },
  onHide: function() {
    console.log('App Hide')
  },
  methods: {
    applyThemeToPage() {
      const theme = ThemeManager.getCurrentTheme()
      console.log('主题已应用:', theme.name)
    },
    async doIncrementalSync() {
      try {
        if (!uni.getStorageSync('uni_id_token')) return
        const unsyncedCount = HistoryManager.getUnsyncedCount()
        if (unsyncedCount === 0) return

        const result = await HistoryManager.incrementalSync((done, total) => {
          uni.$emit('syncProgress', { done, total })
        })

        if (result.success > 0) {
          uni.showToast({
            title: `同步完成 ${result.success}/${unsyncedCount} 条`,
            icon: 'success',
            duration: 2000
          })
        }
      } catch (e) {
        console.warn('[App] 增量同步失败:', e.message)
      }
    }
  }
}
</script>

<style>
/* 基础样式，主题变量由各页面通过 :style="themeVars" 动态注入 */
page {
  --theme-primary: linear-gradient(135deg, #007aff, #4f46e5);
  --theme-primary-color: #007aff;
  --theme-secondary-color: #4f46e5;
  --theme-background: #f6f7fb;
  --theme-card-bg: #ffffff;
  --theme-text-primary: #111827;
  --theme-text-secondary: #6b7280;
  background-color: var(--theme-background);
}
</style>
