/**
 * 旅行成就勋章服务
 */

const STORAGE_KEY = 'user_badges'

// 15 种勋章定义
export const BADGE_DEFINITIONS = [
  {
    id: 'first_note',
    name: '初次出发',
    icon: '✈️',
    desc: '生成第一篇游记',
    check: stats => stats.noteCount >= 1
  },
  {
    id: 'note_5',
    name: '旅行达人',
    icon: '📝',
    desc: '累计生成 5 篇游记',
    check: stats => stats.noteCount >= 5
  },
  {
    id: 'note_20',
    name: '游记作家',
    icon: '📚',
    desc: '累计生成 20 篇游记',
    check: stats => stats.noteCount >= 20
  },
  {
    id: 'province_3',
    name: '三省通',
    icon: '🗺️',
    desc: '足迹覆盖 3 个省份',
    check: stats => stats.provinceCount >= 3
  },
  {
    id: 'province_5',
    name: '五省行者',
    icon: '🌏',
    desc: '足迹覆盖 5 个省份',
    check: stats => stats.provinceCount >= 5
  },
  {
    id: 'province_10',
    name: '十省探索者',
    icon: '🏆',
    desc: '足迹覆盖 10 个省份',
    check: stats => stats.provinceCount >= 10
  },
  {
    id: 'city_10',
    name: '城市猎人',
    icon: '🏙️',
    desc: '打卡 10 个城市',
    check: stats => stats.cityCount >= 10
  },
  {
    id: 'plan_first',
    name: '规划师',
    icon: '📋',
    desc: '完成第一个行程规划',
    check: stats => stats.planCount >= 1
  },
  {
    id: 'plan_5',
    name: '旅行规划大师',
    icon: '🗓️',
    desc: '完成 5 个行程规划',
    check: stats => stats.planCount >= 5
  },
  {
    id: 'share_first',
    name: '分享达人',
    icon: '📤',
    desc: '第一次分享游记',
    check: stats => stats.shareCount >= 1
  },
  {
    id: 'consecutive_7',
    name: '坚持旅行',
    icon: '🔥',
    desc: '连续 7 天使用 App',
    check: stats => stats.consecutiveDays >= 7
  },
  {
    id: 'photo_50',
    name: '摄影爱好者',
    icon: '📷',
    desc: '上传超过 50 张照片',
    check: stats => stats.photoCount >= 50
  },
  {
    id: 'ai_polish',
    name: 'AI 创作者',
    icon: '🤖',
    desc: '使用 AI 润色功能 3 次',
    check: stats => stats.aiPolishCount >= 3
  },
  {
    id: 'night_owl',
    name: '夜行者',
    icon: '🌙',
    desc: '在深夜（22:00-6:00）生成游记',
    check: stats => stats.nightNoteCount >= 1
  },
  {
    id: 'explorer',
    name: '探索者',
    icon: '🧭',
    desc: '使用所有 4 种写作风格',
    check: stats => stats.usedTemplates >= 4
  }
]

export class BadgeService {
  /**
   * 获取当前统计数据（从本地历史记录聚合）
   * @returns {Object} stats
   */
  static _buildStats() {
    try {
      const history = uni.getStorageSync('travel_history') || []
      const plans = uni.getStorageSync('travel_plans') || []
      const statsRaw = uni.getStorageSync('app_statistics')
      const appStats = statsRaw
        ? (typeof statsRaw === 'string' ? JSON.parse(statsRaw) : statsRaw)
        : {}

      const provinces = new Set()
      const cities = new Set()
      const templates = new Set()
      let photoCount = 0
      let nightNoteCount = 0

      const provinceKeywords = ['北京', '上海', '天津', '重庆', '河北', '山西', '辽宁', '吉林', '黑龙江', '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南', '广东', '海南', '四川', '贵州', '云南', '陕西', '甘肃', '青海', '台湾', '内蒙古', '广西', '西藏', '宁夏', '新疆', '香港', '澳门']

      history.forEach(note => {
        if (note.address) {
          provinceKeywords.forEach(p => {
            if (note.address.includes(p)) provinces.add(p)
          })
          if (note.city) cities.add(note.city)
        }
        if (note.template) templates.add(note.template)
        if (Array.isArray(note.media)) {
          photoCount += note.media.filter(m => m.type === 'image').length
        }
        if (note.created_at) {
          const hour = new Date(note.created_at).getHours()
          if (hour >= 22 || hour < 6) nightNoteCount++
        }
      })

      return {
        noteCount: history.length,
        provinceCount: provinces.size,
        cityCount: cities.size,
        planCount: plans.length,
        shareCount: appStats.shareCount || 0,
        consecutiveDays: appStats.consecutiveDays || 0,
        photoCount,
        aiPolishCount: appStats.aiPolishCount || 0,
        nightNoteCount,
        usedTemplates: templates.size
      }
    } catch (e) {
      return {
        noteCount: 0, provinceCount: 0, cityCount: 0, planCount: 0,
        shareCount: 0, consecutiveDays: 0, photoCount: 0,
        aiPolishCount: 0, nightNoteCount: 0, usedTemplates: 0
      }
    }
  }

  /**
   * 检查并解锁满足条件的勋章
   * @param {string} triggerType - 'note_generated' | 'location_checkin' | 'plan_completed' | 'share'
   * @returns {Promise<Array>} 新解锁的勋章数组
   */
  static async checkAndUnlock(triggerType) {
    try {
      const stats = this._buildStats()
      const current = this.getAll()
      const unlockedIds = new Set(current.filter(b => b.unlocked).map(b => b.id))
      const newBadges = []

      BADGE_DEFINITIONS.forEach(def => {
        if (unlockedIds.has(def.id)) return
        try {
          if (def.check(stats)) {
            newBadges.push({ ...def, unlocked: true, unlocked_at: Date.now() })
          }
        } catch (e) {
          // 静默忽略单个勋章检查异常
        }
      })

      if (newBadges.length > 0) {
        const updated = current.map(b => {
          const found = newBadges.find(nb => nb.id === b.id)
          return found ? { ...b, unlocked: true, unlocked_at: found.unlocked_at } : b
        })
        uni.setStorageSync(STORAGE_KEY, updated)

        // 已登录时异步同步到云端
        this.syncToCloud().catch(() => {})
      }

      return newBadges
    } catch (e) {
      // 静默忽略整体异常，不影响主流程
      return []
    }
  }

  /**
   * 获取用户所有勋章状态
   * @returns {Array<BadgeStatus>}
   */
  static getAll() {
    try {
      const stored = uni.getStorageSync(STORAGE_KEY)
      const storedMap = {}
      if (Array.isArray(stored)) {
        stored.forEach(b => { storedMap[b.id] = b })
      }
      return BADGE_DEFINITIONS.map(def => ({
        id: def.id,
        name: def.name,
        icon: def.icon,
        desc: def.desc,
        unlocked: !!(storedMap[def.id] && storedMap[def.id].unlocked),
        unlocked_at: storedMap[def.id] ? storedMap[def.id].unlocked_at || null : null
      }))
    } catch (e) {
      return BADGE_DEFINITIONS.map(def => ({
        id: def.id, name: def.name, icon: def.icon, desc: def.desc,
        unlocked: false, unlocked_at: null
      }))
    }
  }

  /**
   * 将勋章同步到 Cloud_DB（需登录）
   * @returns {Promise<void>}
   */
  static async syncToCloud() {
    try {
      const token = uni.getStorageSync('uni_id_token')
      if (!token) return
      const badges = this.getAll().filter(b => b.unlocked)
      await uniCloud.callFunction({
        name: 'sync-notes',
        data: { action: 'syncBadges', badges }
      })
    } catch (e) {
      // 静默忽略
    }
  }
}
