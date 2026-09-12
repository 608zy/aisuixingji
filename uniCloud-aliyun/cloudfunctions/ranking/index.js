'use strict';

/**
 * 热门目的地榜单云函数
 * action: get（读取最新快照）/ refresh（重新计算，定时触发）
 */
exports.main = async (event, context) => {
  const { action = 'get' } = event;
  const db = uniCloud.database();

  try {
    if (action === 'get') return await handleGet(db);
    if (action === 'refresh') return await handleRefresh(db);
    return { ok: false, error: 'invalid_action' };
  } catch (e) {
    console.error('[ranking]', e);
    return { ok: false, error: 'system_error', message: e.message };
  }
};

// ===== 读取最新快照 =====
async function handleGet(db) {
  const res = await db.collection('spot_rankings')
    .orderBy('created_at', 'desc')
    .limit(1)
    .get();

  if (!res.data || res.data.length === 0) {
    // 没有快照时实时计算
    return await handleRefresh(db);
  }

  return { ok: true, data: res.data[0] };
}

// ===== 重新计算榜单 =====
async function handleRefresh(db) {
  // 查询打卡次数前 70 的景点（榜单展示更多）
  const spotsRes = await db.collection('spots')
    .orderBy('checkin_count', 'desc')
    .limit(70)
    .get();

  // 读取上一次快照用于计算排名变化
  const prevRes = await db.collection('spot_rankings')
    .orderBy('created_at', 'desc')
    .limit(1)
    .get();

  const prevRankMap = {};
  if (prevRes.data && prevRes.data.length > 0) {
    (prevRes.data[0].rankings || []).forEach(r => {
      prevRankMap[r.spot_id] = r.rank;
    });
  }

  const rankings = spotsRes.data.map((spot, index) => ({
    rank: index + 1,
    spot_id: spot._id,
    spot_name: spot.name,
    cover: spot.cover || '',
    checkin_count: spot.checkin_count || 0,
    prev_rank: prevRankMap[spot._id] || null
  }));

  const today = new Date().toISOString().slice(0, 10);
  const snapshot = {
    snapshot_date: today,
    rankings,
    created_at: new Date()
  };

  await db.collection('spot_rankings').add(snapshot);

  return { ok: true, data: snapshot };
}
