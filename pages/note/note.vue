<template>
  <view class="container">
    <view v-if="mode === 'webview'" class="webview-wrap">
      <web-view :src="webSrc"></web-view>
    </view>

    <view v-else class="page-with-bar">
      <scroll-view scroll-y class="main-scroll" :style="{ height: mainScrollHeight + 'px' }" :enable-back-to-top="true">
        <view class="fallback-inner">
      <view class="card">
        <view class="head">
          <input v-if="isEditing" v-model="editTitle" class="title-input" placeholder="输入标题" />
          <text v-else class="title">{{ title }}</text>
          <text class="badge">微网页预览</text>
        </view>
        <image v-if="coverSrc" :src="coverSrc" mode="aspectFill" class="cover" />
        <view v-else class="cover placeholder">
          <text class="placeholder-text">AI 随行记</text>
        </view>
        <text class="meta">{{ address }}</text>
        
        <!-- 编辑模式下显示段落，每个段落可以重新生成 -->
        <view v-if="isEditing" class="paragraphs-edit">
          <view v-for="(para, index) in editParagraphs" :key="index" class="paragraph-item">
            <textarea v-model="editParagraphs[index]" class="paragraph-input" auto-height />
            <button class="paragraph-regen-btn" @click="regenerateParagraph(index)">🔄 重新生成</button>
          </view>
        </view>
        <textarea v-else-if="isEditing" v-model="editContent" class="content-input" placeholder="输入内容" auto-height />
        <text v-else class="content">{{ content }}</text>
        
        <!-- 编辑模式下的表情符号选择器 -->
        <view v-if="isEditing" class="emoji-picker">
          <text class="emoji-label">常用表情：</text>
          <view class="emoji-list">
            <text v-for="emoji in commonEmojis" :key="emoji" class="emoji-item" @click="insertEmoji(emoji)">{{ emoji }}</text>
          </view>
        </view>

        <!-- 编辑模式下的多媒体插入 -->
        <view v-if="isEditing" class="media-toolbar">
          <button class="media-btn" @click="insertImage">🖼️ 插入图片 ({{ mediaList.filter(m => m.type === 'image').length }}/9)</button>
          <button class="media-btn" @click="insertVideo">🎬 插入视频</button>
        </view>

        <!-- 媒体列表（编辑模式） -->
        <view v-if="isEditing && mediaList.length > 0" class="media-list">
          <view v-for="(media, mIdx) in mediaList" :key="mIdx" class="media-item" @longpress="showMediaMenu(mIdx)">
            <image v-if="media.type === 'image'" :src="media.url" mode="aspectFill" class="media-thumb" />
            <view v-else class="media-video-thumb">
              <text class="video-icon">▶️</text>
              <text class="video-duration">{{ media.duration ? Math.round(media.duration) + 's' : '视频' }}</text>
            </view>
            <view v-if="media.type === 'image'" class="media-caption-wrap">
              <input
                v-model="mediaList[mIdx].caption"
                class="media-caption-input"
                placeholder="添加图注（最多50字）"
                :maxlength="50"
              />
            </view>
            <text class="media-delete" @click.stop="removeMedia(mIdx)">✕</text>
          </view>
        </view>

        <!-- 媒体列表（查看模式） -->
        <view v-if="!isEditing && viewMediaList.length > 0" class="media-list media-list-view">
          <view v-for="(media, mIdx) in viewMediaList" :key="mIdx" class="media-item">
            <image v-if="media.type === 'image'" :src="media.url" mode="aspectFill" class="media-thumb" @click="previewImage(mIdx)" />
            <view v-else class="media-video-thumb">
              <text class="video-icon">▶️</text>
              <text class="video-duration">{{ media.duration ? Math.round(media.duration) + 's' : '视频' }}</text>
            </view>
            <text v-if="media.caption" class="media-caption-text">{{ media.caption }}</text>
          </view>
        </view>
        
        <!-- 标签显示 -->
        <view v-if="editTags.length > 0" class="tags">
          <view v-for="(tag, index) in editTags" :key="index" class="tag">
            <text>{{ tag }}</text>
            <text v-if="isEditing" class="tag-remove" @click="removeTag(index)">×</text>
          </view>
        </view>
        
        <!-- 编辑模式下的标签输入 -->
        <view v-if="isEditing" class="tag-input-wrap">
          <input v-model="newTag" class="tag-input" placeholder="添加标签（如 #美食）" @confirm="addTag" />
          <button class="tag-add-btn" @click="addTag">添加</button>
        </view>
      </view>
        </view>

    <!-- AI 润色/续写工具栏（非编辑模式，随内容滚动，避免挡住正文） -->
    <view v-if="!isEditing && content" class="ai-toolbar">
      <button class="ai-tool-btn" :loading="aiProcessing" @click="aiPolish">✨ AI 润色</button>
      <button class="ai-tool-btn" :loading="aiProcessing" @click="aiContinue">📝 AI 续写</button>
    </view>
        <view class="scroll-pad"></view>
      </scroll-view>

    <!-- AI 对比视图（底部贴在操作栏上方，避免按钮遮挡） -->
    <view v-if="aiResult" class="ai-compare-panel" :style="comparePanelStyle">
      <view class="compare-header">
        <text class="compare-title">AI 建议</text>
        <text class="compare-close" @click="dismissAiResult">✕</text>
      </view>
      <scroll-view scroll-y class="compare-scroll">
        <text class="compare-text">{{aiResult}}</text>
      </scroll-view>
      <view class="compare-actions">
        <button class="compare-btn outline" @click="dismissAiResult">保留原文</button>
        <button class="compare-btn primary" @click="applyAiResult">应用</button>
      </view>
    </view>

    <view class="bottom-dock">
      <view v-if="!isEditing && mode === 'fallback'" class="share-tip">
        <text class="share-tip-text">分享：右上角「···」可转发好友/朋友圈；点「分享」可复制小程序路径（未认证时部分能力可能不可用）</text>
      </view>
      <view class="actions">
        <button v-if="!isEditing" class="btn" @click="saveShareImage">保存</button>
        <button v-if="!isEditing" class="btn" @click="shareNote">分享</button>
        <button v-if="!isEditing" class="btn" @click="toggleEdit">编辑</button>
        <button v-if="!isEditing" class="btn primary" @click="publishToSquare">发布广场</button>
        <button v-if="isEditing" class="btn" @click="cancelEdit">取消</button>
        <button v-if="isEditing" class="btn primary" @click="saveEdit">保存</button>
      </view>
    </view>
    
    <!-- Canvas 用于生成分享图片（9:16，与 ShareGenerator 一致） -->
    <canvas
      canvas-id="shareCanvas"
      class="share-canvas"
      :style="{ width: shareCanvasW + 'px', height: shareCanvasH + 'px' }"
      :width="shareCanvasW"
      :height="shareCanvasH"
    ></canvas>
    </view>
  </view>
</template>

<script>
import { ShareGenerator } from '@/utils/share-generator.js'
import { HistoryManager } from '@/utils/history-manager.js'
import { BadgeService } from '@/utils/badge-service.js'
import { StatsService } from '@/utils/stats-service.js'
import { getAIConfig, validateAIConfig } from '@/utils/ai-config.js'

function escapeHtml(str) {
  // 部分安卓 WebView/调试基座不支持 String.prototype.replaceAll，这里用 replace + /g 兼容
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildHtml({ title, address, content, coverSrc }) {
  const safeTitle = escapeHtml(title)
  const safeAddress = escapeHtml(address)
  const safeContent = escapeHtml(content).replace(/\n/g, '<br/>')

  const cover = coverSrc
    ? `<img class="cover" src="${coverSrc}" alt="cover" />`
    : `<div class="cover placeholder">AI 随行记</div>`

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${safeTitle}</title>
  <style>
    :root{--bg:#f0f2f5;--card:#fff;--text:#1a1a1a;--muted:#6b7280;--border:rgba(0,0,0,.06);--accent:#4f46e5;}
    *{box-sizing:border-box}
    body{margin:0;background:linear-gradient(180deg,#e8ecf3 0%,var(--bg) 32%);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;-webkit-font-smoothing:antialiased}
    .wrap{max-width:640px;margin:0 auto;padding:20px 16px 48px}
    .card{background:var(--card);border:1px solid var(--border);border-radius:20px;overflow:hidden;box-shadow:0 12px 40px rgba(15,23,42,.08),0 2px 8px rgba(15,23,42,.04)}
    .head{padding:18px 22px 0}
    .title{font-size:22px;font-weight:800;letter-spacing:.02em;line-height:1.35;color:#111827}
    .meta{margin-top:8px;color:var(--muted);font-size:13px;line-height:1.5}
    .cover{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;background:#e5e7eb}
    .cover.placeholder{aspect-ratio:16/9;min-height:200px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;letter-spacing:.08em;color:#fff;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 45%,#c084fc 100%)}
    .body{padding:18px 22px 26px;font-size:16px;line-height:1.85;color:#374151}
    .body p{margin:0 0 1em}
    .badge{display:inline-block;margin-top:12px;padding:5px 12px;border-radius:999px;background:rgba(79,70,229,.08);color:var(--accent);font-size:12px;font-weight:600}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      ${cover}
      <div class="head">
        <div class="title">${safeTitle}</div>
        <div class="meta">${safeAddress}</div>
        <div class="badge">AI 随行记 · 微网页</div>
      </div>
      <div class="body">${safeContent}</div>
    </div>
  </div>
</body>
</html>`
}

export default {
  data() {
    return {
      mode: 'fallback',
      webSrc: '',
      html: '',
      title: 'AI 随行记',
      address: '',
      content: '',
      coverSrc: '',
      noteId: '',
      isEditing: false, // 编辑模式标志
      editTitle: '', // 编辑中的标题
      editContent: '', // 编辑中的内容
      editTags: [], // 编辑中的标签
      newTag: '', // 新标签输入
      commonEmojis: ['😊', '😂', '❤️', '👍', '🎉', '🌟', '🌈', '🌸', '🍀', '🎈', '🎁', '🎂', '🍕', '🍔', '🍰', '☕', '🌍', '✈️', '🏖️', '🗻', '🏰', '🎭', '🎨', '📷', '🎵', '🎸', '⚽', '🏀', '🎾', '🏊'],
      editParagraphs: [], // 编辑中的段落数组
      showParagraphMode: false, // 是否显示段落编辑模式
      aiProcessing: false, // AI 处理中
      aiResult: '', // AI 返回结果（待确认）
      aiMode: '', // 'polish' | 'continue'
      mediaList: [], // 编辑中的多媒体列表 [{type, url, caption, duration}]
      viewMediaList: [], // 查看模式的多媒体列表
      mainScrollHeight: 500,
      comparePanelStyle: {},
      shareLinkSid: '',
      bottomBarTotalPx: 0,
      shareCanvasW: 375,
      shareCanvasH: 667
    }
  },
  watch: {
    isEditing() {
      this.$nextTick(() => this.updateLayoutHeights())
    },
    aiResult() {
      this.$nextTick(() => this.updateLayoutHeights())
    }
  },
  async onLoad(query) {
    try {
      const poster = ShareGenerator.getPosterDimensions()
      this.shareCanvasW = poster.width
      this.shareCanvasH = poster.height

      let payload = null

      if (query.sid) {
        try {
          const raw = uni.getStorageSync('note_share_' + query.sid)
          if (raw) {
            const p = typeof raw === 'string' ? JSON.parse(raw) : raw
            if (p.expireAt && p.expireAt < Date.now()) {
              uni.showToast({ title: '分享链接已过期', icon: 'none' })
            } else {
              payload = p
              this.shareLinkSid = query.sid
            }
          }
        } catch (e) {
          console.warn('读取分享数据失败', e)
        }
      }

      if (!payload) {
        try {
          payload = uni.getStorageSync('temp_note_payload')
          if (payload) {
            uni.removeStorageSync('temp_note_payload')
          }
        } catch (e) {
          console.log('从本地存储读取失败，尝试从 URL 读取', e)
        }
      }

      if (!payload && query.payload) {
        payload = JSON.parse(decodeURIComponent(query.payload))
      }

      if (!payload) {
        payload = {}
      }

      this.title = payload.title || 'AI 随行记'
      this.address = payload.address || ''
      this.content = payload.content || ''
      let rawCover = payload.coverSrc || ''
      this.coverSrc = rawCover
      this.noteId = payload.id || payload.noteId || query.id || ''
      this.viewMediaList = Array.isArray(payload.media) ? payload.media : []

      this.html = buildHtml({
        title: this.title,
        address: this.address,
        content: this.content,
        coverSrc: this.processPathForHtml(rawCover)
      })
    } catch (e) {
      console.error('加载页面数据失败', e)
      this.content = '加载失败：参数错误'
      this.html = buildHtml({ title: this.title, address: '', content: this.content, coverSrc: '' })
    }

    this.mode = 'fallback'
    BadgeService.checkAndUnlock('note_generated').catch(() => {})
    this.$nextTick(() => this.updateLayoutHeights())
  },
  onReady() {
    this.updateLayoutHeights()
  },
  onShow() {
    this.updateLayoutHeights()
  },
  onShareAppMessage() {
    const sid = this.ensureShareSid()
    const img = this.coverSrc && String(this.coverSrc).indexOf('http') === 0 ? this.coverSrc : ''
    return {
      title: this.title || 'AI 随行记',
      path: `/pages/note/note?sid=${sid}`,
      imageUrl: img || undefined
    }
  },
  onShareTimeline() {
    const sid = this.ensureShareSid()
    const img = this.coverSrc && String(this.coverSrc).indexOf('http') === 0 ? this.coverSrc : ''
    return {
      title: (this.title || 'AI 随行记') + ' · 微网页',
      query: `sid=${sid}`,
      imageUrl: img || undefined
    }
  },
  methods: {
    updateLayoutHeights() {
      try {
        const sys = uni.getSystemInfoSync()
        const safe = (sys.safeAreaInsets && sys.safeAreaInsets.bottom) || 0
        const shareTipPx =
          !this.isEditing && this.mode === 'fallback' ? uni.upx2px(88) : 0
        const actionPx = uni.upx2px(12 + 12 + 76 + 64)
        const barPx = actionPx + safe + shareTipPx
        this.bottomBarTotalPx = barPx
        this.mainScrollHeight = Math.max(220, sys.windowHeight - barPx)
        this.comparePanelStyle = { bottom: `${barPx}px` }
      } catch (e) {
        this.mainScrollHeight = 500
        this.comparePanelStyle = { bottom: '200rpx' }
      }
    },
    ensureShareSid() {
      if (this.shareLinkSid) return this.shareLinkSid
      const sid =
        's' +
        Date.now().toString(36) +
        Math.random()
          .toString(36)
          .slice(2, 10)
      const pack = {
        title: this.title,
        address: this.address,
        content: this.content,
        coverSrc: this.coverSrc,
        id: this.noteId,
        media: this.viewMediaList,
        expireAt: Date.now() + 7 * 86400000
      }
      try {
        uni.setStorageSync('note_share_' + sid, JSON.stringify(pack))
      } catch (e) {
        console.warn('写入分享缓存失败', e)
      }
      this.shareLinkSid = sid
      return sid
    },
    async saveShareImage() {
      try {
        uni.showLoading({ title: '生成中...' })
        
        const imagePath = await ShareGenerator.generateShareImage({
          id: this.noteId,
          title: this.title,
          content: this.content,
          cover: this.coverSrc,
          address: this.address
        })
        
        uni.hideLoading()
        await ShareGenerator.saveToAlbum(imagePath)
        
      } catch (error) {
        uni.hideLoading()
        console.error('保存分享图片失败:', error)
        uni.showToast({
          title: '保存失败: ' + error.message,
          icon: 'none'
        })
      }
    },
    processPathForHtml(path) {
      if (!path || path.startsWith('http') || path.startsWith('data:')) return path
      // eslint-disable-next-line no-undef
      if (typeof plus !== 'undefined' && plus.io) {
        // eslint-disable-next-line no-undef
        let abs = plus.io.convertLocalFileSystemURL(path)
        return abs.startsWith('file://') ? abs : 'file://' + abs
      }
      return path
    },
    async shareNote() {
      const sid = this.ensureShareSid()
      const path = `pages/note/note?sid=${sid}`
      const fullPath = '/' + path
      uni.showActionSheet({
        itemList: ['复制小程序路径（发给好友）', '复制分享文案+路径', '保存分享海报到相册'],
        success: async (res) => {
          if (res.tapIndex === 0) {
            await uni.setClipboardData({ data: fullPath })
            uni.showToast({ title: '路径已复制', icon: 'success' })
            uni.showModal({
              title: '如何使用',
              content:
                '好友需在微信内打开本小程序；若对方无法打开链接，请使用右上角「···」直接转发。',
              showCancel: false
            })
          } else if (res.tapIndex === 1) {
            const text = `${this.title}\n${this.address}\n\n${(this.content || '').slice(0, 200)}${(this.content || '').length > 200 ? '…' : ''}\n\n—— 在「AI 随行记」打开路径：\n${fullPath}\n（朋友圈：右上角「···」→ 分享到朋友圈）`
            await uni.setClipboardData({ data: text })
            uni.showToast({ title: '已复制文案与路径', icon: 'success' })
          } else if (res.tapIndex === 2) {
            try {
              uni.showLoading({ title: '生成中...' })
              const imagePath = await ShareGenerator.generateShareImage({
                id: this.noteId,
                title: this.title,
                content: this.content,
                cover: this.coverSrc,
                address: this.address
              })
              uni.hideLoading()
              await ShareGenerator.saveToAlbum(imagePath)
            } catch (error) {
              uni.hideLoading()
              console.error('生成分享图片失败:', error)
              uni.showToast({ title: '生成失败', icon: 'none' })
            }
          }
        }
      })
    },
    writeHtmlToDoc() {
      return new Promise((resolve, reject) => {
        // eslint-disable-next-line no-undef
        plus.io.requestFileSystem(plus.io.PRIVATE_DOC, (fs) => {
          const filename = `ai-travelnote-${Date.now()}.html`
          fs.root.getFile(filename, { create: true }, (entry) => {
            entry.createWriter((writer) => {
              writer.onwrite = () => {
                resolve(entry.toURL())
              }
              writer.onerror = (err) => reject(err)
              writer.write(this.html)
            }, reject)
          }, reject)
        }, reject)
      })
    },
    async exportHtml() {
      try {
        // eslint-disable-next-line no-undef
        if (typeof plus === 'undefined' || !plus.io) {
          await uni.setClipboardData({ data: this.html })
          uni.showToast({ title: '已复制 HTML（当前平台不支持导出文件）', icon: 'none' })
          return
        }
        const fileUrl = await this.writeHtmlToDoc()
        uni.showModal({
          title: '导出成功',
          content: `已导出到本机文件：\n${fileUrl}\n\n提示：要"网页链接分享"，需要把该文件上传到公网托管。`,
          showCancel: false
        })
      } catch (e) {
        uni.showToast({ title: '导出失败', icon: 'none' })
      }
    },
    async copyHtml() {
      await uni.setClipboardData({ data: this.html })
      uni.showToast({ title: 'HTML 已复制', icon: 'success' })
    },
    toggleEdit() {
      this.isEditing = true
      this.editTitle = this.title
      this.editContent = this.content
      this.editTags = [...(this.tags || [])]
      // 加载已有媒体到编辑列表（深拷贝避免直接修改 viewMediaList）
      this.mediaList = this.viewMediaList.map(m => ({ ...m }))
      // 将内容分割为段落
      this.editParagraphs = this.content.split('\n').filter(p => p.trim())
      this.showParagraphMode = true
    },
    cancelEdit() {
      this.isEditing = false
      this.editTitle = ''
      this.editContent = ''
      this.editTags = []
      this.newTag = ''
      this.editParagraphs = []
      this.showParagraphMode = false
      this.mediaList = []
    },
    async saveEdit() {
      try {
        if (!this.editTitle.trim()) {
          uni.showToast({ title: '标题不能为空', icon: 'none' })
          return
        }
        
        // 从段落数组重新组合内容
        const finalContent = this.showParagraphMode 
          ? this.editParagraphs.filter(p => p.trim()).join('\n\n')
          : this.editContent
        
        if (!finalContent.trim()) {
          uni.showToast({ title: '内容不能为空', icon: 'none' })
          return
        }
        
        uni.showLoading({ title: '保存中...' })
        
        // 上传媒体文件到云存储（替换本地临时路径）
        if (this.mediaList.length > 0) {
          uni.showLoading({ title: '上传媒体...' })
          for (let i = 0; i < this.mediaList.length; i++) {
            const m = this.mediaList[i]
            if (m.url && !m.url.startsWith('http') && !m.url.startsWith('cloud://')) {
              const cloudUrl = await this.uploadMediaToCloud(m)
              this.mediaList[i] = { ...m, url: cloudUrl }
            }
          }
        }
        // 更新当前显示的内容
        const oldTitle = this.title
        const oldContent = this.content
        this.title = this.editTitle
        this.content = finalContent
        this.tags = [...this.editTags]
        
        // 构建编辑历史记录
        const editHistory = {
          timestamp: Date.now(),
          changes: {
            title: { old: oldTitle, new: this.title },
            content: { old: oldContent, new: this.content }
          }
        }
        
        // 直接保存到本地存储（不使用 HistoryManager）
        try {
          const history = uni.getStorageSync('travel_history') || []
          
          // 查找是否已存在该记录
          const existingIndex = history.findIndex(h => h.id === this.noteId)
          const previous = existingIndex >= 0 ? history[existingIndex] : {}
          
          const updatedNote = {
            ...previous,
            id: this.noteId || Date.now().toString(),
            time: previous.time || new Date().toLocaleString(),
            address: this.address || '未知地点',
            content: this.content,
            cover: this.coverSrc || '',
            template: 'literary',
            tags: this.tags || [],
            media: this.mediaList || [],
            is_edited: true,
            edit_history: [...(Array.isArray(previous.edit_history) ? previous.edit_history : []), editHistory].slice(-20),
            created_at: previous.created_at || Date.now(),
            updated_at: Date.now(),
            synced: false
          }
          
          if (existingIndex >= 0) {
            // 更新现有记录
            history[existingIndex] = updatedNote
          } else {
            // 添加新记录
            history.unshift(updatedNote)
          }

          this.noteId = updatedNote.id
          
          // 保存到本地存储
          uni.setStorageSync('travel_history', history.slice(0, 100))

          if (uni.getStorageSync('uni_id_token')) {
            HistoryManager.syncToCloud(updatedNote).catch(error => {
              console.warn('[Note] 自动同步失败，将稍后重试:', error.message)
            })
          }
          
          console.log('[Note] 保存成功，记录 ID:', updatedNote.id)
          
        } catch (storageError) {
          console.error('[Note] 保存到本地存储失败:', storageError)
          throw new Error('保存失败: ' + (storageError.message || '存储错误'))
        }
        
        uni.hideLoading()
        uni.showToast({ title: '保存成功', icon: 'success' })
        
        // 更新查看模式的媒体列表
        this.viewMediaList = [...this.mediaList]
        
        // 退出编辑模式
        this.isEditing = false
        this.editTitle = ''
        this.editContent = ''
        this.editTags = []
        this.editParagraphs = []
        this.showParagraphMode = false
        this.mediaList = []
        
        // 更新 HTML
        this.html = buildHtml({
          title: this.title,
          address: this.address,
          content: this.content,
          coverSrc: this.processPathForHtml(this.coverSrc)
        })
        this.shareLinkSid = ''
        this.$nextTick(() => this.updateLayoutHeights())
      } catch (error) {
        uni.hideLoading()
        console.error('保存编辑失败:', error)
        uni.showToast({ 
          title: '保存失败: ' + (error.message || '未知错误'), 
          icon: 'none',
          duration: 3000
        })
      }
    },
    addTag() {
      if (!this.newTag.trim()) {
        return
      }
      
      let tag = this.newTag.trim()
      // 自动添加 # 前缀
      if (!tag.startsWith('#')) {
        tag = '#' + tag
      }
      
      if (!this.editTags.includes(tag)) {
        this.editTags.push(tag)
      }
      
      this.newTag = ''
    },
    removeTag(index) {
      this.editTags.splice(index, 1)
    },
    insertEmoji(emoji) {
      this.editContent += emoji
    },
    async publishToSquare() {
      const token = uni.getStorageSync('uni_id_token')
      if (!token) {
        uni.showToast({ title: '请先登录', icon: 'none' })
        return
      }
      if (!this.content) {
        uni.showToast({ title: '内容为空，无法发布', icon: 'none' })
        return
      }
      uni.showModal({
        title: '发布到游记广场',
        content: '确认将这篇游记发布到广场，让更多人看到？',
        success: async (res) => {
          if (!res.confirm) return
          try {
            uni.showLoading({ title: '发布中...' })
            const result = await uniCloud.callFunction({
              name: 'community-post',
              data: {
                action: 'publish',
                uniIdToken: uni.getStorageSync('uni_id_token') || '',
                title: this.title,
                content: this.content,
                cover: this.coverSrc || '',
                address: this.address || '',
                noteId: this.noteId || ''
              }
            })
            uni.hideLoading()
            const r = result.result || {}
            if (r.ok) {
              uni.showToast({ title: '发布成功', icon: 'success' })
            } else {
              const errMap = {
                not_logged_in: '请先登录或重新登录后再发布',
                missing_content: '内容为空，无法发布'
              }
              throw new Error(r.message || errMap[r.error] || r.error || '发布失败')
            }
          } catch (e) {
            uni.hideLoading()
            uni.showToast({ title: e.message || '发布失败', icon: 'none' })
          }
        }
      })
    },
    // ===== AI 润色 =====
    async aiPolish() {
      if (this.aiProcessing || !this.content) return
      this.aiProcessing = true
      this.aiMode = 'polish'
      uni.showLoading({ title: 'AI 润色中...' })
      try {
        const result = await this._callAI(
          `你是一位优秀的旅行文案作家。请对以下游记进行润色，保持原有内容和风格，使语言更优美流畅。只输出润色后的完整内容，不要加标题或说明。\n\n地点：${this.address || ''}\n\n原文：\n${this.content}`,
          30000
        )
        this.aiResult = result
        // 记录统计
        StatsService.recordGeneration({ address: this.address }).catch(() => {})
      } catch (e) {
        uni.showToast({ title: 'AI 润色失败：' + (e.message || '请重试'), icon: 'none' })
      } finally {
        this.aiProcessing = false
        uni.hideLoading()
      }
    },
    // ===== AI 续写 =====
    async aiContinue() {
      if (this.aiProcessing || !this.content) return
      this.aiProcessing = true
      this.aiMode = 'continue'
      uni.showLoading({ title: 'AI 续写中...' })
      try {
        const result = await this._callAI(
          `你是一位优秀的旅行文案作家。请基于以下游记内容，续写不少于100字的段落，风格保持一致，自然衔接。只输出续写内容，不要重复原文。\n\n地点：${this.address || ''}\n\n原文：\n${this.content}`,
          30000
        )
        this.aiResult = result
        StatsService.recordGeneration({ address: this.address }).catch(() => {})
      } catch (e) {
        uni.showToast({ title: 'AI 续写失败：' + (e.message || '请重试'), icon: 'none' })
      } finally {
        this.aiProcessing = false
        uni.hideLoading()
      }
    },
    async _callAI(prompt, timeoutMs = 30000) {
      const config = getAIConfig()
      const validation = validateAIConfig(config)
      if (!validation.ok) throw new Error(validation.message)
      const { apiKey, baseUrl, model } = validation.value
      const res = await new Promise((resolve, reject) => {
        let settled = false
        const timer = setTimeout(() => {
          if (settled) return
          settled = true
          try { task && task.abort() } catch (e) {}
          reject(new Error('请求超时，请重试'))
        }, timeoutMs)
        const task = uni.request({
          url: `${baseUrl}/chat/completions`,
          method: 'POST',
          header: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          data: { model, messages: [{ role: 'user', content: prompt }], max_tokens: 1000, temperature: 0.7, stream: false },
          timeout: timeoutMs,
          success: r => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            resolve(r)
          },
          fail: err => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            reject(new Error(err.errMsg || '网络请求失败'))
          }
        })
      })
      if (res.statusCode === 200 && res.data?.choices?.[0]?.message?.content) {
        return res.data.choices[0].message.content.trim()
      }
      throw new Error(res.data?.error?.message || `请求失败 (${res.statusCode})`)
    },
    dismissAiResult() {
      this.aiResult = ''
      this.aiMode = ''
    },
    applyAiResult() {
      if (!this.aiResult) return
      if (this.aiMode === 'polish') {
        this.content = this.aiResult
      } else if (this.aiMode === 'continue') {
        this.content = this.content + '\n\n' + this.aiResult
      }
      // 更新 HTML
      this.html = buildHtml({
        title: this.title,
        address: this.address,
        content: this.content,
        coverSrc: this.processPathForHtml(this.coverSrc)
      })
      this.shareLinkSid = ''
      this.dismissAiResult()
      uni.showToast({ title: '已应用', icon: 'success' })
    },
    // ===== 多媒体插入 =====
    insertImage() {
      const remaining = 9 - this.mediaList.filter(m => m.type === 'image').length
      if (remaining <= 0) {
        uni.showToast({ title: '最多插入 9 张图片', icon: 'none' })
        return
      }
      uni.chooseImage({
        count: remaining,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const paths = res.tempFilePaths || []
          paths.forEach(url => {
            // 校验文件大小（10 MB）
            try {
              const info = uni.getFileSystemManager().statSync(url)
              if (info.size > 10 * 1024 * 1024) {
                uni.showToast({ title: '图片不能超过 10 MB', icon: 'none' })
                return
              }
            } catch (e) {}
            this.mediaList.push({ type: 'image', url, caption: '' })
          })
        },
        fail: (err) => {
          if (!err.errMsg.includes('cancel')) {
            uni.showToast({ title: '选择图片失败', icon: 'none' })
          }
        }
      })
    },
    insertVideo() {
      uni.chooseVideo({
        sourceType: ['album', 'camera'],
        maxDuration: 60,
        success: (res) => {
          if (res.duration > 60) {
            uni.showToast({ title: '视频时长不能超过 60 秒', icon: 'none' })
            return
          }
          this.mediaList.push({ type: 'video', url: res.tempFilePath, duration: res.duration })
        },
        fail: (err) => {
          if (!err.errMsg.includes('cancel')) {
            uni.showToast({ title: '选择视频失败', icon: 'none' })
          }
        }
      })
    },
    showMediaMenu(index) {
      const media = this.mediaList[index]
      const items = media.type === 'image'
        ? ['查看大图', '删除', '添加图注']
        : ['删除']
      uni.showActionSheet({
        itemList: items,
        success: (res) => {
          if (media.type === 'image') {
            if (res.tapIndex === 0) {
              uni.previewImage({ urls: [media.url], current: 0 })
            } else if (res.tapIndex === 1) {
              this.removeMedia(index)
            } else if (res.tapIndex === 2) {
              // 图注已内联显示，无需额外操作
            }
          } else {
            if (res.tapIndex === 0) this.removeMedia(index)
          }
        }
      })
    },
    removeMedia(index) {
      this.mediaList.splice(index, 1)
    },
    previewImage(index) {
      const imageUrls = this.viewMediaList
        .filter(m => m.type === 'image')
        .map(m => m.url)
      if (!imageUrls.length) return
      uni.previewImage({
        urls: imageUrls,
        current: imageUrls[index] || imageUrls[0]
      })
    },
    async uploadMediaToCloud(mediaItem) {
      try {
        const ext = mediaItem.type === 'image' ? 'jpg' : 'mp4'
        const cloudPath = `media/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const res = await uniCloud.uploadFile({
          filePath: mediaItem.url,
          cloudPath
        })
        return res.fileID || res.url
      } catch (e) {
        console.warn('[Note] 上传媒体失败，保留本地路径', e.message)
        return mediaItem.url // 上传失败不阻断保存
      }
    },
    async regenerateParagraph(index) {
      try {
        uni.showLoading({ title: '重新生成中...' })
        
        const paragraph = this.editParagraphs[index]
        // 从本地设置读取配置，与首页保持一致
        const config = getAIConfig()
        const validation = validateAIConfig(config)
        if (!validation.ok) throw new Error(validation.message)
        const { apiKey, baseUrl, model } = validation.value
        
        const messages = [
          {
            role: 'system',
            content: '你是一位优秀的旅行文案作家。请根据用户提供的段落内容，重新生成一段风格相似、主题一致的文案。只输出新段落内容，不要加标题或额外说明。'
          },
          {
            role: 'user',
            content: `地点：${this.address || '未知地点'}\n\n请重新生成以下段落，保持相似的风格和主题：\n${paragraph}`
          }
        ]
        
        const res = await new Promise((resolve, reject) => {
          uni.request({
            url: `${baseUrl}/chat/completions`,
            method: 'POST',
            header: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            data: { model, messages, max_tokens: 800, temperature: 0.7, stream: false },
            timeout: 60000,
            success: (r) => resolve(r),
            fail: (err) => reject(new Error(err.errMsg || '网络请求失败'))
          })
        })
        
        uni.hideLoading()
        
        if (res.statusCode === 200 && res.data?.choices?.[0]?.message?.content) {
          // Use splice for Vue reactivity (index assignment is not reactive in Vue 2)
          this.editParagraphs.splice(index, 1, res.data.choices[0].message.content.trim())
          uni.showToast({ title: '重新生成成功', icon: 'success' })
        } else {
          const errMsg = res.data?.error?.message || `请求失败 (${res.statusCode})`
          throw new Error(errMsg)
        }
        
      } catch (error) {
        uni.hideLoading()
        console.error('重新生成段落失败:', error)
        uni.showToast({ title: '重新生成失败: ' + (error.message || '未知错误'), icon: 'none' })
      }
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  height: 100%;
  background: #f6f7fb;
  display: flex;
  flex-direction: column;
}
.webview-wrap {
  flex: 1;
  height: 100vh;
  min-height: 400rpx;
}
.page-with-bar {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  position: relative;
}
.main-scroll {
  width: 100%;
  flex: 1;
  min-height: 0;
}
.fallback-inner {
  padding: 24rpx;
  padding-bottom: 16rpx;
}
.scroll-pad {
  height: 24rpx;
}
.bottom-dock {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 300;
  background: rgba(246, 247, 251, 0.98);
  border-top: 1rpx solid rgba(17, 24, 39, 0.06);
  padding-bottom: env(safe-area-inset-bottom);
}
.share-tip {
  padding: 10rpx 20rpx 0;
  background: transparent;
}
.share-tip-text {
  font-size: 22rpx;
  color: #1e40af;
  line-height: 1.45;
  display: block;
}
.card {
  background: #fff;
  border-radius: 24rpx;
  overflow: hidden;
  border: 1rpx solid rgba(17, 24, 39, 0.06);
  box-shadow: 0 16rpx 40rpx rgba(17, 24, 39, 0.08);
}
.head {
  padding: 26rpx 28rpx 10rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.title {
  display: block;
  font-size: 40rpx;
  font-weight: 800;
  color: #222;
}
.badge {
  padding: 10rpx 14rpx;
  font-size: 22rpx;
  border-radius: 999rpx;
  background: rgba(79, 70, 229, 0.10);
  color: #3730a3;
  border: 1rpx solid rgba(79, 70, 229, 0.16);
}
.meta {
  display: block;
  padding: 10rpx 28rpx 18rpx;
  font-size: 26rpx;
  color: #6b7280;
}
.cover {
  width: 100%;
  height: 360rpx;
  background: #ddd;
}
.cover.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #ff6b00, #ffb703);
}
.placeholder-text {
  font-size: 44rpx;
  font-weight: 900;
  color: rgba(255, 255, 255, 0.95);
  letter-spacing: 1rpx;
}
.content {
  display: block;
  padding: 0 28rpx 28rpx;
  font-size: 30rpx;
  line-height: 1.8;
  color: #333;
  white-space: pre-wrap;
}
.actions {
  position: relative;
  padding: 12rpx 16rpx 12rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  background: transparent;
  box-sizing: border-box;
}
.btn {
  flex: 1 1 28%;
  min-width: 140rpx;
  height: 76rpx;
  line-height: 76rpx;
  border-radius: 20rpx;
  font-size: 24rpx;
  border: none;
  background: #fff;
  color: #333;
  font-weight: 800;
}
.primary {
  background: linear-gradient(135deg, #007aff, #4f46e5);
  color: #fff;
  box-shadow: 0 14rpx 30rpx rgba(79, 70, 229, 0.18);
}
.share-canvas {
  position: fixed;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  pointer-events: none;
}
.title-input {
  flex: 1;
  font-size: 40rpx;
  font-weight: 800;
  color: #222;
  border: 2rpx solid #e5e7eb;
  border-radius: 8rpx;
  padding: 10rpx;
}
.content-input {
  display: block;
  width: 100%;
  min-height: 400rpx;
  padding: 0 28rpx 28rpx;
  font-size: 30rpx;
  line-height: 1.8;
  color: #333;
  border: 2rpx solid #e5e7eb;
  border-radius: 8rpx;
  box-sizing: border-box;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  padding: 0 28rpx 20rpx;
}
.tag {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 16rpx;
  background: rgba(79, 70, 229, 0.10);
  color: #3730a3;
  border-radius: 999rpx;
  font-size: 24rpx;
}
.tag-remove {
  font-size: 32rpx;
  font-weight: bold;
  cursor: pointer;
}
.tag-input-wrap {
  display: flex;
  gap: 12rpx;
  padding: 0 28rpx 28rpx;
}
.tag-input {
  flex: 1;
  height: 64rpx;
  padding: 0 16rpx;
  border: 2rpx solid #e5e7eb;
  border-radius: 8rpx;
  font-size: 28rpx;
}
.tag-add-btn {
  height: 64rpx;
  padding: 0 24rpx;
  background: #4f46e5;
  color: #fff;
  border: none;
  border-radius: 8rpx;
  font-size: 28rpx;
}
.emoji-picker {
  padding: 20rpx 28rpx;
  border-top: 1rpx solid #e5e7eb;
}
.emoji-label {
  display: block;
  font-size: 26rpx;
  color: #6b7280;
  margin-bottom: 12rpx;
}
.emoji-list {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.emoji-item {
  font-size: 48rpx;
  cursor: pointer;
}
.paragraphs-edit {
  padding: 20rpx 28rpx;
}
.paragraph-item {
  margin-bottom: 24rpx;
  border: 2rpx solid #e5e7eb;
  border-radius: 12rpx;
  padding: 16rpx;
  background: #f9fafb;
}
.paragraph-input {
  width: 100%;
  min-height: 120rpx;
  font-size: 30rpx;
  line-height: 1.8;
  color: #333;
  background: transparent;
  border: none;
  margin-bottom: 12rpx;
}
.paragraph-regen-btn {
  width: 100%;
  height: 64rpx;
  line-height: 64rpx;
  background: #4f46e5;
  color: #fff;
  border: none;
  border-radius: 8rpx;
  font-size: 26rpx;
  text-align: center;
}

/* AI 工具栏 */
.ai-toolbar {
  display: flex;
  gap: 16rpx;
  padding: 16rpx 24rpx 20rpx;
  background: #fff;
  border-top: 1rpx solid #f3f4f6;
}
.ai-tool-btn {
  flex: 1;
  height: 72rpx;
  line-height: 72rpx;
  background: linear-gradient(135deg, #4f46e5, #9333ea);
  color: #fff;
  border-radius: 36rpx;
  font-size: 26rpx;
  font-weight: 700;
  border: none;
}

/* AI 对比面板：bottom 由内联 comparePanelStyle 贴合底部操作区 */
.ai-compare-panel {
  position: fixed;
  left: 0;
  right: 0;
  background: #fff;
  border-radius: 30rpx 30rpx 0 0;
  box-shadow: 0 -8rpx 40rpx rgba(0, 0, 0, 0.12);
  padding: 24rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  z-index: 200;
  max-height: 55vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
.compare-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}
.compare-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #111827;
}
.compare-close {
  font-size: 36rpx;
  color: #9ca3af;
  padding: 8rpx;
}
.compare-scroll {
  flex: 1;
  max-height: 40vh;
}
.compare-text {
  font-size: 28rpx;
  line-height: 1.8;
  color: #374151;
  white-space: pre-wrap;
  display: block;
}
.compare-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 20rpx;
}
.compare-btn {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
  font-weight: 700;
  border: none;
}
.compare-btn.outline {
  background: #f3f4f6;
  color: #374151;
}
.compare-btn.primary {
  background: linear-gradient(135deg, #007aff, #4f46e5);
  color: #fff;
}
</style>
