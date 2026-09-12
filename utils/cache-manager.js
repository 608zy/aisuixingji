/**
 * 离线缓存管理器
 * 支持 TTL（过期时间）的本地存储缓存
 */

const CACHE_PREFIX = '__cache__'

export class CacheManager {
  /**
   * 写入缓存
   * @param {string} key
   * @param {*} data
   * @param {number} ttlMs 过期时间（毫秒）
   */
  static set(key, data, ttlMs) {
    try {
      const entry = {
        data,
        expireAt: Date.now() + ttlMs
      }
      uni.setStorageSync(CACHE_PREFIX + key, JSON.stringify(entry))
    } catch (e) {
      console.error('[CacheManager] set 失败:', e)
    }
  }

  /**
   * 读取缓存，过期或不存在返回 null
   * @param {string} key
   * @returns {*|null}
   */
  static get(key) {
    try {
      const raw = uni.getStorageSync(CACHE_PREFIX + key)
      if (!raw) return null
      const entry = JSON.parse(raw)
      if (Date.now() > entry.expireAt) {
        this.remove(key)
        return null
      }
      return entry.data
    } catch (e) {
      console.error('[CacheManager] get 失败:', e)
      return null
    }
  }

  /**
   * 删除缓存
   * @param {string} key
   */
  static remove(key) {
    try {
      uni.removeStorageSync(CACHE_PREFIX + key)
    } catch (e) {
      console.error('[CacheManager] remove 失败:', e)
    }
  }

  /**
   * 清理所有过期缓存
   */
  static purgeExpired() {
    try {
      const info = uni.getStorageInfoSync()
      const keys = (info.keys || []).filter(k => k.startsWith(CACHE_PREFIX))
      const now = Date.now()
      keys.forEach(fullKey => {
        try {
          const raw = uni.getStorageSync(fullKey)
          if (!raw) return
          const entry = JSON.parse(raw)
          if (now > entry.expireAt) {
            uni.removeStorageSync(fullKey)
          }
        } catch (e) {}
      })
    } catch (e) {
      console.error('[CacheManager] purgeExpired 失败:', e)
    }
  }

  /**
   * 删除所有带 TTL 的离线缓存（__cache__ 前缀），不含业务用的 uni.setStorageSync 键
   */
  static removeAllCached() {
    try {
      const info = uni.getStorageInfoSync()
      const keys = (info.keys || []).filter(k => k.startsWith(CACHE_PREFIX))
      keys.forEach(k => {
        try {
          uni.removeStorageSync(k)
        } catch (e) {}
      })
    } catch (e) {
      console.error('[CacheManager] removeAllCached 失败:', e)
    }
  }
}

// 常用 TTL 常量
export const TTL = {
  FIVE_MINUTES: 5 * 60 * 1000,
  ONE_HOUR: 60 * 60 * 1000,
  ONE_DAY: 24 * 60 * 60 * 1000
}
