﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿<template>
  <view class="container" :style="themeVars">
    <view class="hero">
      <view class="hero-card">
        <view class="top-actions">
          <view class="settings-btn" @click="goMe">我的</view>
          <view class="weather-card" @click="goToWeather">
            <view class="weather-icon" :class="weatherInfo.iconClass"></view>
            <view class="weather-info">
              <text class="weather-temp">{{ weatherInfo.temp || '--' }}°</text>
              <text class="weather-desc">{{ weatherInfo.desc || '获取中...' }}</text>
            </view>
            <view class="weather-arrow">›</view>
          </view>
        </view>
        <view class="brand">
          <view class="logo">AI</view>
          <view class="brand-text">
            <text class="title">随行记</text>
            <text class="subtitle">智能旅游微网页生成</text>
          </view>
        </view>
        <view class="chips">
          <text class="chip">拍照</text>
          <text class="chip">定位</text>
          <text class="chip">生成</text>
          <text class="chip">分享</text>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="preview-grid" v-if="imageUrls.length > 0">
        <view v-for="(img, index) in imageUrls" :key="index" class="preview-item">
          <image :src="img" mode="aspectFill" class="preview-img" @click="previewFullImage(index)"></image>
          <view class="delete-badge" @click.stop="removeImage(index)">
            <text class="delete-icon">×</text>
          </view>
        </view>
        <view class="preview-item add-more" v-if="imageUrls.length < 6" @click="chooseImage">
          <text class="add-icon">+</text>
        </view>
      </view>
      <view class="preview placeholder" v-else @click="chooseImage">
        <text class="placeholder-title">先选一张照片</text>
        <text class="placeholder-sub">它会作为微网页封面</text>
      </view>
    </view>

    <view class="section">
      <view class="info">
        <view class="info-row">
          <text class="info-label">当前位置</text>
          <text class="info-value" v-if="locationInfo.addressText || locationInfo.address">{{
            locationInfo.addressText || locationInfo.address
          }}</text>
          <text class="info-placeholder" v-else>未获取（用于生成更贴近现场的文案）</text>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="info">
        <view class="info-row">
          <text class="info-label">写作风格</text>
          <view class="template-selector">
            <view 
              v-for="template in templates" 
              :key="template.id" 
              class="template-item"
              :class="{ active: selectedTemplate === template.id }"
              @click="selectTemplate(template.id)"
            >
              <text class="template-name">{{ template.name }}</text>
              <text class="template-desc">{{ template.description }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="section">
      <button
        class="btn primary"
        :disabled="!imageUrl || !(locationInfo.addressText || locationInfo.address) || isGenerating"
        @click="generateNote"
      >
        生成游记
      </button>
      <button
        v-if="isGenerating"
        class="btn outline"
        style="margin-top:12rpx"
        @click="cancelRequest"
      >
        取消生成
      </button>
      
      <!-- 进度提示 -->
      <view v-if="isGenerating && progressStage" class="progress-container">
        <view class="progress-text">{{ progressStage.text }}</view>
        <view class="progress-bar">
          <view class="progress-fill" :style="{ width: progressStage.progress + '%' }"></view>
        </view>
      </view>
    </view>

    <view class="section" v-if="noteContent">
      <view class="result">
        <view class="result-head">
          <text class="result-title">生成结果</text>
          <text class="result-tip">可继续生成，直到你满意</text>
        </view>
        <text class="result-content">{{ noteContent }}</text>
        <view class="result-actions">
          <button class="btn outline" @click="generateNote">再生成一次</button>
          <button class="btn primary" @click="previewWebNote">生成微网页</button>
        </view>
      </view>
      <view class="result" style="margin-top:18rpx;">
        <view class="result-head">
          <text class="result-title">改进建议</text>
          <text class="result-tip">一句话描述你想要的风格</text>
        </view>
        <textarea v-model="feedbackText" placeholder="例如：更口语、更细节、更有节奏感" style="width:100%;min-height:140rpx;border:2rpx solid #e5e7eb;border-radius:18rpx;padding:12rpx 16rpx;font-size:28rpx;"/>
        <view class="result-actions">
          <button class="btn primary" @click="generateWithFeedback">按建议重生成</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { TEMPLATES, TemplateEngine } from '@/utils/templates.js'
import { PROGRESS_STAGES } from '@/utils/constants.js'
import { HistoryManager } from '@/utils/history-manager.js'
import { StatsService } from '@/utils/stats-service.js'
import { getAIConfig, validateAIConfig } from '@/utils/ai-config.js'
import { getBaiduMapAK } from '@/utils/map-config.js'

export default {
  data() {
    return {
      imageUrl: '',
      imageUrls: [],
      locationInfo: {
        address: '',
        addressText: ''
      },
      processedImageBlocks: [], // 缓存已处理好的图片数据
      noteContent: '',
      feedbackText: '',
      isGenerating: false,
      currentTask: null,
      generationTimer: null, // 统一的定时器管理
      progressStage: null, // 当前进度阶段
      // 模板相关
      templates: Object.values(TEMPLATES),
      selectedTemplate: 'literary', // 默认选择文艺风
      // 天气信息
      weatherInfo: {
        temp: '',
        desc: '',
        iconClass: ''
      },
      // OpenAI 兼容接口配置从本机设置读取，避免把密钥写进源码
      weapisConfig: getAIConfig(),
    }
  },
  onLoad() {
    // 从本地存储读取 AI 配置和上次使用的模板
    try {
      this.weapisConfig = getAIConfig()
      // 读取上次选择的模板
      const lastTemplate = uni.getStorageSync('last_template')
      if (lastTemplate) this.selectedTemplate = lastTemplate
    } catch (e) {}
    
    // 自动获取位置（内部会同步触发天气请求，确保同一套坐标源）
    this.getLocation()
  },
  onShow() {
    // 从设置页返回后立即使用最新配置
    this.weapisConfig = getAIConfig()
  },
  onUnload() {
    // 组件销毁时清理定时器
    if (this.generationTimer) {
      clearTimeout(this.generationTimer)
      this.generationTimer = null
    }
    if (this.currentTask && this.currentTask.abort) {
      try { this.currentTask.abort() } catch (e) {}
    }
    this.currentTask = null
  },
  methods: {
    previewWebNote() {
      const payload = {
        title: 'AI 随行记',
        address: this.locationInfo.addressText || this.locationInfo.address || '',
        content: this.noteContent || '',
        coverSrc: this.imageUrl || ''
      }
      // 使用本地存储传递数据，避免 URL 过长导致超时
      try {
        uni.setStorageSync('temp_note_payload', payload)
        uni.navigateTo({
          url: '/pages/note/note'
        })
      } catch (e) {
        console.error('保存临时数据失败', e)
        uni.showToast({ title: '跳转失败，请重试', icon: 'none' })
      }
    },
    openTokenDialog() {
      uni.navigateTo({ url: '/pages/settings/settings' })
    },
    goMe() {
      uni.navigateTo({ url: '/pages/me/me' })
    },
    goToWeather() {
      uni.navigateTo({ url: '/pages/weather/weather' })
    },
    // 选择模板
    selectTemplate(templateId) {
      this.selectedTemplate = templateId
      // 保存到本地存储
      try {
        uni.setStorageSync('last_template', templateId)
      } catch (e) {
        console.error('保存模板选择失败', e)
      }
    },
    // 选择图片或拍照
    chooseImage() {
      uni.chooseImage({
        count: 6 - this.imageUrls.length,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          this.imageUrls = [...this.imageUrls, ...(res.tempFilePaths || [])]
          this.imageUrl = this.imageUrls[0] || ''
          this.processedImageBlocks = [] // 重置已处理图片
        },
        fail: (err) => {
          if (err.errMsg.indexOf('cancel') === -1) {
            uni.showToast({ title: '选择失败', icon: 'none' })
          }
        }
      })
    },
    // 移除图片
    removeImage(index) {
      this.imageUrls.splice(index, 1)
      this.processedImageBlocks = [] // 图片变动，清空已处理数据
      if (this.imageUrls.length > 0) {
        this.imageUrl = this.imageUrls[0]
      } else {
        this.imageUrl = ''
      }
    },
    // 预览图片
    previewFullImage(index) {
      uni.previewImage({
        urls: this.imageUrls,
        current: index
      })
    },
    // 保存到历史记录
    async saveToHistory() {
      try {
        // 将临时路径转换为持久化路径
        let persistentCover = this.imageUrls[0] || ''
        
        // #ifdef MP-WEIXIN
        // 微信小程序：将临时路径复制到持久化路径
        if (persistentCover && (persistentCover.startsWith('wxfile://') || persistentCover.indexOf('tmp') !== -1)) {
          try {
            const fs = uni.getFileSystemManager()
            const fileName = `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`
            const savedPath = `${wx.env.USER_DATA_PATH}/${fileName}`
            
            await new Promise((resolve, reject) => {
              fs.copyFile({
                srcPath: persistentCover,
                destPath: savedPath,
                success: () => {
                  persistentCover = savedPath
                  console.log(`[History] 图片已保存到持久化路径: ${savedPath}`)
                  resolve()
                },
                fail: (err) => {
                  console.warn('[History] 图片持久化失败，使用临时路径', err)
                  reject(err)
                }
              })
            })
          } catch (err) {
            console.warn('[History] 图片持久化失败，使用临时路径', err)
          }
        }
        // #endif
        
        // 使用 HistoryManager 保存
        const note = {
          address: this.locationInfo.addressText || this.locationInfo.address || '未知地点',
          content: this.noteContent,
          cover: persistentCover,
          template: this.selectedTemplate,
          latitude: this.locationInfo.latitude,
          longitude: this.locationInfo.longitude
        }
        
        const savedNote = await HistoryManager.saveToLocal(note)

        // 登录用户自动尝试同步；失败时保留 synced=false，网络恢复后继续补传
        if (uni.getStorageSync('uni_id_token')) {
          HistoryManager.syncToCloud(savedNote).catch(error => {
            console.warn('[History] 自动同步失败，将稍后重试:', error.message)
          })
        }
        
      } catch (e) {
        console.error('保存历史记录失败', e)
      }
    },
  
    // 获取当前位置
    getLocation() {
      // 首先检查是否有用户手动选择的位置
      const userLocation = uni.getStorageSync('user_location')
      if (userLocation && userLocation.latitude && userLocation.longitude) {
        console.log('使用用户手动选择的位置:', userLocation)
        this.locationInfo = {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          address: userLocation.address,
          addressText: userLocation.name || userLocation.address
        }
        // 使用同一份坐标请求天气，避免与自动定位不一致
        this.fetchWeatherData(userLocation.latitude, userLocation.longitude)
        return
      }
      
      // 如果没有用户手动选择的位置，则自动获取位置授权
      // #ifdef MP-WEIXIN
      // 微信小程序中，uni.getLocation 默认不返回 address 详细地址
      // 使用自动获取位置，然后通过逆地理编码获取地址
      uni.getLocation({
        type: 'gcj02',
        isHighAccuracy: true,
        highAccuracyExpireTime: 3000,
        success: (res) => {
          console.log('自动获取位置成功:', res)
          this.locationInfo = {
            latitude: res.latitude,
            longitude: res.longitude,
            address: '',
            addressText: '当前位置'
          }
          // 可以在这里调用逆地理编码API获取详细地址
          this.reverseGeocode(res.latitude, res.longitude)
          // 使用同一份坐标请求天气
          this.fetchWeatherData(res.latitude, res.longitude)
        },
        fail: (err) => {
          console.error('自动获取位置失败:', err)
          uni.showModal({
            title: '位置授权失败',
            content: '需要获取您的位置信息才能生成游记，请授权位置权限',
            confirmText: '去设置',
            success: (modalRes) => {
              if (modalRes.confirm) {
                uni.openSetting({
                  success: (settingRes) => {
                    if (settingRes.authSetting['scope.userLocation']) {
                      // 用户重新授权，再次获取位置
                      this.getLocation()
                    }
                  }
                })
              }
            }
          })
        }
      })
      // #endif

      // #ifndef MP-WEIXIN
      uni.getLocation({
        type: 'gcj02',
        geocode: true, // 设置为true以获取详细地址信息
        success: (res) => {
          const addr = res?.address
          const addressText =
            typeof addr === 'string'
              ? addr
              : [
                  addr?.country,
                  addr?.province,
                  addr?.city,
                  addr?.district,
                  addr?.street,
                  addr?.streetNum
                ]
                  .filter(Boolean)
                  .join('')

          this.locationInfo = { ...res, address: addr, addressText }
          uni.showToast({
            title: '位置获取成功',
            icon: 'success'
          })
          // 使用同一份坐标请求天气
          this.fetchWeatherData(res.latitude, res.longitude)
        },
        fail: (err) => {
          uni.showToast({
            title: '位置获取失败，请开启定位权限',
            icon: 'none'
          })
        }
      })
      // #endif
    },
    
    // 逆地理编码，根据经纬度获取详细地址（使用百度地图 API）
    reverseGeocode(latitude, longitude) {
      console.log('开始逆地理编码:', { latitude, longitude })
      
      const baiduMapAK = getBaiduMapAK()
      if (!baiduMapAK) {
        this.locationInfo.addressText = `当前位置 (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
        this.locationInfo.address = this.locationInfo.addressText
        uni.showToast({ title: '未配置地图 AK，暂用坐标显示', icon: 'none' })
        return
      }
      // uni.getLocation(type='gcj02') 返回 GCJ-02 坐标，因此这里使用 gcj02ll，避免坐标系不匹配造成偏移
      const url = `https://api.map.baidu.com/reverse_geocoding/v3/?ak=${baiduMapAK}&output=json&coordtype=gcj02ll&location=${latitude},${longitude}`
      uni.request({
        url: url,
        method: 'GET',
        header: {
          'Referer': 'touristappid' // 添加 Referer 配置
        },
        success: (res) => {
          console.log('逆地理编码响应:', res.data)
          
          if (res.data && res.data.status === 0 && res.data.result) {
            const addressComponent = res.data.result.addressComponent
            if (addressComponent) {
              // 组合完整地址：省 + 市 + 区 + 街道
              const fullAddress = [
                addressComponent.province,
                addressComponent.city,
                addressComponent.district,
                addressComponent.street,
                addressComponent.streetNumber
              ].filter(Boolean).join('')
              
              // 获取 POI 信息（如果有）
              const poiName = res.data.result.pois && res.data.result.pois[0] 
                ? res.data.result.pois[0].name 
                : ''
              
              this.locationInfo.addressText = poiName || fullAddress || `当前位置 (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
              this.locationInfo.address = fullAddress
              
              console.log('逆地理编码成功:', this.locationInfo.addressText)
            } else {
              this.locationInfo.addressText = `当前位置 (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
            }
          } else {
            console.warn('逆地理编码失败:', res.data)
            this.locationInfo.addressText = `当前位置 (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
          }
        },
        fail: (err) => {
          console.error('逆地理编码请求失败:', err)
          this.locationInfo.addressText = `当前位置 (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
        }
      })
    },
    
    // 调用云函数获取天气信息
    fetchWeatherData(latitude, longitude) {
      console.log('调用云函数获取天气:', { latitude, longitude })
      
      uniCloud.callFunction({
        name: 'get-weather',
        data: {
          latitude: latitude,
          longitude: longitude
        },
        success: (res) => {
          console.log('云函数响应:', res)
          // 更健壮的错误处理，防止res.result为null
          if (res && res.result && res.result.ok && res.result.data && res.result.data.now) {
            const weatherData = res.result.data.now
            console.log('天气数据:', weatherData)
            this.updateWeatherInfo(weatherData)
          } else {
            console.error('获取天气失败:', res ? res.result : 'res is null')
            // 设置默认天气数据，确保UI显示
            this.updateWeatherInfo({
              temp: '25',
              text: '晴',
              code: '0'
            })
          }
        },
        fail: (err) => {
          console.error('调用云函数失败:', err)
          // 设置默认天气数据，确保UI显示
          this.updateWeatherInfo({
            temp: '25',
            text: '晴',
            code: '0'
          })
        }
      })
    },
    
    // 更新天气信息
    updateWeatherInfo(weatherData) {
      // 确保weatherData和code字段存在
      const code = weatherData && weatherData.code ? weatherData.code : '0'
      this.weatherInfo = {
        temp: weatherData && weatherData.temp ? weatherData.temp : '25',
        desc: weatherData && weatherData.text ? weatherData.text : '晴',
        iconClass: this.getWeatherIconClass(code)
      }
    },
    
    // 根据天气代码获取图标类名（百度地图天气代码）
    getWeatherIconClass(code) {
      // 确保 code 存在且为字符串
      const codeStr = (code !== undefined && code !== null) ? String(code) : '0'
      // 百度地图天气代码映射
      const iconMap = {
        // 晴天
        '0': 'weather-sunny',

        // 多云
        '1': 'weather-cloudy',

        // 阴
        '2': 'weather-overcast',

        // 雨
        '3': 'weather-rain',
        '4': 'weather-rain',
        '5': 'weather-rain',
        '6': 'weather-rain',
        '7': 'weather-rain',
        '8': 'weather-rain',
        '9': 'weather-rain',
        '10': 'weather-rain',
        '11': 'weather-rain',

        // 雪
        '12': 'weather-snow',
        '13': 'weather-snow',
        '14': 'weather-snow',
        '15': 'weather-snow',

        // 雾
        '16': 'weather-fog',

        // 霾
        '17': 'weather-haze',

        // 风
        '18': 'weather-wind',

        // 浮尘
        '19': 'weather-dust'
      }
      return iconMap[codeStr] || 'weather-sunny'
    },

    // 直接调用 WeAPIs（OpenAI 兼容）生成游记
    async generateNote() {
      if (this.isGenerating) return

      const configCheck = validateAIConfig(this.weapisConfig)
      if (!configCheck.ok) {
        uni.showModal({
          title: '需要配置 AI 服务',
          content: configCheck.message,
          confirmText: '去设置',
          success: res => {
            if (res.confirm) uni.navigateTo({ url: '/pages/settings/settings' })
          }
        })
        return
      }
      
      // 检查是否已获取位置
      const address = this.locationInfo.addressText || this.locationInfo.address || ''
      if (!address) {
        uni.showToast({
          title: '请先获取位置',
          icon: 'none',
          duration: 2000
        })
        return
      }
      
      this.isGenerating = true
      this.progressStage = PROGRESS_STAGES.ANALYZING
      uni.showLoading({ title: '正在分析图片...' })

      try {
        const address = this.locationInfo.addressText || this.locationInfo.address || ''
        // 使用模板引擎构建 prompt
        const basePrompt = TemplateEngine.buildPrompt(this.selectedTemplate, address)

        console.log(`[Generate] 开始生成，直接调用 AI API`);
        console.log(`[Generate] 准备图片中...`);
        
        const contentBlocks = [{ type: 'text', text: basePrompt }]
        
        // 渐进式策略：如果还没有生成过内容（首次生成），只等第一张图片处理完
        // 这样可以极大地缩短首次等待时间
        const isFirstGeneration = !this.noteContent;
        let imgs = [];
        
        if (isFirstGeneration) {
          console.log(`[Generate] 首次生成，仅处理首图...`);
          imgs = await this.prepareImageBlocks(this.imageUrls, 1);
          // 异步处理剩余图片，不阻塞当前请求
          this.prepareImageBlocks(this.imageUrls, 3); 
        } else {
          console.log(`[Generate] 再次生成，使用所有已选图片...`);
          imgs = await this.prepareImageBlocks(this.imageUrls, 3);
        }
        
        console.log(`[Generate] 图片准备完成, 成功 ${imgs.length} 张`);
        
        // 更新进度：开始创作
        this.progressStage = PROGRESS_STAGES.CREATING
        uni.showLoading({ title: 'AI 正在创作...' })
        imgs.forEach(b => contentBlocks.push(b))

        // 清理旧定时器并设置新的超时观察
        if (this.generationTimer) {
          clearTimeout(this.generationTimer)
          this.generationTimer = null
        }
        
        this.generationTimer = setTimeout(() => {
          if (this.isGenerating) {
            console.warn(`[Generate] 请求超时`);
            this.isGenerating = false
            if (this.currentTask && this.currentTask.abort) {
              try { this.currentTask.abort() } catch (e) {}
            }
            this.currentTask = null
            this.generationTimer = null
            uni.hideLoading()
            uni.showToast({ title: '请求超时，请重试', icon: 'none' })
          }
        }, this.weapisConfig.timeoutMs || 120000)

        console.log(`[Generate] 发送请求到 AI API...`);
        const res = await this.apiRequest({
          model: this.weapisConfig.model,
          stream: false,
          messages: [{ role: 'user', content: contentBlocks }],
          max_tokens: 1200,
          temperature: 0.6
        }, this.weapisConfig.timeoutMs || 60000)

        // 更新进度：即将完成
        this.progressStage = PROGRESS_STAGES.FINISHING

        // 处理返回结果
        const data = res.data || {}
        if (res && (res.statusCode === 200 || res.statusCode === 201)) {
          const content =
            data?.choices?.[0]?.message?.content ||
            data?.content ||
            data?.message?.content ||
            ''
          this.noteContent = (content || '').trim()
          
          if (!this.noteContent) {
            uni.showToast({ title: 'AI 返回内容为空，请重试', icon: 'none' })
            return
          }
          
          // 存储到本地历史记录
          await this.saveToHistory()
          
          // 记录统计数据
          try {
            await StatsService.recordGeneration({
              address: this.locationInfo.addressText || this.locationInfo.address || '未知地点',
              timestamp: Date.now()
            })
          } catch (error) {
            console.error('记录统计失败:', error)
          }
          
          uni.showToast({
            title: '游记生成成功！',
            icon: 'success'
          })
        } else {
          console.error('生成错误：', res?.statusCode, data)
          const errMsg = data?.error?.message || data?.error || data?.message || `HTTP ${res?.statusCode || '未知'}`
          if (res?.statusCode === 401 || res?.statusCode === 403) {
            uni.navigateTo({ url: '/pages/settings/settings' })
          }
          uni.showToast({
            title: `AI生成失败：${errMsg}`,
            icon: 'none',
            duration: 3000
          })
        }
      } catch (err) {
        console.error('请求异常：', err)
        uni.showToast({
          title: `请求失败：${err.message || '未知错误'}`,
          icon: 'none'
        })
      } finally {
        uni.hideLoading()
        this.isGenerating = false
        this.progressStage = null
        if (this.generationTimer) {
          clearTimeout(this.generationTimer)
          this.generationTimer = null
        }
        this.currentTask = null
      }
    }
    ,
    async generateWithFeedback() {
      if (this.isGenerating) return
      const configCheck = validateAIConfig(this.weapisConfig)
      if (!configCheck.ok) {
        uni.showToast({ title: configCheck.message, icon: 'none', duration: 2500 })
        return
      }
      const tip = String(this.feedbackText || '').trim()
      if (!tip) {
        uni.showToast({ title: '请填写改进建议', icon: 'none' })
        return
      }
      this.isGenerating = true
      uni.showLoading({ title: '按建议重写中...' })
      try {
        const address = this.locationInfo.addressText || this.locationInfo.address || ''
        // 使用模板引擎构建带反馈的 prompt
        const basePrompt = TemplateEngine.buildPrompt(this.selectedTemplate, address, tip)
        console.log(`[Feedback] 开始重写`);
        console.log(`[Feedback] 准备图片中...`);
        const contentBlocks = [{ type: 'text', text: basePrompt }]
        const imgs = await this.prepareImageBlocks(this.imageUrls, 3)
        console.log(`[Feedback] 图片准备完成, 成功 ${imgs.length} 张`);
        imgs.forEach(b => contentBlocks.push(b))

        // 清理旧定时器并设置新的超时观察
        if (this.generationTimer) {
          clearTimeout(this.generationTimer)
          this.generationTimer = null
        }
        
        this.generationTimer = setTimeout(() => {
          if (this.isGenerating) {
            console.warn(`[Feedback] 请求超时`);
            this.isGenerating = false
            if (this.currentTask && this.currentTask.abort) {
              try { this.currentTask.abort() } catch (e) {}
            }
            this.currentTask = null
            this.generationTimer = null
            uni.hideLoading()
            uni.showToast({ title: '请求超时，请重试', icon: 'none' })
          }
        }, this.weapisConfig.timeoutMs || 120000)

        console.log(`[Feedback] 发送请求到 AI API...`);
        const res = await this.apiRequest({
          model: this.weapisConfig.model,
          messages: [{ role: 'user', content: contentBlocks }],
          max_tokens: 1200,
          temperature: 0.6
        }, this.weapisConfig.timeoutMs || 60000)
        // 处理返回结果
        const data = res.data || {}
        if (res && (res.statusCode === 200 || res.statusCode === 201)) {
          const content =
            data?.choices?.[0]?.message?.content ||
            data?.content ||
            data?.message?.content ||
            ''
          this.noteContent = (content || '').trim()
          uni.showToast({ title: '已按建议重写', icon: 'success' })
        } else {
          const errMsg = data?.error?.message || data?.error || data?.message || `HTTP ${res?.statusCode || '未知'}`
          uni.showToast({ title: `重写失败：${errMsg}`, icon: 'none' })
        }
      } catch (e) {
        uni.showToast({ title: `请求失败：${e.message || '未知错误'}`, icon: 'none' })
      } finally {
        uni.hideLoading()
        this.isGenerating = false
        if (this.generationTimer) {
          clearTimeout(this.generationTimer)
          this.generationTimer = null
        }
        this.currentTask = null
      }
    },
    // 核心请求方法：直接调用 AI API（绕过 uniCloud.callFunction 避免签名链路问题）
    async apiRequest(payload, timeoutMs) {
      console.log('[Request] 直接调用 AI API');
      
      const validation = validateAIConfig(this.weapisConfig)
      if (!validation.ok) throw new Error(validation.message)
      
      console.log('[Request] 参数验证通过');
      console.log('[Request] Base URL:', this.weapisConfig.baseUrl);
      console.log('[Request] Model:', this.weapisConfig.model);
      
      const requestUrl = `${this.weapisConfig.baseUrl}/chat/completions`;
      const requestData = {
        model: payload.model || this.weapisConfig.model,
        messages: payload.messages,
        max_tokens: payload.max_tokens || 1200,
        temperature: payload.temperature || 0.6,
        stream: false
      };
      
      return new Promise((resolve, reject) => {
        this.currentTask = uni.request({
          url: requestUrl,
          method: 'POST',
          header: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.weapisConfig.apiKey}`
          },
          data: requestData,
          timeout: timeoutMs || this.weapisConfig.timeoutMs || 120000,
          success: (res) => {
            console.log('[Request] API 响应状态:', res.statusCode);
            resolve({
              statusCode: res.statusCode,
              data: res.data
            });
          },
          fail: (err) => {
            console.error('[Request] API 请求失败:', err);
            reject(new Error(err.errMsg || '网络请求失败'));
          }
        });
      });
    },
    cancelRequest() {
      try {
        if (this.currentTask && this.currentTask.abort) this.currentTask.abort()
      } catch (e) {}
      if (this.generationTimer) {
        clearTimeout(this.generationTimer)
        this.generationTimer = null
      }
      this.currentTask = null
      this.isGenerating = false
      this.progressStage = null
      uni.hideLoading()
      uni.showToast({ title: '已取消', icon: 'none' })
    },
    // 处理图片块
    async prepareImageBlocks(paths, limit = 3) {
      const take = (paths || []).slice(0, limit)
      const results = []
      
      // 串行处理图片，减少移动端瞬间内存压力
      for (let i = 0; i < take.length; i++) {
        // 如果已经处理过了（按索引匹配），直接使用缓存
        if (this.processedImageBlocks[i]) {
          results.push(this.processedImageBlocks[i])
          continue
        }
        
        const block = await this.pathToImageBlock(take[i])
        if (block) {
          results.push(block)
          this.processedImageBlocks[i] = block // 存入缓存
        }
      }
      return results
    },
    pathToImageBlock(p) {
      return new Promise((resolve) => {
        console.log(`[Image] 开始处理图片: ${p}`);
        const timeout = setTimeout(() => {
          console.warn(`[Image] 处理图片超时(60s): ${p}`);
          resolve(null)
        }, 60000);

        // 如果已经是网络图片（排除微信临时路径），直接返回
        if (typeof p === 'string' && (p.startsWith('http://') || p.startsWith('https://'))) {
          if (p.indexOf('http://tmp/') === -1 && p.indexOf('wxfile://') === -1) {
            clearTimeout(timeout)
            resolve({ type: 'image_url', image_url: { url: p } })
            return
          }
        }

        // #ifdef MP-WEIXIN
        // 1. 先压缩图片，减小体积（微信小程序特有流程）
        uni.compressImage({
          src: p,
          quality: 30, // 进一步降低质量提高速度：30%
          compressedWidth: 600, // 减小宽度提高速度
          success: (cRes) => {
            const path = cRes.tempFilePath
            // 2. 读取压缩后的文件并转为 Base64
            uni.getFileSystemManager().readFile({
              filePath: path,
              encoding: 'base64',
              success: (res) => {
                clearTimeout(timeout)
                const base64 = `data:image/jpeg;base64,${res.data}`
                console.log(`[Image] 微信端压缩后 Base64 读取完成 (${Math.round(base64.length / 1024)} KB)`);
                resolve({ type: 'image_url', image_url: { url: base64 } })
              },
              fail: (err) => {
                clearTimeout(timeout)
                console.error(`[Image] 读取失败: ${JSON.stringify(err)}`);
                resolve(null)
              }
            })
          },
          fail: (err) => {
            console.warn('[Image] 压缩失败，尝试降低质量重新压缩', err);
            // 压缩失败兜底：尝试更低质量压缩
            uni.compressImage({
              src: p,
              quality: 15, // 降低到 15% 质量
              compressedWidth: 400, // 进一步限制宽度
              success: (retryRes) => {
                uni.getFileSystemManager().readFile({
                  filePath: retryRes.tempFilePath,
                  encoding: 'base64',
                  success: (res) => {
                    clearTimeout(timeout)
                    const base64 = `data:image/jpeg;base64,${res.data}`
                    console.log(`[Image] 微信端重试压缩成功 (${Math.round(base64.length / 1024)} KB)`);
                    resolve({ type: 'image_url', image_url: { url: base64 } })
                  },
                  fail: (fErr) => {
                    clearTimeout(timeout)
                    console.error('[Image] 重试压缩后读取失败，跳过该图片');
                    resolve(null)
                  }
                })
              },
              fail: (retryErr) => {
                clearTimeout(timeout)
                console.error('[Image] 重试压缩仍失败，跳过该图片', retryErr);
                resolve(null)
              }
            })
          }
        })
        // #endif

        // #ifndef MP-WEIXIN
        // 5+App 或其他环境：使用 plus.io 处理
        let finalPath = p;
        if (typeof plus !== 'undefined' && p.startsWith('content://')) {
          try {
            finalPath = plus.io.convertLocalFileSystemURL(p);
          } catch (e) {}
        }

        try {
          if (typeof plus !== 'undefined' && plus.io && plus.zip) {
            const dst = `_doc/ai-img-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
            plus.zip.compressImage(
              { src: finalPath, dst, width: '600px', quality: 60, overwrite: true },
              () => {
                plus.io.resolveLocalFileSystemURL(dst, (entry) => {
                  entry.file((file) => {
                    const reader = new FileReader()
                    reader.onload = () => {
                      clearTimeout(timeout)
                      resolve({ type: 'image_url', image_url: { url: String(reader.result || '') } })
                    }
                    reader.onerror = () => { clearTimeout(timeout); resolve(null) }
                    reader.readAsDataURL(file)
                  }, () => { clearTimeout(timeout); resolve(null) })
                }, () => { clearTimeout(timeout); resolve(null) })
              },
              () => {
                plus.io.resolveLocalFileSystemURL(finalPath, (entry) => {
                  entry.file((file) => {
                    const reader = new FileReader()
                    reader.onload = () => {
                      clearTimeout(timeout)
                      resolve({ type: 'image_url', image_url: { url: String(reader.result || '') } })
                    }
                    reader.onerror = () => { clearTimeout(timeout); resolve(null) }
                    reader.readAsDataURL(file)
                  }, () => { clearTimeout(timeout); resolve(null) })
                }, () => { clearTimeout(timeout); resolve(null) })
              }
            )
            return
          }
        } catch (e) {
          clearTimeout(timeout)
        }
        // #endif
      })
    }
  }
}
</script>

<style scoped>
.container {
  padding: 0 24rpx 40rpx;
  background: var(--theme-background, #f6f7fb);
  min-height: 100vh;
}

.hero {
  padding: 28rpx 0 10rpx;
}
.hero-card {
  background: var(--theme-primary, linear-gradient(135deg, #111827, #312e81));
  border-radius: 28rpx;
  padding: 28rpx;
  color: #fff;
  box-shadow: 0 18rpx 50rpx rgba(17, 24, 39, 0.22);
  border: 1rpx solid rgba(255, 255, 255, 0.12);
  position: relative;
}
.top-actions{position:absolute;left:14rpx;top:14rpx;right:14rpx;display:flex;justify-content:space-between;align-items:center;gap:10rpx}

.weather-card {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 10rpx 16rpx;
  background: rgba(255, 255, 255, 0.14);
  border: 1rpx solid rgba(255, 255, 255, 0.18);
  border-radius: 999rpx;
  backdrop-filter: blur(8rpx);
  flex-shrink: 0;
  max-width: 200rpx;
}

.weather-arrow {
  color: rgba(255, 255, 255, 0.6);
  font-size: 28rpx;
  margin-left: auto;
}

.brand {
  margin-top: 80rpx; /* 增加顶部 margin，避免被天气卡片遮挡 */
  display: flex;
  align-items: center;
}

.weather-icon {
  width: 40rpx;
  height: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
}

.weather-info {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.weather-temp {
  font-size: 28rpx;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}

.weather-desc {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1;
}

/* 天气图标样式 */
.weather-sunny::before {
  content: '☀️';
}

.weather-cloudy::before {
  content: '⛅';
}

.weather-overcast::before {
  content: '☁️';
}

.weather-rain::before {
  content: '🌧️';
}

.weather-thunder::before {
  content: '⛈️';
}

.weather-snow::before {
  content: '❄️';
}

.weather-fog::before {
  content: '🌫️';
}

.weather-haze::before {
  content: '🌁';
}

.weather-wind::before {
  content: '💨';
}

.weather-dust::before {
  content: '🌪️';
}
.settings-btn{padding:10rpx 16rpx;border-radius:999rpx;background:rgba(255,255,255,.14);border:1rpx solid rgba(255,255,255,.18);color:#fff;font-size:24rpx}
.brand {
  display: flex;
  align-items: center;
  gap: 18rpx;
}
.logo {
  width: 84rpx;
  height: 84rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  letter-spacing: 1rpx;
  background: linear-gradient(135deg, #ff6b00, #ffb703);
  box-shadow: 0 10rpx 26rpx rgba(255, 107, 0, 0.35);
}
.brand-text {
  display: flex;
  flex-direction: column;
}
.title {
  font-size: 44rpx;
  font-weight: 900;
  line-height: 1.1;
}
.subtitle {
  margin-top: 6rpx;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.78);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 18rpx;
}
.chip {
  padding: 8rpx 14rpx;
  font-size: 22rpx;
  border-radius: 999rpx;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.12);
  border: 1rpx solid rgba(255, 255, 255, 0.14);
}

.section {
  margin-top: 18rpx;
}

.preview-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  background: var(--theme-card-bg, #fff);
  padding: 16rpx;
  border-radius: 28rpx;
  border: 1rpx solid rgba(17, 24, 39, 0.06);
}
.preview-item {
  position: relative;
  width: calc(33.33% - 8rpx);
  aspect-ratio: 1;
  border-radius: 16rpx;
  overflow: hidden;
}
.preview-img {
  width: 100%;
  height: 100%;
}
.delete-badge {
  position: absolute;
  top: 6rpx;
  right: 6rpx;
  width: 36rpx;
  height: 36rpx;
  background: rgba(0,0,0,0.5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4rpx);
}
.delete-icon {
  color: #fff;
  font-size: 28rpx;
  font-weight: bold;
  margin-top: -4rpx;
}
.add-more {
  background: #f3f4f6;
  border: 2rpx dashed #d1d5db;
  display: flex;
  align-items: center;
  justify-content: center;
}
.add-icon {
  font-size: 50rpx;
  color: #9ca3af;
}

.preview {
  position: relative;
  background: var(--theme-card-bg, #fff);
  border-radius: 28rpx;
  overflow: hidden;
  border: 1rpx solid rgba(17, 24, 39, 0.06);
  box-shadow: 0 10rpx 28rpx rgba(17, 24, 39, 0.06);
}

.preview-img {
  width: 100%;
  height: 420rpx;
  display: block;
}
.preview-mask {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.22));
}
.preview-badge {
  position: absolute;
  left: 18rpx;
  bottom: 18rpx;
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(17, 24, 39, 0.55);
  border: 1rpx solid rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(10px);
}
.preview-badge-text {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.95);
}
.preview.placeholder {
  padding: 44rpx 28rpx;
  text-align: left;
}
.placeholder-title {
  display: block;
  font-size: 32rpx;
  font-weight: 800;
  color: var(--theme-text-primary, #111827);
}
.placeholder-sub {
  display: block;
  margin-top: 10rpx;
  font-size: 26rpx;
  color: var(--theme-text-secondary, #6b7280);
}

.info {
  background: var(--theme-card-bg, #fff);
  border-radius: 28rpx;
  padding: 22rpx 22rpx;
  border: 1rpx solid rgba(17, 24, 39, 0.06);
  box-shadow: 0 10rpx 28rpx rgba(17, 24, 39, 0.06);
}

.info-row {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}
.info-label {
  font-size: 24rpx;
  color: #6b7280;
  letter-spacing: 1rpx;
}

.info-value {
  font-size: 30rpx;
  color: #111827;
  font-weight: 700;
  line-height: 1.5;
}
.info-placeholder {
  font-size: 28rpx;
  color: #9ca3af;
  line-height: 1.5;
}

.grid {
  display: flex;
  gap: 16rpx;
  margin-bottom: 16rpx;
}

.btn {
  height: 92rpx;
  line-height: 88rpx;
  border-radius: 24rpx;
  font-size: 30rpx;
  border: none;
  font-weight: 800;
}
.soft {
  flex: 1;
  background: rgba(17, 24, 39, 0.06);
  color: #111827;
}

.primary {
  background: var(--theme-primary, linear-gradient(135deg, #007aff, #4f46e5));
  color: #fff;
  box-shadow: 0 12rpx 30rpx rgba(79, 70, 229, 0.3);
}

.outline {
  background: #fff;
  color: #111827;
  border: 2rpx solid rgba(17, 24, 39, 0.12);
}

.btn[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 模板选择器样式 */
.template-selector {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 12rpx;
}

.template-item {
  padding: 16rpx 20rpx;
  border-radius: 16rpx;
  background: #f9fafb;
  border: 2rpx solid #e5e7eb;
  transition: all 0.2s ease;
  cursor: pointer;
}

.template-item.active {
  background: linear-gradient(135deg, #eff6ff, #dbeafe);
  border-color: #3b82f6;
  box-shadow: 0 4rpx 12rpx rgba(59, 130, 246, 0.15);
}

.template-name {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #111827;
  margin-bottom: 6rpx;
}

.template-item.active .template-name {
  color: #1e40af;
}

.template-desc {
  display: block;
  font-size: 24rpx;
  color: #6b7280;
  line-height: 1.4;
}

.template-item.active .template-desc {
  color: #3b82f6;
}

/* 进度提示样式 */
.progress-container {
  margin-top: 20rpx;
  padding: 24rpx;
  background: #fff;
  border-radius: 20rpx;
  border: 1rpx solid rgba(17, 24, 39, 0.06);
  box-shadow: 0 8rpx 24rpx rgba(17, 24, 39, 0.08);
}

.progress-text {
  font-size: 28rpx;
  color: #111827;
  font-weight: 600;
  margin-bottom: 16rpx;
  text-align: center;
}

.progress-bar {
  width: 100%;
  height: 12rpx;
  background: #e5e7eb;
  border-radius: 999rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  border-radius: 999rpx;
  transition: width 0.3s ease;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% {
    opacity: 0.8;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.8;
  }
}

.result {
  background: #fff;
  border-radius: 28rpx;
  padding: 22rpx;
  border: 1rpx solid rgba(17, 24, 39, 0.06);
  box-shadow: 0 10rpx 28rpx rgba(17, 24, 39, 0.06);
}

.result-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 14rpx;
}
.result-title {
  font-size: 32rpx;
  color: #111827;
  font-weight: 900;
}
.result-tip {
  font-size: 24rpx;
  color: #9ca3af;
}

.result-content {
  font-size: 30rpx;
  color: #374151;
  line-height: 1.8;
  white-space: pre-wrap; /* 保留AI生成的换行 */
  padding: 10rpx 2rpx 0;
}
.result-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 18rpx;
}
.token-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24rpx;
}
.token-panel {
  width: 90%;
  max-width: 680rpx;
  background: #fff;
  border-radius: 24rpx;
  border: 1rpx solid rgba(17, 24, 39, 0.06);
  box-shadow: 0 16rpx 40rpx rgba(17, 24, 39, 0.12);
  padding: 28rpx;
}
.token-title {
  display: block;
  font-size: 32rpx;
  font-weight: 800;
  color: #111827;
  margin-bottom: 16rpx;
}
.token-input {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 18rpx;
  background: #f3f4f6;
  padding: 0 18rpx;
  border: 2rpx solid #e5e7eb;
  font-size: 28rpx;
  color: var(--theme-text-primary, #111827);
}
.token-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 18rpx;
}
</style>
