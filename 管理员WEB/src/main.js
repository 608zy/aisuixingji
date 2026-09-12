import './style.css'

const PAGE_SIZE = 20
const AUDIT_PAGE = 30

let _uniCloud = null
let _cloudClient = null

function installBrowserUniAdapter() {
  if (globalThis.uni) return

  globalThis.uni = {
    request(options = {}) {
      const controller = new AbortController()
      const timeout = Number(options.timeout) > 0
        ? setTimeout(() => controller.abort(), Number(options.timeout))
        : null

      fetch(options.url, {
        method: options.method || 'GET',
        headers: options.header || {},
        body: /^(GET|HEAD)$/i.test(options.method || 'GET')
          ? undefined
          : JSON.stringify(options.data || {}),
        signal: controller.signal
      }).then(async response => {
        const raw = await response.text()
        let data = raw
        try { data = raw ? JSON.parse(raw) : null } catch (e) {}
        const result = {
          statusCode: response.status,
          data,
          header: Object.fromEntries(response.headers.entries()),
          errMsg: 'request:ok'
        }
        options.success?.(result)
        options.complete?.(result)
      }).catch(error => {
        const result = {
          errMsg: error && error.name === 'AbortError' ? 'request:fail timeout' : `request:fail ${error.message || error}`
        }
        options.fail?.(result)
        options.complete?.(result)
      }).finally(() => {
        if (timeout) clearTimeout(timeout)
      })

      return { abort: () => controller.abort() }
    },
    setStorageSync(key, value) {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
    },
    getStorageSync(key) {
      const value = localStorage.getItem(key)
      if (value == null) return ''
      try { return JSON.parse(value) } catch (e) { return value }
    },
    removeStorageSync(key) { localStorage.removeItem(key) },
    clearStorageSync() { localStorage.clear() },
    getLocale() { return navigator.language || 'zh-CN' },
    getLaunchOptionsSync() { return {} },
    getSystemInfoSync() {
      return {
        appId: 'admin-web',
        appName: 'AI 随行记管理员WEB',
        appVersion: '1.0.0',
        browserName: navigator.userAgent,
        deviceType: 'pc',
        osName: navigator.platform,
        uniPlatform: 'web'
      }
    }
  }
}

async function ensureUniCloud() {
  if (_uniCloud) return _uniCloud
  installBrowserUniAdapter()
  const module = await import('@dcloudio/uni-cloud')
  _uniCloud = module.default || module.uniCloud
  if (!_uniCloud || typeof _uniCloud.init !== 'function') {
    throw new Error('uniCloud 浏览器客户端加载失败')
  }
  return _uniCloud
}

async function initCloudClient({ spaceId, clientSecret }) {
  const uc = await ensureUniCloud()
  _cloudClient = uc.init({
    provider: 'aliyun',
    spaceId: String(spaceId).trim(),
    clientSecret: String(clientSecret).trim()
  })
  return _cloudClient
}

async function callAdmin(action, data = {}) {
  const uc = _cloudClient
  if (!uc) throw new Error('请先连接 uniCloud')
  const adminToken = sessionStorage.getItem(SS.token) || ''
  const res = await uc.callFunction({
    name: 'admin-web',
    data: { action, adminToken, ...data }
  })
  const body = res.result || res
  if (!body.ok && body.code === 'FORBIDDEN') {
    state.connected = false
  }
  return body
}

const SS = {
  space: 'admin_web_space_id',
  client: 'admin_web_client_secret',
  token: 'admin_web_admin_token'
}

const state = {
  connected: false,
  loading: false,
  tab: 'overview',
  dashboard: null,
  users: [],
  userTotal: 0,
  userPage: 1,
  keyword: '',
  detail: null,
  posts: [],
  postsTotal: 0,
  postsPage: 1,
  postsKeyword: '',
  audit: [],
  auditTotal: 0,
  auditPage: 1,
  msg: '',
  err: ''
}

function loadFormFromSession() {
  return {
    spaceId: sessionStorage.getItem(SS.space) || '',
    clientSecret: sessionStorage.getItem(SS.client) || '',
    adminToken: sessionStorage.getItem(SS.token) || ''
  }
}

function saveSession({ spaceId, clientSecret, adminToken }) {
  sessionStorage.setItem(SS.space, spaceId)
  sessionStorage.setItem(SS.client, clientSecret)
  sessionStorage.setItem(SS.token, adminToken)
}

function clearSession() {
  Object.values(SS).forEach(key => sessionStorage.removeItem(key))
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function render() {
  const app = document.getElementById('app')
  const f = loadFormFromSession()
  const spaceVal = f.spaceId
  const clientVal = f.clientSecret
  const tokenVal = f.adminToken

  const d = state.dashboard

  app.innerHTML = `
    <header class="topbar">
      <div>
        <h1>管理员WEB</h1>
        <p class="sub">AI 随行记 · uniCloud 云函数 <code class="mono">admin-web</code></p>
      </div>
      ${
        state.connected
          ? `<button type="button" class="secondary small" id="btn-disconnect">退出连接</button>`
          : ''
      }
    </header>

    <div class="card">
      <h2 class="card-title">连接</h2>
      <div class="row">
        <label>spaceId<input id="inp-space" value="${esc(spaceVal)}" autocomplete="off" placeholder="pages.json → uniCloud.spaceId" /></label>
        <label>clientSecret<input id="inp-client" type="password" value="${esc(clientVal)}" autocomplete="off" placeholder="勿提交到公开仓库" /></label>
        <label>管理口令<input id="inp-token" type="password" value="${esc(tokenVal)}" autocomplete="off" placeholder="云函数环境变量 ADMIN_WEB_TOKEN" /></label>
      </div>
      <button type="button" id="btn-connect">${state.connected ? '已连接 · 重新校验' : '连接并校验'}</button>
      ${state.err ? `<div class="msg err">${esc(state.err)}</div>` : ''}
      ${state.msg ? `<div class="msg ok">${esc(state.msg)}</div>` : ''}
    </div>

    ${
      state.loading
        ? `<div class="loading-bar"><span class="spinner"></span> 请求中…</div>`
        : ''
    }

    ${
      state.connected
        ? `
    <nav class="tabs">
      <button type="button" class="tab ${state.tab === 'overview' ? 'active' : ''}" data-tab="overview">数据概览</button>
      <button type="button" class="tab ${state.tab === 'users' ? 'active' : ''}" data-tab="users">用户</button>
      <button type="button" class="tab ${state.tab === 'posts' ? 'active' : ''}" data-tab="posts">广场帖子</button>
      <button type="button" class="tab ${state.tab === 'audit' ? 'active' : ''}" data-tab="audit">审计</button>
    </nav>

    ${
      state.tab === 'overview'
        ? `
    <div class="card">
      <h2 class="card-title">数据概览</h2>
      ${
        d
          ? `<div class="detail-grid">
        <div class="stat"><b>${d.users_total}</b><span>注册用户</span></div>
        <div class="stat"><b>${d.users_banned}</b><span>已封号</span></div>
        <div class="stat"><b>${d.community_posts_total}</b><span>广场帖子(含隐藏)</span></div>
        <div class="stat"><b>${d.community_posts_visible}</b><span>广场可见</span></div>
        <div class="stat"><b>${d.travel_notes}</b><span>云游记</span></div>
        <div class="stat"><b>${d.post_comments}</b><span>评论</span></div>
        <div class="stat"><b>${d.post_likes}</b><span>点赞记录</span></div>
        <div class="stat"><b>${d.audit_logs}</b><span>审计条数</span></div>
      </div>
      <button type="button" class="secondary" id="btn-dash-refresh">刷新数字</button>`
          : `<p class="hint">正在加载…</p>`
      }
    </div>`
        : ''
    }

    ${
      state.tab === 'users'
        ? `
    <div class="card">
      <h2 class="card-title">用户列表</h2>
      <div class="row">
        <label class="flex2">搜索（昵称/用户名/手机/邮箱）<input id="inp-kw" value="${esc(state.keyword)}" placeholder="留空 = 全部" /></label>
        <button type="button" id="btn-search" class="secondary">搜索</button>
      </div>
      <p class="hint">共 ${state.userTotal} 条 · 每页 ${PAGE_SIZE} 条 · 第 ${state.userPage} 页</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>状态</th><th>昵称</th><th>用户名</th><th>手机</th><th>注册时间</th><th></th></tr></thead>
          <tbody>
            ${
              state.users.length === 0
                ? `<tr><td colspan="6" class="empty-cell">暂无数据</td></tr>`
                : state.users
                    .map(
                      (u) => `
              <tr>
                <td>${u.status === 1 ? '<span class="badge badge-ban">已封</span>' : '<span class="badge badge-ok">正常</span>'}</td>
                <td>${esc(u.nickname)}</td>
                <td class="mono">${esc(u.username)}</td>
                <td>${esc(u.mobile)}</td>
                <td class="mono">${u.register_date ? new Date(u.register_date).toLocaleString() : '—'}</td>
                <td><button type="button" class="secondary small btn-detail" data-uid="${esc(u._id)}">详情</button></td>
              </tr>`
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>
      <div class="row">
        <button type="button" class="secondary" id="btn-prev" ${state.userPage <= 1 ? 'disabled' : ''}>上一页</button>
        <button type="button" class="secondary" id="btn-next" ${
          state.userPage * PAGE_SIZE >= state.userTotal ? 'disabled' : ''
        }>下一页</button>
      </div>
    </div>
    ${renderUserDetail()}`
        : ''
    }

    ${
      state.tab === 'posts'
        ? `
    <div class="card">
      <h2 class="card-title">广场帖子巡查</h2>
      <p class="hint">按标题 / 地址 / 正文关键词筛选；隐藏后小程序列表不再展示（is_hidden）。</p>
      <div class="row">
        <label class="flex2">关键词<input id="inp-posts-kw" value="${esc(state.postsKeyword)}" placeholder="留空 = 最新帖子" /></label>
        <button type="button" id="btn-posts-search" class="secondary">搜索</button>
      </div>
      <p class="hint">共 ${state.postsTotal} 条 · 第 ${state.postsPage} 页</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>状态</th><th>标题</th><th>发布者 uid</th><th>赞/评</th><th>时间</th><th></th></tr></thead>
          <tbody>
            ${
              state.posts.length === 0
                ? `<tr><td colspan="6" class="empty-cell">暂无帖子</td></tr>`
                : state.posts
                    .map((p) => {
                      const hid = p.is_hidden === true
                      return `
              <tr class="${hid ? 'row-muted' : ''}">
                <td>${
                  p.is_anonymized
                    ? '<span class="badge badge-warn">匿名</span>'
                    : ''
                } ${hid ? '<span class="badge badge-ban">已隐藏</span>' : '<span class="badge badge-ok">展示</span>'}</td>
                <td>${esc((p.title || p.address || '').slice(0, 40))}</td>
                <td class="mono mono-sm">${esc((p.user_id || '').slice(0, 12))}…</td>
                <td>${p.like_count || 0} / ${p.comment_count || 0}</td>
                <td class="mono mono-sm">${p.created_at ? new Date(p.created_at).toLocaleString() : '—'}</td>
                <td>
                  ${
                    hid
                      ? `<button type="button" class="secondary small btn-unhide" data-pid="${esc(p._id)}">恢复</button>`
                      : `<button type="button" class="danger small btn-hide" data-pid="${esc(p._id)}">隐藏</button>`
                  }
                </td>
              </tr>`
                    })
                    .join('')
            }
          </tbody>
        </table>
      </div>
      <div class="row">
        <button type="button" class="secondary" id="posts-prev" ${state.postsPage <= 1 ? 'disabled' : ''}>上一页</button>
        <button type="button" class="secondary" id="posts-next" ${
          state.postsPage * PAGE_SIZE >= state.postsTotal ? 'disabled' : ''
        }>下一页</button>
      </div>
    </div>`
        : ''
    }

    ${
      state.tab === 'audit'
        ? `
    <div class="card">
      <h2 class="card-title">操作审计</h2>
      <p class="hint">共 ${state.auditTotal} 条 · 每页 ${AUDIT_PAGE} 条</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>时间</th><th>动作</th><th>目标 uid</th><th>详情</th></tr></thead>
          <tbody>
            ${
              state.audit.length === 0
                ? `<tr><td colspan="4" class="empty-cell">暂无记录</td></tr>`
                : state.audit
                    .map(
                      (a) => `
              <tr>
                <td class="mono mono-sm">${a.created_at ? new Date(a.created_at).toLocaleString() : '—'}</td>
                <td>${esc(a.action)}</td>
                <td class="mono mono-sm">${esc(a.target_uid)}</td>
                <td class="detail-cell">${esc(a.detail)}</td>
              </tr>`
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>
      <div class="row">
        <button type="button" class="secondary" id="audit-prev" ${state.auditPage <= 1 ? 'disabled' : ''}>上一页</button>
        <button type="button" class="secondary" id="audit-next" ${
          state.auditPage * AUDIT_PAGE >= state.auditTotal ? 'disabled' : ''
        }>下一页</button>
        <button type="button" class="secondary" id="audit-refresh">刷新</button>
      </div>
    </div>`
        : ''
    }
    `
        : ''
    }
  `

  bindEvents()
}

function renderUserDetail() {
  if (!state.detail) return ''
  const u = state.detail.user
  const uid = state.detail._uid
  return `
    <div class="card detail-card">
      <div class="detail-head">
        <h2 class="card-title">用户详情</h2>
        <div class="detail-actions">
          <button type="button" class="secondary small" id="btn-copy-uid">复制 UID</button>
          <button type="button" class="secondary small" id="btn-close-detail">关闭</button>
        </div>
      </div>
      <p class="mono uid-line">${esc(uid)}</p>
      <div class="detail-grid">
        <div class="stat"><b>${state.detail.counts.community_posts}</b><span>广场帖子</span></div>
        <div class="stat"><b>${state.detail.counts.post_comments}</b><span>评论</span></div>
        <div class="stat"><b>${state.detail.counts.travel_notes}</b><span>云游记</span></div>
        <div class="stat"><b>${state.detail.counts.post_likes}</b><span>点赞</span></div>
        <div class="stat"><b>${state.detail.counts.user_favorites}</b><span>收藏</span></div>
        <div class="stat"><b>${state.detail.counts.upload_urls}</b><span>近期图链</span></div>
      </div>
      <p class="user-line"><strong>昵称</strong> ${esc(u.nickname)} · <strong>用户名</strong> ${esc(u.username)} · <strong>手机</strong> ${esc(u.mobile)} · <strong>邮箱</strong> ${esc(u.email)}</p>
      <p class="hint">最近登录 ${u.last_login_date ? new Date(u.last_login_date).toLocaleString() : '—'} · IP ${esc(u.last_login_ip)}</p>
      <div class="row">
        <button type="button" class="danger" id="btn-ban">封号</button>
        <button type="button" class="secondary" id="btn-unban">解封</button>
        <button type="button" class="danger outline" id="btn-anon">匿名化其内容</button>
      </div>
      <h3 class="section-title">近期广场帖</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>标题</th><th>地址</th><th>赞/评</th><th>时间</th></tr></thead>
          <tbody>
            ${
              (state.detail.recent_posts || []).length === 0
                ? `<tr><td colspan="4" class="empty-cell">无</td></tr>`
                : (state.detail.recent_posts || [])
                    .map(
                      (p) => `
              <tr>
                <td>${esc(p.title)}${p.is_anonymized ? ' <span class="badge badge-ban">已匿名</span>' : ''}</td>
                <td>${esc(p.address)}</td>
                <td>${p.like_count || 0} / ${p.comment_count || 0}</td>
                <td class="mono mono-sm">${p.created_at ? new Date(p.created_at).toLocaleString() : '—'}</td>
              </tr>`
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>
      <h3 class="section-title">近期云游记</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>标题</th><th>图片数</th><th>时间</th></tr></thead>
          <tbody>
            ${
              (state.detail.recent_notes || []).length === 0
                ? `<tr><td colspan="3" class="empty-cell">无</td></tr>`
                : (state.detail.recent_notes || [])
                    .map(
                      (n) => `
              <tr>
                <td>${esc(n.title)}${n.is_anonymized ? ' <span class="badge badge-ban">已匿名</span>' : ''}</td>
                <td>${Array.isArray(n.images) ? n.images.length : 0}</td>
                <td class="mono mono-sm">${n.created_at ? new Date(n.created_at).toLocaleString() : '—'}</td>
              </tr>`
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>
      <h3 class="section-title">近期图片 / 封面 URL</h3>
      <div class="uploads">
        ${(state.detail.recent_uploads || [])
          .map(
            (x) =>
              `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.type)} · ${esc(String(x.url).slice(0, 56))}…</a>`
          )
          .join('')}
      </div>
    </div>
  `
}

function bindEvents() {
  document.getElementById('btn-connect')?.addEventListener('click', onConnect)
  document.getElementById('btn-disconnect')?.addEventListener('click', () => {
    _cloudClient = null
    clearSession()
    state.connected = false
    state.detail = null
    state.dashboard = null
    state.msg = ''
    state.err = ''
    render()
  })
  document.getElementById('btn-search')?.addEventListener('click', onSearchUsers)
  document.getElementById('btn-prev')?.addEventListener('click', async () => {
    if (state.userPage > 1) {
      state.userPage--
      await withLoading(() => loadUsers())
      render()
    }
  })
  document.getElementById('btn-next')?.addEventListener('click', async () => {
    if (state.userPage * PAGE_SIZE < state.userTotal) {
      state.userPage++
      await withLoading(() => loadUsers())
      render()
    }
  })
  document.querySelectorAll('.btn-detail').forEach((btn) => {
    btn.addEventListener('click', () => loadDetail(btn.getAttribute('data-uid')))
  })
  document.getElementById('btn-ban')?.addEventListener('click', () => doBan(true))
  document.getElementById('btn-unban')?.addEventListener('click', () => doBan(false))
  document.getElementById('btn-anon')?.addEventListener('click', doAnonymize)
  document.getElementById('btn-close-detail')?.addEventListener('click', () => {
    state.detail = null
    render()
  })
  document.getElementById('btn-copy-uid')?.addEventListener('click', () => {
    const t = state.detail?._uid || ''
    if (t && navigator.clipboard) {
      navigator.clipboard.writeText(t).then(() => alert('已复制 UID'))
    } else {
      prompt('复制 UID', t)
    }
  })
  document.querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', async () => {
      state.tab = t.getAttribute('data-tab')
      if (state.tab === 'audit') await withLoading(() => loadAudit())
      if (state.tab === 'overview') await withLoading(() => loadDashboard())
      if (state.tab === 'posts') await withLoading(() => loadPosts())
      render()
    })
  })
  document.getElementById('btn-dash-refresh')?.addEventListener('click', async () => {
    await withLoading(() => loadDashboard())
    render()
  })
  document.getElementById('btn-posts-search')?.addEventListener('click', async () => {
    state.postsPage = 1
    await withLoading(() => loadPosts())
    render()
  })
  document.getElementById('posts-prev')?.addEventListener('click', async () => {
    if (state.postsPage > 1) {
      state.postsPage--
      await withLoading(() => loadPosts())
      render()
    }
  })
  document.getElementById('posts-next')?.addEventListener('click', async () => {
    if (state.postsPage * PAGE_SIZE < state.postsTotal) {
      state.postsPage++
      await withLoading(() => loadPosts())
      render()
    }
  })
  document.querySelectorAll('.btn-hide').forEach((b) => {
    b.addEventListener('click', () => togglePostHidden(b.getAttribute('data-pid'), true))
  })
  document.querySelectorAll('.btn-unhide').forEach((b) => {
    b.addEventListener('click', () => togglePostHidden(b.getAttribute('data-pid'), false))
  })
  document.getElementById('audit-prev')?.addEventListener('click', async () => {
    if (state.auditPage > 1) {
      state.auditPage--
      await withLoading(() => loadAudit())
      render()
    }
  })
  document.getElementById('audit-next')?.addEventListener('click', async () => {
    if (state.auditPage * AUDIT_PAGE < state.auditTotal) {
      state.auditPage++
      await withLoading(() => loadAudit())
      render()
    }
  })
  document.getElementById('audit-refresh')?.addEventListener('click', async () => {
    await withLoading(() => loadAudit())
    render()
  })
}

async function withLoading(fn) {
  state.loading = true
  render()
  try {
    await fn()
  } finally {
    state.loading = false
  }
}

async function onConnect() {
  state.err = ''
  state.msg = ''
  const spaceId = document.getElementById('inp-space')?.value?.trim()
  const clientSecret = document.getElementById('inp-client')?.value?.trim()
  const adminToken = document.getElementById('inp-token')?.value?.trim()
  if (!spaceId || !clientSecret || !adminToken) {
    state.err = '请填写 spaceId、clientSecret、管理口令'
    render()
    return
  }
  saveSession({ spaceId, clientSecret, adminToken })
  await withLoading(async () => {
    try {
      await initCloudClient({ spaceId, clientSecret })
      const r = await callAdmin('ping')
      if (!r.ok) {
        state.err = r.message || JSON.stringify(r)
        state.connected = false
        return
      }
      state.connected = true
      state.msg = r.message || '已连接'
      state.userPage = 1
      state.tab = 'overview'
      await loadDashboard()
      await loadUsers()
    } catch (e) {
      state.err = e.message || String(e)
      state.connected = false
    }
  })
  render()
}

async function loadDashboard() {
  const r = await callAdmin('dashboard')
  if (!r.ok) {
    state.dashboard = null
    state.err = r.message || '概览加载失败'
    return
  }
  state.dashboard = r.data
}

async function loadUsers() {
  const kwEl = document.getElementById('inp-kw')
  const kw = kwEl ? kwEl.value.trim() : state.keyword
  state.keyword = kw
  const r = await callAdmin('listUsers', { page: state.userPage, pageSize: PAGE_SIZE, keyword: kw })
  if (!r.ok) {
    state.err = r.message || '加载用户失败'
    state.users = []
    return
  }
  state.users = r.data.users || []
  state.userTotal = r.data.total || 0
}

async function onSearchUsers() {
  state.userPage = 1
  await withLoading(() => loadUsers())
  render()
}

async function loadPosts() {
  const el = document.getElementById('inp-posts-kw')
  const kw = el ? el.value.trim() : state.postsKeyword
  state.postsKeyword = kw
  const r = await callAdmin('listPosts', { page: state.postsPage, pageSize: PAGE_SIZE, keyword: kw })
  if (!r.ok) {
    state.err = r.message || '帖子列表失败'
    state.posts = []
    return
  }
  state.posts = r.data.list || []
  state.postsTotal = r.data.total || 0
}

async function togglePostHidden(postId, hidden) {
  if (!postId) return
  if (!confirm(hidden ? '确认隐藏该帖？广场列表将不再展示。' : '确认恢复该帖在广场的展示？')) return
  await withLoading(async () => {
    const r = await callAdmin('setPostHidden', { postId, hidden })
    alert(r.ok ? r.message : r.message || '失败')
    await loadPosts()
  })
  render()
}

async function loadDetail(uid) {
  state.err = ''
  await withLoading(async () => {
    const r = await callAdmin('getUserDetail', { uid })
    if (!r.ok) {
      state.err = r.message || '加载详情失败'
      state.detail = null
      return
    }
    state.detail = r.data
    state.detail._uid = uid
  })
  render()
  requestAnimationFrame(() => {
    document.querySelector('.detail-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

async function doBan(ban) {
  const uid = state.detail?._uid
  if (!uid) return
  if (!confirm(ban ? '确认封号？将清空 token。' : '确认解封？')) return
  await withLoading(async () => {
    const r = await callAdmin(ban ? 'banUser' : 'unbanUser', { uid })
    alert(r.ok ? r.message : r.message || '失败')
    await loadDetail(uid)
    await loadUsers()
    await loadDashboard()
  })
  render()
}

async function doAnonymize() {
  const uid = state.detail?._uid
  if (!uid) return
  if (!confirm('确认匿名化该用户在广场、评论、云游记中的内容？请谨慎操作。')) return
  await withLoading(async () => {
    const r = await callAdmin('anonymizeUser', { uid })
    alert(
      r.ok
        ? `${r.message}\n帖子 ${r.data?.posts || 0} 评论 ${r.data?.comments || 0} 游记 ${r.data?.travel_notes || 0}`
        : r.message || '失败'
    )
    await loadDetail(uid)
    await loadUsers()
    await loadDashboard()
    await loadPosts()
  })
  render()
}

async function loadAudit() {
  const r = await callAdmin('listAudit', { page: state.auditPage, pageSize: AUDIT_PAGE })
  if (!r.ok) {
    state.err = r.message || '审计加载失败'
    state.audit = []
    return
  }
  state.audit = r.data.list || []
  state.auditTotal = r.data.total || 0
}

render()
