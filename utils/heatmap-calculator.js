/**
 * 热力图计算工具
 * 负责从历史记录中提取有效坐标并生成热力图数据
 */

const EARTH_RADIUS_KM = 6371
const CLUSTER_THRESHOLD_DEG = 0.01 // 距离 < 0.01° 的点聚合

export class HeatmapCalculator {
  /**
   * 从历史记录中提取有效坐标点
   * @param {Array} history - travel_history 记录数组
   * @returns {Array<{latitude, longitude}>}
   */
  static extractValidPoints(history) {
    if (!Array.isArray(history)) return []
    return history.filter(item => {
      const lat = item.latitude
      const lng = item.longitude
      if (lat == null || lng == null) return false
      if (isNaN(lat) || isNaN(lng)) return false
      if (lat < -90 || lat > 90) return false
      if (lng < -180 || lng > 180) return false
      return true
    }).map(item => ({
      latitude: Number(item.latitude),
      longitude: Number(item.longitude)
    }))
  }

  /**
   * 将坐标点转换为热力图数据格式（含权重）
   * 将距离 < CLUSTER_THRESHOLD_DEG 的点聚合，归一化 weight
   * @param {Array<{latitude, longitude}>} points
   * @returns {Array<{latitude, longitude, weight}>}
   */
  static toHeatmapData(points) {
    if (!points || points.length === 0) return []

    const clusters = []

    points.forEach(point => {
      // 查找是否有已有聚合点在阈值范围内
      const existing = clusters.find(c =>
        Math.abs(c.latitude - point.latitude) < CLUSTER_THRESHOLD_DEG &&
        Math.abs(c.longitude - point.longitude) < CLUSTER_THRESHOLD_DEG
      )
      if (existing) {
        existing.count++
        // 更新聚合中心（取平均）
        existing.latitude = (existing.latitude * (existing.count - 1) + point.latitude) / existing.count
        existing.longitude = (existing.longitude * (existing.count - 1) + point.longitude) / existing.count
      } else {
        clusters.push({ latitude: point.latitude, longitude: point.longitude, count: 1 })
      }
    })

    const maxCount = Math.max(...clusters.map(c => c.count))

    return clusters.map(c => ({
      latitude: c.latitude,
      longitude: c.longitude,
      weight: maxCount > 0 ? c.count / maxCount : 0
    }))
  }

  /**
   * Haversine 公式计算两点间距离（km）
   * @param {{latitude, longitude}} p1
   * @param {{latitude, longitude}} p2
   * @returns {number} 距离（km）
   */
  static haversineDistance(p1, p2) {
    const toRad = deg => (deg * Math.PI) / 180
    const dLat = toRad(p2.latitude - p1.latitude)
    const dLon = toRad(p2.longitude - p1.longitude)
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(p1.latitude)) * Math.cos(toRad(p2.latitude)) * Math.sin(dLon / 2) ** 2
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a))
  }

  /**
   * 估算步行交通时间
   * @param {{latitude, longitude}} p1
   * @param {{latitude, longitude}} p2
   * @returns {{ hours: number, display: string }}
   */
  static estimateWalkTime(p1, p2) {
    const distKm = this.haversineDistance(p1, p2)
    const hours = distKm / 5 // 步行 5 km/h
    const minutes = Math.round(hours * 60)
    const display = hours < 1 ? `${minutes}分钟` : `${Math.floor(hours)}小时${minutes % 60}分钟`
    return { hours, display }
  }
}

// —— 城市点亮（微信 map circles），与足迹页共用，避免单独文件在 mp 端未被打包 ——

export const CITY_LIGHT_PRESETS = {
  北京市: { lat: 39.9042, lng: 116.4074, r: 38000 },
  上海市: { lat: 31.2304, lng: 121.4737, r: 35000 },
  天津市: { lat: 39.3434, lng: 117.3616, r: 32000 },
  重庆市: { lat: 29.563, lng: 106.5516, r: 36000 },
  广州市: { lat: 23.1291, lng: 113.2644, r: 34000 },
  深圳市: { lat: 22.5431, lng: 114.0579, r: 30000 },
  东莞市: { lat: 23.0207, lng: 113.7518, r: 28000 },
  佛山市: { lat: 23.0215, lng: 113.1214, r: 26000 },
  珠海市: { lat: 22.2707, lng: 113.5767, r: 22000 },
  杭州市: { lat: 30.2741, lng: 120.1551, r: 32000 },
  南京市: { lat: 32.0603, lng: 118.7969, r: 30000 },
  苏州市: { lat: 31.2989, lng: 120.5853, r: 28000 },
  无锡市: { lat: 31.4912, lng: 120.3124, r: 24000 },
  宁波市: { lat: 29.8683, lng: 121.544, r: 28000 },
  温州市: { lat: 28.0006, lng: 120.6994, r: 26000 },
  成都市: { lat: 30.5728, lng: 104.0668, r: 34000 },
  武汉市: { lat: 30.5928, lng: 114.3055, r: 32000 },
  西安市: { lat: 34.3416, lng: 108.9398, r: 32000 },
  郑州市: { lat: 34.7466, lng: 113.6254, r: 30000 },
  长沙市: { lat: 28.2282, lng: 112.9388, r: 30000 },
  合肥市: { lat: 31.8206, lng: 117.2272, r: 28000 },
  福州市: { lat: 26.0745, lng: 119.2965, r: 28000 },
  厦门市: { lat: 24.4798, lng: 118.0819, r: 22000 },
  青岛市: { lat: 36.0671, lng: 120.3826, r: 30000 },
  济南市: { lat: 36.6512, lng: 117.1201, r: 28000 },
  大连市: { lat: 38.914, lng: 121.6147, r: 26000 },
  沈阳市: { lat: 41.8057, lng: 123.4315, r: 30000 },
  哈尔滨市: { lat: 45.8038, lng: 126.535, r: 32000 },
  长春市: { lat: 43.8171, lng: 125.3235, r: 28000 },
  石家庄市: { lat: 38.0428, lng: 114.5149, r: 28000 },
  太原市: { lat: 37.8706, lng: 112.5489, r: 26000 },
  南昌市: { lat: 28.682, lng: 115.8579, r: 28000 },
  南宁市: { lat: 22.817, lng: 108.3669, r: 30000 },
  海口市: { lat: 20.044, lng: 110.1999, r: 24000 },
  昆明市: { lat: 25.0406, lng: 102.7123, r: 30000 },
  贵阳市: { lat: 26.647, lng: 106.6302, r: 28000 },
  兰州市: { lat: 36.0611, lng: 103.8343, r: 26000 },
  乌鲁木齐市: { lat: 43.8256, lng: 87.6168, r: 32000 },
  拉萨市: { lat: 29.652, lng: 91.1721, r: 28000 },
  西宁市: { lat: 36.6171, lng: 101.7782, r: 24000 },
  银川市: { lat: 38.4872, lng: 106.2309, r: 24000 },
  呼和浩特市: { lat: 40.8424, lng: 111.7492, r: 26000 },
  香港特别行政区: { lat: 22.3193, lng: 114.1694, r: 18000 },
  澳门特别行政区: { lat: 22.1987, lng: 113.5439, r: 8000 }
}

export function extractCityKeyFromAddress(address) {
  if (!address || typeof address !== 'string') return ''
  const s = address.replace(/\s/g, '')
  const munis = ['北京', '上海', '天津', '重庆']
  for (let i = 0; i < munis.length; i++) {
    const m = munis[i]
    if (s.includes(m)) return `${m}市`
  }
  if (s.includes('香港')) return '香港特别行政区'
  if (s.includes('澳门')) return '澳门特别行政区'
  const m1 = s.match(/(?:省|自治区)([\u4e00-\u9fa5]{2,5}市)/)
  if (m1) return m1[1]
  const m2 = s.match(/([\u4e00-\u9fa5]{2,5}市)/)
  if (m2) return m2[1]
  return ''
}

function findCityLightPreset(cityKey) {
  if (!cityKey) return null
  if (CITY_LIGHT_PRESETS[cityKey]) return CITY_LIGHT_PRESETS[cityKey]
  const noSuffix = cityKey.replace(/市$/, '')
  const withSuffix = noSuffix.length ? `${noSuffix}市` : ''
  if (withSuffix && CITY_LIGHT_PRESETS[withSuffix]) return CITY_LIGHT_PRESETS[withSuffix]
  return null
}

function cityLightDynamicRadiusMeters(points) {
  if (!points.length) return 20000
  let sumLat = 0
  let sumLng = 0
  for (let i = 0; i < points.length; i++) {
    sumLat += points[i].latitude
    sumLng += points[i].longitude
  }
  const cLat = sumLat / points.length
  const cLng = sumLng / points.length
  let maxKm = 0
  for (let j = 0; j < points.length; j++) {
    const p = points[j]
    const km = HeatmapCalculator.haversineDistance(
      { latitude: cLat, longitude: cLng },
      { latitude: p.latitude, longitude: p.longitude }
    )
    if (km > maxKm) maxKm = km
  }
  const meters = maxKm * 1000 * 1.45 + 4000
  return Math.min(50000, Math.max(14000, meters))
}

export function buildCityLightCircles(litItems) {
  if (!Array.isArray(litItems) || !litItems.length) return []

  const groups = new Map()
  for (let i = 0; i < litItems.length; i++) {
    const item = litItems[i]
    const lat = Number(item.latitude)
    const lng = Number(item.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue

    let key = extractCityKeyFromAddress(item.address || '')
    if (!key) key = `__coord_${Math.round(lat * 100)}_${Math.round(lng * 100)}`

    if (!groups.has(key)) {
      groups.set(key, { points: [], cityKey: key.indexOf('__coord_') === 0 ? '' : key })
    }
    groups.get(key).points.push({ latitude: lat, longitude: lng })
  }

  const circles = []
  const used = new Set()

  groups.forEach((g) => {
    const points = g.points
    const cityKey = g.cityKey
    const preset = cityKey ? findCityLightPreset(cityKey) : null

    let clat
    let clng
    let radius

    if (preset) {
      clat = preset.lat
      clng = preset.lng
      radius = preset.r
    } else {
      let sumLat = 0
      let sumLng = 0
      for (let k = 0; k < points.length; k++) {
        sumLat += points[k].latitude
        sumLng += points[k].longitude
      }
      clat = sumLat / points.length
      clng = sumLng / points.length
      radius = cityLightDynamicRadiusMeters(points)
    }

    const dedupe = `${clat.toFixed(3)}_${clng.toFixed(3)}_${radius}`
    if (used.has(dedupe)) return
    used.add(dedupe)

    circles.push({
      latitude: clat,
      longitude: clng,
      radius,
      strokeWidth: 2,
      strokeColor: '#FF7A45CC',
      fillColor: '#FF7A4533'
    })
  })

  return circles
}

export function countLitCities(litItems) {
  if (!Array.isArray(litItems)) return 0
  const set = new Set()
  for (let i = 0; i < litItems.length; i++) {
    const item = litItems[i]
    if (!Number.isFinite(Number(item.latitude)) || !Number.isFinite(Number(item.longitude))) continue
    const k = extractCityKeyFromAddress(item.address || '')
    if (k) set.add(k)
    else set.add(`_${item.latitude}_${item.longitude}`)
  }
  return set.size
}
