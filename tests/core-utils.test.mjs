import test from 'node:test'
import assert from 'node:assert/strict'

const storage = new Map()
globalThis.uni = {
  getStorageSync: key => storage.get(key) ?? '',
  setStorageSync: (key, value) => storage.set(key, value),
  removeStorageSync: key => storage.delete(key)
}

const { getAIConfig, saveAIConfig, validateAIConfig } = await import('../utils/ai-config.js')
const { BudgetCalculator } = await import('../utils/budget-calculator.js')
const { NoteSerializer } = await import('../utils/note-serializer.js')
const { StatsService } = await import('../utils/stats-service.js')

test.beforeEach(() => storage.clear())

test('AI 配置拒绝空密钥和非 HTTPS 地址，并可正常持久化', () => {
  assert.equal(validateAIConfig({ apiKey: '', baseUrl: 'https://example.com/v1', model: 'demo' }).ok, false)
  assert.equal(validateAIConfig({ apiKey: 'secret', baseUrl: 'http://example.com/v1', model: 'demo' }).ok, false)

  const saved = saveAIConfig({ apiKey: 'secret', baseUrl: 'https://example.com/v1/', model: 'demo' })
  assert.equal(saved.ok, true)
  assert.deepEqual(getAIConfig(), {
    apiKey: 'secret',
    baseUrl: 'https://example.com/v1',
    model: 'demo',
    timeoutMs: 120000
  })
})

test('预算计算会修正越界人数、天数和非法单价', () => {
  const result = BudgetCalculator.calculate(
    { days: -2, daily_spots: [{ spots: [{}, {}] }] },
    99,
    { transport: -1, food: '200' }
  )
  assert.equal(result.people, 10)
  assert.equal(result.days, 1)
  assert.equal(result.spotCount, 2)
  assert.equal(result.unitPrices.transport, 200)
  assert.equal(result.unitPrices.food, 200)
  assert.ok(Number.isFinite(result.total))
})

test('Note 反序列化拒绝 JSON 原始值，导出 HTML 过滤危险封面 URL', () => {
  const invalid = NoteSerializer.deserialize('null')
  assert.match(invalid.error, /Note 对象/)

  const html = NoteSerializer.toHtml({
    title: '<旅行>',
    address: '上海',
    content: '<script>alert(1)</script>',
    cover: 'javascript:alert(1)'
  })
  assert.doesNotMatch(html, /javascript:/i)
  assert.doesNotMatch(html, /<script>alert/)
  assert.match(html, /&lt;旅行&gt;/)
  assert.doesNotThrow(() => NoteSerializer.toHtml(null))
})

test('统计服务兼容旧版对象存储，并忽略负使用时长', async () => {
  storage.set('app_statistics', { generationCount: 3, locations: null })
  const stats = await StatsService.getStats()
  assert.equal(stats.generationCount, 3)
  assert.deepEqual(stats.locations, {})

  await StatsService.recordUsageTime(-100)
  assert.equal((await StatsService.getStats()).totalUsageTime, 0)
})
