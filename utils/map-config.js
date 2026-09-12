const BAIDU_MAP_AK_KEY = 'baidu_map_ak'

export function getBaiduMapAK() {
  try {
    return String(uni.getStorageSync(BAIDU_MAP_AK_KEY) || '').trim()
  } catch (e) {
    return ''
  }
}

export function saveBaiduMapAK(value) {
  try {
    const ak = String(value || '').trim()
    if (ak) uni.setStorageSync(BAIDU_MAP_AK_KEY, ak)
    else uni.removeStorageSync(BAIDU_MAP_AK_KEY)
    return true
  } catch (e) {
    return false
  }
}
