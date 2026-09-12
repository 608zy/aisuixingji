/**
 * 图片懒加载工具
 * 基于 uni-app 的 IntersectionObserver 实现
 */

const DEFAULT_PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#f3f4f6"/></svg>'
)

const DEFAULT_ERROR_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#e5e7eb"/><text x="50" y="55" text-anchor="middle" fill="#9ca3af" font-size="12">加载失败</text></svg>'
)

export class LazyLoader {
  /**
   * 创建懒加载观察器（在页面 onReady 中调用）
   * @param {Object} context - Vue 组件实例（this）
   * @param {string} selector - 图片元素选择器（如 '.lazy-img'）
   * @param {Function} onLoad - 图片进入视口时的回调 (index) => void
   * @returns {Object} observer 实例
   */
  static createObserver(context, selector, onLoad) {
    // #ifdef MP-WEIXIN
    const observer = context.createIntersectionObserver({
      thresholds: [0],
      observeAll: true
    })
    observer.relativeToViewport({ bottom: uni.getSystemInfoSync().windowHeight }).observe(selector, res => {
      if (res.intersectionRatio > 0 && typeof onLoad === 'function') {
        onLoad(res.dataset && res.dataset.index)
      }
    })
    return observer
    // #endif

    // #ifndef MP-WEIXIN
    // 非微信小程序降级：直接全部加载
    if (typeof onLoad === 'function') onLoad(null)
    return null
    // #endif
  }

  /**
   * 获取占位图 URL
   * @returns {string}
   */
  static get placeholder() {
    return DEFAULT_PLACEHOLDER
  }

  /**
   * 获取加载失败占位图 URL
   * @returns {string}
   */
  static get errorImg() {
    return DEFAULT_ERROR_IMG
  }

  /**
   * 图片加载失败处理
   * @param {Object} event - 错误事件
   * @param {Array} imageList - 图片数组（响应式）
   * @param {number} index - 图片索引
   * @param {string} urlField - URL 字段名（默认 'url'）
   */
  static handleError(event, imageList, index, urlField = 'url') {
    if (imageList && imageList[index]) {
      imageList[index][urlField] = DEFAULT_ERROR_IMG
    }
  }
}
