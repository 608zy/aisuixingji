'use strict';

/**
 * 景点搜索与详情云函数
 * action: search / detail
 */
exports.main = async (event, context) => {
  const { action } = event;
  const db = uniCloud.database();

  try {
    switch (action) {
      case 'search': return await handleSearch(db, event);
      case 'detail': return await handleDetail(db, event);
      default:
        return { ok: false, error: 'invalid_action' };
    }
  } catch (e) {
    console.error('[spot-search]', e);
    return { ok: false, error: 'system_error', message: e.message };
  }
};

// ===== 关键词搜索（最多 20 条）=====
async function handleSearch(db, event) {
  const { keyword } = event;
  if (!keyword || keyword.trim() === '') {
    return { ok: false, error: 'missing_keyword' };
  }

  const res = await db.collection('spots')
    .where(db.command.expr(
      db.command.aggregate.regexMatch({
        input: '$name',
        regex: keyword.trim(),
        options: 'i'
      })
    ))
    .orderBy('checkin_count', 'desc')
    .limit(20)
    .get();

  return { ok: true, data: res.data };
}

// ===== 景点详情（含关联游记，最多 10 条按点赞数降序）=====
async function handleDetail(db, event) {
  const { spotId } = event;
  if (!spotId) return { ok: false, error: 'missing_spotId' };

  const spotRes = await db.collection('spots').doc(spotId).get();
  if (!spotRes.data || spotRes.data.length === 0) {
    return { ok: false, error: 'not_found', message: '景点不存在' };
  }

  const spot = spotRes.data[0];

  // 关联游记：从 community_posts 中查找包含该景点名称的帖子
  const notesRes = await db.collection('community_posts')
    .where({
      is_hidden: false,
      address: spot.name
    })
    .orderBy('like_count', 'desc')
    .limit(10)
    .get();

  return { ok: true, data: { ...spot, relatedNotes: notesRes.data } };
}
