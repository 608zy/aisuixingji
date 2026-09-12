<template>
  <view class="container" :style="themeVars">
    <view class="header">
      <text class="title">模板市场</text>
    </view>
    <!-- 模板网格 -->
    <view class="template-grid">
      <view
        v-for="tpl in templates"
        :key="tpl.id"
        class="template-card"
        :class="{selected: selectedId === tpl.id}"
        :style="{background: tpl.bg, borderColor: selectedId === tpl.id ? tpl.accent : 'transparent'}"
        @click="selectTemplate(tpl)"
      >
        <text class="tpl-name" :style="{color: tpl.accent, fontFamily: tpl.font}">{{tpl.name}}</text>
        <view class="tpl-preview-lines">
          <view class="preview-line" :style="{background: tpl.accent, opacity: 0.6}"></view>
          <view class="preview-line short" :style="{background: tpl.accent, opacity: 0.4}"></view>
        </view>
      </view>
    </view>

    <!-- 预览面板 -->
    <view v-if="selectedTemplate" class="preview-panel" :style="{background: selectedTemplate.bg}">
      <text class="preview-title" :style="{color: selectedTemplate.accent, fontFamily: selectedTemplate.font}">
        {{noteTitle || '游记标题'}}
      </text>
      <text class="preview-address" :style="{color: selectedTemplate.accent}">📍 {{noteAddress || '地点'}}</text>
      <text class="preview-content" :style="{color: selectedTemplate.accent, fontFamily: selectedTemplate.font}">
        {{noteContent || '游记内容将在这里展示...'}}
      </text>
    </view>

    <view class="footer-actions">
      <button class="apply-btn" :style="{background: selectedTemplate ? selectedTemplate.accent : '#007aff'}" @click="applyTemplate">应用模板</button>
    </view>
  </view>
</template>

<script>
const EXTENDED_TEMPLATES = [
  { id: 'literary', name: '文艺风', bg: '#fdf6ec', accent: '#d97706', font: '楷体' },
  { id: 'humorous', name: '幽默风', bg: '#f0fdf4', accent: '#16a34a', font: '黑体' },
  { id: 'concise', name: '简洁风', bg: '#f8fafc', accent: '#0f172a', font: '微软雅黑' },
  { id: 'poetic', name: '诗意风', bg: '#fdf4ff', accent: '#9333ea', font: '宋体' },
  { id: 'travel_log', name: '旅行日志', bg: '#eff6ff', accent: '#2563eb', font: '微软雅黑' },
  { id: 'magazine', name: '杂志风', bg: '#fff1f2', accent: '#e11d48', font: '黑体' },
  { id: 'vintage', name: '复古风', bg: '#fefce8', accent: '#854d0e', font: '楷体' },
  { id: 'minimal', name: '极简风', bg: '#ffffff', accent: '#6b7280', font: '微软雅黑' },
  { id: 'nature', name: '自然风', bg: '#f0fdf4', accent: '#15803d', font: '宋体' },
  { id: 'night', name: '夜间风', bg: '#0f172a', accent: '#38bdf8', font: '微软雅黑' }
]

const DEFAULT_TEMPLATE_ID = 'literary'
const LAST_TEMPLATE_KEY = 'last_template_id'

export default {
  data() {
    return {
      templates: EXTENDED_TEMPLATES,
      selectedId: DEFAULT_TEMPLATE_ID,
      noteId: '',
      noteTitle: '',
      noteAddress: '',
      noteContent: ''
    }
  },
  computed: {
    selectedTemplate() {
      return this.templates.find(t => t.id === this.selectedId) || this.templates[0]
    }
  },
  onLoad(query) {
    this.noteId = query.noteId || ''
    // 恢复上次使用的模板
    try {
      const lastId = uni.getStorageSync(LAST_TEMPLATE_KEY)
      if (lastId && this.templates.find(t => t.id === lastId)) {
        this.selectedId = lastId
      }
    } catch (e) {
      this.selectedId = DEFAULT_TEMPLATE_ID
    }
    // 加载游记内容
    if (this.noteId) {
      this.loadNote()
    }
  },
  methods: {
    loadNote() {
      try {
        const history = uni.getStorageSync('travel_history') || []
        const note = history.find(n => n.id === this.noteId)
        if (note) {
          this.noteTitle = note.title || note.address || ''
          this.noteAddress = note.address || ''
          this.noteContent = note.content || ''
        }
      } catch (e) {
        console.error('加载游记失败', e)
      }
    },
    selectTemplate(tpl) {
      this.selectedId = tpl.id
    },
    applyTemplate() {
      if (!this.selectedTemplate) return
      try {
        uni.setStorageSync(LAST_TEMPLATE_KEY, this.selectedId)
      } catch (e) {}
      uni.showToast({ title: `已应用「${this.selectedTemplate.name}」`, icon: 'success' })
      setTimeout(() => {
        uni.navigateBack()
      }, 800)
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: var(--theme-background, #f6f7fb);
  padding-bottom: 160rpx;
}
.header {
  padding: 40rpx 30rpx 20rpx;
}
.title {
  font-size: 40rpx;
  font-weight: 800;
  color: var(--theme-text-primary, #111827);
}
.template-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
  padding: 20rpx 30rpx;
}
.template-card {
  width: calc(50% - 10rpx);
  border-radius: 20rpx;
  padding: 24rpx;
  border: 4rpx solid transparent;
  box-sizing: border-box;
  transition: border-color 0.2s;
}
.template-card.selected {
  box-shadow: 0 0 0 4rpx rgba(0,0,0,0.1);
}
.tpl-name {
  font-size: 30rpx;
  font-weight: 700;
  display: block;
  margin-bottom: 16rpx;
}
.tpl-preview-lines {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.preview-line {
  height: 8rpx;
  border-radius: 4rpx;
  width: 100%;
}
.preview-line.short {
  width: 60%;
}
.preview-panel {
  margin: 20rpx 30rpx;
  border-radius: 20rpx;
  padding: 30rpx;
  min-height: 200rpx;
}
.preview-title {
  font-size: 34rpx;
  font-weight: 800;
  display: block;
  margin-bottom: 12rpx;
}
.preview-address {
  font-size: 24rpx;
  display: block;
  margin-bottom: 16rpx;
  opacity: 0.8;
}
.preview-content {
  font-size: 28rpx;
  line-height: 1.8;
  display: block;
}
.footer-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20rpx 30rpx calc(20rpx + env(safe-area-inset-bottom));
  background: rgba(246,247,251,0.95);
  border-top: 1rpx solid #f3f4f6;
}
.apply-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 44rpx;
  color: #fff;
  font-size: 30rpx;
  font-weight: 700;
  border: none;
}
</style>
