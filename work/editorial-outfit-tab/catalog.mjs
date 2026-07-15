export const channels = ['精选', '通勤', '约会', '周末', '显高'];

const product = (storyId, number, category, title, spec, priceFen, status = 'available') => ({
  id: `${storyId}-p${number}`,
  category,
  title,
  spec,
  priceFen,
  image: `./assets/${storyId}-product-${number}.jpg`,
  status,
});

const story = (id, storyChannels, title, intro, tips, topics, products) => ({
  id,
  channels: storyChannels,
  title,
  editorialLabel: '编辑精选',
  savedCountLabel: '灵感收藏',
  image: `./assets/${id}-cover.jpg`,
  gallery: [`./assets/${id}-01.jpg`, `./assets/${id}-02.jpg`],
  intro,
  tips,
  topics,
  priceNote: '价格仅为原型演示参考',
  products,
});

export const stories = [
  story('city-trench', ['精选', '通勤'], '一件风衣的三种城市穿法', '从清晨通勤到傍晚散步，用轻薄层次连接一天的不同场景。', ['内搭保持同色系', '裤脚留出利落线条', '用小包收束比例'], ['城市通勤', '轻层次'], [
    product('city-trench', 1, '外套', '轻量长风衣', '燕麦色 M', 69900),
    product('city-trench', 2, '下装', '直筒长裤', '深灰 M', 32900),
    product('city-trench', 3, '鞋', '方头便鞋', '黑色 38', 45900, 'sold-out'),
  ]),
  story('blue-shirt', ['精选', '通勤', '显高'], '蓝衬衫与高腰线的清爽组合', '用明确的腰线和松紧对比，整理日常衬衫的穿着节奏。', ['前摆轻收进腰头', '袖口卷至手腕上方'], ['清爽通勤', '比例灵感'], [
    product('blue-shirt', 1, '上装', '宽松棉质衬衫', '雾蓝 M', 26900),
    product('blue-shirt', 2, '下装', '高腰阔腿裤', '米白 M', 35900),
  ]),
  story('soft-dinner', ['精选', '约会'], '柔和晚餐色调穿搭', '低饱和色彩让针织与长裙自然衔接，适合从日落到晚餐的场景。', ['上短下长保持轻盈', '饰品选择哑光质感'], ['晚餐约会', '柔和配色'], [
    product('soft-dinner', 1, '上装', '细针织开衫', '浅杏 S', 29900),
    product('soft-dinner', 2, '下装', '垂感长裙', '灰粉 S', 39900),
  ]),
  story('park-denim', ['精选', '周末'], '周末公园里的牛仔层次', '耐看的牛仔与棉质单品，适合步行和短暂停留。', ['深浅牛仔错开', '内搭露出少量白色'], ['周末散步', '牛仔层次'], [
    product('park-denim', 1, '外套', '短款牛仔夹克', '水洗蓝 M', 42900),
    product('park-denim', 2, '上装', '基础圆领衫', '白色 M', 12900),
  ]),
  story('long-line', ['精选', '显高'], '长线条外套的比例练习', '纵向开襟和接近的内搭色彩，让整体轮廓更连贯。', ['外套敞开形成纵线', '鞋裤选择相近颜色'], ['长线条', '日常比例'], [
    product('long-line', 1, '外套', '直线型长外套', '炭灰 M', 75900),
    product('long-line', 2, '下装', '窄直筒长裤', '深灰 M', 34900),
  ]),
  story('linen-morning', ['精选', '通勤'], '亚麻早晨的自然叠穿', '柔软肌理与简洁剪裁组合，为温暖天气保留呼吸感。', ['领口保持简洁', '包袋选择硬挺轮廓'], ['暖日通勤', '自然肌理'], [
    product('linen-morning', 1, '上装', '亚麻混纺衬衣', '米色 M', 31900),
    product('linen-morning', 2, '包', '小号托特包', '棕色', 38900),
  ]),
  story('gallery-black', ['精选', '约会'], '看展时的轻黑色组合', '不同材质的黑色单品彼此区分，让简洁造型保留细节。', ['用材质差异区分层次', '留出颈部轻盈空间'], ['看展约会', '轻黑色'], [
    product('gallery-black', 1, '上装', '薄纱拼接上衣', '黑色 S', 28900),
    product('gallery-black', 2, '下装', '微光半身裙', '黑色 S', 41900),
  ]),
  story('market-stripes', ['精选', '周末'], '条纹衫与市集帆布包', '轻松的条纹和宽松裤装，回应周末市集的步行节奏。', ['条纹作为唯一图案', '裤装保留活动余量'], ['周末市集', '轻松条纹'], [
    product('market-stripes', 1, '上装', '棉质条纹衫', '蓝白 M', 19900),
    product('market-stripes', 2, '包', '宽带帆布包', '原色', 15900),
  ]),
  story('short-jacket', ['精选', '显高'], '短外套与直筒裤的上下呼应', '短款轮廓和连续裤线形成清晰分区，适合日常借鉴。', ['外套下摆靠近腰线', '裤长覆盖部分鞋面'], ['短外套', '比例灵感'], [
    product('short-jacket', 1, '外套', '短款斜纹夹克', '卡其 M', 46900),
    product('short-jacket', 2, '下装', '高腰直筒裤', '咖色 M', 33900),
  ]),
  story('knit-coffee', ['精选', '通勤', '约会'], '针织背心的咖啡馆午后', '细针织叠在清爽衬衫之外，在室内外温差中保持舒适层次。', ['背心与裤装色彩呼应', '衬衫下摆自然露出'], ['咖啡馆', '针织叠穿'], [
    product('knit-coffee', 1, '上装', '细针织背心', '可可色 M', 22900),
    product('knit-coffee', 2, '上装', '宽松白衬衫', '白色 M', 25900),
  ]),
];

const feature = {
  type: 'feature',
  id: 'weekly-city-edit',
  title: '本周城市通勤灵感',
  image: './assets/weekly-city-edit.jpg',
};

export const feedEntriesByChannel = Object.fromEntries(channels.map((channel) => {
  const entries = stories
    .filter((item) => item.channels.includes(channel))
    .map((item) => ({ type: 'story', storyId: item.id }));
  if (channel === '精选') entries.splice(7, 0, feature);
  return [channel, entries];
}));
