import App from './App'
import ThemeManager from '@/utils/theme-manager.js'

// #ifndef VUE3
import Vue from 'vue'
import './uni.promisify.adaptor'
Vue.config.productionTip = false

// 全局混入主题
Vue.mixin({
  data() {
    return {
      globalTheme: ThemeManager.getCurrentTheme(),
      _themeHandler: null
    }
  },
  computed: {
    themeVars() {
      const theme = this.globalTheme;
      return `--theme-primary: ${theme.primary}; --theme-primary-color: ${theme.primaryColor}; --theme-secondary-color: ${theme.secondaryColor}; --theme-background: ${theme.background}; --theme-card-bg: ${theme.cardBg}; --theme-text-primary: ${theme.textPrimary}; --theme-text-secondary: ${theme.textSecondary};`
    }
  },
  onShow() {
    this.globalTheme = ThemeManager.getCurrentTheme()
  },
  created() {
    this._themeHandler = (theme) => {
      this.globalTheme = theme
    }
    uni.$on('themeChanged', this._themeHandler)
  },
  beforeDestroy() {
    if (this._themeHandler) {
      uni.$off('themeChanged', this._themeHandler)
      this._themeHandler = null
    }
  }
})

App.mpType = 'app'
const app = new Vue({
  ...App
})
app.$mount()
// #endif

// #ifdef VUE3
import { createSSRApp } from 'vue'
export function createApp() {
  const app = createSSRApp(App)
  app.mixin({
    data() {
      return {
        globalTheme: ThemeManager.getCurrentTheme(),
        _themeHandler: null
      }
    },
    computed: {
      themeVars() {
        const theme = this.globalTheme
        return `--theme-primary: ${theme.primary}; --theme-primary-color: ${theme.primaryColor}; --theme-secondary-color: ${theme.secondaryColor}; --theme-background: ${theme.background}; --theme-card-bg: ${theme.cardBg}; --theme-text-primary: ${theme.textPrimary}; --theme-text-secondary: ${theme.textSecondary};`
      }
    },
    onShow() {
      this.globalTheme = ThemeManager.getCurrentTheme()
    },
    created() {
      this._themeHandler = (theme) => {
        this.globalTheme = theme
      }
      uni.$on('themeChanged', this._themeHandler)
    },
    beforeUnmount() {
      if (this._themeHandler) {
        uni.$off('themeChanged', this._themeHandler)
        this._themeHandler = null
      }
    }
  })
  return {
    app
  }
}
// #endif