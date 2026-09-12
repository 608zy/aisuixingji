'use strict'

/**
 * 管理员 WEB 专用云函数（与小程序用户 token 无关，仅用口令校验）
 *
 * 口令配置（二选一，与前端「管理口令」一致）：
 * 1) 阿里云函数计算控制台里该函数的环境变量 ADMIN_WEB_TOKEN（DCloud Web 控制台常无此入口）
 * 2) 本目录下 admin-token.json（复制 admin-token.example.json 改名填写后，与代码一起上传部署）
 *
 * 上传 DB Schema：admin_audit_logs
 */

function getExpectedToken() {
  const fromEnv = String(process.env.ADMIN_WEB_TOKEN || '').trim()
  if (fromEnv) return fromEnv
  try {
    const f = require('./admin-token.json')
    return String(f.ADMIN_WEB_TOKEN || '').trim()
  } catch (e) {
    return ''
  }
}

function assertAdmin(event) {
  const expected = String(getExpectedToken()).trim()
  if (!expected) {
    return {
      ok: false,
      code: 'NO_CONFIG',
      message:
        '未配置管理口令：请在云函数环境变量设置 ADMIN_WEB_TOKEN，或在 admin-web 目录添加 admin-token.json 后重新上传部署'
    }
  }
  const token = String(event.adminToken || event.admin_token || '').trim()
  if (!token || token !== expected) {
    return { ok: false, code: 'FORBIDDEN', message: '管理口令错误' }
  }
  return null
}

function maskMobile(m) {
  const s = String(m || '')
  if (s.length < 7) return s ? '***' : ''
  return `${s.slice(0, 3)}****${s.slice(-4)}`
}

function maskEmail(e) {
  const s = String(e || '')
  if (!s.includes('@')) return s ? '***@***' : ''
  const [a, b] = s.split('@')
  if (a.length <= 1) return `*@${b}`
  return `${a[0]}***@${b}`
}

function escapeReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function writeAudit(db, action, targetUid, detail) {
  try {
    await db.collection('admin_audit_logs').add({
      action,
      target_uid: targetUid || '',
      detail: typeof detail === 'string' ? detail.slice(0, 2000) : JSON.stringify(detail || {}).slice(0, 2000),
      created_at: new Date()
    })
  } catch (e) {
    console.warn('[admin-web] audit skip:', e.message)
  }
}

function publicUserDoc(doc) {
  if (!doc) return null
  return {
    _id: doc._id,
    nickname: doc.nickname || '',
    username: doc.username || '',
    mobile: maskMobile(doc.mobile),
    email: maskEmail(doc.email),
    status: doc.status,
    register_date: doc.register_date,
    last_login_date: doc.last_login_date,
    last_login_ip: doc.last_login_ip || ''
  }
}

exports.main = async (event) => {
  const err = assertAdmin(event)
  if (err) return err

  const db = uniCloud.database()
  const cmd = db.command
  const { action } = event

  try {
    switch (action) {
      case 'ping':
        return { ok: true, message: '管理员接口可用' }

      case 'listUsers': {
        const page = Math.max(1, parseInt(event.page, 10) || 1)
        const pageSize = Math.min(50, Math.max(1, parseInt(event.pageSize, 10) || 20))
        const kw = String(event.keyword || '').trim()
        const userWhere = () => {
          let c = db.collection('uni-id-users')
          if (kw) {
            const reg = new RegExp(escapeReg(kw), 'i')
            c = c.where(
              cmd.or([
                { nickname: reg },
                { username: reg },
                { mobile: reg },
                { email: reg }
              ])
            )
          }
          return c
        }
        const skip = (page - 1) * pageSize
        const [listRes, countRes] = await Promise.all([
          userWhere()
            .field({
              _id: true,
              nickname: true,
              username: true,
              mobile: true,
              email: true,
              status: true,
              register_date: true,
              last_login_date: true,
              last_login_ip: true
            })
            .orderBy('register_date', 'desc')
            .skip(skip)
            .limit(pageSize)
            .get(),
          userWhere().count()
        ])
        const users = (listRes.data || []).map(publicUserDoc)
        return { ok: true, data: { users, total: countRes.total || 0, page, pageSize } }
      }

      case 'getUserDetail': {
        const uid = String(event.uid || '').trim()
        if (!uid) return { ok: false, message: '缺少 uid' }
        const ures = await db
          .collection('uni-id-users')
          .doc(uid)
          .field({
            _id: true,
            nickname: true,
            username: true,
            mobile: true,
            email: true,
            status: true,
            register_date: true,
            last_login_date: true,
            last_login_ip: true
          })
          .get()
        const udoc = ures.data && ures.data[0]
        if (!udoc) return { ok: false, message: '用户不存在' }

        const [
          postCount,
          commentCount,
          noteCount,
          likeCount,
          favCount,
          recentPosts,
          recentNotes
        ] = await Promise.all([
          db.collection('community_posts').where({ user_id: uid }).count(),
          db.collection('post_comments').where({ user_id: uid }).count(),
          db.collection('travel_notes').where({ user_id: uid }).count(),
          db.collection('post_likes').where({ user_id: uid }).count(),
          db.collection('user_favorites').where({ user_id: uid }).count(),
          db
            .collection('community_posts')
            .where({ user_id: uid })
            .orderBy('created_at', 'desc')
            .limit(30)
            .field({
              _id: true,
              title: true,
              address: true,
              cover: true,
              images: true,
              like_count: true,
              comment_count: true,
              created_at: true,
              is_anonymized: true
            })
            .get(),
          db
            .collection('travel_notes')
            .where({ user_id: uid })
            .orderBy('created_at', 'desc')
            .limit(20)
            .field({
              _id: true,
              title: true,
              local_id: true,
              images: true,
              created_at: true,
              is_anonymized: true
            })
            .get()
        ])

        const uploads = []
        for (const p of recentPosts.data || []) {
          if (p.cover) uploads.push({ type: 'post_cover', post_id: p._id, url: p.cover, created_at: p.created_at })
          if (Array.isArray(p.images)) {
            p.images.forEach((url, i) => {
              if (url) uploads.push({ type: 'post_image', post_id: p._id, url, idx: i, created_at: p.created_at })
            })
          }
        }
        for (const n of recentNotes.data || []) {
          const imgs = n.images || []
          imgs.forEach((url, i) => {
            if (url) uploads.push({ type: 'note_image', note_id: n._id, url, idx: i, created_at: n.created_at })
          })
        }

        return {
          ok: true,
          data: {
            user: publicUserDoc(udoc),
            counts: {
              community_posts: postCount.total || 0,
              post_comments: commentCount.total || 0,
              travel_notes: noteCount.total || 0,
              post_likes: likeCount.total || 0,
              user_favorites: favCount.total || 0,
              upload_urls: uploads.length
            },
            recent_posts: recentPosts.data || [],
            recent_notes: recentNotes.data || [],
            recent_uploads: uploads.slice(0, 80)
          }
        }
      }

      case 'banUser': {
        const uid = String(event.uid || '').trim()
        if (!uid) return { ok: false, message: '缺少 uid' }
        await db
          .collection('uni-id-users')
          .doc(uid)
          .update({
            status: 1,
            token: [],
            updated_at: new Date()
          })
        await writeAudit(db, 'ban_user', uid, {})
        return { ok: true, message: '已封号（status=1，token 已清空）' }
      }

      case 'unbanUser': {
        const uid = String(event.uid || '').trim()
        if (!uid) return { ok: false, message: '缺少 uid' }
        await db.collection('uni-id-users').doc(uid).update({
          status: 0,
          updated_at: new Date()
        })
        await writeAudit(db, 'unban_user', uid, {})
        return { ok: true, message: '已解封（status=0）' }
      }

      case 'anonymizeUser': {
        const uid = String(event.uid || '').trim()
        if (!uid) return { ok: false, message: '缺少 uid' }
        const now = new Date()
        let postsN = 0
        let commentsN = 0
        let notesN = 0

        const BATCH = 200
        while (true) {
          const batch = await db
            .collection('community_posts')
            .where({ user_id: uid, is_anonymized: cmd.neq(true) })
            .limit(BATCH)
            .get()
          if (!batch.data || batch.data.length === 0) break
          for (const doc of batch.data) {
            await db
              .collection('community_posts')
              .doc(doc._id)
              .update({
                title: '（内容已匿名）',
                content: '该用户发布的内容已按管理要求匿名处理。',
                cover: '',
                images: [],
                address: '',
                location: {},
                is_anonymized: true,
                anonymized_at: now,
                updated_at: now
              })
            postsN++
          }
          if (batch.data.length < BATCH) break
        }

        while (true) {
          const batch = await db
            .collection('post_comments')
            .where({ user_id: uid, is_anonymized: cmd.neq(true) })
            .limit(BATCH)
            .get()
          if (!batch.data || batch.data.length === 0) break
          for (const doc of batch.data) {
            await db
              .collection('post_comments')
              .doc(doc._id)
              .update({
                content: '该评论已匿名',
                is_deleted: true,
                is_anonymized: true,
                anonymized_at: now
              })
            commentsN++
          }
          if (batch.data.length < BATCH) break
        }

        while (true) {
          const batch = await db
            .collection('travel_notes')
            .where({ user_id: uid, is_anonymized: cmd.neq(true) })
            .limit(BATCH)
            .get()
          if (!batch.data || batch.data.length === 0) break
          for (const doc of batch.data) {
            await db
              .collection('travel_notes')
              .doc(doc._id)
              .update({
                title: '（游记已匿名）',
                content: '该游记已按管理要求匿名处理。',
                images: [],
                is_anonymized: true,
                anonymized_at: now,
                updated_at: now
              })
            notesN++
          }
          if (batch.data.length < BATCH) break
        }

        await writeAudit(db, 'anonymize_user', uid, { postsN, commentsN, notesN })
        return {
          ok: true,
          message: '已匿名化该用户在广场/评论/云游记中的内容',
          data: { posts: postsN, comments: commentsN, travel_notes: notesN }
        }
      }

      case 'listAudit': {
        const page = Math.max(1, parseInt(event.page, 10) || 1)
        const pageSize = Math.min(100, Math.max(1, parseInt(event.pageSize, 10) || 30))
        const skip = (page - 1) * pageSize
        const res = await db
          .collection('admin_audit_logs')
          .orderBy('created_at', 'desc')
          .skip(skip)
          .limit(pageSize)
          .get()
        const cnt = await db.collection('admin_audit_logs').count()
        return { ok: true, data: { list: res.data || [], total: cnt.total || 0, page, pageSize } }
      }

      case 'dashboard': {
        const visiblePostsQ = db.collection('community_posts').where({ is_hidden: cmd.neq(true) })
        const [users, banned, postsAll, postsVisible, notes, comments, likes, audits] = await Promise.all([
          db.collection('uni-id-users').count(),
          db.collection('uni-id-users').where({ status: 1 }).count(),
          db.collection('community_posts').count(),
          visiblePostsQ.count(),
          db.collection('travel_notes').count(),
          db.collection('post_comments').count(),
          db.collection('post_likes').count(),
          db.collection('admin_audit_logs').count()
        ])
        return {
          ok: true,
          data: {
            users_total: users.total || 0,
            users_banned: banned.total || 0,
            community_posts_total: postsAll.total || 0,
            community_posts_visible: postsVisible.total || 0,
            travel_notes: notes.total || 0,
            post_comments: comments.total || 0,
            post_likes: likes.total || 0,
            audit_logs: audits.total || 0
          }
        }
      }

      case 'listPosts': {
        const page = Math.max(1, parseInt(event.page, 10) || 1)
        const pageSize = Math.min(50, Math.max(1, parseInt(event.pageSize, 10) || 20))
        const kw = String(event.keyword || '').trim()
        const postsWhere = () => {
          let c = db.collection('community_posts')
          if (kw) {
            const reg = new RegExp(escapeReg(kw), 'i')
            c = c.where(cmd.or([{ title: reg }, { address: reg }, { content: reg }]))
          }
          return c
        }
        const skip = (page - 1) * pageSize
        const [listRes, countRes] = await Promise.all([
          postsWhere()
            .orderBy('created_at', 'desc')
            .skip(skip)
            .limit(pageSize)
            .field({
              _id: true,
              user_id: true,
              title: true,
              address: true,
              cover: true,
              like_count: true,
              comment_count: true,
              is_hidden: true,
              is_anonymized: true,
              created_at: true
            })
            .get(),
          postsWhere().count()
        ])
        return {
          ok: true,
          data: { list: listRes.data || [], total: countRes.total || 0, page, pageSize }
        }
      }

      case 'setPostHidden': {
        const postId = String(event.postId || '').trim()
        const hidden = event.hidden !== false
        if (!postId) return { ok: false, message: '缺少 postId' }
        await db
          .collection('community_posts')
          .doc(postId)
          .update({
            is_hidden: !!hidden,
            updated_at: new Date()
          })
        await writeAudit(db, hidden ? 'hide_post' : 'unhide_post', '', { postId })
        return { ok: true, message: hidden ? '已从广场隐藏' : '已恢复显示' }
      }

      default:
        return {
          ok: false,
          message: '未知 action',
          allowed: [
            'ping',
            'dashboard',
            'listUsers',
            'getUserDetail',
            'banUser',
            'unbanUser',
            'anonymizeUser',
            'listAudit',
            'listPosts',
            'setPostHidden'
          ]
        }
    }
  } catch (e) {
    console.error('[admin-web]', e)
    return { ok: false, message: e.message || String(e) }
  }
}
