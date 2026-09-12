'use strict';

/**
 * 小程序 callFunction 时 context.CLIENTTOKEN 可能为空，需同时读取客户端传入的 uniIdToken。
 */
function resolveUniIdToken(event, context) {
  const fromEvent = event.uniIdToken || event.token
  if (fromEvent && String(fromEvent).trim()) return String(fromEvent).trim()
  if (context.CLIENTTOKEN && String(context.CLIENTTOKEN).trim()) return String(context.CLIENTTOKEN).trim()
  return null
}

/**
 * 游记同步云函数
 * 
 * 功能：处理游记的云端同步（上传、下载、合并）
 * 
 * @param {Object} event - 云函数事件参数
 * @param {string} event.action - 操作类型：upload（上传）、download（下载）、merge（合并）
 * @param {Array<Object>} event.notes - 游记数组（upload 操作必需）
 * 
 * @returns {Object} 返回结果
 * @returns {boolean} returns.ok - 是否成功
 * @returns {Array<Object>} returns.data - 返回的游记数据
 * @returns {string} returns.error - 错误代码（失败时）
 * @returns {string} returns.message - 错误消息（失败时）
 */
exports.main = async (event, context) => {
  console.log('[SyncNotes] 收到请求');
  console.log('[SyncNotes] 操作类型:', event.action);
  
  const { action, notes } = event;
  const db = uniCloud.database();
  const collection = db.collection('travel_notes');
  
  try {
    const token = resolveUniIdToken(event, context)
    if (!token) {
      console.error('[SyncNotes] 无登录 token（CLIENTTOKEN / uniIdToken 均为空）')
      return {
        ok: false,
        error: 'not_logged_in',
        message: '请先登录'
      }
    }
    const uniID = require('uni-id-common')
    const uniIDIns = uniID.createInstance({ context })
    let payload
    try {
      payload = await uniIDIns.checkToken(token)
    } catch (checkErr) {
      console.error('[SyncNotes] checkToken 抛出异常:', JSON.stringify({
        errCode: checkErr.errCode,
        errMsg: checkErr.errMsg,
        code: checkErr.code,
        message: checkErr.message
      }))
      const isExpired = checkErr.errCode === 'uni-id-token-expired' || checkErr.code === 30203
      return {
        ok: false,
        error: isExpired ? 'token_expired' : 'token_invalid',
        message: isExpired ? '登录已过期，请重新登录' : '登录验证失败，请重新登录'
      }
    }
    if (!payload || !payload.uid) {
      console.error('[SyncNotes] token 校验返回无效 payload:', JSON.stringify(payload))
      return {
        ok: false,
        error: 'not_logged_in',
        message: '请先登录或重新登录后再试'
      }
    }
    const uid = payload.uid

    // 根据操作类型分发处理
    switch (action) {
      case 'ping':
        // 健康检查
        console.log('[SyncNotes] Ping 检测');
        return {
          ok: true,
          message: '云端就绪',
          timestamp: Date.now()
        };
      
      case 'upload':
        return await handleUpload(collection, uid, notes);
      
      case 'download':
        return await handleDownload(collection, uid);
      
      case 'merge':
        return await handleMerge(collection, uid, notes);
      
      default:
        console.error('[SyncNotes] 未知操作类型:', action);
        return {
          ok: false,
          error: 'invalid_action',
          message: '无效的操作类型'
        };
    }
  } catch (error) {
    console.error('[SyncNotes] 处理失败:', error);
    return {
      ok: false,
      error: 'system_error',
      message: error.message || '系统错误'
    };
  }
};

/**
 * 处理上传操作
 * @param {Object} collection - 数据库集合
 * @param {string} uid - 用户 ID
 * @param {Array<Object>} notes - 游记数组
 * @returns {Promise<Object>} 处理结果
 */
async function handleUpload(collection, uid, notes) {
  console.log('[SyncNotes] 处理上传操作');
  
  if (!Array.isArray(notes) || notes.length === 0) {
    return {
      ok: false,
      error: 'invalid_notes',
      message: '游记数据无效'
    };
  }
  
  const safeNotes = notes.slice(0, 100);
  console.log('[SyncNotes] 上传游记数量:', safeNotes.length);
  
  const uploadedNotes = [];
  const failedNotes = [];
  
  // 逐个上传游记
  for (const note of safeNotes) {
    try {
      if (!note || typeof note !== 'object') throw new Error('游记格式无效');
      const localId = String(note.local_id || note.id || '').trim();
      if (!localId) throw new Error('游记缺少本地 ID');
      const rawCreatedAt =
        typeof note.created_at === 'number'
          ? new Date(note.created_at)
          : (note.created_at instanceof Date ? note.created_at : null);
      const createdAt = rawCreatedAt && Number.isFinite(rawCreatedAt.getTime()) ? rawCreatedAt : new Date();
      const allowedTemplates = ['literary', 'humorous', 'concise', 'poetic'];
      const template = allowedTemplates.includes(note.template) ? note.template : 'literary';
      const editHistory = Array.isArray(note.edit_history)
        ? note.edit_history.slice(-20).map(item => ({
            timestamp: new Date(Number(item && item.timestamp) || Date.now()),
            content: String(item && item.content || item && item.changes && item.changes.content && item.changes.content.new || note.content || '').slice(0, 50000)
          }))
        : [];

      // 构建数据库记录
      const record = {
        user_id: uid,
        local_id: localId,
        title: String(note.title || note.address || '未命名游记').slice(0, 100),
        content: String(note.content || '').slice(0, 50000),
        images: typeof note.cover === 'string' && note.cover ? [note.cover] : [],
        location: {
          address: String(note.address || '').slice(0, 300),
          addressText: String(note.address || '').slice(0, 300),
          latitude: Number.isFinite(Number(note.latitude)) ? Number(note.latitude) : null,
          longitude: Number.isFinite(Number(note.longitude)) ? Number(note.longitude) : null
        },
        template,
        tags: Array.isArray(note.tags) ? note.tags.slice(0, 20).map(tag => String(tag).slice(0, 30)) : [],
        created_at: createdAt,
        updated_at: new Date(),
        is_edited: !!note.is_edited,
        edit_history: editHistory
      };

      // user_id + local_id 幂等写入，网络重试不会制造重复游记
      const existing = await collection.where({ user_id: uid, local_id: localId }).limit(1).get();
      let cloudId;
      if (existing.data && existing.data.length > 0) {
        cloudId = existing.data[0]._id;
        const updateRecord = { ...record };
        delete updateRecord.user_id;
        delete updateRecord.local_id;
        delete updateRecord.created_at;
        await collection.doc(cloudId).update(updateRecord);
        console.log('[SyncNotes] 已更新现有游记:', cloudId);
      } else {
        const res = await collection.add(record);
        cloudId = res.id;
        console.log('[SyncNotes] 上传成功，ID:', cloudId);
      }
      
      uploadedNotes.push({
        ...note,
        id: localId,
        _id: cloudId,
        synced: true
      });
    } catch (error) {
      console.error('[SyncNotes] 上传单条游记失败:', error);
      failedNotes.push({ id: note && note.id || '', message: error.message || '上传失败' });
    }
  }
  
  console.log('[SyncNotes] 上传完成，成功:', uploadedNotes.length);
  
  return {
    ok: uploadedNotes.length > 0,
    data: uploadedNotes,
    count: uploadedNotes.length,
    failed: failedNotes.length,
    failures: failedNotes,
    message: uploadedNotes.length > 0 ? '同步完成' : '没有游记同步成功'
  };
}

/**
 * 处理下载操作
 * @param {Object} collection - 数据库集合
 * @param {string} uid - 用户 ID
 * @returns {Promise<Object>} 处理结果
 */
async function handleDownload(collection, uid) {
  console.log('[SyncNotes] 处理下载操作');
  
  // 查询该用户的所有游记
  const res = await collection
    .where({
      user_id: uid
    })
    .orderBy('created_at', 'desc')
    .limit(100) // 最多返回 100 条
    .get();
  
  console.log('[SyncNotes] 查询到游记数量:', res.data.length);
  
  // 转换为客户端格式
  const notes = res.data.map(record => ({
    id: record.local_id || record._id,
    _id: record._id,
    time: new Date(record.created_at).toLocaleString(),
    address: record.location?.addressText || record.title,
    content: record.content,
    cover: record.images && record.images.length > 0 ? record.images[0] : '',
    template: record.template,
    tags: Array.isArray(record.tags) ? record.tags : [],
    latitude: record.location && record.location.latitude != null ? record.location.latitude : undefined,
    longitude: record.location && record.location.longitude != null ? record.location.longitude : undefined,
    synced: true,
    created_at: record.created_at
  }));
  
  return {
    ok: true,
    data: notes
  };
}

/**
 * 处理合并操作
 * @param {Object} collection - 数据库集合
 * @param {string} uid - 用户 ID
 * @param {Array<Object>} localNotes - 本地游记数组
 * @returns {Promise<Object>} 处理结果
 */
async function handleMerge(collection, uid, localNotes) {
  console.log('[SyncNotes] 处理合并操作');
  
  // 先下载云端数据
  const downloadResult = await handleDownload(collection, uid);
  
  if (!downloadResult.ok) {
    return downloadResult;
  }
  
  const cloudNotes = downloadResult.data;
  
  // 找出本地独有的游记（未同步的）
  const cloudNoteIds = new Set(cloudNotes.map(n => String(n.id)));
  const localOnlyNotes = (localNotes || []).filter(n => !cloudNoteIds.has(String(n.id)) && !n.synced);
  
  console.log('[SyncNotes] 云端游记数量:', cloudNotes.length);
  console.log('[SyncNotes] 本地独有游记数量:', localOnlyNotes.length);
  
  // 上传本地独有的游记
  if (localOnlyNotes.length > 0) {
    const uploadResult = await handleUpload(collection, uid, localOnlyNotes);
    
    if (uploadResult.ok) {
      // 合并上传后的游记
      const mergedNotes = [...cloudNotes, ...uploadResult.data];
      
      // 按创建时间降序排序
      mergedNotes.sort((a, b) => {
        const timeA = a.created_at || new Date(a.time).getTime();
        const timeB = b.created_at || new Date(b.time).getTime();
        return timeB - timeA;
      });
      
      return {
        ok: true,
        data: mergedNotes
      };
    }
  }
  
  // 没有本地独有游记，直接返回云端数据
  return {
    ok: true,
    data: cloudNotes
  };
}
