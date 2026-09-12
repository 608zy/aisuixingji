/**
 * 客户端敏感词过滤工具
 */

// 基础敏感词列表（可扩展）
const SENSITIVE_WORDS = [
  '赌博', '博彩', '色情', '毒品', '诈骗', '传销', '违禁',
  '枪支', '爆炸物', '恐怖', '暴力', '自杀', '援交'
]

export class SensitiveFilter {
  /**
   * 检查文本是否包含敏感词
   * @param {string} text
   * @returns {boolean} true 表示命中敏感词
   */
  static contains(text) {
    if (!text || typeof text !== 'string') return false
    return SENSITIVE_WORDS.some(word => text.includes(word))
  }

  /**
   * 过滤帖子列表，移除命中敏感词的帖子
   * @param {Array} posts
   * @returns {Array}
   */
  static filterPosts(posts) {
    if (!Array.isArray(posts)) return []
    return posts.filter(post => {
      const text = [post.title, post.content, post.address].filter(Boolean).join(' ')
      return !this.contains(text)
    })
  }

  /**
   * 替换文本中的敏感词为 *
   * @param {string} text
   * @returns {string}
   */
  static mask(text) {
    if (!text || typeof text !== 'string') return text
    let result = text
    SENSITIVE_WORDS.forEach(word => {
      result = result.split(word).join('*'.repeat(word.length))
    })
    return result
  }
}
