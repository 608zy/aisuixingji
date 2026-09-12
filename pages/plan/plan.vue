<template>
  <view class="container" :style="themeVars">
    <view class="header">
      <view class="header-content">
        <text class="title">我的行程</text>
        <text class="subtitle">让旅行更井井有条</text>
      </view>
      <view class="header-action" @click="createNewPlan">
        <view class="add-btn">
          <text class="add-icon">+</text>
          <text>新建行程</text>
        </view>
      </view>
    </view>
    <!-- AI 规划行程按钮 -->
    <view class="ai-plan-bar">
      <button class="ai-plan-btn" @click="showAiPlanInput">✨ AI 规划行程</button>
    </view>
    
    <view class="content">
      <view v-if="plans.length === 0" class="empty-state">
        <view class="empty-illustration">📅</view>
        <text class="empty-text">还没有行程规划</text>
        <text class="empty-hint">生成游记后可以自动同步足迹，或手动开启一段新旅程</text>
        <button class="primary-btn" @click="createNewPlan">立即开启</button>
      </view>
      
      <view v-else class="plan-list">
        <view 
          class="plan-card" 
          v-for="(plan, index) in plans" 
          :key="index" 
          @click="viewPlanDetail(plan)"
          @longpress="confirmDelete(index)"
        >
          <view class="plan-info">
            <view class="plan-top">
              <text class="plan-name">{{ plan.title }}</text>
              <text class="plan-tag" :class="plan.status">{{ getStatusText(plan.status) }}</text>
            </view>
            <view class="plan-meta">
              <text class="meta-item">🗓️ {{ formatDate(plan.date) }}</text>
              <text class="meta-item">📍 {{ plan.location }}</text>
            </view>
            
            <!-- 时间轴预览 -->
            <view class="timeline-preview">
              <view 
                v-for="(loc, lIndex) in (plan.locations || []).slice(0, 3)" 
                :key="lIndex" 
                class="timeline-dot"
              >
                <view class="dot"></view>
                <text class="dot-label">{{ loc.address || loc.name }}</text>
                <view v-if="lIndex < 2 && lIndex < (plan.locations.length - 1)" class="line"></view>
              </view>
              <text v-if="plan.locations && plan.locations.length > 3" class="more-dots">...</text>
            </view>
          </view>
          <view class="plan-right">
            <text class="plan-arrow">›</text>
            <text class="delete-hint">长按删除</text>
          </view>
        </view>
      </view>
    </view>
    
    <!-- 详情弹出层 -->
    <uni-popup ref="detailPopup" type="bottom">
      <view class="popup-content" :style="themeVars">
        <view class="popup-header">
          <text class="popup-title">{{ currentPlan.title }}</text>
          <text class="close-btn" @click="closeDetail">✕</text>
        </view>
        <scroll-view scroll-y class="popup-scroll">
          <view class="timeline-detail">
            <view 
              v-for="(item, index) in (currentPlan.locations || [])" 
              :key="index" 
              class="detail-item"
            >
              <view class="time-column">
                <text class="time">DAY {{ index + 1 }}</text>
              </view>
              <view class="marker-column">
                <view class="detail-dot"></view>
                <view v-if="index < currentPlan.locations.length - 1" class="detail-line"></view>
              </view>
              <view class="info-column">
                <text class="location-name">{{ item.address || item.name }}</text>
                <text class="location-desc">建议游玩：{{ item.duration_hours ? item.duration_hours + '小时' : '2-3小时' }}</text>
                <text v-if="item.best_time" class="best-time">🕘 建议到达：{{ item.best_time }}</text>
                <text v-if="getWalkTime(index)" class="walk-time">🚶 距下一站约 {{getWalkTime(index)}}</text>
              </view>
            </view>
          </view>

          <!-- 预算面板 -->
          <view class="budget-panel">
            <text class="budget-title">💰 预算估算</text>
            <view class="people-row">
              <text class="budget-label">出行人数</text>
              <picker mode="selector" :range="peopleOptions" :value="peopleIndex" @change="onPeopleChange">
                <view class="people-picker">
                  <text>{{peopleOptions[peopleIndex]}} 人</text>
                  <text class="picker-arrow">▼</text>
                </view>
              </picker>
            </view>
            <view v-if="budget" class="budget-items">
              <view v-for="cat in budgetCategories" :key="cat.key" class="budget-item">
                <text class="budget-cat-label">{{cat.label}}</text>
                <view class="budget-price-row">
                  <text class="budget-unit">单价 ¥</text>
                  <input
                    class="budget-unit-input"
                    type="number"
                    :value="String(budget.unitPrices[cat.key])"
                    @blur="onUnitPriceChange(cat.key, $event)"
                  />
                  <text class="budget-total">合计 {{formatAmount(budget[cat.key])}}</text>
                </view>
              </view>
              <view class="budget-total-row">
                <text class="budget-total-label">总计</text>
                <text class="budget-total-val">{{formatAmount(budget.total)}}</text>
              </view>
            </view>
          </view>
        </scroll-view>
        <view class="popup-footer">
          <button class="ai-btn" @click="optimizePlan">✨ AI 智能优化行程</button>
          <button class="delete-btn" @click="deleteCurrentPlan">🗑️ 删除行程</button>
        </view>
      </view>
    </uni-popup>

    <!-- AI 规划输入弹层 -->
    <uni-popup ref="aiPlanPopup" type="center">
      <view class="ai-input-popup" :style="themeVars">
        <text class="ai-popup-title">✨ AI 规划行程</text>
        <input v-model="aiDestination" class="ai-input" placeholder="目的地（如：北京）" />
        <view class="days-row">
          <text class="days-label">天数</text>
          <picker mode="selector" :range="daysOptions" :value="aiDaysIndex" @change="onAiDaysChange">
            <view class="days-picker">
              <text>{{daysOptions[aiDaysIndex]}} 天</text>
              <text class="picker-arrow">▼</text>
            </view>
          </picker>
        </view>
        <view class="ai-popup-actions">
          <button class="cancel-btn" @click="closeAiPlanPopup">取消</button>
          <button class="confirm-btn" :loading="aiPlanning" @click="doAiPlan">开始规划</button>
        </view>
      </view>
    </uni-popup>
  </view>
</template>

<script>
import { HeatmapCalculator } from '@/utils/heatmap-calculator.js'
import { BudgetCalculator } from '@/utils/budget-calculator.js'
import { BadgeService } from '@/utils/badge-service.js'

export default {
  data() {
    return {
      plans: [],
      currentPlan: {},
      budget: null,
      peopleOptions: [1,2,3,4,5,6,7,8,9,10],
      peopleIndex: 0,
      budgetCategories: [
        { key: 'transport', label: '🚗 交通' },
        { key: 'accommodation', label: '🏨 住宿' },
        { key: 'food', label: '🍜 餐饮' },
        { key: 'tickets', label: '🎫 门票' }
      ],
      aiDestination: '',
      aiDaysIndex: 2,
      daysOptions: [1,2,3,4,5,6,7,8,9,10,11,12,13,14],
      aiPlanning: false
    }
  },
  onShow() {
    this.loadPlans()
  },
  methods: {
    loadPlans() {
      const plans = uni.getStorageSync('travel_plans') || []
      this.plans = plans
    },
    createNewPlan() {
      const history = uni.getStorageSync('travel_history') || []
      if (history.length === 0) {
        uni.showToast({ title: '先去首页生成一段游记吧！', icon: 'none' })
        return
      }
      const locations = history.slice(0, 5)
      const newPlan = {
        id: Date.now(),
        title: `${locations[0].address.substring(0, 6)}之旅`,
        date: Date.now(),
        location: locations[0].address,
        status: 'planning',
        locations: locations
      }
      this.plans.unshift(newPlan)
      uni.setStorageSync('travel_plans', this.plans)
      uni.showToast({ title: '行程已生成', icon: 'success' })
    },
    viewPlanDetail(plan) {
      this.currentPlan = plan
      this.peopleIndex = 0
      this._calcBudget()
      this.$refs.detailPopup.open()
    },
    closeDetail() {
      this.$refs.detailPopup.close()
    },
    _calcBudget() {
      try {
        const people = this.peopleOptions[this.peopleIndex]
        const planForBudget = {
          days: this.currentPlan.locations ? this.currentPlan.locations.length : 1,
          daily_spots: this.currentPlan.locations
            ? this.currentPlan.locations.map(l => ({ spots: [l] }))
            : []
        }
        this.budget = BudgetCalculator.calculate(planForBudget, people)
      } catch (e) {
        this.budget = null
      }
    },
    onPeopleChange(e) {
      this.peopleIndex = e.detail.value
      this._calcBudget()
    },
    onUnitPriceChange(category, e) {
      const val = parseFloat(e.detail.value)
      if (!isNaN(val) && val >= 0 && this.budget) {
        this.budget = BudgetCalculator.recalculate(this.budget, category, val)
      }
    },
    formatAmount(amount) {
      return BudgetCalculator.formatAmount(amount)
    },
    getWalkTime(index) {
      const locs = this.currentPlan.locations || []
      if (index >= locs.length - 1) return ''
      const a = locs[index]
      const b = locs[index + 1]
      if (!a || !b || !a.latitude || !b.latitude) return ''
      try {
        const result = HeatmapCalculator.estimateWalkTime(
          { latitude: a.latitude, longitude: a.longitude },
          { latitude: b.latitude, longitude: b.longitude }
        )
        return result.display
      } catch (e) {
        return ''
      }
    },
    showAiPlanInput() {
      this.$refs.aiPlanPopup.open()
    },
    closeAiPlanPopup() {
      this.$refs.aiPlanPopup.close()
    },
    onAiDaysChange(e) {
      this.aiDaysIndex = e.detail.value
    },
    async doAiPlan() {
      const dest = this.aiDestination.trim()
      if (!dest) {
        uni.showToast({ title: '请输入目的地', icon: 'none' })
        return
      }
      const days = this.daysOptions[this.aiDaysIndex]
      this.aiPlanning = true
      try {
        const res = await uniCloud.callFunction({
          name: 'ai-plan',
          data: { destination: dest, days }
        })
        const planData = res.result && res.result.data
        if (planData) {
          const newPlan = {
            id: Date.now(),
            title: `${dest} ${days}日游`,
            date: Date.now(),
            location: dest,
            status: 'planning',
            locations: planData.daily_spots
              ? planData.daily_spots.flatMap(d => d.spots || []).map(s => ({ address: s.name, name: s.name, ...s }))
              : [],
            daily_spots: planData.daily_spots || []
          }
          this.plans.unshift(newPlan)
          uni.setStorageSync('travel_plans', this.plans)
          this.closeAiPlanPopup()
          // 触发成就检查
          BadgeService.checkAndUnlock('plan_completed').catch(() => {})
          uni.showToast({ title: 'AI 行程已生成', icon: 'success' })
        } else {
          throw new Error('AI 返回数据异常')
        }
      } catch (e) {
        // 兜底：基于历史记录生成
        this._fallbackPlan(dest, days)
      } finally {
        this.aiPlanning = false
      }
    },
    _fallbackPlan(dest, days) {
      const history = uni.getStorageSync('travel_history') || []
      const locations = history.slice(0, days * 2).map(n => ({ address: n.address, name: n.address }))
      if (locations.length === 0) {
        uni.showToast({ title: 'AI 规划失败，暂无历史数据', icon: 'none' })
        return
      }
      const newPlan = {
        id: Date.now(),
        title: `${dest} ${days}日游（兜底）`,
        date: Date.now(),
        location: dest,
        status: 'planning',
        locations
      }
      this.plans.unshift(newPlan)
      uni.setStorageSync('travel_plans', this.plans)
      this.closeAiPlanPopup()
      uni.showToast({ title: '已基于历史记录生成行程', icon: 'none' })
    },
    optimizePlan() {
      const locations = Array.isArray(this.currentPlan.locations) ? this.currentPlan.locations : []
      if (locations.length < 2) {
        uni.showToast({ title: '至少需要 2 个地点才可优化', icon: 'none' })
        return
      }

      uni.showLoading({ title: '优化中...' })
      setTimeout(() => {
        const originalCount = locations.length
        const deduped = this._dedupeLocations(locations)
        const grouped = this._splitByDays(deduped, this.currentPlan.daily_spots)
        const optimizedGroups = grouped.map(group => this._optimizeRoute(group))

        const optimizedDailySpots = optimizedGroups.map((spots, idx) => ({
          day: idx + 1,
          spots: spots.map((spot, sIdx) => ({
            ...spot,
            best_time: this._calcBestTime(sIdx, spot.duration_hours)
          }))
        }))

        const optimizedLocations = optimizedDailySpots.flatMap(day => day.spots)
        const removed = originalCount - optimizedLocations.length

        const optimizedPlan = {
          ...this.currentPlan,
          status: 'ongoing',
          locations: optimizedLocations,
          daily_spots: optimizedDailySpots,
          optimized_at: Date.now()
        }

        this.currentPlan = optimizedPlan
        const index = this.plans.findIndex(p => p.id === optimizedPlan.id)
        if (index !== -1) {
          this.plans.splice(index, 1, optimizedPlan)
          uni.setStorageSync('travel_plans', this.plans)
        }

        uni.hideLoading()
        uni.showToast({
          title: removed > 0 ? `优化完成，去重 ${removed} 站` : '优化完成，路线更顺路了',
          icon: 'success'
        })
      }, 600)
    },
    _dedupeLocations(locations) {
      const map = {}
      return locations.filter(item => {
        const key = this._locationKey(item)
        if (!key) return true
        if (map[key]) return false
        map[key] = true
        return true
      })
    },
    _locationKey(item) {
      const name = String((item && (item.name || item.address)) || '').trim().toLowerCase()
      if (!name) return ''
      const lat = item && item.latitude != null ? Number(item.latitude).toFixed(4) : ''
      const lng = item && item.longitude != null ? Number(item.longitude).toFixed(4) : ''
      return `${name}_${lat}_${lng}`
    },
    _splitByDays(locations, dailySpots) {
      if (Array.isArray(dailySpots) && dailySpots.length > 0) {
        return dailySpots.map(day => Array.isArray(day.spots) ? day.spots : []).filter(day => day.length > 0)
      }
      const total = locations.length
      const days = Math.max(1, Math.ceil(total / 3))
      const result = []
      let start = 0
      for (let i = 0; i < days; i++) {
        const leftDays = days - i
        const leftCount = total - start
        const size = Math.max(1, Math.ceil(leftCount / leftDays))
        result.push(locations.slice(start, start + size))
        start += size
      }
      return result
    },
    _optimizeRoute(spots) {
      if (!Array.isArray(spots) || spots.length < 3) return spots || []
      const remaining = [...spots]
      const route = [remaining.shift()]
      while (remaining.length > 0) {
        const last = route[route.length - 1]
        let bestIndex = 0
        let bestDistance = Number.MAX_SAFE_INTEGER
        remaining.forEach((item, idx) => {
          const distance = this._estimateDistance(last, item)
          if (distance < bestDistance) {
            bestDistance = distance
            bestIndex = idx
          }
        })
        route.push(remaining.splice(bestIndex, 1)[0])
      }
      return route
    },
    _estimateDistance(a, b) {
      if (!a || !b || a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) {
        return 100000
      }
      const toRad = d => (Number(d) * Math.PI) / 180
      const lat1 = toRad(a.latitude)
      const lat2 = toRad(b.latitude)
      const dLat = lat2 - lat1
      const dLng = toRad(Number(b.longitude) - Number(a.longitude))
      const sinLat = Math.sin(dLat / 2)
      const sinLng = Math.sin(dLng / 2)
      const x = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng
      return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
    },
    _calcBestTime(index, durationHours) {
      const duration = Number(durationHours) > 0 ? Number(durationHours) : 2
      const minutes = 9 * 60 + index * (duration * 60 + 30)
      const h = String(Math.floor(minutes / 60)).padStart(2, '0')
      const m = String(minutes % 60).padStart(2, '0')
      return `${h}:${m}`
    },
    formatDate(ts) {
      const d = new Date(ts)
      return `${d.getMonth() + 1}月${d.getDate()}日`
    },
    getStatusText(status) {
      const map = { planning: '规划中', ongoing: '进行中', completed: '已完成' }
      return map[status] || '规划中'
    },
    confirmDelete(index) {
      uni.showModal({
        title: '删除行程',
        content: `确定要删除「${this.plans[index].title}」吗？`,
        confirmText: '删除',
        confirmColor: '#ef4444',
        success: (res) => {
          if (res.confirm) this.deletePlan(index)
        }
      })
    },
    deletePlan(index) {
      this.plans.splice(index, 1)
      uni.setStorageSync('travel_plans', this.plans)
      uni.showToast({ title: '已删除', icon: 'success' })
    },
    deleteCurrentPlan() {
      const index = this.plans.findIndex(p => p.id === this.currentPlan.id)
      if (index === -1) return
      uni.showModal({
        title: '删除行程',
        content: `确定要删除「${this.currentPlan.title}」吗？`,
        confirmText: '删除',
        confirmColor: '#ef4444',
        success: (res) => {
          if (res.confirm) {
            this.closeDetail()
            this.$nextTick(() => this.deletePlan(index))
          }
        }
      })
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background-color: var(--theme-background, #f9fafb);
}

.header {
  padding: 60rpx 40rpx;
  background: var(--theme-primary, linear-gradient(135deg, #111827, #312e81));
  color: #fff;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.title {
  font-size: 48rpx;
  font-weight: 800;
  display: block;
}

.subtitle {
  font-size: 26rpx;
  opacity: 0.8;
  margin-top: 10rpx;
  display: block;
}

.add-btn {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  padding: 16rpx 28rpx;
  border-radius: 100rpx;
  display: flex;
  align-items: center;
  gap: 10rpx;
  font-size: 26rpx;
  font-weight: 600;
  border: 1rpx solid rgba(255, 255, 255, 0.3);
}

.add-icon {
  font-size: 32rpx;
}

.content {
  padding: 30rpx;
  margin-top: -30rpx;
}

.empty-state {
  background: var(--theme-card-bg, #fff);
  border-radius: 40rpx;
  padding: 100rpx 60rpx;
  text-align: center;
  box-shadow: 0 10rpx 40rpx rgba(0, 0, 0, 0.05);
}

.empty-illustration {
  font-size: 120rpx;
  margin-bottom: 40rpx;
}

.empty-text {
  font-size: 34rpx;
  font-weight: 700;
  color: var(--theme-text-primary, #111827);
  display: block;
}

.empty-hint {
  font-size: 26rpx;
  color: var(--theme-text-secondary, #6b7280);
  margin-top: 20rpx;
  display: block;
  line-height: 1.6;
}

.primary-btn {
  margin-top: 60rpx;
  background: var(--theme-primary, linear-gradient(135deg, #3b82f6, #2563eb));
  color: #fff;
  border-radius: 100rpx;
  font-weight: 700;
  border: none;
}

.plan-card {
  background: var(--theme-card-bg, #fff);
  border-radius: 30rpx;
  padding: 30rpx;
  margin-bottom: 24rpx;
  display: flex;
  align-items: center;
  box-shadow: 0 10rpx 30rpx rgba(0, 0, 0, 0.04);
}

.plan-info {
  flex: 1;
}

.plan-top {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 16rpx;
}

.plan-name {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--theme-text-primary, #111827);
}

.plan-tag {
  font-size: 20rpx;
  padding: 4rpx 16rpx;
  border-radius: 100rpx;
}

.plan-tag.planning { background: #eff6ff; color: #2563eb; }

.plan-meta {
  display: flex;
  gap: 24rpx;
  margin-bottom: 24rpx;
}

.meta-item {
  font-size: 24rpx;
  color: var(--theme-text-secondary, #6b7280);
}

.timeline-preview {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.timeline-dot {
  display: flex;
  align-items: center;
  gap: 8rpx;
  position: relative;
}

.dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: var(--theme-primary-color, #3b82f6);
}

.dot-label {
  font-size: 22rpx;
  color: #4b5563;
  max-width: 120rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.line {
  width: 30rpx;
  height: 2rpx;
  background: #e5e7eb;
}

.more-dots {
  font-size: 22rpx;
  color: #9ca3af;
}

.plan-arrow {
  color: #d1d5db;
  padding-left: 20rpx;
}

.plan-right {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-left: 20rpx;
  gap: 8rpx;
}

.delete-hint {
  font-size: 18rpx;
  color: #d1d5db;
}

.popup-content {
  background: var(--theme-background, #f9fafb);
  border-radius: 40rpx 40rpx 0 0;
  padding: 40rpx;
  max-height: 80vh;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40rpx;
}

.popup-title {
  font-size: 36rpx;
  font-weight: 800;
  color: var(--theme-text-primary, #111827);
}

.close-btn {
  font-size: 40rpx;
  color: #9ca3af;
}

.popup-scroll {
  height: 60vh;
}

.timeline-detail {
  padding-left: 20rpx;
}

.detail-item {
  display: flex;
  margin-bottom: 40rpx;
}

.time-column {
  width: 120rpx;
}

.time {
  font-size: 24rpx;
  font-weight: 700;
  color: var(--theme-primary-color, #3b82f6);
}

.marker-column {
  width: 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.detail-dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  background: var(--theme-primary-color, #3b82f6);
  border: 4rpx solid #fff;
  z-index: 2;
}

.detail-line {
  position: absolute;
  top: 20rpx;
  bottom: -40rpx;
  width: 4rpx;
  background: #e5e7eb;
  z-index: 1;
}

.info-column {
  flex: 1;
  padding-left: 20rpx;
}

.location-name {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--theme-text-primary, #111827);
  display: block;
}

.location-desc {
  font-size: 24rpx;
  color: var(--theme-text-secondary, #6b7280);
  margin-top: 8rpx;
  display: block;
}

.popup-footer {
  padding-top: 30rpx;
}

.ai-btn {
  background: linear-gradient(135deg, #4f46e5, #9333ea);
  color: #fff;
  border-radius: 100rpx;
  font-weight: 700;
  border: none;
  margin-bottom: 20rpx;
  width: 100%;
}

.delete-btn {
  background: #fff;
  color: #ef4444;
  border-radius: 100rpx;
  font-weight: 600;
  border: 2rpx solid #fecaca;
  width: 100%;
}

/* AI 规划行程 */
.ai-plan-bar {
  padding: 16rpx 30rpx;
  background: var(--theme-card-bg, #fff);
  border-bottom: 1rpx solid #f3f4f6;
}
.ai-plan-btn {
  width: 100%;
  height: 80rpx;
  line-height: 80rpx;
  background: linear-gradient(135deg, #4f46e5, #9333ea);
  color: #fff;
  border-radius: 40rpx;
  font-size: 28rpx;
  font-weight: 700;
  border: none;
}

/* 预算面板 */
.budget-panel {
  margin-top: 30rpx;
  background: #f9fafb;
  border-radius: 20rpx;
  padding: 24rpx;
}
.budget-title {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--theme-text-primary, #111827);
  display: block;
  margin-bottom: 20rpx;
}
.people-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}
.budget-label {
  font-size: 28rpx;
  color: var(--theme-text-primary, #111827);
}
.people-picker, .days-picker {
  display: flex;
  align-items: center;
  gap: 8rpx;
  background: #fff;
  padding: 10rpx 20rpx;
  border-radius: 12rpx;
  border: 1rpx solid #e5e7eb;
  font-size: 28rpx;
}
.picker-arrow { font-size: 20rpx; color: #9ca3af; }
.budget-items {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.budget-item {
  background: #fff;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
}
.budget-cat-label {
  font-size: 26rpx;
  color: var(--theme-text-primary, #111827);
  display: block;
  margin-bottom: 10rpx;
}
.budget-price-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.budget-unit {
  font-size: 24rpx;
  color: #9ca3af;
}
.budget-unit-input {
  width: 120rpx;
  height: 56rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 8rpx;
  padding: 0 12rpx;
  font-size: 26rpx;
  text-align: center;
}
.budget-total {
  flex: 1;
  font-size: 26rpx;
  color: var(--theme-text-secondary, #6b7280);
  text-align: right;
}
.budget-total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16rpx;
  border-top: 1rpx solid #e5e7eb;
  margin-top: 8rpx;
}
.budget-total-label {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--theme-text-primary, #111827);
}
.budget-total-val {
  font-size: 34rpx;
  font-weight: 900;
  color: #ef4444;
}
.walk-time {
  font-size: 22rpx;
  color: #16a34a;
  display: block;
  margin-top: 6rpx;
}
.best-time {
  font-size: 22rpx;
  color: #7c3aed;
  display: block;
  margin-top: 6rpx;
}

/* AI 规划弹层 */
.ai-input-popup {
  background: var(--theme-card-bg, #fff);
  border-radius: 32rpx;
  padding: 48rpx 40rpx;
  width: 600rpx;
}
.ai-popup-title {
  font-size: 34rpx;
  font-weight: 800;
  color: var(--theme-text-primary, #111827);
  display: block;
  margin-bottom: 30rpx;
  text-align: center;
}
.ai-input {
  width: 100%;
  height: 80rpx;
  background: #f3f4f6;
  border-radius: 16rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  margin-bottom: 20rpx;
  box-sizing: border-box;
}
.days-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 30rpx;
}
.days-label {
  font-size: 28rpx;
  color: var(--theme-text-primary, #111827);
}
.ai-popup-actions {
  display: flex;
  gap: 16rpx;
}
.cancel-btn {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  background: #f3f4f6;
  color: var(--theme-text-primary, #111827);
  border-radius: 40rpx;
  font-size: 28rpx;
  border: none;
}
.confirm-btn {
  flex: 2;
  height: 80rpx;
  line-height: 80rpx;
  background: linear-gradient(135deg, #4f46e5, #9333ea);
  color: #fff;
  border-radius: 40rpx;
  font-size: 28rpx;
  font-weight: 700;
  border: none;
}
</style>
