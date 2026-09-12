/**
 * 本地景点兜底数据（云端无数据或搜索失败时使用）
 * 共 56 条：经典 6 条 + 补充 50 条热门目的地
 */
const EXTRA_RAW = [
  ['苏州拙政园', '江南古典园林代表，亭台水榭精巧雅致。', 31.324, 120.632, 798],
  ['南京夫子庙', '秦淮河畔文化街区，夜景与小吃闻名。', 32.018, 118.793, 765],
  ['重庆洪崖洞', '吊脚楼风格夜景地标，嘉陵江畔打卡热点。', 29.562, 106.577, 812],
  ['武汉黄鹤楼', '长江畔千古名楼，城市文化符号。', 30.545, 114.305, 688],
  ['长沙橘子洲', '湘江中的狭长洲岛，青年毛泽东雕像所在地。', 28.197, 112.963, 702],
  ['厦门鼓浪屿', '万国建筑与钢琴之岛，世界文化遗产。', 24.447, 118.067, 889],
  ['青岛栈桥', '百年海滨栈桥，红瓦绿树碧海蓝天的起点。', 36.061, 120.317, 756],
  ['天津古文化街', '津门故里民俗与手工艺集中展示街区。', 39.142, 117.198, 598],
  ['哈尔滨中央大街', '欧风面包石长街，冰雪季氛围浓厚。', 45.759, 126.629, 721],
  ['沈阳故宫', '清代入关前皇宫，满族宫廷建筑遗存。', 41.796, 123.454, 612],
  ['大连星海广场', '滨海城市广场与海景步道，适合散步观海。', 38.876, 121.583, 645],
  ['济南趵突泉', '泉城三大名泉之首，园林泉水景观。', 36.661, 117.019, 566],
  ['泰山', '五岳之首，日出与摩崖石刻闻名。', 36.254, 117.101, 834],
  ['黄山', '奇松怪石云海温泉，世界自然与文化双遗产。', 30.137, 118.167, 901],
  ['庐山', '避暑胜地，云雾与别墅群人文景观交融。', 29.593, 115.988, 778],
  ['张家界国家森林公园', '石英砂岩峰林地貌，阿凡达取景灵感来源地之一。', 29.325, 110.479, 867],
  ['九寨沟', '彩色海子与瀑布群，高原喀斯特水景奇观。', 33.260, 103.918, 892],
  ['桂林漓江', '喀斯特山水画廊，竹筏与倒影经典体验。', 25.214, 110.299, 915],
  ['阳朔西街', '中西合璧小镇街巷，骑行遇龙河起点。', 24.778, 110.497, 798],
  ['丽江古城', '纳西族古城世界文化遗产，小桥流水人家。', 26.872, 100.230, 876],
  ['大理洱海', '高原湖泊与苍山雪线，环湖骑行与双廊小镇。', 25.607, 100.267, 854],
  ['香格里拉普达措', '高原湖泊草甸森林，滇西北生态名片。', 27.831, 99.966, 712],
  ['西双版纳热带植物园', '热带雨林植物科研与观光园区。', 21.918, 101.258, 689],
  ['敦煌莫高窟', '丝路佛教艺术宝库，壁画与塑像举世闻名。', 40.042, 94.809, 823],
  ['鸣沙山月牙泉', '沙山环抱一泓清泉，沙漠奇观。', 40.088, 94.673, 801],
  ['青海湖', '中国最大咸水湖，环湖骑行与油菜花季。', 36.896, 100.151, 756],
  ['茶卡盐湖', '天空之镜盐湖景观，摄影热门地。', 36.755, 99.086, 734],
  ['布达拉宫', '拉萨高原宫堡式建筑群，藏文化象征。', 29.655, 91.119, 889],
  ['大昭寺', '藏传佛教圣地，八廓街转经道中心。', 29.652, 91.132, 765],
  ['都江堰', '两千余年仍在发挥作用的古代水利工程。', 31.003, 103.619, 712],
  ['峨眉山', '佛教名山，金顶云海与猴群生态。', 29.525, 103.336, 778],
  ['乐山大佛', '临江摩崖石刻弥勒大佛，世界文化遗产。', 29.544, 103.773, 801],
  ['乌镇', '江南水乡古镇代表，东栅西栅夜游出色。', 30.748, 120.489, 812],
  ['西塘古镇', '廊棚烟雨长廊，江南生活气息浓郁。', 30.946, 120.896, 756],
  ['周庄古镇', '中国第一水乡，双桥与沈厅张厅。', 31.117, 120.845, 734],
  ['南浔古镇', '丝商豪宅与小莲庄园林，江南富镇遗存。', 30.868, 120.418, 623],
  ['宏村', '徽派村落月沼南湖，中国画里乡村。', 30.004, 117.987, 701],
  ['西递', '徽州明清民居建筑群，石雕木雕精美。', 29.904, 117.994, 589],
  ['三清山', '道教名山，花岗岩峰林与栈道奇观。', 28.918, 118.066, 667],
  ['武夷山', '丹霞地貌与岩茶产区，九曲溪漂流。', 27.756, 118.035, 723],
  ['雁荡山', '浙东名山，奇峰飞瀑与古刹。', 28.369, 121.060, 598],
  ['普陀山', '观音道场，海岛佛寺与沙滩。', 29.985, 122.385, 712],
  ['千岛湖', '新安江水库千岛景观，骑行与游船。', 29.608, 119.034, 756],
  ['莫干山', '竹海民宿与避暑别墅，长三角周末度假地。', 30.601, 119.825, 689],
  ['珠海长隆海洋王国', '大型海洋主题乐园与鲸鲨馆。', 22.101, 113.541, 723],
  ['深圳世界之窗', '微缩世界地标主题公园。', 22.540, 113.988, 612],
  ['香港维多利亚港', '维港夜景与星光大道，城市天际线。', 22.293, 114.172, 889],
  ['澳门大三巴牌坊', '圣保禄教堂遗址，中西文化交汇地标。', 22.197, 113.544, 834],
  ['台北故宫博物院', '华夏文物珍藏，翠玉白菜与书画闻名。', 25.102, 121.548, 756],
  ['呼伦贝尔大草原', '夏季草场与蒙古包体验，星空银河。', 49.215, 119.765, 801]
]

function buildExtraSpots() {
  return EXTRA_RAW.map((row, i) => ({
    _id: 'local-extra-' + i,
    name: row[0],
    description: row[1],
    cover: '',
    open_hours: '以景区公告为准',
    ticket_price: 0,
    checkin_count: row[4],
    latitude: row[2],
    longitude: row[3]
  }))
}

const LOCAL_SPOTS = [
  {
    _id: 'local-bj-gugong',
    name: '北京故宫',
    description: '明清两代皇宫，建筑群壮观，文化底蕴深厚。',
    cover: '',
    open_hours: '08:30-17:00',
    ticket_price: 60,
    checkin_count: 1280,
    latitude: 39.9163,
    longitude: 116.3972
  },
  {
    _id: 'local-sh-waitan',
    name: '上海外滩',
    description: '黄浦江畔地标景观带，适合步行观景与夜景拍照。',
    cover: '',
    open_hours: '全天开放',
    ticket_price: 0,
    checkin_count: 1160,
    latitude: 31.24,
    longitude: 121.49
  },
  {
    _id: 'local-gz-ta',
    name: '广州塔',
    description: '广州城市地标，高空观景体验丰富，夜景亮眼。',
    cover: '',
    open_hours: '09:30-22:30',
    ticket_price: 150,
    checkin_count: 980,
    latitude: 23.1085,
    longitude: 113.319
  },
  {
    _id: 'local-cd-kuanzhai',
    name: '成都宽窄巷子',
    description: '成都老街区代表，兼具美食、茶馆与慢生活氛围。',
    cover: '',
    open_hours: '全天开放',
    ticket_price: 0,
    checkin_count: 910,
    latitude: 30.6671,
    longitude: 104.0555
  },
  {
    _id: 'local-hz-xihu',
    name: '杭州西湖',
    description: '湖山相映的人文景区，四季景色各有特色。',
    cover: '',
    open_hours: '全天开放',
    ticket_price: 0,
    checkin_count: 1020,
    latitude: 30.2431,
    longitude: 120.15
  },
  {
    _id: 'local-xa-bingmayong',
    name: '西安兵马俑',
    description: '秦代大型陪葬坑遗址，历史价值高，参观体验强。',
    cover: '',
    open_hours: '08:30-18:00',
    ticket_price: 120,
    checkin_count: 860,
    latitude: 34.3849,
    longitude: 109.2732
  },
  ...buildExtraSpots()
]

function safeText(v) {
  try {
    return String(v || '')
      .trim()
      .toLowerCase()
  } catch (e) {
    console.error('safeText 函数错误:', e)
    return ''
  }
}

export function getLocalSpots() {
  return LOCAL_SPOTS.map(item => ({ ...item }))
}

export function getLocalSpotById(id) {
  if (!id) return null
  return LOCAL_SPOTS.find(item => item._id === id) || null
}

export function searchLocalSpots(keyword) {
  const kw = safeText(keyword)
  const spots = getLocalSpots()
  if (!kw) {
    return spots
      .slice()
      .sort((a, b) => (b.checkin_count || 0) - (a.checkin_count || 0))
      .slice(0, 24)
  }

  const directMatched = spots.filter(item => {
    const name = safeText(item.name)
    const desc = safeText(item.description)
    return name.includes(kw) || desc.includes(kw)
  })

  if (directMatched.length > 0) return directMatched

  const chars = Array.from(kw).filter(Boolean)
  const fuzzyMatched = spots.filter(item => {
    const text = `${safeText(item.name)} ${safeText(item.description)}`
    return chars.some(ch => text.includes(ch))
  })
  if (fuzzyMatched.length > 0) return fuzzyMatched

  return spots
    .sort((a, b) => (b.checkin_count || 0) - (a.checkin_count || 0))
    .slice(0, 24)
}

export function getLocalRankingData() {
  const spots = getLocalSpots().sort((a, b) => (b.checkin_count || 0) - (a.checkin_count || 0))
  return spots.map((spot, index) => ({
    rank: index + 1,
    spot_id: spot._id,
    spot_name: spot.name,
    cover: spot.cover || '',
    checkin_count: spot.checkin_count || 0,
    prev_rank: index < 3 ? index + 2 : index
  }))
}
