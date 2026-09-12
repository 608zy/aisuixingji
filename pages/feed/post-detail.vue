<template>
  <view class="container" :style="themeVars">
    <view class="back-fab" @click="goBack">‹ 返回</view>
    <view v-if="loading" class="loading-wrap">
      <text class="loading-text">加载中...</text>
    </view>
    <view v-else-if="!post" class="empty-state">
      <text class="empty-text">帖子不存在</text>
    </view>
    <view v-else>
      <image v-if="post.cover" :src="post.cover" mode="aspectFill" class="cover" />
      <view class="content-wrap">
        <text class="title">{{post.title || post.address}}</text>
        <text class="meta">📍 {{post.address}}</text>
        <text class="author">👤 {{post.author_name || '匿名用户'}}</text>
        <text class="content">{{post.content}}</text>
        <!-- 互动栏 -->
        <view class="action-bar">
          <view class="action-item" @click="toggleLike">
            <text :class="['action-icon', post.isLiked ? 'liked' : '']">❤️</text>
            <text class="action-count">{{post.like_count || 0}}</text>
          </view>
          <view class="action-item" @click="toggleFavorite">
            <text :class="['action-icon', isFavorited ? 'favorited' : '']">⭐</text>
            <text class="action-count">收藏</text>
          </view>
          <view class="action-item" @click="focusComment">
            <text class="action-icon">💬</text>
            <text class="action-count">{{post.comment_count || 0}}</text>
          </view>
        </view>
      </view>

      <!-- 评论区 -->
      <view class="comment-section">
        <text class="section-title">评论</text>
        <view v-for="comment in comments" :key="comment._id" class="comment-item">
          <view class="comment-main">
            <text class="comment-author">{{comment.author_name || '匿名'}}</text>
            <text class="comment-content">{{comment.content}}</text>
            <view class="comment-footer">
              <text class="comment-time">{{formatTime(comment.created_at)}}</text>
              <text v-if="isOwner(comment)" class="delete-btn" @click="deleteComment(comment._id)">删除</text>
              <text v-if="!comment.parent_id" class="reply-btn" @click="setReplyTarget(comment)">回复</text>
            </view>
          </view>
          <!-- 二级回复 -->
          <view v-for="reply in comment.replies" :key="reply._id" class="reply-item">
            <text class="comment-author">{{reply.author_name || '匿名'}}</text>
            <text class="comment-content">{{reply.content}}</text>
            <view class="comment-footer">
              <text class="comment-time">{{formatTime(reply.created_at)}}</text>
              <text v-if="isOwner(reply)" class="delete-btn" @click="deleteComment(reply._id)">删除</text>
            </view>
          </view>
        </view>
        <view v-if="comments.length === 0" class="no-comment">
          <text>暂无评论，快来抢沙发</text>
        </view>
      </view>
    </view>

    <!-- 评论输入框 -->
    <view class="comment-input-bar">
      <text v-if="replyTarget" class="reply-hint">回复 {{replyTarget.author_name || '匿名'}}：</text>
      <input
        v-model="commentText"
        class="comment-input"
        :placeholder="replyTarget ? '写下你的回复...' : '写下你的评论...'"
        :maxlength="200"
        @focus="inputFocused = true"
        @blur="inputFocused = false"
      />
      <text class="char-count">{{commentText.length}}/200</text>
      <button class="submit-btn" @click="submitComment">发送</button>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      postId: '',
      post: null,
      comments: [],
      loading: true,
      commentText: '',
      replyTarget: null,
      isFavorited: false,
      inputFocused: false
    }
  },
  computed: {
    currentUserId() {
      try {
        const info = uni.getStorageSync('uni_id_user_info') || {}
        return info._id || info.uid || ''
      } catch (e) { return '' }
    },
    isLoggedIn() {
      return !!uni.getStorageSync('uni_id_token')
    }
  },
  onLoad(query) {
    this.postId = query.id || ''
    this.loadPost()
    this.checkFavorite()
  },
  methods: {
    goBack() {
      uni.navigateBack({
        delta: 1,
        fail: () => {
          uni.reLaunch({ url: '/pages/feed/feed' })
        }
      })
    },
    async loadPost() {
      this.loading = true
      try {
        const res = await uniCloud.callFunction({
          name: 'community-post',
          data: {
            action: 'detail', postId: this.postId,
            uniIdToken: uni.getStorageSync('uni_id_token') || ''
          }
        })
        if (res.result && res.result.ok && res.result.data) {
          const p = res.result.data
          // detail action already returns comments
          if (p.comments) {
            const raw = p.comments
            const top = raw.filter(c => !c.is_deleted && !c.parent_id)
            top.forEach(c => {
              c.replies = raw.filter(r => !r.is_deleted && r.parent_id === c._id)
            })
            this.comments = top
            delete p.comments
          } else {
            // fallback: load comments separately
            this.loadComments()
          }
          this.post = p
        } else {
          throw new Error(res.result?.message || '帖子不存在')
        }
      } catch (e) {
        uni.showToast({ title: '加载失败', icon: 'none' })
      } finally {
        this.loading = false
      }
    },
    async loadComments() {
      try {
        const res = await uniCloud.callFunction({
          name: 'community-post',
          data: { action: 'listComments', postId: this.postId }
        })
        if (!res.result || !res.result.ok) throw new Error(res.result?.message || '加载评论失败')
        const raw = (res.result && res.result.data) || []
        // 过滤软删除，组织二级结构
        const top = raw.filter(c => !c.is_deleted && !c.parent_id)
        top.forEach(c => {
          c.replies = raw.filter(r => !r.is_deleted && r.parent_id === c._id)
        })
        this.comments = top
      } catch (e) {
        console.error('加载评论失败', e)
      }
    },
    async toggleLike() {
      if (!this.isLoggedIn) {
        uni.showToast({ title: '请先登录', icon: 'none' })
        return
      }
      if (!this.post) return
      // 乐观更新
      const wasLiked = this.post.isLiked
      this.post.isLiked = !wasLiked
      this.post.like_count = (this.post.like_count || 0) + (wasLiked ? -1 : 1)
      if (this.post.like_count < 0) this.post.like_count = 0

      // 更新本地缓存
      try {
        const likedIds = uni.getStorageSync('liked_post_ids') || []
        if (!wasLiked) {
          if (!likedIds.includes(this.postId)) likedIds.push(this.postId)
        } else {
          const idx = likedIds.indexOf(this.postId)
          if (idx > -1) likedIds.splice(idx, 1)
        }
        uni.setStorageSync('liked_post_ids', likedIds)
      } catch (e) {}

      try {
        const res = await uniCloud.callFunction({
          name: 'community-post',
          data: {
            action: wasLiked ? 'unlike' : 'like', postId: this.postId,
            uniIdToken: uni.getStorageSync('uni_id_token') || ''
          }
        })
        if (!res.result || !res.result.ok) throw new Error(res.result?.message || '操作失败')
      } catch (e) {
        // 回滚
        this.post.isLiked = wasLiked
        this.post.like_count = (this.post.like_count || 0) + (wasLiked ? 1 : -1)
        try {
          const likedIds = uni.getStorageSync('liked_post_ids') || []
          const idx = likedIds.indexOf(this.postId)
          if (wasLiked && idx === -1) likedIds.push(this.postId)
          if (!wasLiked && idx > -1) likedIds.splice(idx, 1)
          uni.setStorageSync('liked_post_ids', likedIds)
        } catch (storageError) {}
        uni.showToast({ title: '操作失败', icon: 'none' })
      }
    },
    async toggleFavorite() {
      if (!this.isLoggedIn) {
        uni.showToast({ title: '请先登录', icon: 'none' })
        return
      }
      const wasFav = this.isFavorited
      this.isFavorited = !wasFav
      try {
        const res = await uniCloud.callFunction({
          name: 'community-post',
          data: {
            action: wasFav ? 'unfavorite' : 'favorite', targetType: 'post', targetId: this.postId,
            uniIdToken: uni.getStorageSync('uni_id_token') || ''
          }
        })
        if (!res.result || !res.result.ok) throw new Error(res.result?.message || '操作失败')
        uni.showToast({ title: wasFav ? '已取消收藏' : '已收藏', icon: 'success' })
      } catch (e) {
        this.isFavorited = wasFav
        uni.showToast({ title: '操作失败', icon: 'none' })
      }
    },
    async checkFavorite() {
      if (!this.isLoggedIn) return
      try {
        const res = await uniCloud.callFunction({
          name: 'community-post',
          data: {
            action: 'checkFavorite', targetType: 'post', targetId: this.postId,
            uniIdToken: uni.getStorageSync('uni_id_token') || ''
          }
        })
        this.isFavorited = !!(res.result && res.result.isFavorited)
      } catch (e) {}
    },
    setReplyTarget(comment) {
      this.replyTarget = comment
    },
    focusComment() {
      this.replyTarget = null
    },
    async submitComment() {
      const text = this.commentText.trim()
      if (!text) {
        uni.showToast({ title: '评论不能为空', icon: 'none' })
        return
      }
      if (text.length > 200) {
        uni.showToast({ title: '评论不能超过200字', icon: 'none' })
        return
      }
      if (!this.isLoggedIn) {
        uni.showToast({ title: '请先登录', icon: 'none' })
        return
      }
      try {
        const res = await uniCloud.callFunction({
          name: 'community-post',
          data: {
            action: 'comment',
            postId: this.postId,
            content: text,
            parentId: this.replyTarget ? this.replyTarget._id : null,
            uniIdToken: uni.getStorageSync('uni_id_token') || ''
          }
        })
        if (!res.result || !res.result.ok) throw new Error(res.result?.message || '评论失败')
        this.commentText = ''
        this.replyTarget = null
        this.loadComments()
        if (this.post) this.post.comment_count = (this.post.comment_count || 0) + 1
        uni.showToast({ title: '评论成功', icon: 'success' })
      } catch (e) {
        uni.showToast({ title: '评论失败', icon: 'none' })
      }
    },
    async deleteComment(commentId) {
      try {
        const res = await uniCloud.callFunction({
          name: 'community-post',
          data: {
            action: 'deleteComment', commentId,
            uniIdToken: uni.getStorageSync('uni_id_token') || ''
          }
        })
        if (!res.result || !res.result.ok) throw new Error(res.result?.message || '删除失败')
        this.loadComments()
        if (this.post && this.post.comment_count > 0) this.post.comment_count--
        uni.showToast({ title: '已删除', icon: 'success' })
      } catch (e) {
        uni.showToast({ title: '删除失败', icon: 'none' })
      }
    },
    isOwner(comment) {
      return this.currentUserId && comment.user_id === this.currentUserId
    },
    formatTime(ts) {
      if (!ts) return ''
      const d = new Date(ts)
      return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: var(--theme-background, #f6f7fb);
  padding-bottom: 140rpx;
}
.back-fab{
  position: fixed;
  left: 24rpx;
  top: calc(24rpx + env(safe-area-inset-top));
  z-index: 10;
  padding: 14rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.92);
  border: 1rpx solid rgba(17, 24, 39, 0.10);
  box-shadow: 0 10rpx 24rpx rgba(17, 24, 39, 0.10);
  font-size: 26rpx;
  color: #111827;
}
.loading-wrap, .empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 400rpx;
}
.loading-text, .empty-text {
  font-size: 28rpx;
  color: #9ca3af;
}
.cover {
  width: 100%;
  height: 480rpx;
}
.content-wrap {
  padding: 30rpx;
  background: var(--theme-card-bg, #fff);
}
.title {
  font-size: 36rpx;
  font-weight: 800;
  color: var(--theme-text-primary, #111827);
  display: block;
  margin-bottom: 12rpx;
}
.meta, .author {
  font-size: 24rpx;
  color: var(--theme-text-secondary, #6b7280);
  display: block;
  margin-bottom: 8rpx;
}
.content {
  font-size: 30rpx;
  line-height: 1.8;
  color: var(--theme-text-primary, #111827);
  display: block;
  margin-top: 20rpx;
  white-space: pre-wrap;
}
.action-bar {
  display: flex;
  gap: 40rpx;
  margin-top: 30rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid #f3f4f6;
}
.action-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.action-icon { font-size: 36rpx; }
.action-icon.liked { color: #ef4444; }
.action-icon.favorited { color: #f59e0b; }
.action-count { font-size: 26rpx; color: var(--theme-text-secondary, #6b7280); }
.comment-section {
  padding: 30rpx;
  margin-top: 16rpx;
  background: var(--theme-card-bg, #fff);
}
.section-title {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--theme-text-primary, #111827);
  display: block;
  margin-bottom: 24rpx;
}
.comment-item {
  margin-bottom: 24rpx;
  padding-bottom: 24rpx;
  border-bottom: 1rpx solid #f3f4f6;
}
.comment-main { margin-bottom: 12rpx; }
.reply-item {
  margin-left: 40rpx;
  margin-top: 12rpx;
  padding: 12rpx;
  background: #f9fafb;
  border-radius: 8rpx;
}
.comment-author {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--theme-text-primary, #111827);
  display: block;
  margin-bottom: 6rpx;
}
.comment-content {
  font-size: 28rpx;
  color: var(--theme-text-primary, #111827);
  display: block;
  line-height: 1.6;
}
.comment-footer {
  display: flex;
  gap: 20rpx;
  margin-top: 8rpx;
}
.comment-time { font-size: 22rpx; color: #9ca3af; }
.delete-btn, .reply-btn { font-size: 22rpx; color: #007aff; }
.no-comment {
  text-align: center;
  padding: 40rpx;
  font-size: 26rpx;
  color: #9ca3af;
}
.comment-input-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
  background: var(--theme-card-bg, #fff);
  border-top: 1rpx solid #f3f4f6;
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.reply-hint {
  font-size: 22rpx;
  color: #007aff;
  white-space: nowrap;
}
.comment-input {
  flex: 1;
  height: 72rpx;
  background: #f3f4f6;
  border-radius: 36rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
}
.char-count {
  font-size: 22rpx;
  color: #9ca3af;
  white-space: nowrap;
}
.submit-btn {
  height: 72rpx;
  line-height: 72rpx;
  padding: 0 28rpx;
  background: var(--theme-primary-color, #007aff);
  color: #fff;
  border-radius: 36rpx;
  font-size: 28rpx;
  border: none;
}
</style>
