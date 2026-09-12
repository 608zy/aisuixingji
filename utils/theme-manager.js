/**
 * 主题皮肤管理器
 */

// 预定义主题
export const THEMES = {
  blue: {
    name: '科技蓝',
    primary: 'linear-gradient(135deg, #007aff, #4f46e5)',
    primaryColor: '#007aff',
    secondaryColor: '#4f46e5',
    background: '#f6f7fb',
    cardBg: '#ffffff',
    textPrimary: '#111827',
    textSecondary: '#6b7280'
  },
  purple: {
    name: '梦幻紫',
    primary: 'linear-gradient(135deg, #7c3aed, #a855f7)',
    primaryColor: '#7c3aed',
    secondaryColor: '#a855f7',
    background: '#faf5ff',
    cardBg: '#ffffff',
    textPrimary: '#111827',
    textSecondary: '#6b7280'
  },
  green: {
    name: '清新绿',
    primary: 'linear-gradient(135deg, #059669, #10b981)',
    primaryColor: '#059669',
    secondaryColor: '#10b981',
    background: '#ecfdf5',
    cardBg: '#ffffff',
    textPrimary: '#111827',
    textSecondary: '#6b7280'
  },
  orange: {
    name: '活力橙',
    primary: 'linear-gradient(135deg, #ea580c, #f97316)',
    primaryColor: '#ea580c',
    secondaryColor: '#f97316',
    background: '#fff7ed',
    cardBg: '#ffffff',
    textPrimary: '#111827',
    textSecondary: '#6b7280'
  },
  pink: {
    name: '浪漫粉',
    primary: 'linear-gradient(135deg, #db2777, #ec4899)',
    primaryColor: '#db2777',
    secondaryColor: '#ec4899',
    background: '#fdf2f8',
    cardBg: '#ffffff',
    textPrimary: '#111827',
    textSecondary: '#6b7280'
  },
  dark: {
    name: '深邃黑',
    primary: 'linear-gradient(135deg, #1f2937, #374151)',
    primaryColor: '#1f2937',
    secondaryColor: '#374151',
    background: '#111827',
    cardBg: '#1f2937',
    textPrimary: '#f9fafb',
    textSecondary: '#9ca3af'
  }
};

/**
 * 获取当前主题
 */
export function getCurrentTheme() {
  try {
    const themeKey = uni.getStorageSync('app_theme') || 'blue';
    return THEMES[themeKey] || THEMES.blue;
  } catch (e) {
    return THEMES.blue;
  }
}

/**
 * 设置主题
 */
export function setTheme(themeKey) {
  try {
    if (THEMES[themeKey]) {
      uni.setStorageSync('app_theme', themeKey);
      // 触发主题更新事件
      uni.$emit('themeChanged', THEMES[themeKey]);
      return true;
    }
    return false;
  } catch (e) {
    console.error('设置主题失败:', e);
    return false;
  }
}

/**
 * 获取所有主题列表
 */
export function getThemeList() {
  return Object.keys(THEMES).map(key => ({
    key: key,
    name: THEMES[key].name,
    primary: THEMES[key].primary,
    primaryColor: THEMES[key].primaryColor
  }));
}

export default {
  THEMES,
  getCurrentTheme,
  setTheme,
  getThemeList
};
