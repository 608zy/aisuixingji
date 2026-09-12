/**
 * 统计服务类
 * 负责记录和统计用户的使用数据
 */

const STORAGE_KEY_STATS = 'app_statistics'

const DEFAULT_STATS = Object.freeze({
  generationCount: 0,
  totalUsageTime: 0,
  locations: {},
  monthlyStats: {},
  lastSyncTime: null
})

function createDefaultStats() {
  return { ...DEFAULT_STATS, locations: {}, monthlyStats: {} }
}

function normalizeStats(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  return {
    ...createDefaultStats(),
    ...source,
    generationCount: Number.isFinite(Number(source.generationCount)) ? Math.max(0, Number(source.generationCount)) : 0,
    totalUsageTime: Number.isFinite(Number(source.totalUsageTime)) ? Math.max(0, Number(source.totalUsageTime)) : 0,
    locations: source.locations && typeof source.locations === 'object' && !Array.isArray(source.locations) ? source.locations : {},
    monthlyStats: source.monthlyStats && typeof source.monthlyStats === 'object' && !Array.isArray(source.monthlyStats) ? source.monthlyStats : {}
  }
}

export class StatsService {
  /**
   * 记录游记生成
   * @param {Object} note - 游记对象
   */
  static async recordGeneration(note) {
    try {
      const stats = await this.getStats()
      
      // 增加生成次数
      stats.generationCount = (stats.generationCount || 0) + 1
      
      // 记录地点
      if (note.address) {
        if (!stats.locations) {
          stats.locations = {}
        }
        stats.locations[note.address] = (stats.locations[note.address] || 0) + 1
      }
      
      // 记录月度统计
      const month = this.getCurrentMonth()
      if (!stats.monthlyStats) {
        stats.monthlyStats = {}
      }
      stats.monthlyStats[month] = (stats.monthlyStats[month] || 0) + 1
      
      // 保存统计数据
      await this.saveStats(stats)
      
      console.log('[StatsService] 记录生成成功:', stats)
    } catch (error) {
      console.error('[StatsService] 记录生成失败:', error)
    }
  }
  
  /**
   * 记录使用时长
   * @param {number} duration - 使用时长（毫秒）
   */
  static async recordUsageTime(duration) {
    try {
      const safeDuration = Number(duration)
      if (!Number.isFinite(safeDuration) || safeDuration <= 0) return
      const stats = await this.getStats()
      
      stats.totalUsageTime = (stats.totalUsageTime || 0) + safeDuration
      
      await this.saveStats(stats)
      
      console.log('[StatsService] 记录使用时长:', duration, 'ms')
    } catch (error) {
      console.error('[StatsService] 记录使用时长失败:', error)
    }
  }
  
  /**
   * 获取统计数据
   * @returns {Promise<Object>} 统计数据对象
   */
  static async getStats() {
    try {
      const stats = uni.getStorageSync(STORAGE_KEY_STATS)
      
      if (stats) {
        const parsed = typeof stats === 'string' ? JSON.parse(stats) : stats
        return normalizeStats(parsed)
      }
      
      return createDefaultStats()
    } catch (error) {
      console.error('[StatsService] 获取统计数据失败:', error)
      return createDefaultStats()
    }
  }
  
  /**
   * 保存统计数据
   * @param {Object} stats - 统计数据对象
   */
  static async saveStats(stats) {
    try {
      uni.setStorageSync(STORAGE_KEY_STATS, JSON.stringify(normalizeStats(stats)))
    } catch (error) {
      console.error('[StatsService] 保存统计数据失败:', error)
      throw error
    }
  }
  
  /**
   * 获取访问最多的地点
   * @param {number} limit - 返回数量限制
   * @returns {Promise<Array>} 地点列表
   */
  static async getMostVisitedLocations(limit = 10) {
    try {
      const stats = await this.getStats()
      
      if (!stats.locations || Object.keys(stats.locations).length === 0) {
        return []
      }
      
      // 转换为数组并排序
      const locations = Object.entries(stats.locations)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
      
      return locations
    } catch (error) {
      console.error('[StatsService] 获取访问最多的地点失败:', error)
      return []
    }
  }
  
  /**
   * 获取当前月份（格式：YYYY-MM）
   * @returns {string} 月份字符串
   */
  static getCurrentMonth() {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
  }
  
  /**
   * 获取月度统计数据
   * @param {number} months - 获取最近几个月的数据
   * @returns {Promise<Array>} 月度统计数组
   */
  static async getMonthlyStats(months = 6) {
    try {
      const stats = await this.getStats()
      
      if (!stats.monthlyStats) {
        return []
      }
      
      // 生成最近 N 个月的月份列表
      const monthList = []
      const now = new Date()
      
      for (let i = months - 1; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const monthKey = `${year}-${month}`
        
        monthList.push({
          month: monthKey,
          count: stats.monthlyStats[monthKey] || 0
        })
      }
      
      return monthList
    } catch (error) {
      console.error('[StatsService] 获取月度统计失败:', error)
      return []
    }
  }
  
  /**
   * 同步统计数据到云端
   * @returns {Promise<void>}
   */
  static async syncToCloud() {
    try {
      console.log('[StatsService] 统计数据仅保存在本地')
      
      // 显示友好提示
      uni.showToast({
        title: '统计数据已保存在本地',
        icon: 'success',
        duration: 2000
      })
      
      return Promise.resolve()
    } catch (error) {
      console.error('[StatsService] 操作失败:', error)
      throw error
    }
  }
  
  /**
   * 从云端下载统计数据
   * @returns {Promise<void>}
   */
  static async downloadFromCloud() {
    try {
      console.log('[StatsService] 统计数据仅保存在本地')
      
      // 显示友好提示
      uni.showToast({
        title: '统计数据已保存在本地',
        icon: 'success',
        duration: 2000
      })
      
      return Promise.resolve()
    } catch (error) {
      console.error('[StatsService] 操作失败:', error)
      throw error
    }
  }
}

/**
 * 快捷记录生成函数
 * @param {Object} note - 游记对象
 */
export async function recordGeneration(note) {
  return await StatsService.recordGeneration(note)
}

/**
 * 快捷记录使用时长函数
 * @param {number} duration - 使用时长（毫秒）
 */
export async function recordUsageTime(duration) {
  return await StatsService.recordUsageTime(duration)
}

/**
 * 快捷获取统计数据函数
 * @returns {Promise<Object>} 统计数据对象
 */
export async function getStats() {
  return await StatsService.getStats()
}
