'use strict';

function resolveUniIdToken(event, context) {
  const fromEvent = event.uniIdToken || event.token;
  if (fromEvent && String(fromEvent).trim()) return String(fromEvent).trim();
  if (context.CLIENTTOKEN && String(context.CLIENTTOKEN).trim()) return String(context.CLIENTTOKEN).trim();
  return null;
}

/**
 * 增量同步云函数
 * 接收单条 Note 记录，写入 Cloud_DB travel_notes
 */
exports.main = async (event, context) => {
  const { note } = event;
  if (!note || !note.id) {
    return { ok: false, error: 'missing_note' };
  }

  try {
    const token = resolveUniIdToken(event, context);
    if (!token) {
      return { ok: false, error: 'not_logged_in', message: '请先登录' };
    }
    const uniID = require('uni-id-common');
    const ins = uniID.createInstance({ context });
    const payload = await ins.checkToken(token);
    if (!payload || !payload.uid) {
      return { ok: false, error: 'not_logged_in', message: '请先登录或重新登录后再试' };
    }
    const uid = payload.uid;

    const db = uniCloud.database();

    const createdAt =
      typeof note.created_at === 'number'
        ? new Date(note.created_at)
        : (note.created_at instanceof Date ? note.created_at : null);

    // 检查是否已存在（按本地 id 查重）
    const existing = await db.collection('travel_notes')
      .where({ local_id: note.id, user_id: uid })
      .count();

    if (existing.total > 0) {
      return { ok: true, message: '已存在，跳过', skipped: true };
    }

    await db.collection('travel_notes').add({
      local_id: note.id,
      user_id: uid,
      title: note.address || '未命名游记',
      content: note.content || '',
      images: note.cover ? [note.cover] : [],
      location: {
        address: note.address || '',
        latitude: note.latitude || null,
        longitude: note.longitude || null
      },
      template: note.template || 'literary',
      tags: note.tags || [],
      created_at: createdAt || new Date(),
      updated_at: new Date()
    });

    return { ok: true, synced: true };
  } catch (e) {
    console.error('[incremental-sync]', e);
    return { ok: false, error: 'db_error', message: e.message };
  }
};
