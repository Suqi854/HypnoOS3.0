const commonLocationsCn = [
  ['住所', '玩家或角色平时居住的地点'],
  ['学校', '通用学校或大学场景'],
  ['商业区', '商店、餐饮和娱乐场所集中区域'],
  ['医院', '通用医疗设施'],
  ['车站', '连接各区域的公共交通节点'],
].map(([name, description]) => ({ name, description }));

const commonLocationsJp = [
  ['自宅', 'プレイヤーまたは登場人物の住居'],
  ['学校', '中学校、高校、大学に適用できる一般的な学校'],
  ['商店街', '買い物、飲食、娯楽の地域'],
  ['病院', '一般的な医療施設'],
  ['駅', '各地域をつなぐ公共交通の拠点'],
].map(([name, description]) => ({ name, description }));

export const REGION_PACKS = Object.freeze({
  cn: {
    id: 'cn',
    label: '中国通用版',
    locale: 'zh-CN',
    dateFormat: 'YYYY年M月D日',
    defaultDate: '9月1日',
    weekdays: ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'],
    holidays: ['元旦', '春节', '清明节', '劳动节', '端午节', '中秋节', '国庆节'],
    defaultScheduleLabel: '上课前',
    currency: { code: 'CNY', label: '人民币', initial: 500 },
    timetable: ['第一节', '第二节', '第三节', '第四节', '第五节', '第六节'].map((period, index) => ({ period, subject: ['语文', '数学', '英语', '历史', '体育', '信息技术'][index], modified: false, customSubject: '' })),
    locations: commonLocationsCn,
  },
  jp: {
    id: 'jp',
    label: '日本通用版',
    locale: 'ja-JP',
    dateFormat: 'YYYY年M月D日',
    defaultDate: '4月8日',
    weekdays: ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日'],
    holidays: ['元日', '成人の日', '建国記念の日', '春分の日', '昭和の日', '憲法記念日', '文化の日'],
    defaultScheduleLabel: '始業前',
    currency: { code: 'JPY', label: '円', initial: 6000 },
    timetable: ['1限', '2限', '3限', '4限', '5限', '6限'].map((period, index) => ({ period, subject: ['国語', '数学', '英語', '世界史', '体育', '情報'][index], modified: false, customSubject: '' })),
    locations: commonLocationsJp,
  },
  custom: {
    id: 'custom',
    label: '完全自定义',
    locale: 'zh-CN',
    dateFormat: 'YYYY-M-D',
    defaultDate: '1月1日',
    weekdays: ['第1日', '第2日', '第3日', '第4日', '第5日', '第6日', '第7日'],
    holidays: [],
    defaultScheduleLabel: '自由时间',
    currency: { code: 'CUSTOM', label: '货币', initial: 0 },
    timetable: [],
    locations: [{ name: '未设定地点', description: '等待玩家配置' }],
  },
});

export function getRegionPack(id) {
  return REGION_PACKS[id] || REGION_PACKS.cn;
}
