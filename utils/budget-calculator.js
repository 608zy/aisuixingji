/**
 * 旅行预算估算工具
 */

// 默认单价（元/人/天）
const DEFAULT_UNIT_PRICES = {
  transport: 200,
  accommodation: 300,
  food: 150,
  tickets: 50 // 每个景点 × 人数
}

export class BudgetCalculator {
  /**
   * 根据行程和人数计算预算
   * @param {Object} plan - 行程对象 { days, daily_spots: [{ spots: [] }] }
   * @param {number} people - 出行人数（1-10）
   * @param {Object} customPrices - 自定义单价（可选）
   * @returns {Object} BudgetResult
   */
  static calculate(plan, people, customPrices = {}) {
    const source = plan && typeof plan === 'object' ? plan : {}
    const parsedPeople = Number(people)
    const n = Math.max(1, Math.min(10, Number.isFinite(parsedPeople) ? Math.round(parsedPeople) : 1))
    const parsedDays = Number(source.days || (Array.isArray(source.daily_spots) ? source.daily_spots.length : 1))
    const days = Math.max(1, Math.min(365, Number.isFinite(parsedDays) ? Math.round(parsedDays) : 1))
    const prices = Object.fromEntries(Object.entries(DEFAULT_UNIT_PRICES).map(([key, fallback]) => {
      const hasCustom = customPrices && Object.prototype.hasOwnProperty.call(customPrices, key)
      const value = hasCustom ? Number(customPrices[key]) : NaN
      return [key, Number.isFinite(value) && value >= 0 ? value : fallback]
    }))

    // 统计总景点数
    let spotCount = 0
    if (Array.isArray(source.daily_spots)) {
      source.daily_spots.forEach(day => {
        if (day && Array.isArray(day.spots)) {
          spotCount += day.spots.length
        }
      })
    }

    const transport = prices.transport * n * days
    const accommodation = prices.accommodation * n * days
    const food = prices.food * n * days
    const tickets = prices.tickets * spotCount * n
    const total = transport + accommodation + food + tickets

    return {
      people: n,
      days,
      spotCount,
      transport,
      accommodation,
      food,
      tickets,
      total,
      unitPrices: { ...prices }
    }
  }

  /**
   * 更新单项单价后重新计算
   * @param {Object} budget - 上次计算结果
   * @param {string} category - 分类名（transport/accommodation/food/tickets）
   * @param {number} unitPrice - 新单价
   * @returns {Object} 新的 BudgetResult
   */
  static recalculate(budget, category, unitPrice) {
    if (!budget || typeof budget !== 'object') throw new TypeError('budget 必须是有效的预算对象')
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_UNIT_PRICES, category)) return { ...budget }
    const parsedPrice = Number(unitPrice)
    const safePrice = Number.isFinite(parsedPrice) && parsedPrice >= 0
      ? parsedPrice
      : Number(budget.unitPrices && budget.unitPrices[category]) || DEFAULT_UNIT_PRICES[category]
    const newPrices = { ...DEFAULT_UNIT_PRICES, ...(budget.unitPrices || {}), [category]: safePrice }
    const n = budget.people
    const days = budget.days
    const spotCount = budget.spotCount

    const transport = newPrices.transport * n * days
    const accommodation = newPrices.accommodation * n * days
    const food = newPrices.food * n * days
    const tickets = newPrices.tickets * spotCount * n
    const total = transport + accommodation + food + tickets

    return {
      ...budget,
      transport,
      accommodation,
      food,
      tickets,
      total,
      unitPrices: newPrices
    }
  }

  /**
   * 格式化金额显示
   * @param {number} amount
   * @returns {string}
   */
  static formatAmount(amount) {
    if (amount == null || isNaN(amount)) return '--'
    return '¥' + Math.round(amount).toLocaleString()
  }
}
