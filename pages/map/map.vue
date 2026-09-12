<template>
  <view class="container" :style="themeVars">
    <view class="header">
      <view class="title-section">
        <text class="title">我的足迹</text>
        <view class="stats-row">
          <view class="stat-item">
            <text class="stat-num">{{ litCount }}</text>
            <text class="stat-label">已点亮</text>
          </view>
          <view class="stat-item">
            <text class="stat-num">{{ pendingGeoCount }}</text>
            <text class="stat-label">待定位</text>
          </view>
          <view class="stat-item">
            <text class="stat-num">{{ litCityCount }}</text>
            <text class="stat-label">点亮城市</text>
          </view>
          <view class="stat-item">
            <text class="stat-num">{{ provinceCount }}</text>
            <text class="stat-label">涉及省份</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="pendingGeoCount > 0" class="geo-banner" @click="enrichAllMissing">
      <text class="geo-banner-text">有 {{ pendingGeoCount }} 条足迹未在地图上显示，点击用地址补全坐标（百度）</text>
      <text v-if="geocoding" class="geo-banner-loading">补全中…</text>
    </view>

    <view class="map-wrap">
      <map
        v-if="!mapFailed"
        id="footprintMap"
        ref="footprintMap"
        class="map"
        :latitude="centerLatitude"
        :longitude="centerLongitude"
        :scale="mapScale"
        :markers="showHeatmap ? [] : markers"
        :polyline="trackPolyline"
        :circles="showCityGlow ? cityLightCircles : []"
        :heat-map-data="showHeatmap ? heatmapData : []"
        enable-zoom
        enable-scroll
        @markertap="onMarkerTap"
        @error="onMapError"
      />

      <view v-if="mapFailed" class="map-fallback">
        <text class="map-fallback-text">地图加载失败，请使用下方列表与「补全坐标」</text>
      </view>

      <view class="map-overlay">
        <view class="legend">
          <view class="legend-item">
            <view class="dot active"></view>
            <text>足迹标记</text>
          </view>
          <view class="legend-item">
            <view class="dot city-glow"></view>
            <text>城市点亮</text>
          </view>
          <view class="legend-item dim">
            <view class="dot dim-dot"></view>
            <text>轨迹连线</text>
          </view>
        </view>
        <view class="overlay-actions">
          <view v-if="litCount > 0" class="chip" :class="{ on: showCityGlow }" @click="toggleCityGlow">
            <text>{{ showCityGlow ? '隐藏城市光晕' : '城市光晕' }}</text>
          </view>
          <view v-if="validPointCount >= 2" class="chip" :class="{ on: showTrack }" @click="toggleTrack">
            <text>{{ showTrack ? '隐藏轨迹' : '显示轨迹' }}</text>
          </view>
          <view v-if="validPointCount >= 3" class="chip" @click="toggleHeatmap">
            <text>{{ showHeatmap ? '标记模式' : '热力图' }}</text>
          </view>
          <view class="chip" @click="refreshLiveLocation">
            <text>刷新定位</text>
          </view>
          <view class="chip" @click="recenterMap">
            <text>回到全览</text>
          </view>
        </view>
      </view>
    </view>

    <scroll-view scroll-y class="location-list">
      <view class="list-title">足迹详情</view>
      <view v-if="history.length === 0" class="empty-tip">
        <text>去首页生成游记并授权定位，即可在地图上点亮足迹</text>
      </view>
      <view
        v-for="(item, index) in history"
        :key="item.id || index"
        class="location-item"
        :class="{ dim: !isLit(item) }"
        @click="focusLocation(item)"
      >
        <view class="item-icon">{{ isLit(item) ? '📍' : '○' }}</view>
        <view class="item-info">
          <text class="item-name">{{ item.address }}</text>
          <text class="item-time">{{ item.time }}</text>
        </view>
        <view class="item-badge" :class="isLit(item) ? 'lit' : 'pending'">
          <text>{{ isLit(item) ? '已点亮' : '待定位' }}</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { HeatmapCalculator, buildCityLightCircles, countLitCities } from '@/utils/heatmap-calculator.js'
import { getBaiduMapAK } from '@/utils/map-config.js'

export default {
  data() {
    return {
      history: [],
      markers: [],
      includePoints: [],
      trackPolyline: [],
      centerLatitude: 39.9088,
      centerLongitude: 116.3975,
      mapScale: 5,
      provinceCount: 0,
      litCount: 0,
      pendingGeoCount: 0,
      showHeatmap: false,
      showTrack: true,
      heatmapData: [],
      validPointCount: 0,
      mapFailed: false,
      geocoding: false,
      selectedMarkerId: null,
      cityLightCircles: [],
      litCityCount: 0,
      showCityGlow: false,
      footprintMarkers: [],
      liveLocationMarker: null,
      mapCtx: null
    }
  },
  computed: {
    includePointsForFit() {
      return this.includePoints.length >= 2 ? this.includePoints : []
    }
  },
  onShow() {
    this.loadHistory()
  },
  onReady() {
    this.mapCtx = uni.createMapContext('footprintMap', this)
  },
  methods: {
    isLit(item) {
      const lat = Number(item.latitude)
      const lng = Number(item.longitude)
      return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
    },

    loadHistory() {
      let history = uni.getStorageSync('travel_history') || []
      if (!Array.isArray(history)) history = []

      // 合并「用户选择的位置」为虚拟足迹（高德式常亮起点）
      const userLoc = uni.getStorageSync('user_location')
      if (userLoc && userLoc.latitude && userLoc.longitude) {
        const exists = history.some(
          (h) =>
            this.isLit(h) &&
            Math.abs(Number(h.latitude) - Number(userLoc.latitude)) < 0.002 &&
            Math.abs(Number(h.longitude) - Number(userLoc.longitude)) < 0.002
        )
        if (!exists) {
          history = [
            {
              id: '__user_pinned__',
              time: '常用地',
              address: userLoc.name || userLoc.address || '我的位置',
              latitude: Number(userLoc.latitude),
              longitude: Number(userLoc.longitude),
              template: 'pin',
              content: '',
              cover: '',
              created_at: 0
            },
            ...history
          ]
        }
      }

      this.history = history

      const provinceKeywords = [
        '北京', '上海', '天津', '重庆', '河北', '山西', '辽宁', '吉林', '黑龙江', '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南', '广东', '海南', '四川', '贵州', '云南', '陕西', '甘肃', '青海', '台湾', '内蒙古', '广西', '西藏', '宁夏', '新疆', '香港', '澳门'
      ]
      const provinces = new Set()
      history.forEach((item) => {
        const addr = item.address || ''
        provinceKeywords.forEach((p) => {
          if (addr.includes(p)) provinces.add(p)
        })
      })
      this.provinceCount = provinces.size

      const litItems = history.filter((h) => this.isLit(h))
      this.litCount = litItems.length
      this.pendingGeoCount = history.length - litItems.length

      const validPoints = HeatmapCalculator.extractValidPoints(history)
      this.validPointCount = validPoints.length
      this.heatmapData = HeatmapCalculator.toHeatmapData(validPoints)

      this.litCityCount = countLitCities(litItems)
      this.cityLightCircles = buildCityLightCircles(litItems)

      // 仅对已点亮坐标打点（避免全部堆在北京默认点）
      this.footprintMarkers = litItems.map((item, index) => {
        const lat = Number(item.latitude)
        const lng = Number(item.longitude)
        return {
          id: index + 1,
          latitude: lat,
          longitude: lng,
          width: 36,
          height: 36,
          anchor: { x: 0.5, y: 1 },
          label: {
            content: '亮',
            color: '#ffffff',
            fontSize: 11,
            borderRadius: 6,
            bgColor: '#ff7a45',
            padding: 3,
            anchorX: 0,
            anchorY: -2
          },
          callout: {
            content: item.address || '足迹',
            color: '#ffffff',
            fontSize: 12,
            borderRadius: 8,
            bgColor: '#1f2937',
            padding: 8,
            display: 'BYCLICK'
          }
        }
      })
      this.mergeMarkers()

      this.includePoints = litItems.map((h) => ({
        latitude: Number(h.latitude),
        longitude: Number(h.longitude)
      }))

      this.buildTrack(history)

      this.fitMapToPoints(litItems)
    },

    buildTrack(history) {
      if (!this.showTrack || !history.length) {
        this.trackPolyline = []
        return
      }
      const sorted = history
        .filter((h) => this.isLit(h))
        .sort((a, b) => (a.created_at || 0) - (b.created_at || 0))
      if (sorted.length < 2) {
        this.trackPolyline = []
        return
      }
      const points = sorted.map((h) => ({
        latitude: Number(h.latitude),
        longitude: Number(h.longitude)
      }))
      this.trackPolyline = [
        {
          points,
          color: '#FF7A4588',
          width: 5,
          dottedLine: false,
          arrowLine: false
        }
      ]
    },

    fitMapToPoints(litItems) {
      if (!litItems.length) {
        this.centerLatitude = 39.9088
        this.centerLongitude = 116.3975
        this.mapScale = 5
        this.$nextTick(() => this.fitPointsToView([]))
        return
      }
      if (litItems.length === 1) {
        this.centerLatitude = Number(litItems[0].latitude)
        this.centerLongitude = Number(litItems[0].longitude)
        this.mapScale = 13
        this.$nextTick(() =>
          this.fitPointsToView([
            {
              latitude: Number(litItems[0].latitude),
              longitude: Number(litItems[0].longitude)
            }
          ])
        )
        return
      }
      let minLat = Infinity
      let maxLat = -Infinity
      let minLng = Infinity
      let maxLng = -Infinity
      litItems.forEach((h) => {
        const la = Number(h.latitude)
        const lo = Number(h.longitude)
        minLat = Math.min(minLat, la)
        maxLat = Math.max(maxLat, la)
        minLng = Math.min(minLng, lo)
        maxLng = Math.max(maxLng, lo)
      })
      this.centerLatitude = (minLat + maxLat) / 2
      this.centerLongitude = (minLng + maxLng) / 2
      const span = Math.max(maxLat - minLat, maxLng - minLng)
      if (span < 0.02) this.mapScale = 14
      else if (span < 0.15) this.mapScale = 11
      else if (span < 0.8) this.mapScale = 8
      else this.mapScale = 5
      this.$nextTick(() =>
        this.fitPointsToView(
          litItems.map((h) => ({
            latitude: Number(h.latitude),
            longitude: Number(h.longitude)
          }))
        )
      )
    },

    recenterMap() {
      const lit = this.history.filter((h) => this.isLit(h))
      this.fitMapToPoints(lit)
    },
    fitPointsToView(points) {
      if (!this.mapCtx || !Array.isArray(points) || points.length < 1) return
      this.mapCtx.includePoints({
        points,
        padding: [40, 80, 140, 60]
      })
    },

    mergeMarkers() {
      const list = [...this.footprintMarkers]
      if (this.liveLocationMarker) list.push(this.liveLocationMarker)
      this.markers = list
    },

    toggleCityGlow() {
      this.showCityGlow = !this.showCityGlow
    },

    refreshLiveLocation() {
      uni.getLocation({
        type: 'gcj02',
        isHighAccuracy: true,
        highAccuracyExpireTime: 5000,
        success: (res) => {
          this.liveLocationMarker = {
            id: 999999,
            latitude: res.latitude,
            longitude: res.longitude,
            width: 32,
            height: 32,
            anchor: { x: 0.5, y: 1 },
            label: {
              content: '我',
              color: '#ffffff',
              fontSize: 10,
              borderRadius: 8,
              bgColor: '#2563eb',
              padding: 3,
              anchorX: 0,
              anchorY: -2
            },
            callout: {
              content: '当前位置（刚刷新）',
              color: '#ffffff',
              fontSize: 12,
              borderRadius: 8,
              bgColor: '#1e40af',
              padding: 8,
              display: 'BYCLICK'
            }
          }
          this.mergeMarkers()
          this.centerLatitude = res.latitude
          this.centerLongitude = res.longitude
          this.mapScale = 14
          uni.showToast({ title: '已刷新 GPS 定位', icon: 'success' })
        },
        fail: () => {
          uni.showToast({ title: '定位失败，请在系统设置中开启权限', icon: 'none' })
        }
      })
    },

    toggleHeatmap() {
      this.showHeatmap = !this.showHeatmap
    },

    toggleTrack() {
      this.showTrack = !this.showTrack
      this.buildTrack(this.history)
    },

    onMapError(e) {
      console.error('地图加载失败', e)
      this.mapFailed = true
    },

    onMarkerTap(e) {
      const mid = e.detail && e.detail.markerId
      this.selectedMarkerId = mid
    },

    focusLocation(item) {
      if (this.isLit(item)) {
        this.centerLatitude = Number(item.latitude)
        this.centerLongitude = Number(item.longitude)
        this.mapScale = 15
        return
      }
      uni.showModal({
        title: '该足迹暂无坐标',
        content: '是否根据地址尝试补全？（需已配置百度地图 request 域名）',
        confirmText: '补全',
        success: (res) => {
          if (res.confirm) this.geocodeAndSaveItem(item)
        }
      })
    },

    geocodeAddress(address) {
      if (!address || !String(address).trim()) return Promise.resolve(null)
      const baiduMapAK = getBaiduMapAK()
      if (!baiduMapAK) {
        uni.showToast({ title: '请先在设置中配置百度地图 AK', icon: 'none' })
        return Promise.resolve(null)
      }
      const url = `https://api.map.baidu.com/geocoding/v3/?address=${encodeURIComponent(
        String(address).trim()
      )}&output=json&ak=${baiduMapAK}&ret_coordtype=gcj02ll`
      return new Promise((resolve) => {
        uni.request({
          url,
          method: 'GET',
          header: { Referer: 'touristappid' },
          success: (res) => {
            const d = res.data
            if (d && d.status === 0 && d.result && d.result.location) {
              const loc = d.result.location
              const lat = Number(loc.lat)
              const lng = Number(loc.lng)
              if (Number.isFinite(lat) && Number.isFinite(lng)) {
                resolve({ latitude: lat, longitude: lng })
                return
              }
            }
            resolve(null)
          },
          fail: () => resolve(null)
        })
      })
    },

    async geocodeAndSaveItem(item) {
      const coords = await this.geocodeAddress(item.address)
      if (!coords) {
        uni.showToast({ title: '补全失败，请检查网络与域名白名单', icon: 'none' })
        return
      }
      const list = uni.getStorageSync('travel_history') || []
      const idx = list.findIndex(
        (h) =>
          (item.id && h.id === item.id) ||
          (!item.id && h.address === item.address && h.time === item.time)
      )
      if (idx >= 0) {
        list[idx].latitude = coords.latitude
        list[idx].longitude = coords.longitude
        list[idx].geocoded_at = Date.now()
        uni.setStorageSync('travel_history', list)
        uni.showToast({ title: '已点亮该足迹', icon: 'success' })
        this.loadHistory()
      }
    },

    async enrichAllMissing() {
      if (this.geocoding) return
      const missing = this.history.filter((h) => !this.isLit(h) && h.id !== '__user_pinned__')
      if (!missing.length) {
        uni.showToast({ title: '没有待补全的足迹', icon: 'none' })
        return
      }
      this.geocoding = true
      let ok = 0
      const list = [...(uni.getStorageSync('travel_history') || [])]
      for (let i = 0; i < missing.length; i++) {
        const item = missing[i]
        const coords = await this.geocodeAddress(item.address)
        if (coords) {
          const idx = list.findIndex(
            (h) =>
              (item.id && h.id === item.id) ||
              (!item.id && h.address === item.address && h.time === item.time)
          )
          if (idx >= 0) {
            list[idx].latitude = coords.latitude
            list[idx].longitude = coords.longitude
            list[idx].geocoded_at = Date.now()
            ok++
          }
        }
        await new Promise((r) => setTimeout(r, 280))
      }
      uni.setStorageSync('travel_history', list)
      this.geocoding = false
      this.loadHistory()
      uni.showToast({
        title: ok ? `已补全 ${ok} 条` : '未能补全，请检查域名或地址',
        icon: ok ? 'success' : 'none'
      })
    }
  }
}
</script>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--theme-background, #f9fafb);
}

.header {
  padding: 40rpx 30rpx 28rpx;
  background: var(--theme-primary, linear-gradient(135deg, #111827, #312e81));
  color: #fff;
}

.title {
  font-size: 40rpx;
  font-weight: 800;
  margin-bottom: 20rpx;
  display: block;
}

.stats-row {
  display: flex;
  gap: 32rpx;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  flex-direction: column;
}

.stat-num {
  font-size: 40rpx;
  font-weight: 900;
}

.stat-label {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.75);
}

.geo-banner {
  margin: 0 24rpx;
  padding: 20rpx 24rpx;
  background: linear-gradient(135deg, #fff7ed, #ffedd5);
  border: 1rpx solid #fdba74;
  border-radius: 16rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.geo-banner-text {
  font-size: 24rpx;
  color: #9a3412;
  line-height: 1.5;
}

.geo-banner-loading {
  font-size: 22rpx;
  color: #c2410c;
}

.map-wrap {
  position: relative;
  height: 52vh;
  width: 100%;
}

.map {
  width: 100%;
  height: 100%;
}

.map-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f3f4f6;
}

.map-fallback-text {
  font-size: 26rpx;
  color: #9ca3af;
  text-align: center;
  padding: 0 40rpx;
}

.map-overlay {
  position: absolute;
  top: 20rpx;
  left: 20rpx;
  right: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  pointer-events: none;
}

.legend {
  align-self: flex-start;
  background: rgba(255, 255, 255, 0.94);
  padding: 12rpx 18rpx;
  border-radius: 12rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.08);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 6rpx;
}
.legend-item:first-child {
  margin-top: 0;
}
.legend-item.dim text {
  color: #9ca3af;
}

.dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
}

.dot.active {
  background: #ff7a45;
  box-shadow: 0 0 10rpx rgba(255, 122, 69, 0.6);
}

.dim-dot {
  background: transparent;
  border: 2rpx solid #ff7a45;
}

.dot.city-glow {
  background: rgba(255, 122, 69, 0.45);
  border: 2rpx solid #ff7a45;
  box-shadow: 0 0 12rpx rgba(255, 122, 69, 0.5);
}

.legend-item text {
  font-size: 22rpx;
  color: #4b5563;
}

.overlay-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  pointer-events: auto;
}

.chip {
  background: rgba(255, 255, 255, 0.94);
  padding: 12rpx 20rpx;
  border-radius: 999rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.08);
  border: 1rpx solid #e5e7eb;
}

.chip text {
  font-size: 24rpx;
  color: #111827;
  font-weight: 600;
}

.chip.on {
  background: #fff7ed;
  border-color: #fdba74;
}

.location-list {
  flex: 1;
  background: var(--theme-card-bg, #fff);
  border-radius: 28rpx 28rpx 0 0;
  margin-top: 0;
  z-index: 10;
  padding: 20rpx 24rpx 24rpx;
}

.list-title {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--theme-text-primary, #111827);
  margin-bottom: 24rpx;
}

.location-item {
  display: flex;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid #f3f4f6;
}

.location-item.dim {
  opacity: 0.85;
}

.item-icon {
  font-size: 36rpx;
  margin-right: 20rpx;
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.item-name {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--theme-text-primary, #111827);
}

.item-time {
  font-size: 22rpx;
  color: var(--theme-text-secondary, #6b7280);
  margin-top: 4rpx;
}

.item-badge {
  flex-shrink: 0;
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
}

.item-badge.lit {
  background: #fff7ed;
  color: #c2410c;
}

.item-badge.pending {
  background: #f3f4f6;
  color: #9ca3af;
}

.empty-tip {
  padding: 80rpx 0;
  text-align: center;
  color: #9ca3af;
  font-size: 28rpx;
  line-height: 1.6;
}
</style>
