'use strict';

/**
 * 小程序 callFunction 时 context.CLIENTTOKEN 可能为空，需同时从客户端显式传入的 uniIdToken 读取。
 */
function resolveUniIdToken(event, context) {
  const fromEvent = event.uniIdToken || event.token;
  if (fromEvent && String(fromEvent).trim()) return String(fromEvent).trim();
  if (context.CLIENTTOKEN && String(context.CLIENTTOKEN).trim()) return String(context.CLIENTTOKEN).trim();
  return null;
}

/**
 * 游记广场社区云函数
 * 支持 action: list / detail / publish / like / unlike / comment / deleteComment / favorite / unfavorite
 */
exports.main = async (event, context) => {
  const { action } = event;
  const db = uniCloud.database();

  // 获取用户 ID
  let uid = null;
  try {
    const token = resolveUniIdToken(event, context);
    if (token) {
      const uniID = require('uni-id-common');
      const ins = uniID.createInstance({ context });
      const payload = await ins.checkToken(token);
      if (payload && payload.uid) uid = payload.uid;
    }
  } catch (e) {
    uid = null;
  }

  try {
    switch (action) {
      case 'list':   return await handleList(db, event, uid);
      case 'detail': return await handleDetail(db, event, uid);
      case 'publish': return await handlePublish(db, event, uid);
      case 'like':   return await handleLike(db, event, uid);
      case 'unlike': return await handleUnlike(db, event, uid);
      case 'comment': return await handleComment(db, event, uid);
      case 'deleteComment': return await handleDeleteComment(db, event, uid);
      case 'listComments': return await handleListComments(db, event, uid);
      case 'checkFavorite': return await handleCheckFavorite(db, event, uid);
      case 'listBySpot': return await handleListBySpot(db, event, uid);
      case 'favorite': return await handleFavorite(db, event, uid, event.targetType || 'post');
      case 'unfavorite': return await handleUnfavorite(db, event, uid, event.targetType || 'post');
      default:
        return { ok: false, error: 'invalid_action', message: '无效操作' };
    }
  } catch (e) {
    console.error('[community-post]', e);
    return { ok: false, error: 'system_error', message: e.message };
  }
};

function toPositiveInt(value, fallback, max) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

async function getVisiblePost(db, postId) {
  if (!postId) return null;
  const res = await db.collection('community_posts').doc(postId).get();
  if (!res.data || res.data.length === 0 || res.data[0].is_hidden === true) return null;
  return res.data[0];
}

// ===== 列表（分页 + 排序）=====
async function handleList(db, event, uid) {
  const { sort = 'latest', page = 1, pageSize = 10 } = event;
  const safePage = toPositiveInt(page, 1, 10000);
  const limit = toPositiveInt(pageSize, 10, 10);
  const skip = (safePage - 1) * limit;

  const dbCmd = db.command;
  let query = db.collection('community_posts').where({ is_hidden: dbCmd.neq(true) });

  if (sort === 'hot') {
    query = query.orderBy('like_count', 'desc');
  } else {
    query = query.orderBy('created_at', 'desc');
  }

  const res = await query.skip(skip).limit(limit).get();
  let posts = res.data;

  // 标记已点赞
  if (uid && posts.length > 0) {
    const postIds = posts.map(p => p._id);
    const likesRes = await db.collection('post_likes')
      .where({ user_id: uid, post_id: db.command.in(postIds) })
      .field({ post_id: true })
      .get();
    const likedSet = new Set(likesRes.data.map(l => l.post_id));
    posts = posts.map(p => ({ ...p, isLiked: likedSet.has(p._id) }));
  }

  return { ok: true, data: posts, page: safePage, pageSize: limit };
}

// ===== 详情 =====
async function handleDetail(db, event, uid) {
  const { postId } = event;
  if (!postId) return { ok: false, error: 'missing_postId' };

  const res = await db.collection('community_posts').doc(postId).get();
  if (!res.data || res.data.length === 0) {
    return { ok: false, error: 'not_found', message: '帖子不存在' };
  }
  const post = res.data[0];
  if (post.is_hidden === true) {
    return { ok: false, error: 'not_found', message: '帖子不存在' };
  }

  // 评论（含一级评论和二级回复，客户端按 parent_id 组装）
  const commentsRes = await db.collection('post_comments')
    .where({ post_id: postId, is_deleted: false })
    .orderBy('created_at', 'asc')
    .limit(50)
    .get()

  let isLiked = false;
  if (uid) {
    const likeRes = await db.collection('post_likes')
      .where({ post_id: postId, user_id: uid })
      .count();
    isLiked = likeRes.total > 0;
  }

  return { ok: true, data: { ...post, isLiked, comments: commentsRes.data } };
}

// ===== 发布帖子 =====
async function handlePublish(db, event, uid) {
  if (!uid) return { ok: false, error: 'not_logged_in', message: '请先登录或重新登录后再发布' };
  const { title, content, images, cover, address, location, noteId } = event;
  const safeContent = String(content || '').trim();
  if (!safeContent) return { ok: false, error: 'missing_content', message: '内容为空，无法发布' };
  if (safeContent.length > 10000) return { ok: false, error: 'content_too_long', message: '正文不能超过 10000 字' };
  const safeImages = Array.isArray(images) ? images.filter(x => typeof x === 'string' && x.trim()).slice(0, 9) : [];

  const res = await db.collection('community_posts').add({
    user_id: uid,
    note_id: noteId || '',
    title: String(title || '').trim().slice(0, 100),
    content: safeContent,
    images: safeImages,
    cover: typeof cover === 'string' ? cover : '',
    address: String(address || '').trim().slice(0, 200),
    location: location && typeof location === 'object' && !Array.isArray(location) ? location : {},
    like_count: 0,
    comment_count: 0,
    is_hidden: false,
    created_at: new Date(),
    updated_at: new Date()
  });
  return { ok: true, data: { id: res.id } };
}

// ===== 点赞（幂等）=====
async function handleLike(db, event, uid) {
  if (!uid) return { ok: false, error: 'not_logged_in' };
  const { postId } = event;
  if (!postId) return { ok: false, error: 'missing_postId' };
  const post = await getVisiblePost(db, postId);
  if (!post) return { ok: false, error: 'not_found', message: '帖子不存在' };

  const existing = await db.collection('post_likes')
    .where({ post_id: postId, user_id: uid }).count();

  if (existing.total > 0) {
    return { ok: true, message: '已点赞', alreadyLiked: true };
  }

  await db.collection('post_likes').add({ post_id: postId, user_id: uid, created_at: new Date() });
  await db.collection('community_posts').doc(postId).update({
    like_count: db.command.inc(1)
  });
  return { ok: true, liked: true };
}

// ===== 取消点赞 =====
async function handleUnlike(db, event, uid) {
  if (!uid) return { ok: false, error: 'not_logged_in' };
  const { postId } = event;
  if (!postId) return { ok: false, error: 'missing_postId' };

  const res = await db.collection('post_likes')
    .where({ post_id: postId, user_id: uid }).get();

  if (res.data.length === 0) {
    return { ok: true, message: '未点赞', alreadyUnliked: true };
  }

  await db.collection('post_likes').doc(res.data[0]._id).remove();
  const postRes = await db.collection('community_posts').doc(postId).get();
  const post = postRes.data && postRes.data[0];
  if (post && Number(post.like_count) > 0) {
    await db.collection('community_posts').doc(postId).update({ like_count: db.command.inc(-1) });
  }
  return { ok: true, liked: false };
}

// ===== 评论 =====
async function handleComment(db, event, uid) {
  if (!uid) return { ok: false, error: 'not_logged_in' };
  const { postId, content, parentId } = event;

  const post = await getVisiblePost(db, postId);
  if (!post) return { ok: false, error: 'not_found', message: '帖子不存在' };

  const safeContent = String(content || '').trim();

  if (!safeContent) {
    return { ok: false, error: 'empty_content', message: '评论内容不能为空' };
  }
  if (safeContent.length > 200) {
    return { ok: false, error: 'content_too_long', message: '评论不能超过 200 字' };
  }

  // 层级限制：最多 2 层
  if (parentId) {
    const parent = await db.collection('post_comments').doc(parentId).get();
    if (!parent.data || parent.data.length === 0 || parent.data[0].is_deleted || parent.data[0].post_id !== postId) {
      return { ok: false, error: 'invalid_parent', message: '回复的评论不存在' };
    }
    if (parent.data[0].parent_id) {
      return { ok: false, error: 'max_depth', message: '回复层级最多 2 层' };
    }
  }

  const res = await db.collection('post_comments').add({
    post_id: postId,
    user_id: uid,
    content: safeContent,
    parent_id: parentId || null,
    is_deleted: false,
    created_at: new Date()
  });

  await db.collection('community_posts').doc(postId).update({
    comment_count: db.command.inc(1)
  });

  return { ok: true, data: { id: res.id } };
}

// ===== 软删除评论 =====
async function handleDeleteComment(db, event, uid) {
  if (!uid) return { ok: false, error: 'not_logged_in' };
  const { commentId } = event;
  if (!commentId) return { ok: false, error: 'missing_commentId' };

  const res = await db.collection('post_comments').doc(commentId).get();
  if (!res.data || res.data.length === 0) {
    return { ok: false, error: 'not_found' };
  }
  if (res.data[0].user_id !== uid) {
    return { ok: false, error: 'forbidden', message: '只能删除自己的评论' };
  }

  if (res.data[0].is_deleted) return { ok: true, alreadyDeleted: true };

  await db.collection('post_comments').doc(commentId).update({ is_deleted: true });
  const postRes = await db.collection('community_posts').doc(res.data[0].post_id).get();
  const post = postRes.data && postRes.data[0];
  if (post && Number(post.comment_count) > 0) {
    await db.collection('community_posts').doc(res.data[0].post_id).update({
      comment_count: db.command.inc(-1)
    });
  }
  return { ok: true };
}

// ===== 收藏 =====
async function handleFavorite(db, event, uid, targetType) {
  if (!uid) return { ok: false, error: 'not_logged_in' };
  if (!['post', 'spot'].includes(targetType)) return { ok: false, error: 'invalid_target_type' };
  const targetId = event.targetId || event.postId || event.spotId;
  if (!targetId) return { ok: false, error: 'missing_targetId' };

  const existing = await db.collection('user_favorites')
    .where({ user_id: uid, target_type: targetType, target_id: targetId }).count();

  if (existing.total > 0) {
    return { ok: true, message: '已收藏', alreadyFavorited: true };
  }

  await db.collection('user_favorites').add({
    user_id: uid, target_type: targetType, target_id: targetId, created_at: new Date()
  });
  return { ok: true, favorited: true };
}

// ===== 取消收藏 =====
async function handleUnfavorite(db, event, uid, targetType) {
  if (!uid) return { ok: false, error: 'not_logged_in' };
  if (!['post', 'spot'].includes(targetType)) return { ok: false, error: 'invalid_target_type' };
  const targetId = event.targetId || event.postId || event.spotId;
  if (!targetId) return { ok: false, error: 'missing_targetId' };

  const res = await db.collection('user_favorites')
    .where({ user_id: uid, target_type: targetType, target_id: targetId }).get();

  if (res.data.length === 0) {
    return { ok: true, message: '未收藏' };
  }

  await db.collection('user_favorites').doc(res.data[0]._id).remove();
  return { ok: true, favorited: false };
}

// ===== 获取帖子评论列表 =====
async function handleListComments(db, event, uid) {
  const { postId } = event;
  if (!postId) return { ok: false, error: 'missing_postId' };

  const res = await db.collection('post_comments')
    .where({ post_id: postId, is_deleted: false })
    .orderBy('created_at', 'asc')
    .limit(100)
    .get();

  return { ok: true, data: res.data };
}

// ===== 检查是否已收藏 =====
async function handleCheckFavorite(db, event, uid) {
  if (!uid) return { ok: true, isFavorited: false };
  const { targetType = 'post' } = event;
  const id = event.targetId || event.postId || event.spotId;
  if (!id) return { ok: false, error: 'missing_targetId' };

  const res = await db.collection('user_favorites')
    .where({ user_id: uid, target_type: targetType, target_id: id })
    .count();

  return { ok: true, isFavorited: res.total > 0 };
}

// ===== 按景点查询关联游记 =====
async function handleListBySpot(db, event, uid) {
  const { spotId, limit = 10 } = event;
  if (!spotId) return { ok: false, error: 'missing_spotId' };

  // 先查景点名称
  const spotRes = await db.collection('spots').doc(spotId).get();
  if (!spotRes.data || spotRes.data.length === 0) {
    return { ok: true, data: [] };
  }
  const spotName = spotRes.data[0].name || '';

  const res = await db.collection('community_posts')
    .where({ is_hidden: db.command.neq(true), address: spotName })
    .orderBy('like_count', 'desc')
    .limit(toPositiveInt(limit, 10, 20))
    .get();

  return { ok: true, data: res.data };
}
