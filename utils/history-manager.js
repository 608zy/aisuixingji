// 历史记录管理器
import { STORAGE_KEYS } from './constants.js'

/**
 * 历史记录管理器类
 * 负责管理游记的本地存储和云端同步
 */
export class HistoryManager {
  /**
   * 保存游记到本地存储
   * @param {Object} note - 游记对象
   * @param {string} note.content - 游记内容
   * @param {string} note.address - 地点信息
   * @param {string} note.cover - 封面图片 URL
   * @param {string} note.template - 使用的模板 ID
   * @returns {Promise<Object>} 保存后的游记对象（包含 ID 和时间戳）
   */
  static async saveToLocal(note) {
    try {
      console.log('[HistoryManager] 保存游记到本地');
      
      // 获取现有历史记录
      const history = this.getLocalHistory();
      
      // 创建新记录
      const newRecord = {
        id: Date.now().toString(),
        time: new Date().toLocaleString(),
        address: note.address || '未知地点',
        content: note.content || '',
        cover: note.cover || '',
        template: note.template || 'literary',
        synced: false, // 标记为未同步
        created_at: Date.now(),
        // 地图足迹：与首页定位一致（GCJ-02），缺失时地图无法正确「点亮」
        latitude: note.latitude != null && note.latitude !== '' ? Number(note.latitude) : undefined,
        longitude: note.longitude != null && note.longitude !== '' ? Number(note.longitude) : undefined
      };
      if (!Number.isFinite(newRecord.latitude)) delete newRecord.latitude;
      if (!Number.isFinite(newRecord.longitude)) delete newRecord.longitude;
      
      // 添加到历史记录开头
      history.unshift(newRecord);
      
      // 最多保存 100 条，超出时删除最旧记录（按 created_at 升序删除）
      let trimmedHistory = history;
      if (history.length > 100) {
        trimmedHistory = history
          .slice()
          .sort((a, b) => (a.created_at || 0) - (b.created_at || 0))
          .slice(history.length - 100)
          .sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
      }
      
      // 保存到本地存储
      uni.setStorageSync(STORAGE_KEYS.TRAVEL_HISTORY, trimmedHistory);
      
      console.log('[HistoryManager] 保存成功，记录 ID:', newRecord.id);
      
      return newRecord;
    } catch (error) {
      console.error('[HistoryManager] 保存到本地失败:', error);
      throw error;
    }
  }
  
  /**
   * 从本地获取历史记录
   * @returns {Array<Object>} 历史记录数组
   */
  static getLocalHistory() {
    try {
      const history = uni.getStorageSync(STORAGE_KEYS.TRAVEL_HISTORY);
      return Array.isArray(history) ? history : [];
    } catch (error) {
      console.error('[HistoryManager] 获取本地历史记录失败:', error);
      return [];
    }
  }
  
  /**
   * 清空本地历史记录
   * @returns {Promise<void>}
   */
  static async clearLocalHistory() {
    try {
      console.log('[HistoryManager] 清空本地历史记录');
      uni.removeStorageSync(STORAGE_KEYS.TRAVEL_HISTORY);
    } catch (error) {
      console.error('[HistoryManager] 清空本地历史记录失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取未同步的游记数量
   * @returns {number} 未同步的游记数量
   */
  static getUnsyncedCount() {
    const history = this.getLocalHistory();
    return history.filter(note => !note.synced).length;
  }
  
  /**
   * 标记游记为已同步
   * @param {string} noteId - 游记 ID
   * @returns {Promise<void>}
   */
  static async markAsSynced(noteId) {
    try {
      const history = this.getLocalHistory();
      const note = history.find(n => n.id === noteId);
      
      if (note) {
        note.synced = true;
        uni.setStorageSync(STORAGE_KEYS.TRAVEL_HISTORY, history);
        console.log('[HistoryManager] 标记为已同步:', noteId);
      }
    } catch (error) {
      console.error('[HistoryManager] 标记同步状态失败:', error);
      throw error;
    }
  }
  
  /**
   * 上传游记到云端
   * @param {Object} note - 游记对象
   * @returns {Promise<Object>} 云端返回的游记对象
   */
  static async syncToCloud(note) {
    try {
      console.log('[HistoryManager] 上传游记到云端');
      
      // 调用云函数上传
      const res = await uniCloud.callFunction({
        name: 'sync-notes',
        data: {
          action: 'upload',
          uniIdToken: uni.getStorageSync('uni_id_token') || '',
          notes: [note]
        }
      });
      
      if (res.result && res.result.ok) {
        console.log('[HistoryManager] 上传成功');
        
        // 标记为已同步
        await this.markAsSynced(note.id);
        
        return res.result.data;
      } else {
        throw new Error(res.result?.message || '上传失败');
      }
    } catch (error) {
      console.error('[HistoryManager] 上传到云端失败:', error);
      throw error;
    }
  }
  
  /**
   * 从云端拉取游记
   * @returns {Promise<Array<Object>>} 云端游记数组
   */
  static async fetchFromCloud() {
    try {
      console.log('[HistoryManager] 从云端拉取游记');
      
      // 调用云函数下载
      const res = await uniCloud.callFunction({
        name: 'sync-notes',
        data: {
          action: 'download',
          uniIdToken: uni.getStorageSync('uni_id_token') || ''
        }
      });
      
      if (res.result && res.result.ok) {
        console.log('[HistoryManager] 拉取成功，数量:', res.result.data.length);
        return res.result.data;
      } else {
        throw new Error(res.result?.message || '拉取失败');
      }
    } catch (error) {
      console.error('[HistoryManager] 从云端拉取失败:', error);
      throw error;
    }
  }
  
  /**
   * 合并本地和云端数据（以云端为准）
   * @param {Array<Object>} cloudNotes - 云端游记数组
   * @returns {Promise<Array<Object>>} 合并后的游记数组
   */
  static async mergeNotes(cloudNotes) {
    try {
      console.log('[HistoryManager] 合并本地和云端数据');
      
      const localNotes = this.getLocalHistory();
      
      // 创建云端游记 ID 集合
      const cloudNoteIds = new Set(cloudNotes.map(n => n.id));
      
      // 找出本地独有的游记（未同步的）
      const localOnlyNotes = localNotes.filter(n => !cloudNoteIds.has(n.id) && !n.synced);
      
      // 合并：云端数据 + 本地独有数据
      const mergedNotes = [...cloudNotes, ...localOnlyNotes];
      
      // 按创建时间降序排序
      mergedNotes.sort((a, b) => {
        const timeA = a.created_at || new Date(a.time).getTime();
        const timeB = b.created_at || new Date(b.time).getTime();
        return timeB - timeA;
      });
      
      // 保存到本地
      uni.setStorageSync(STORAGE_KEYS.TRAVEL_HISTORY, mergedNotes.slice(0, 100));
      
      console.log('[HistoryManager] 合并完成，总数:', mergedNotes.length);
      
      return mergedNotes;
    } catch (error) {
      console.error('[HistoryManager] 合并数据失败:', error);
      throw error;
    }
  }

  /**
   * 增量同步：仅上传 synced=false 的记录
   * @param {Function} onProgress - 进度回调 (done, total) => void
   * @returns {Promise<{success: number, failed: number}>}
   */
  static async incrementalSync(onProgress) {
    const history = this.getLocalHistory();
    const unsynced = history.filter(n => !n.synced);
    if (unsynced.length === 0) return { success: 0, failed: 0 };

    let success = 0;
    let failed = 0;

    for (let i = 0; i < unsynced.length; i++) {
      const note = unsynced[i];
      try {
        const res = await uniCloud.callFunction({
          name: 'incremental-sync',
          data: {
            note,
            uniIdToken: uni.getStorageSync('uni_id_token') || ''
          }
        });
        if (res.result && res.result.ok) {
          await this.markAsSynced(note.id);
          success++;
        } else {
          failed++;
        }
      } catch (e) {
        failed++;
        console.warn('[HistoryManager] 增量同步单条失败:', note.id, e.message);
      }
      if (typeof onProgress === 'function') {
        onProgress(success + failed, unsynced.length);
      }
    }

    console.log(`[HistoryManager] 增量同步完成: 成功 ${success}, 失败 ${failed}`);
    return { success, failed };
  }
}

/**
 * 快捷保存函数
 * @param {Object} note - 游记对象
 * @returns {Promise<Object>} 保存后的游记对象
 */
export async function saveNote(note) {
  return await HistoryManager.saveToLocal(note);
}

/**
 * 快捷获取历史记录函数
 * @returns {Array<Object>} 历史记录数组
 */
export function getHistory() {
  return HistoryManager.getLocalHistory();
}
