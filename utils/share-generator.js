// 分享图片生成器 — 9:16 朋友圈海报（上图下文 + 底部识别区）
/**
 * @typedef {Object} NoteSharePayload
 * @property {string} [id]
 * @property {string} [title]
 * @property {string} [content]
 * @property {string} [cover]
 * @property {string} [address]
 */

export class ShareGenerator {
  /**
   * 与绘制逻辑一致的画布尺寸（竖屏 9:16，便于朋友圈）
   * @returns {{ width: number, height: number }}
   */
  static getPosterDimensions() {
    const systemInfo = uni.getSystemInfoSync()
    const width = systemInfo.windowWidth
    const height = Math.round((width * 16) / 9)
    return { width, height }
  }

  /**
   * @param {NoteSharePayload} note
   * @returns {Promise<string>}
   */
  static async generateShareImage(note) {
    return new Promise(async (resolve, reject) => {
      try {
        const { width: W, height: H } = this.getPosterDimensions()
        const ctx = uni.createCanvasContext('shareCanvas')

        const pad = Math.round(W * 0.065)
        const coverH = Math.round(H * 0.42)
        const footerH = Math.max(112, Math.round(W * 0.29))
        const cardTop = coverH
        const cardBottom = H - footerH
        const cardH = cardBottom - cardTop
        const rTop = Math.min(22, Math.round(W * 0.055))

        const titleFont = Math.round(W * 0.058)
        const bodyFont = Math.round(W * 0.04)
        const metaFont = Math.round(W * 0.033)
        const hintFont = Math.round(W * 0.03)
        const tinyFont = Math.round(W * 0.027)

        const truncatedContent = this.truncateContent(note.content, 118)
        const title = note.title || note.address || 'AI 随行记'

        // 1) 顶部图区
        if (note.cover) {
          try {
            await this.drawImageCover(ctx, note.cover, 0, 0, W, coverH)
            const g = ctx.createLinearGradient(0, coverH * 0.55, 0, coverH)
            g.addColorStop(0, 'rgba(0,0,0,0)')
            g.addColorStop(1, 'rgba(0,0,0,0.18)')
            ctx.fillStyle = g
            ctx.fillRect(0, 0, W, coverH)
          } catch (e) {
            console.warn('[ShareGenerator] 封面绘制失败:', e)
            this.fillGradientPlaceholder(ctx, W, coverH)
          }
        } else {
          this.fillGradientPlaceholder(ctx, W, coverH)
        }

        // 2) 正文卡片（上圆角）
        ctx.save()
        this.drawRoundedTopRect(ctx, 0, cardTop, W, cardH, rTop)
        ctx.fillStyle = '#faf8f5'
        ctx.fill()
        ctx.restore()

        // 3) 文字（深色印在浅底上）
        let y = cardTop + pad + 4
        ctx.textBaseline = 'top'
        ctx.textAlign = 'left'
        ctx.shadowColor = 'transparent'

        ctx.fillStyle = '#111827'
        ctx.font = `bold ${titleFont}px sans-serif`
        const titleLines = this.drawWrappedText(ctx, title, pad, y, W - pad * 2, Math.round(titleFont * 1.22), 2)
        y += titleLines * Math.round(titleFont * 1.22) + 10

        if (note.address) {
          const addr = String(note.address)
          ctx.font = `${metaFont}px sans-serif`
          const pillPadX = Math.round(W * 0.028)
          const pillPadY = Math.round(metaFont * 0.35)
          const tw = ctx.measureText(addr).width
          const pillW = tw + pillPadX * 2
          const pillH = metaFont + pillPadY * 2
          const pillR = Math.round(pillH / 2)
          ctx.fillStyle = '#ede9e4'
          this.drawRoundRect(ctx, pad, y, pillW, pillH, pillR)
          ctx.fill()
          ctx.fillStyle = '#57534e'
          ctx.fillText(addr, pad + pillPadX, y + pillPadY)
          y += pillH + 14
        }

        ctx.fillStyle = '#4b5563'
        ctx.font = `${bodyFont}px sans-serif`
        const bodyLh = Math.round(bodyFont * 1.52)
        const bodyLines = this.drawWrappedText(ctx, truncatedContent, pad, y, W - pad * 2, bodyLh, 6)
        y += bodyLines * bodyLh

        // 4) 底栏
        ctx.fillStyle = '#f3f0eb'
        ctx.fillRect(0, H - footerH, W, footerH)
        ctx.fillStyle = '#a8a29e'
        ctx.font = `${hintFont}px sans-serif`
        ctx.textBaseline = 'middle'
        const midY = H - footerH / 2
        ctx.fillText('长按识别小程序码', pad, midY - 10)
        ctx.font = `${tinyFont}px sans-serif`
        ctx.fillStyle = '#c4bfba'
        ctx.fillText('AI 随行记 · 查看完整游记', pad, midY + 12)

        if (note.id) {
          await this.drawQRCodeInFooter(ctx, note.id, W, H, footerH)
        }

        ctx.draw(false, async () => {
          try {
            await new Promise((r) => setTimeout(r, 480))
            const tempFilePath = await this.canvasToTempFilePath('shareCanvas', W, H)
            resolve(tempFilePath)
          } catch (error) {
            console.error('[ShareGenerator] 导出失败:', error)
            reject(error)
          }
        })
      } catch (error) {
        console.error('[ShareGenerator] 生成失败:', error)
        reject(error)
      }
    })
  }

  static fillGradientPlaceholder(ctx, W, h) {
    const g = ctx.createLinearGradient(0, 0, W, h)
    g.addColorStop(0, '#1e3a5f')
    g.addColorStop(0.55, '#3d2c5c')
    g.addColorStop(1, '#5c3d2e')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, h)
  }

  /** 仅顶部两角圆角 */
  static drawRoundedTopRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + rr, y)
    ctx.lineTo(x + w - rr, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
    ctx.lineTo(x + w, y + h)
    ctx.lineTo(x, y + h)
    ctx.lineTo(x, y + rr)
    ctx.quadraticCurveTo(x, y, x + rr, y)
    ctx.closePath()
  }

  /** 四角圆角矩形（描边/填充前调用 path） */
  static drawRoundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + rr, y)
    ctx.lineTo(x + w - rr, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
    ctx.lineTo(x + w, y + h - rr)
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
    ctx.lineTo(x + rr, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
    ctx.lineTo(x, y + rr)
    ctx.quadraticCurveTo(x, y, x + rr, y)
    ctx.closePath()
  }

  /**
   * object-fit: cover
   */
  static async drawImageCover(ctx, imagePath, x, y, w, h) {
    return new Promise((resolve, reject) => {
      uni.getImageInfo({
        src: imagePath,
        success: (info) => {
          const iw = info.width
          const ih = info.height
          const scale = Math.max(w / iw, h / ih)
          const dw = iw * scale
          const dh = ih * scale
          const dx = x + (w - dw) / 2
          const dy = y + (h - dh) / 2
          ctx.drawImage(imagePath, dx, dy, dw, dh)
          setTimeout(() => resolve(), 80)
        },
        fail: reject
      })
    })
  }

  static async drawQRCodeInFooter(ctx, noteId, W, H, footerH) {
    try {
      const qrSize = Math.round(W * 0.21)
      const padding = Math.round(W * 0.045)
      const footerY = H - footerH
      const qrPath = await this.generateMiniProgramCode(noteId)
      if (!qrPath) return
      const qy = footerY + (footerH - qrSize) / 2
      const qx = W - qrSize - padding
      await this.drawImage(ctx, qrPath, qx, qy, qrSize, qrSize)
    } catch (e) {
      console.warn('[ShareGenerator] 小程序码绘制跳过:', e)
    }
  }

  static drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 999) {
    if (!text) return 0
    const chars = text.split('')
    let line = ''
    let lineCount = 0
    let currentY = y

    for (let i = 0; i < chars.length; i++) {
      const testLine = line + chars[i]
      const testWidth = ctx.measureText(testLine).width

      if (testWidth > maxWidth && line !== '') {
        ctx.fillText(line, x, currentY)
        line = chars[i]
        currentY += lineHeight
        lineCount++

        if (lineCount >= maxLines) {
          if (i < chars.length - 1) {
            ctx.fillText(line + '…', x, currentY)
            lineCount++
          }
          break
        }
      } else {
        line = testLine
      }
    }

    if (line && lineCount < maxLines) {
      ctx.fillText(line, x, currentY)
      lineCount++
    }

    return lineCount
  }

  static truncateContent(content, maxLength = 200) {
    if (!content) return ''
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength) + '…'
  }

  static async drawImage(ctx, imagePath, x, y, width, height) {
    return new Promise((resolve, reject) => {
      uni.getImageInfo({
        src: imagePath,
        success: () => {
          ctx.drawImage(imagePath, x, y, width, height)
          setTimeout(() => resolve(), 80)
        },
        fail: reject
      })
    })
  }

  static async generateMiniProgramCode(noteId) {
    const result = await uniCloud.callFunction({
      name: 'generate-qrcode',
      data: {
        noteId: noteId,
        page: 'pages/note/note'
      }
    })

    if (result.result && result.result.success) {
      return result.result.qrCodeUrl
    }
    throw new Error(result.result?.message || '生成小程序码失败')
  }

  static canvasToTempFilePath(canvasId, width, height) {
    return new Promise((resolve, reject) => {
      const systemInfo = uni.getSystemInfoSync()
      const pixelRatio = systemInfo.pixelRatio || 2
      uni.canvasToTempFilePath({
        canvasId: canvasId,
        width: width,
        height: height,
        destWidth: width * pixelRatio,
        destHeight: height * pixelRatio,
        fileType: 'jpg',
        quality: 0.92,
        success: (res) => resolve(res.tempFilePath),
        fail: reject
      })
    })
  }

  static async saveToAlbum(tempFilePath) {
    try {
      let filePath = tempFilePath
      if (Array.isArray(tempFilePath)) filePath = tempFilePath[0]
      if (typeof filePath !== 'string') throw new Error('图片路径必须是字符串')

      const authResult = await this.requestAlbumAuth()
      if (!authResult) throw new Error('用户拒绝授权访问相册')

      await uni.saveImageToPhotosAlbum({ filePath: filePath })

      uni.showToast({ title: '已保存到相册', icon: 'success' })
    } catch (error) {
      console.error('[ShareGenerator] 保存失败:', error)
      uni.showToast({
        title: '保存失败: ' + (error.message || '未知错误'),
        icon: 'none',
        duration: 3000
      })
      throw error
    }
  }

  static async requestAlbumAuth() {
    return new Promise((resolve) => {
      uni.getSetting({
        success: (res) => {
          if (res.authSetting['scope.writePhotosAlbum']) {
            resolve(true)
          } else {
            uni.authorize({
              scope: 'scope.writePhotosAlbum',
              success: () => resolve(true),
              fail: () => {
                uni.showModal({
                  title: '提示',
                  content: '需要您授权保存图片到相册',
                  confirmText: '去设置',
                  success: (modalRes) => {
                    if (modalRes.confirm) uni.openSetting()
                    resolve(false)
                  }
                })
              }
            })
          }
        }
      })
    })
  }
}

export async function generateShareImage(note) {
  return await ShareGenerator.generateShareImage(note)
}

export async function saveToAlbum(imagePath) {
  return await ShareGenerator.saveToAlbum(imagePath)
}
