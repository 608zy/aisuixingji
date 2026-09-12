/**
 * Note 序列化/反序列化工具
 * 负责 Note 对象与 JSON 字符串、HTML 之间的转换
 */

const REQUIRED_FIELDS = ['id', 'content', 'address']

export class NoteSerializer {
  /**
   * Note 对象 → JSON 字符串
   * @param {Object} note
   * @returns {string}
   */
  static serialize(note) {
    const source = note && typeof note === 'object' && !Array.isArray(note) ? note : {}
    const normalized = {
      id: source.id || '',
      content: source.content || '',
      address: source.address || '',
      title: source.title || '',
      cover: source.cover || '',
      tags: Array.isArray(source.tags) ? [...source.tags] : [],
      template_id: source.template_id || '',
      latitude: source.latitude != null ? source.latitude : null,
      longitude: source.longitude != null ? source.longitude : null,
      province: source.province || null,
      city: source.city || null,
      media: Array.isArray(source.media) ? source.media.map(m => ({ ...m })) : [],
      created_at: source.created_at || 0,
      updated_at: source.updated_at || 0,
      synced: !!source.synced
    }
    return JSON.stringify(normalized)
  }

  /**
   * JSON 字符串 → Note 对象
   * 缺少必填字段时返回 { error, missingFields }，不抛出异常
   * @param {string} json
   * @returns {Object} Note 对象 或 { error: string, missingFields: string[] }
   */
  static deserialize(json) {
    let parsed
    try {
      parsed = JSON.parse(json)
    } catch (e) {
      return { error: 'JSON 解析失败: ' + e.message, missingFields: [] }
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { error: 'JSON 内容必须是 Note 对象', missingFields: [...REQUIRED_FIELDS] }
    }

    const missingFields = REQUIRED_FIELDS.filter(
      f => parsed[f] == null || parsed[f] === ''
    )
    if (missingFields.length > 0) {
      return {
        error: '缺少必填字段: ' + missingFields.join(', '),
        missingFields
      }
    }

    return {
      id: parsed.id,
      content: parsed.content,
      address: parsed.address,
      title: parsed.title || '',
      cover: parsed.cover || '',
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      template_id: parsed.template_id || '',
      latitude: parsed.latitude != null ? parsed.latitude : null,
      longitude: parsed.longitude != null ? parsed.longitude : null,
      province: parsed.province || null,
      city: parsed.city || null,
      media: Array.isArray(parsed.media) ? parsed.media : [],
      created_at: parsed.created_at || 0,
      updated_at: parsed.updated_at || 0,
      synced: !!parsed.synced
    }
  }

  /**
   * Note 对象 → 微网页 HTML 字符串（含 XSS 转义）
   * @param {Object} note
   * @returns {string}
   */
  static toHtml(note) {
    const source = note && typeof note === 'object' && !Array.isArray(note) ? note : {}
    const safeTitle = this.escapeHtml(source.title || source.address || 'AI 随行记')
    const safeAddress = this.escapeHtml(source.address || '')
    const safeContent = this.escapeHtml(source.content || '').replace(/\n/g, '<br/>')
    const safeCover = this.safeImageUrl(source.cover)
    const cover = safeCover
      ? `<img class="cover" src="${this.escapeHtml(safeCover)}" alt="cover" />`
      : `<div class="cover placeholder">AI 随行记</div>`

    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${safeTitle}</title>
  <style>
    :root{--bg:#f5f5f5;--card:#fff;--text:#222;--muted:#6b7280;--border:#e5e7eb;}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif}
    .wrap{max-width:720px;margin:0 auto;padding:16px}
    .card{background:var(--card);border:1px solid var(--border);border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.06)}
    .head{padding:18px 18px 8px}
    .title{font-size:22px;font-weight:800;letter-spacing:.5px}
    .meta{margin-top:6px;color:var(--muted);font-size:13px;line-height:1.4}
    .cover{width:100%;height:240px;object-fit:cover;display:block;background:#ddd}
    .cover.placeholder{display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;background:linear-gradient(135deg,#ff6b00,#ffb703);height:240px}
    .body{padding:14px 18px 18px;font-size:16px;line-height:1.8}
    .badge{display:inline-block;margin-top:10px;padding:6px 10px;border-radius:999px;background:#eef2ff;color:#3730a3;font-size:12px}
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

  /**
   * HTML 特殊字符转义
   * @param {string} str
   * @returns {string}
   */
  static escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  static safeImageUrl(value) {
    const url = String(value || '').trim()
    if (/^(https?:\/\/|data:image\/(png|jpe?g|webp);base64,|wxfile:\/\/|file:\/\/)/i.test(url)) {
      return url
    }
    return ''
  }
}
