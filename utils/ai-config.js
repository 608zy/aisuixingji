const STORAGE_KEYS = {
  API_KEY: 'weapis_api_key',
  BASE_URL: 'weapis_base_url',
  MODEL: 'weapis_model'
}

export const AI_CONFIG_DEFAULTS = Object.freeze({
  baseUrl: 'https://vg.v1api.cc/v1',
  model: 'gpt-4o-mini',
  timeoutMs: 120000
})

function readStorage(key) {
  try {
    return String(uni.getStorageSync(key) || '').trim()
  } catch (e) {
    return ''
  }
}

export function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '')
}

export function getAIConfig() {
  return {
    apiKey: readStorage(STORAGE_KEYS.API_KEY),
    baseUrl: normalizeBaseUrl(readStorage(STORAGE_KEYS.BASE_URL) || AI_CONFIG_DEFAULTS.baseUrl),
    model: readStorage(STORAGE_KEYS.MODEL) || AI_CONFIG_DEFAULTS.model,
    timeoutMs: AI_CONFIG_DEFAULTS.timeoutMs
  }
}

export function validateAIConfig(config) {
  const apiKey = String(config && config.apiKey || '').trim()
  const baseUrl = normalizeBaseUrl(config && config.baseUrl)
  const model = String(config && config.model || '').trim()

  if (!apiKey) return { ok: false, message: '请先在设置中填写 AI API Key' }
  if (!baseUrl) return { ok: false, message: '请先在设置中填写 AI API 地址' }
  if (!/^https:\/\//i.test(baseUrl) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(baseUrl)) {
    return { ok: false, message: 'AI API 地址必须使用 HTTPS' }
  }
  if (!model) return { ok: false, message: '请选择 AI 模型' }

  return { ok: true, value: { apiKey, baseUrl, model } }
}

export function saveAIConfig(config) {
  const validation = validateAIConfig(config)
  if (!validation.ok) return validation

  try {
    const value = validation.value
    uni.setStorageSync(STORAGE_KEYS.API_KEY, value.apiKey)
    uni.setStorageSync(STORAGE_KEYS.BASE_URL, value.baseUrl)
    uni.setStorageSync(STORAGE_KEYS.MODEL, value.model)
    return { ok: true, value: { ...value, timeoutMs: AI_CONFIG_DEFAULTS.timeoutMs } }
  } catch (e) {
    return { ok: false, message: '保存 AI 设置失败，请检查存储空间' }
  }
}

export function clearAIKey() {
  try {
    uni.removeStorageSync(STORAGE_KEYS.API_KEY)
    return true
  } catch (e) {
    return false
  }
}
